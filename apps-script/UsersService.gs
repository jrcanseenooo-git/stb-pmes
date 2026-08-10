/**
 * UsersService.gs — Updated with Firebase Auth integration
 * When a user is created → Firebase Auth account is also created
 * When activated/deactivated → Firebase account is enabled/disabled
 * When password is reset → Firebase password is updated
 */

const UsersService = (() => {
  const USER_EXTRA_COLUMNS = [
    'tempPassword', 'tempPasswordHash', 'mustChangePassword',
    'permissionGroups', 'permissions',
    'pendingActivation', 'requestedRole', 'selfRegistered',
    'firstName', 'middleName', 'lastName', 'suffix',
    'officeId', 'officeCode', 'officeName', 'systemScope', 'officeRole', 'centralRoles'
  ]

  // ── SELF-REGISTER (Google-authenticated user with no PMES account yet) ──
  // Identity (uid/email) is taken from the verified token, never the form.
  // Role is forced to Technical Staff and the account is created inactive + pending, so
  // a self-registering user can never grant themselves elevated access — an
  // admin reviews and sets the real role on approval.
  function selfRegister(body, user) {
    const sheet = _usersSheet()
    const email = String(user.email || '').trim().toLowerCase()
    if (!email) throw HttpError('No authenticated email found for registration.', 400)

    const existing = SpreadsheetService.getAllRows(sheet).find(r => {
      if (r.deleted === true || String(r.deleted).toLowerCase() === 'true') return false
      const uidMatch   = user.uid && String(r.uid || '').trim() === String(user.uid).trim()
      const emailMatch = String(r.email || '').trim().toLowerCase() === email
      return uidMatch || emailMatch
    })
    if (existing) throw HttpError('An account for this email already exists. Contact your administrator.', 409)

    const office = typeof OfficeRegistryService !== 'undefined'
      ? OfficeRegistryService.resolveRegistrationOffice(body)
      : {
        officeId: 'STB',
        officeCode: 'STB',
        officeName: 'Social Technology Bureau',
        systemScope: 'STB_FULL',
        officeRole: 'STB_PERSONNEL'
      }
    const now = new Date().toISOString()
    const id  = SpreadsheetService.generateId('USR-')
    const newUser = {
      id,
      uid:                user.uid   || '',
      email:              user.email || '',
      fullName:           body.fullName || user.name || '',
      firstName:          body.firstName  || '',
      middleName:         body.middleName || '',
      lastName:           body.lastName   || '',
      suffix:             body.suffix     || '',
      role:               'Technical Staff',                         // forced — admin sets real role on approval
      requestedRole:      body.role || '',                          // what the user asked for (hint only)
      positionLevel:      resolvePositionLevel(body.position || ''),
      divisionId:         body.divisionId   || '',
      divisionName:       body.division || body.divisionName || '',
      section:            body.section      || '',
      position:           body.position     || '',
      employeeNo:         body.employeeNo   || '',
      type:               body.type         || 'Regular',
      officeId:           office.officeId,
      officeCode:         office.officeCode,
      officeName:         office.officeName,
      systemScope:        office.systemScope,
      officeRole:         office.officeRole,
      centralRoles:       '',
      tempPassword:       '',
      tempPasswordHash:   '',
      mustChangePassword: false,                                    // Google-authenticated — no temp password
      active:             false,
      pendingActivation:  true,
      selfRegistered:     true,
      createdAt:          now,
      updatedAt:          now,
      lastLoginAt:        now
    }
    SpreadsheetService.appendRow(sheet, newUser)
    AuditService.log('SELF_REGISTER', 'Users', `Self-registration pending review: ${newUser.email}`, user)
    return { pending: true }
  }

  // ── DECLINE a pending registration (admin) ──
  function decline(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet = _usersSheet()
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('User not found', 404)
    requireUserAdministration_(profile, row)
    SpreadsheetService.updateRow(sheet, id, {
      deleted:           true,
      active:            false,
      pendingActivation: false,
      updatedAt:         new Date().toISOString()
    })
    AuditService.log('DECLINE_USER', 'Users', `Declined registration: ${row.email}`, user)
    return { declined: true }
  }

  // ── LIST users ──
  function list(params, user) {
    const sheet   = _usersSheet()
    let rows      = SpreadsheetService.getAllRows(sheet).filter(r => !r.deleted)
    const profile = AuthService.getProfile(user)

    // Scope by role — staff only see their division
    const canManageUsers = AuthService.hasPermission(profile, 'manage_users')
    const canManageOfficeUsers = hasOfficeUserAdministration_(profile)
    const canViewBureau = AuthService.hasPermission(profile, 'view_bureau_monitoring')
    if (canManageUsers) {
      // central user managers keep full scope
    } else if (canManageOfficeUsers) {
      rows = rows.filter(r => sameOffice_(r, profile))
    } else if (!canViewBureau) {
      rows = rows.filter(r => r.divisionId === profile.divisionId)
    }

    if (params.search) {
      const q = params.search.toLowerCase()
      rows = rows.filter(r =>
        (r.fullName  || '').toLowerCase().includes(q) ||
        (r.email     || '').toLowerCase().includes(q) ||
        (r.role      || '').toLowerCase().includes(q) ||
        (r.divisionName || '').toLowerCase().includes(q)
      )
    }

    if (params.divisionId) rows = rows.filter(r => r.divisionId === params.divisionId)
    if (params.role)       rows = rows.filter(r => r.role === params.role)

    return SpreadsheetService.paginate(rows.map(_safeUser), params.page, params.pageSize)
  }

  // ── GET single user ──
  function get(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet = _usersSheet()
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('User not found', 404)

    // Same scoping as list(): you can always read yourself; admins/bureau read
    // anyone; everyone else is limited to their own division. This closes the
    // IDOR where any authenticated user could enumerate every user record by id.
    const canManageUsers = AuthService.hasPermission(profile, 'manage_users')
    const canManageOfficeUsers = hasOfficeUserAdministration_(profile)
    const canViewBureau = AuthService.hasPermission(profile, 'view_bureau_monitoring')
    if (!canManageUsers &&
        !(canManageOfficeUsers && sameOffice_(row, profile)) &&
        !canViewBureau &&
        row.id !== profile.id &&
        row.divisionId !== profile.divisionId) {
      throw HttpError('Access denied to this user record', 403)
    }
    return _safeUser(row)
  }

  // ── CREATE user — also creates Firebase Auth account ──
  function create(body, user) {
    AuthService.requirePermission(user, 'manage_users')

    const sheet = _usersSheet()
    const now   = new Date().toISOString()
    const id    = SpreadsheetService.generateId('USR-')

    // 1. Create in Sheets first
    const newUser = {
      id,
      uid:                '',   // will be set after Firebase creation
      email:              body.email        || '',
      fullName:           body.fullName     || '',
      role:               body.role         || 'Technical Staff',
      permissionGroups:   _normaliseList(body.permissionGroups),
      permissions:        _normaliseList(body.permissions),
      positionLevel:      body.positionLevel || resolvePositionLevel(body.position || ''),
      divisionId:         body.divisionId   || '',
      divisionName:       body.division     || body.divisionName || '',
      section:            body.section      || '',
      position:           body.position     || '',
      employeeNo:         body.employeeNo   || '',
      type:               body.type         || 'Regular',
      officeId:           body.officeId     || 'STB',
      officeCode:         body.officeCode   || body.officeId || 'STB',
      officeName:         body.officeName   || 'Social Technology Bureau',
      systemScope:        body.systemScope  || 'STB_FULL',
      officeRole:         body.officeRole   || 'STB_PERSONNEL',
      centralRoles:       _normaliseList(body.centralRoles),
      tempPassword:       '',
      tempPasswordHash:   body.tempPassword ? _hashTempPassword(id, body.email, body.tempPassword) : '',
      mustChangePassword: true,
      active:             true,
      createdAt:          now,
      updatedAt:          now,
      lastLoginAt:        ''
    }

    SpreadsheetService.appendRow(sheet, newUser)

    // 2. Create Firebase Auth account (if email and tempPassword provided)
    let firebaseResult = null
    if (body.email && body.tempPassword) {
      try {
        firebaseResult = FirebaseAuthService.createUser(
          body.email,
          body.tempPassword,
          newUser.fullName
        )

        if (firebaseResult.success && firebaseResult.uid) {
          // 3. Update Sheets row with the Firebase UID
          SpreadsheetService.updateRow(sheet, newUser.id, {
            uid: firebaseResult.uid,
            updatedAt: now
          })
          newUser.uid = firebaseResult.uid
        }

        Logger.log('Firebase user creation result: ' + JSON.stringify(firebaseResult))
      } catch (fbErr) {
        // Don't fail the whole request if Firebase fails
        // The admin can manually create in Firebase Console
        Logger.log('⚠️ Firebase user creation failed (Sheets user still created): ' + fbErr.message)
        firebaseResult = { success: false, error: fbErr.message }
      }
    }

    AuditService.log('CREATE_USER', 'Users',
      `Created user: ${newUser.email} | Firebase: ${firebaseResult?.success ? '✅ ' + newUser.uid : '❌ ' + (firebaseResult?.error || 'skipped')}`,
      user
    )

    // Admin-created accounts are active immediately — there is no separate
    // approval step for activate() to catch, so this is the only place that
    // can push a directly-created office account into its office roster.
    // Without this, an account created here with officeId/systemScope set to a
    // participating office existed only in the central directory: it could log
    // in, but never appeared in that office's Personnel roster and was
    // invisible to rater-assignment generation for that office.
    let officePersonnelSync = { synced: false, skipped: true }
    if (shouldSyncOfficePersonnel_(newUser) && typeof OfficePersonnelService !== 'undefined') {
      officePersonnelSync = OfficePersonnelService.syncFromCentralUser(newUser, user)
    }

    return {
      ..._safeUser(newUser),
      tempPassword: body.tempPassword || '',
      firebaseCreated: firebaseResult?.success || false,
      firebaseError:   firebaseResult?.error   || null,
      officePersonnelSync
    }
  }

  // ── UPDATE user ──
  function update(id, body, user) {
    const profile = AuthService.getProfile(user)
    const canManageUsers = AuthService.hasPermission(profile, 'manage_users')
    const canManageOfficeUsers = hasOfficeUserAdministration_(profile)

    const sheet    = _usersSheet()
    const existing = SpreadsheetService.getRow(sheet, id)
    if (!existing) throw HttpError('User not found', 404)
    const updateBody = { ...body }
    const canEditOwn = id === profile.id
    const canEditOfficeUser = canManageOfficeUsers && sameOffice_(existing, profile)
    if (!canManageUsers && !canEditOfficeUser && !canEditOwn) {
      throw HttpError('Insufficient permissions', 403)
    }
    if (canEditOfficeUser && !canManageUsers) {
      stripOfficeAdminForbiddenFields_(updateBody)
    }
    if (canEditOwn && !canManageUsers && !canEditOfficeUser) {
      stripSelfForbiddenFields_(updateBody)
    }
    // Editing your own row while also holding office-admin permissions took
    // the canEditOfficeUser branch above (sameOffice_ trivially matches your
    // own row), not the canEditOwn branch — so stripOfficeAdminForbiddenFields_
    // ran instead of stripSelfForbiddenFields_ and deleted mustChangePassword
    // regardless of the allowlist fix there. That denylist exists to stop an
    // office admin forcing the flag on SOMEONE ELSE's account; it should never
    // have applied to clearing your own. Restoring it here, after whichever
    // strip ran, means the self-service password-change confirmation works for
    // every account tier — ordinary staff, office admin, or central admin —
    // without weakening what an office admin can do to any other user's row.
    if (canEditOwn && Object.prototype.hasOwnProperty.call(body, 'mustChangePassword')) {
      updateBody.mustChangePassword = body.mustChangePassword === true || body.mustChangePassword === 'true'
    }
    if (Object.prototype.hasOwnProperty.call(updateBody, 'permissionGroups')) {
      updateBody.permissionGroups = _normaliseList(updateBody.permissionGroups)
    }
    if (Object.prototype.hasOwnProperty.call(updateBody, 'permissions')) {
      updateBody.permissions = _normaliseList(updateBody.permissions)
    }
    if (Object.prototype.hasOwnProperty.call(updateBody, 'centralRoles')) {
      updateBody.centralRoles = _normaliseList(updateBody.centralRoles)
    }

    // A tempPassword in the update body means this is a password reset.
    // Previously this only ever changed what's displayed in the Sheet —
    // the real Firebase Auth credential was never touched, so the admin
    // would hand someone a "new" password that didn't actually work.
    // Do this FIRST and let it throw before touching the Sheet at all —
    // otherwise a failed Firebase update would still leave the Sheet
    // showing a password that was never actually set.
    if (body.tempPassword) {
      if (!existing.uid) {
        throw HttpError('No Firebase account linked to this user (uid is empty) — password was not changed.', 400)
      }
      try {
        FirebaseAuthService.updatePassword(existing.uid, body.tempPassword)
      } catch (e) {
        throw HttpError('Password change failed, nothing was updated: ' + e.message, 502)
      }
      updateBody.tempPassword = ''
      updateBody.tempPasswordHash = _hashTempPassword(id, existing.email, body.tempPassword)
      updateBody.mustChangePassword = true
    } else if (Object.prototype.hasOwnProperty.call(body, 'tempPassword')) {
      updateBody.tempPassword = ''
      updateBody.tempPasswordHash = ''
    }

    const updated = SpreadsheetService.updateRow(sheet, id, {
      ...updateBody,
      updatedAt: new Date().toISOString()
    })

    // Update Firebase display name if fullName changed
    if (body.fullName && updated.uid) {
      try {
        FirebaseAuthService.updateDisplayName(updated.uid, body.fullName)
      } catch (e) {
        Logger.log('Could not update Firebase display name: ' + e.message)
      }
    }

    // Re-sync to the office roster if this edit touches office-scoped fields
    // and the account is active — e.g. a corrected division/section, or an
    // account moved to a different participating office after creation.
    // Skipped for inactive/pending accounts: activate() performs the initial
    // sync when they are approved, and syncing an unapproved account would
    // put someone on an office roster before an administrator ever approved
    // them there.
    let officePersonnelSync = { synced: false, skipped: true }
    const touchesOfficeFields = ['officeId', 'officeCode', 'systemScope', 'divisionId', 'divisionName', 'section', 'position', 'role', 'fullName']
      .some(field => Object.prototype.hasOwnProperty.call(updateBody, field))
    if (touchesOfficeFields && updated.active !== false && String(updated.active).toLowerCase() !== 'false' &&
        shouldSyncOfficePersonnel_(updated) && typeof OfficePersonnelService !== 'undefined') {
      officePersonnelSync = OfficePersonnelService.syncFromCentralUser(updated, user)
    }

    AuditService.log('UPDATE_USER', 'Users', `Updated user: ${id}`, user)
    return { ...updated, officePersonnelSync }
  }

  // ── ACTIVATE user ──
  function activate(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = _usersSheet()
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('User not found', 404)
    requireUserAdministration_(profile, row)

    const approvedRow = {
      ...row,
      active:            true,
      pendingActivation: false,   // approving a self-registered account clears the pending flag
      updatedAt:         new Date().toISOString()
    }
    let officePersonnelSync = { synced: false, skipped: true }
    if (shouldSyncOfficePersonnel_(approvedRow) && typeof OfficePersonnelService !== 'undefined') {
      officePersonnelSync = OfficePersonnelService.syncFromCentralUser(approvedRow, user)
    }

    SpreadsheetService.updateRow(sheet, id, {
      active:            approvedRow.active,
      pendingActivation: approvedRow.pendingActivation,
      updatedAt:         approvedRow.updatedAt
    })

    // Enable in Firebase
    if (row.uid) {
      try {
        FirebaseAuthService.enableUser(row.uid)
      } catch (e) {
        Logger.log('Could not enable Firebase user: ' + e.message)
      }
    }

    AuditService.log('ACTIVATE_USER', 'Users', `Activated user: ${row.email}`, user)
    return { success: true, officePersonnelSync }
  }

  // ── DEACTIVATE user ──
  function deactivate(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet = _usersSheet()
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('User not found', 404)
    requireUserAdministration_(profile, row)

    SpreadsheetService.updateRow(sheet, id, {
      active:    false,
      updatedAt: new Date().toISOString()
    })

    // Disable in Firebase so they can't log in
    if (row.uid) {
      try {
        FirebaseAuthService.disableUser(row.uid)
      } catch (e) {
        Logger.log('Could not disable Firebase user: ' + e.message)
      }
    }

    AuditService.log('DEACTIVATE_USER', 'Users', `Deactivated user: ${row.email}`, user)
    return { success: true }
  }

  // ── RESET PASSWORD ──
  function resetPassword(id, body, user) {
    AuthService.requirePermission(user, 'manage_users')
    const sheet = _usersSheet()
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('User not found', 404)

    const newTempPassword = body.tempPassword || ''

    // Update Firebase password
    let firebaseResult = { success: false }
    if (row.uid && newTempPassword) {
      try {
        firebaseResult = FirebaseAuthService.updatePassword(row.uid, newTempPassword)
      } catch (e) {
        throw HttpError('Password change failed, nothing was updated: ' + e.message, 502)
      }
    } else if (!row.uid && newTempPassword) {
      // User has no Firebase account yet — try to create one
      try {
        const created = FirebaseAuthService.createUser(row.email, newTempPassword, row.fullName)
        if (created.success && created.uid) {
          SpreadsheetService.updateRow(sheet, id, { uid: created.uid, updatedAt: new Date().toISOString() })
          firebaseResult = created
        }
      } catch (e) {
        throw HttpError('Could not create Firebase user during reset: ' + e.message, 502)
      }
    }

    SpreadsheetService.updateRow(sheet, id, {
      tempPassword:       '',
      tempPasswordHash:   newTempPassword ? _hashTempPassword(id, row.email, newTempPassword) : '',
      mustChangePassword: true,
      updatedAt:          new Date().toISOString()
    })

    AuditService.log('RESET_PASSWORD', 'Users',
      `Reset password for: ${row.email} | Firebase: ${firebaseResult.success ? '✅' : '❌'}`,
      user
    )
    return {
      success:         true,
      firebaseUpdated: firebaseResult.success,
      tempPassword:    newTempPassword,
      note:            firebaseResult.success
        ? 'Password updated in Firebase Auth. PMES Database stores only the temporary password hash.'
        : 'Password updated in PMES Database. Firebase update failed — update manually in Firebase Console.'
    }
  }

  // ── Helper: resolve position level from position title ──
  function resolvePositionLevel(position) {
    const p = (position || '').toLowerCase()
    if (/\biv\b/.test(p)) return 'IV'
    if (/\bii\b/.test(p)) return 'II'
    return 'III'
  }

  // ── UPDATE own profile + sync DRAFT IPCRF forms ──
  function updateOwnProfile(id, body, user) {
    const profile = AuthService.getProfile(user)
    if (id !== profile.id) throw HttpError('Cannot update another user\'s profile', 403)

    const sheet   = _usersSheet()
    const updated = SpreadsheetService.updateRow(sheet, id, {
      fullName:   body.fullName   || '',
      position:   body.position   || '',
      employeeNo: body.employeeNo || '',
      updatedAt:  new Date().toISOString()
    })

    // Sync position to DRAFT IPCRF forms
    if (body.position) {
      try {
        const ipcrfSheet = SpreadsheetService.getSheet('IPCRForms')
        const forms      = SpreadsheetService.getAllRows(ipcrfSheet)
        forms.forEach(form => {
          if (form.userId === id && form.status === 'Draft') {
            SpreadsheetService.updateRow(ipcrfSheet, form.id, {
              position:      body.position,
              positionLevel: resolvePositionLevel(body.position),
              employeeName:  updated.fullName
            })
          }
        })
      } catch (e) {
        Logger.log('Could not sync IPCRF position: ' + e.message)
      }
    }

    AuditService.log('UPDATE_PROFILE', 'Users', `Updated own profile: ${id}`, user)
    return _safeUser(updated)
  }

  function _usersSheet() {
    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    _ensureColumns(sheet, USER_EXTRA_COLUMNS)
    // One-time migration of any legacy plaintext temp passwords. Gated by a
    // Script Property so this doesn't scan the whole Users sheet on every request.
    try {
      const props = PropertiesService.getScriptProperties()
      if (props.getProperty('TEMP_PW_MIGRATED') !== 'true') {
        _migratePlainTempPasswords(sheet)
        props.setProperty('TEMP_PW_MIGRATED', 'true')
      }
    } catch (e) {
      Logger.log('[Users] temp-password migration skipped: ' + e.message)
    }
    return sheet
  }

  function _ensureColumns(sheet, headers) {
    const lastCol = Math.max(sheet.getLastColumn(), 1)
    const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].filter(Boolean)
    const missing = headers.filter(h => !existing.includes(h))
    if (missing.length) {
      sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing])
    }
  }

  function _migratePlainTempPasswords(sheet) {
    const lastRow = sheet.getLastRow()
    if (lastRow < 2) return

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    const tempCol = headers.indexOf('tempPassword') + 1
    const hashCol = headers.indexOf('tempPasswordHash') + 1
    const idCol = headers.indexOf('id') + 1
    const emailCol = headers.indexOf('email') + 1
    if (!tempCol || !hashCol || !idCol || !emailCol) return

    const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues()
    values.forEach((row, index) => {
      const tempPassword = row[tempCol - 1]
      if (!tempPassword) return
      const id = row[idCol - 1]
      const email = row[emailCol - 1]
      const existingHash = row[hashCol - 1]
      const nextHash = existingHash || _hashTempPassword(id, email, tempPassword)
      const sheetRow = index + 2
      sheet.getRange(sheetRow, hashCol).setValue(nextHash)
      sheet.getRange(sheetRow, tempCol).setValue('')
    })
  }

  function _hashTempPassword(id, email, password) {
    const salt = `${id || ''}:${String(email || '').toLowerCase()}`
    const bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      `${salt}:${password}`,
      Utilities.Charset.UTF_8
    )
    const hex = bytes.map(b => {
      const value = b < 0 ? b + 256 : b
      return ('0' + value.toString(16)).slice(-2)
    }).join('')
    return `sha256$${hex}`
  }

  function _safeUser(row) {
    const { passwordHash, tempPassword, tempPasswordHash, ...safe } = row || {}
    return safe
  }

  function _normaliseList(value) {
    if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean).join(',')
    return String(value || '')
      .split(/[,|]/)
      .map(s => s.trim())
      .filter(Boolean)
      .join(',')
  }

  function shouldSyncOfficePersonnel_(row) {
    const officeId = String(row.officeId || row.officeCode || '').trim().toUpperCase()
    const scope = String(row.systemScope || '').trim().toUpperCase()
    return officeId && officeId !== 'STB' && ['CLUSTER_PORTAL', 'OFFICE_ADMIN'].indexOf(scope) >= 0
  }

  function hasOfficeUserAdministration_(profile) {
    return AuthService.hasPermission(profile, 'manage_office_users') ||
      String(profile.systemScope || '') === 'OFFICE_ADMIN' ||
      String(profile.officeRole || '') === 'OFFICE_ADMIN'
  }

  function sameOffice_(row, profile) {
    const rowOffice = String(row.officeId || row.officeCode || '').trim().toUpperCase()
    const profileOffice = String(profile.officeId || profile.officeCode || '').trim().toUpperCase()
    return !!rowOffice && !!profileOffice && rowOffice === profileOffice && rowOffice !== 'STB'
  }

  function requireUserAdministration_(profile, targetRow) {
    if (AuthService.hasPermission(profile, 'manage_users')) return profile
    if (hasOfficeUserAdministration_(profile) && sameOffice_(targetRow, profile)) return profile
    throw HttpError('Access denied. User approval permission required for this office.', 403)
  }

  function stripOfficeAdminForbiddenFields_(body) {
    if (String(body.role || '').trim() === 'System Administrator') {
      throw HttpError('Office administrators cannot assign System Administrator role.', 403)
    }
    [
      'id', 'uid', 'email', 'officeId', 'officeCode', 'officeName',
      'systemScope', 'officeRole', 'centralRoles',
      'permissionGroups', 'permissions',
      'tempPassword', 'tempPasswordHash', 'mustChangePassword',
      'active', 'pendingActivation', 'selfRegistered',
      'createdAt', 'lastLoginAt', 'deleted'
    ].forEach(key => delete body[key])
  }

  function stripSelfForbiddenFields_(body) {
    // mustChangePassword is a boolean UI flag, not a permission — letting a
    // user clear it on themselves is how PasswordChangePrompt.vue confirms a
    // completed password change. Without it here, that write was silently
    // dropped: the sheet kept mustChangePassword=true forever, so the prompt
    // reappeared on every profile refresh (a 60s timer, or a route change)
    // even though the user really had changed their password in Firebase.
    Object.keys(body).forEach(key => {
      if (['fullName', 'position', 'employeeNo', 'mustChangePassword'].indexOf(key) < 0) delete body[key]
    })
  }

  return { list, get, create, update, updateOwnProfile, activate, deactivate, resetPassword, selfRegister, decline }
})()
