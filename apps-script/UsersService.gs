/**
 * UsersService.gs - Updated with Firebase Auth integration
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

  // Built once per request. A user-list request may evaluate hundreds of
  // records, so resolving office aliases per row would turn a correctness fix
  // into a new performance problem.
  let _officeIdentityAliasMap = null

  // ── SELF-REGISTER (Google-authenticated user with no PMES account yet) ──
  // Identity (uid/email) is taken from the verified token, never the form.
  // Role is forced to Technical Staff and the account is created inactive + pending, so
  // a self-registering user can never grant themselves elevated access - an
  // admin reviews and sets the real role on approval.
  // Serialised: the "does an account already exist?" check below and the
  // append that follows must not interleave with another registration for the
  // same person, or a first login submitted twice creates two accounts.
  function selfRegister(body, user) {
    return withWriteLock(
      () => selfRegister_(body, user),
      'Registration is busy right now. Please try again in a moment.'
    )
  }

  function selfRegister_(body, user) {
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
      role:               'Technical Staff',                         // forced - admin sets real role on approval
      requestedRole:      typeof RoleLabelService !== 'undefined'
      ? RoleLabelService.storedRole(body.role || '')
        : (String(body.role || '').trim() === 'Staff' ? 'Technical Staff' : (body.role || '')), // what the user asked for (hint only)
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
      mustChangePassword: false,                                    // Google-authenticated - no temp password
      active:             false,
      pendingActivation:  true,
      selfRegistered:     true,
      createdAt:          now,
      updatedAt:          now,
      lastLoginAt:        now
    }
    SpreadsheetService.appendRow(sheet, newUser)
    AuthService.invalidateProfileCache(newUser)
    AuditService.log('SELF_REGISTER', 'Users', `Self-registration pending review: ${newUser.email}`, user)
    return { pending: true }
  }

  // ── DECLINE a pending registration (admin) ──
  function decline(id, user) {
    return withWriteLock(
      () => decline_(id, user),
      'User approval is busy right now. Please try again in a moment.'
    )
  }

  function decline_(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet = _usersSheet()
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('User not found', 404)
    requireUserAdministration_(profile, row)
    const isPending = row.pendingActivation === true || String(row.pendingActivation).toLowerCase() === 'true'
    const isDeleted = row.deleted === true || String(row.deleted).toLowerCase() === 'true'
    if (isDeleted || !isPending) {
      throw HttpError('Only a pending registration can be declined.', 409)
    }
    // A declined self-registration is not an inactive account. Remove its
    // PMES user record so the same Google identity can register again for the
    // correct office. The audit event below preserves an administrative trail.
    SpreadsheetService.hardDeleteRow(sheet, id)
    AuthService.invalidateProfileCache(row)
    AuditService.log('DECLINE_USER', 'Users', `Declined registration: ${row.email}`, user)
    return { declined: true, deletedId: id }
  }

  // ── LIST users ──
  function list(params, user) {
    const sheet   = _usersSheet()
    let rows      = SpreadsheetService.getAllRows(sheet).filter(r => !r.deleted)
    const profile = AuthService.getProfile(user)

    // Scope by role - staff only see their division
    const canManageUsers = AuthService.hasPermission(profile, 'manage_users')
    const canManageOfficeUsers = hasOfficeUserAdministration_(profile)
    // A bureau-monitoring permission belongs to a central/STB monitoring
    // account. Never let an office-assigned account use it as a fallback to
    // read an arbitrary central directory record.
    const canViewBureau = AuthService.hasPermission(profile, 'view_bureau_monitoring') && !isAssignedNonStbOffice_(profile)
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
    const canViewBureau = AuthService.hasPermission(profile, 'view_bureau_monitoring') && !isAssignedNonStbOffice_(profile)
    if (!canManageUsers &&
        !(canManageOfficeUsers && sameOffice_(row, profile)) &&
        !canViewBureau &&
        row.id !== profile.id &&
        row.divisionId !== profile.divisionId) {
      throw HttpError('Access denied to this user record', 403)
    }
    return _safeUser(row)
  }

  // ── CREATE user - also creates Firebase Auth account ──
  function create(body, user) {
    return withWriteLock(
      () => create_(body, user),
      'User administration is busy right now. Please try again in a moment.'
    )
  }

  function create_(body, user) {
    AuthService.requirePermission(user, 'manage_users')

    const sheet = _usersSheet()

    // A duplicate check was missing here entirely. selfRegister has always
    // refused an email that already holds an account, but the administrator
    // path did not: it appended the Users row first and only then called
    // Firebase, which is the only thing that would have objected - and its
    // EMAIL_EXISTS branch reports success. So creating the same person twice,
    // whether by a double-clicked Save or two administrators working the same
    // list, left two Users rows for one email. That is ambiguous everywhere
    // downstream, because getProfile resolves a signed-in account by matching
    // on exactly this field.
    const email = String(body.email || '').trim().toLowerCase()
    if (email) {
      const clash = SpreadsheetService.getAllRows(sheet).find(r => {
        if (r.deleted === true || String(r.deleted).toLowerCase() === 'true') return false
        return String(r.email || '').trim().toLowerCase() === email
      })
      if (clash) throw HttpError('An account for this email already exists.', 409)
    }

    const now   = new Date().toISOString()
    const id    = SpreadsheetService.generateId('USR-')

    // 1. Create in Sheets first
    const role = typeof RoleLabelService !== 'undefined'
      ? RoleLabelService.storedRole(body.role || 'Technical Staff')
      : (String(body.role || '').trim() === 'Staff' ? 'Technical Staff' : (body.role || 'Technical Staff'))
    const newUser = {
      id,
      uid:                '',   // will be set after Firebase creation
      email:              body.email        || '',
      fullName:           body.fullName     || '',
      role:               role,
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

    validateAuthorityConfiguration_(newUser)

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

    // Admin-created accounts are active immediately - there is no separate
    // approval step for activate() to catch, so this is the only place that
    // can push a directly-created office account into its office roster.
    // Without this, an account created here with officeId/systemScope set to a
    // participating office existed only in the central directory: it could log
    // in, but never appeared in that office's Personnel roster and was
    // invisible to rater-assignment generation for that office.
    let officePersonnelSync = { synced: false, skipped: true }
    if (shouldSyncOfficePersonnel_(newUser) && typeof OfficePersonnelService !== 'undefined') {
      // The account row and Firebase login above are already created and
      // durable by this point - a roster-sync problem (most commonly: the
      // office isn't ACTIVE yet) must not be reported as account creation
      // having failed. An uncaught throw here used to abort the whole
      // response even though the user account genuinely existed, which is
      // exactly what surfaced as "Office assessment portal is not active
      // yet." on Create User: the account was created, the error was real,
      // but it described a side effect, not the actual operation the admin
      // asked for.
      try {
        officePersonnelSync = OfficePersonnelService.syncFromCentralUser(newUser, user)
      } catch (e) {
        Logger.log('Office personnel sync failed during create: ' + e.message)
        officePersonnelSync = { synced: false, skipped: false, error: e.message }
      }
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
      stripOfficeAdminForbiddenFields_(updateBody, canEditOwn)
      applyOfficeRaterTaggingDelegation_(updateBody, body, existing)
    }
    if (canEditOwn && !canManageUsers && !canEditOfficeUser) {
      stripSelfForbiddenFields_(updateBody)
    }
    // Editing your own row while also holding office-admin permissions took
    // the canEditOfficeUser branch above (sameOffice_ trivially matches your
    // own row), not the canEditOwn branch - so stripOfficeAdminForbiddenFields_
    // ran instead of stripSelfForbiddenFields_ and deleted mustChangePassword
    // regardless of the allowlist fix there. That denylist exists to stop an
    // office admin forcing the flag on SOMEONE ELSE's account; it should never
    // have applied to clearing your own. Restoring it here, after whichever
    // strip ran, means the self-service password-change confirmation works for
    // every account tier - ordinary staff, office admin, or central admin -
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
    if (Object.prototype.hasOwnProperty.call(updateBody, 'role') && typeof RoleLabelService !== 'undefined') {
      updateBody.role = RoleLabelService.storedRole(updateBody.role)
    }
    if (Object.prototype.hasOwnProperty.call(updateBody, 'requestedRole') && typeof RoleLabelService !== 'undefined') {
      updateBody.requestedRole = RoleLabelService.storedRole(updateBody.requestedRole)
    }
    if (Object.prototype.hasOwnProperty.call(updateBody, 'positionLevel') && typeof RoleLabelService !== 'undefined') {
      updateBody.positionLevel = RoleLabelService.storedRole(updateBody.positionLevel)
    }

    // A tempPassword in the update body means this is a password reset.
    // Previously this only ever changed what's displayed in the Sheet -
    // the real Firebase Auth credential was never touched, so the admin
    // would hand someone a "new" password that didn't actually work.
    // Do this FIRST and let it throw before touching the Sheet at all -
    // otherwise a failed Firebase update would still leave the Sheet
    // showing a password that was never actually set.
    if (body.tempPassword) {
      if (!existing.uid) {
        throw HttpError('No Firebase account linked to this user (uid is empty) - password was not changed.', 400)
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

    // Validate the final authority combination, rather than each field in
    // isolation. This prevents an update from turning an office account into a
    // central administrator simply by mixing a role, scope, and access group
    // that are individually valid values.
    const authorityFields = ['role', 'systemScope', 'officeId', 'officeCode', 'officeName', 'officeRole', 'permissionGroups', 'permissions', 'centralRoles']
    if (authorityFields.some(field => Object.prototype.hasOwnProperty.call(updateBody, field))) {
      validateAuthorityConfiguration_({ ...existing, ...updateBody })
    }

    const updated = SpreadsheetService.updateRow(sheet, id, {
      ...updateBody,
      updatedAt: new Date().toISOString()
    })
    AuthService.invalidateProfileCache(updated)

    // Update Firebase display name if fullName changed
    if (body.fullName && updated.uid) {
      try {
        FirebaseAuthService.updateDisplayName(updated.uid, body.fullName)
      } catch (e) {
        Logger.log('Could not update Firebase display name: ' + e.message)
      }
    }

    // Re-sync to the office roster if this edit touches office-scoped fields
    // and the account is active - e.g. a corrected division/section, or an
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
      // The account edit itself already succeeded above - a roster-sync
      // problem (e.g. the office isn't ACTIVE yet) must not be reported as
      // the whole update having failed. Matches the same never-fail-the-
      // primary-action pattern already used for the Firebase display-name
      // sync a few lines up.
      try {
        officePersonnelSync = OfficePersonnelService.syncFromCentralUser(updated, user)
      } catch (e) {
        Logger.log('Office personnel sync failed during update: ' + e.message)
        officePersonnelSync = { synced: false, skipped: false, error: e.message }
      }
    }

    AuditService.log('UPDATE_USER', 'Users', `Updated user: ${id}`, user)
    return { ...updated, officePersonnelSync }
  }

  function applyOfficeAccessScope(officeId, accessMode, user) {
    return withWriteLock(
      () => applyOfficeAccessScope_(officeId, accessMode, user),
      'User scope update is busy right now. Please try again in a moment.'
    )
  }

  function applyOfficeAccessScope_(officeId, accessMode, user) {
    AuthService.requirePermission(user, 'manage_users')
    const officeKey = String(officeId || 'STB').trim().toUpperCase() || 'STB'
    const targetScope = String(accessMode || '') === 'full_access'
      ? (officeKey === 'STB' ? 'STB_FULL' : 'OFFICE_FULL_PMES')
      : 'CLUSTER_PORTAL'
    const sheet = _usersSheet()
    const data = sheet.getDataRange().getValues()
    if (data.length < 2) {
      return { officeId: officeKey, targetScope, updated: 0, skippedProtected: 0, alreadyMatched: 0 }
    }

    const headers = data[0]
    const idx = name => headers.indexOf(name)
    const col = {
      uid: idx('uid'),
      email: idx('email'),
      officeId: idx('officeId'),
      officeCode: idx('officeCode'),
      officeName: idx('officeName'),
      systemScope: idx('systemScope'),
      role: idx('role'),
      permissionGroups: idx('permissionGroups'),
      centralRoles: idx('centralRoles'),
      active: idx('active'),
      deleted: idx('deleted'),
      updatedAt: idx('updatedAt')
    }
    if (col.systemScope < 0) throw HttpError('Users sheet is missing systemScope column.', 500)

    let updated = 0
    let skippedProtected = 0
    let alreadyMatched = 0
    const now = new Date().toISOString()
    const rows = data.slice(1)
    rows.forEach(row => {
      if (isDeletedValue_(row[col.deleted])) return
      if (!rowBelongsToOffice_(row, col, officeKey)) return
      if (isProtectedSystemAccountRow_(row, col)) {
        skippedProtected += 1
        return
      }
      if (String(row[col.systemScope] || '').trim() === targetScope) {
        alreadyMatched += 1
        return
      }
      row[col.systemScope] = targetScope
      if (col.updatedAt >= 0) row[col.updatedAt] = now
      updated += 1
    })

    if (updated > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows)
      SpreadsheetService.invalidateSheet(sheet)
      // Access scope is part of the cached effective profile. Invalidate only
      // the affected office so profiles for other offices stay warm.
      rows.forEach(row => {
        if (rowBelongsToOffice_(row, col, officeKey)) {
          AuthService.invalidateProfileCache({
            uid: col.uid >= 0 ? row[col.uid] : '',
            email: col.email >= 0 ? row[col.email] : ''
          })
        }
      })
    }

    AuditService.log(
      'BULK_UPDATE_USER_SCOPE',
      'Users',
      `Set ${updated} user scope(s) for office ${officeKey} to ${targetScope}; skipped protected ${skippedProtected}`,
      user
    )
    return { officeId: officeKey, targetScope, updated, skippedProtected, alreadyMatched }
  }

  // ── ACTIVATE user ──
  function activate(id, user) {
    // Approval is the point at which a self-registered account becomes able to
    // enter PMES. Commit that small, central Users-sheet change first and
    // protect it with the write lock. The office roster copy is useful for
    // assignments, but it opens a second workbook and must never leave an
    // administrator guessing whether the approval itself was applied.
    const activation = withWriteLock(
      () => activate_(id, user),
      'User approval is busy right now. Please try again in a moment.'
    )

    const approvedRow = activation.row
    let officePersonnelSync = { synced: false, skipped: true }
    if (shouldSyncOfficePersonnel_(approvedRow) && typeof OfficePersonnelService !== 'undefined') {
      // This is deliberately idempotent: an uncertain network response can be
      // reconciled by calling activate again without creating a second roster
      // person, because the sync updates by email when the person already exists.
      try {
        officePersonnelSync = OfficePersonnelService.syncFromCentralUser(approvedRow, user)
      } catch (e) {
        Logger.log('Office personnel sync failed during activation: ' + e.message)
        officePersonnelSync = { synced: false, skipped: false, error: e.message }
      }
    }

    // Enabling Firebase is best-effort, just as it was before this change.
    // A temporary Firebase error must not roll back the already committed
    // administrative approval.
    if (approvedRow.uid) {
      try {
        FirebaseAuthService.enableUser(approvedRow.uid)
      } catch (e) {
        Logger.log('Could not enable Firebase user: ' + e.message)
      }
    }

    // Keep auditing outside the short, duplicate-sensitive Users-sheet lock.
    // The account state has already been committed at this point, and a slow
    // audit append must never make an office administrator wait to approve a
    // registration or receive a misleading "service busy" error.
    if (!activation.alreadyActive) {
      try {
        AuditService.log('ACTIVATE_USER', 'Users', `Activated user: ${approvedRow.email}`, user)
      } catch (e) {
        Logger.log('Could not audit user activation: ' + e.message)
      }
    }

    return { success: true, alreadyActive: activation.alreadyActive, officePersonnelSync }
  }

  function activate_(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = _usersSheet()
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('User not found', 404)
    requireUserAdministration_(profile, row)

    const alreadyActive = row.active !== false && String(row.active).toLowerCase() !== 'false' &&
      !(row.pendingActivation === true || String(row.pendingActivation).toLowerCase() === 'true')

    const approvedRow = {
      ...row,
      active:            true,
      pendingActivation: false,   // approving a self-registered account clears the pending flag
      updatedAt:         new Date().toISOString()
    }

    if (!alreadyActive) {
      SpreadsheetService.updateRow(sheet, id, {
        active:            approvedRow.active,
        pendingActivation: approvedRow.pendingActivation,
        updatedAt:         approvedRow.updatedAt
      })
      AuthService.invalidateProfileCache(approvedRow)
    }

    return { row: approvedRow, alreadyActive }
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
    AuthService.invalidateProfileCache(row)

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

  // ── DELETE user (permanent - unlike deactivate) ──
  // Exists specifically for accounts that should never have existed at all
  // (duplicate/broken rows from a failed create, a typo'd email) rather than
  // as a replacement for deactivate - deactivate is still the right call for
  // a real employee who's left, since it keeps their history intact.
  function remove(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet = _usersSheet()
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('User not found', 404)
    requireUserAdministration_(profile, row)

    if (String(row.id) === String(profile.id)) {
      throw HttpError('You cannot delete your own account.', 400)
    }

    // Best-effort: free the email in Firebase too, so a corrected
    // re-creation isn't blocked by a stale account still holding it. A
    // Firebase failure here must not block removing the bad row itself.
    if (row.uid) {
      try {
        FirebaseAuthService.deleteUser(row.uid)
      } catch (e) {
        Logger.log('Could not delete Firebase user during removal: ' + e.message)
      }
    }

    SpreadsheetService.hardDeleteRow(sheet, id)
    AuthService.invalidateProfileCache(row)
    AuditService.log('DELETE_USER', 'Users', `Permanently deleted user: ${row.email}`, user)
    return { success: true, deletedId: id }
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
      // User has no Firebase account yet - try to create one
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
    AuthService.invalidateProfileCache(row)

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
        : 'Password updated in PMES Database. Firebase update failed - update manually in Firebase Console.'
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
    AuthService.invalidateProfileCache(updated)

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
    return officeId && officeId !== 'STB' && ['CLUSTER_PORTAL', 'OFFICE_ADMIN', 'OFFICE_FULL_PMES'].indexOf(scope) >= 0
  }

  function validateAuthorityConfiguration_(row) {
    const scope = String(row.systemScope || '').trim().toUpperCase()
    const officeKey = String(row.officeId || row.officeCode || '').trim().toUpperCase()
    const role = String(row.role || '').trim()
    const groups = _normaliseList(row.permissionGroups).split(',').filter(Boolean)
    const centralGroups = [
      'system-admin', 'cluster-system-admin', 'cluster-technical-admin',
      'cluster-assessment-admin', 'cluster-monitoring-admin'
    ]
    const validScopes = ['STB_FULL', 'CLUSTER_PORTAL', 'OFFICE_ADMIN', 'OFFICE_FULL_PMES', 'CLUSTER_ADMIN']
    if (validScopes.indexOf(scope) < 0) {
      throw HttpError('Choose a valid system scope before saving this account.', 400)
    }
    if (scope !== 'STB_FULL' && !officeKey) {
      throw HttpError('An assigned office is required for this system scope.', 400)
    }
    const isStb = officeKey === 'STB' || officeKey === 'OFF-STB' || officeKey === 'SOCIAL TECHNOLOGY BUREAU'
    const centralSystemAdmin = role === 'System Administrator' && isStb && ['STB_FULL', 'CLUSTER_ADMIN'].indexOf(scope) >= 0
    if (role === 'System Administrator' && !centralSystemAdmin) {
      throw HttpError('System Administrator is reserved for STB/central accounts. Use the person\'s assessment role (for example, Technical Staff) with Office Admin Portal for an office administrator.', 400)
    }
    if (!centralSystemAdmin && groups.some(group => centralGroups.indexOf(group) >= 0)) {
      throw HttpError('Central access groups can only be assigned to an STB/central System Administrator account.', 400)
    }
  }

  function isDeletedValue_(value) {
    return value === true || String(value || '').toLowerCase() === 'true'
  }

  function listHas_(value, item) {
    return _normaliseList(value).split(',').indexOf(item) >= 0
  }

  function rowBelongsToOffice_(row, col, officeKey) {
    const keys = [col.officeId, col.officeCode, col.officeName]
      .filter(i => i >= 0)
      .map(i => String(row[i] || '').trim().toUpperCase())
      .filter(Boolean)
    if (officeKey === 'STB') {
      return !keys.length ||
        keys.indexOf('STB') >= 0 ||
        keys.indexOf('OFF-STB') >= 0 ||
        keys.indexOf('SOCIAL TECHNOLOGY BUREAU') >= 0
    }
    return keys.indexOf(officeKey) >= 0
  }

  function isProtectedSystemAccountRow_(row, col) {
    const role = col.role >= 0 ? String(row[col.role] || '').trim() : ''
    const scope = col.systemScope >= 0 ? String(row[col.systemScope] || '').trim().toUpperCase() : ''
    const permissionGroups = col.permissionGroups >= 0 ? row[col.permissionGroups] : ''
    const centralRoles = col.centralRoles >= 0 ? row[col.centralRoles] : ''
    return role === 'System Administrator' ||
      scope === 'CLUSTER_ADMIN' ||
      listHas_(permissionGroups, 'system-admin') ||
      listHas_(permissionGroups, 'cluster-system-admin') ||
      listHas_(centralRoles, 'system-admin') ||
      listHas_(centralRoles, 'cluster-system-admin')
  }

  function hasOfficeUserAdministration_(profile) {
    return AuthService.hasPermission(profile, 'manage_office_users') ||
      String(profile.officeRole || '') === 'OFFICE_ADMIN'
  }

  function sameOffice_(row, profile) {
    // Older and newly registered accounts can represent the same office with
    // different, valid values: for example `OFF-EPAHP` (registry ID) and
    // `EPAHP` (office code).  Comparing only `officeId || officeCode` made an
    // office administrator's own directory appear empty when the two rows used
    // different aliases.  Resolve every known alias through the central office
    // registry, then require an intersection.  This broadens no access: an
    // account still has to match the one registry office assigned to the admin.
    const rowKeys = officeIdentityKeys_(row)
    const profileKeys = officeIdentityKeys_(profile)
    return rowKeys.some(key => profileKeys.indexOf(key) >= 0)
  }

  function officeIdentityKeys_(subject) {
    const keys = [subject && subject.officeId, subject && subject.officeCode, subject && subject.officeName]
      .map(value => String(value || '').trim().toUpperCase())
      .filter(Boolean)

    if (!keys.length) return []

    // Keep the established STB aliases equivalent, including legacy rows that
    // were created before office IDs were introduced.
    if (keys.some(key => ['STB', 'OFF-STB', 'SOCIAL TECHNOLOGY BUREAU'].indexOf(key) >= 0)) {
      return ['STB', 'OFF-STB', 'SOCIAL TECHNOLOGY BUREAU']
    }

    try {
      const aliasMap = officeIdentityAliasMap_()
      const matchingAliases = keys
        .map(key => aliasMap[key] || [])
        .find(aliases => aliases.length)
      if (matchingAliases) {
        matchingAliases.forEach(alias => {
          if (keys.indexOf(alias) < 0) keys.push(alias)
        })
      }
    } catch (e) {
      // A registry lookup is an enhancement for legacy aliases, not a reason
      // to fail user administration.  Exact identifiers above still work.
      Logger.log('[Users] office identity lookup failed: ' + (e && e.message || e))
    }
    return keys
  }

  function officeIdentityAliasMap_() {
    if (_officeIdentityAliasMap) return _officeIdentityAliasMap
    const map = {}
    if (typeof OfficeRegistryService === 'undefined') return (_officeIdentityAliasMap = map)
    OfficeRegistryService.registrationOptions().forEach(office => {
      const aliases = [office.officeId, office.officeCode, office.officeName]
        .map(value => String(value || '').trim().toUpperCase())
        .filter(Boolean)
      aliases.forEach(alias => { map[alias] = aliases })
    })
    _officeIdentityAliasMap = map
    return map
  }

  function requireUserAdministration_(profile, targetRow) {
    if (AuthService.hasPermission(profile, 'manage_users')) return profile
    if (hasOfficeUserAdministration_(profile) && sameOffice_(targetRow, profile)) return profile
    throw HttpError('Access denied. User approval permission required for this office.', 403)
  }

  // Roles that carry authority beyond the office holding them. Assigning any of
  // these from the office-admin path is an escalation out of office scope:
  // 'Undersecretary' maps to cluster-monitoring-admin, whose
  // view_cluster_monitoring permission is exactly what
  // OfficeScopeService.canUseExplicitOffice_ accepts as authority to target an
  // arbitrary officeId - i.e. to read any office's workbook.
  const OFFICE_ADMIN_FORBIDDEN_ROLES = ['System Administrator', 'Undersecretary']

  const OFFICE_RATER_TAGGING_FOCAL_GROUP = 'office-rater-tagging-focal'

  // Office administrators may delegate just this one narrowly scoped ability
  // to a colleague in their own office. Existing groups are preserved exactly;
  // this prevents the office-admin update path from adding, removing, or
  // rewriting central / STB permissions.
  function applyOfficeRaterTaggingDelegation_(sanitizedBody, originalBody, existing) {
    if (!Object.prototype.hasOwnProperty.call(originalBody, 'permissionGroups')) return
    const requested = _normaliseList(originalBody.permissionGroups).split(',')
    const existingGroups = _normaliseList(existing.permissionGroups).split(',').filter(Boolean)
    const shouldDelegate = requested.indexOf(OFFICE_RATER_TAGGING_FOCAL_GROUP) >= 0
    const next = existingGroups.filter(group => group !== OFFICE_RATER_TAGGING_FOCAL_GROUP)
    if (shouldDelegate) next.push(OFFICE_RATER_TAGGING_FOCAL_GROUP)
    sanitizedBody.permissionGroups = _normaliseList(next)
  }

  function isAssignedNonStbOffice_(profile) {
    const scope = String(profile.systemScope || '').trim().toUpperCase()
    const officeKey = String(profile.officeId || profile.officeCode || '').trim().toUpperCase()
    // An STB account may legitimately use an office-scoped portal persona.
    // Scope alone must not misclassify it as an outside office.
    if (['OFFICE_ADMIN', 'OFFICE_FULL_PMES', 'CLUSTER_PORTAL'].indexOf(scope) >= 0) {
      return officeKey !== 'STB' && officeKey !== 'OFF-STB' && officeKey !== 'SOCIAL TECHNOLOGY BUREAU'
    }
    return !!officeKey && officeKey !== 'STB' && officeKey !== 'OFF-STB' && officeKey !== 'SOCIAL TECHNOLOGY BUREAU'
  }

  function stripOfficeAdminForbiddenFields_(body, isSelfEdit) {
    const requestedRole = String(body.role || '').trim()
    if (OFFICE_ADMIN_FORBIDDEN_ROLES.indexOf(requestedRole) >= 0) {
      throw HttpError('Office administrators cannot assign the ' + requestedRole + ' role.', 403)
    }

    // Nobody promotes themselves. An office admin editing their OWN row lands
    // in this branch rather than the self-edit branch below, because
    // sameOffice_ trivially matches your own row - so without this, `role` was
    // never stripped and an office admin could PUT their own record with
    // role: 'Undersecretary', pick up view_cluster_monitoring, and from there
    // read every office's assessment data by passing an explicit officeId.
    // Changing your own role has no legitimate use: a real promotion is
    // performed by someone holding manage_users, who never reaches this path.
    if (isSelfEdit) {
      delete body.role
      delete body.requestedRole
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
    // mustChangePassword is a boolean UI flag, not a permission - letting a
    // user clear it on themselves is how PasswordChangePrompt.vue confirms a
    // completed password change. Without it here, that write was silently
    // dropped: the sheet kept mustChangePassword=true forever, so the prompt
    // reappeared on every profile refresh (a 60s timer, or a route change)
    // even though the user really had changed their password in Firebase.
    Object.keys(body).forEach(key => {
      if (['fullName', 'position', 'employeeNo', 'mustChangePassword'].indexOf(key) < 0) delete body[key]
    })
  }

  return { list, get, create, update, updateOwnProfile, activate, deactivate, remove, resetPassword, selfRegister, decline, applyOfficeAccessScope }
})()
