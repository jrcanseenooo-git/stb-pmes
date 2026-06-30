/**
 * UsersService.gs — Updated with Firebase Auth integration
 * When a user is created → Firebase Auth account is also created
 * When activated/deactivated → Firebase account is enabled/disabled
 * When password is reset → Firebase password is updated
 */

const UsersService = (() => {
  const USER_EXTRA_COLUMNS = ['tempPassword', 'tempPasswordHash', 'mustChangePassword']

  // ── LIST users ──
  function list(params, user) {
    const sheet   = _usersSheet()
    let rows      = SpreadsheetService.getAllRows(sheet).filter(r => !r.deleted)
    const profile = AuthService.getProfile(user)

    // Scope by role — staff only see their division
    if (!['System Administrator','Bureau Director','Assistant Bureau Director'].includes(profile.role)) {
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
    const sheet = _usersSheet()
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('User not found', 404)
    return _safeUser(row)
  }

  // ── CREATE user — also creates Firebase Auth account ──
  function create(body, user) {
    AuthService.requireRole(user, 'System Administrator')

    const sheet = _usersSheet()
    const now   = new Date().toISOString()
    const id    = SpreadsheetService.generateId('USR-')

    // 1. Create in Sheets first
    const newUser = {
      id,
      uid:                '',   // will be set after Firebase creation
      email:              body.email        || '',
      fullName:           body.fullName     || `${body.firstName || ''} ${body.lastName || ''}`.trim(),
      firstName:          body.firstName    || '',
      lastName:           body.lastName     || '',
      role:               body.role         || 'Staff',
      positionLevel:      body.positionLevel || resolvePositionLevel(body.position || ''),
      divisionId:         body.divisionId   || '',
      divisionName:       body.division     || body.divisionName || '',
      section:            body.section      || '',
      position:           body.position     || '',
      employeeNo:         body.employeeNo   || '',
      type:               body.type         || 'Regular',
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

    return {
      ..._safeUser(newUser),
      tempPassword: body.tempPassword || '',
      firebaseCreated: firebaseResult?.success || false,
      firebaseError:   firebaseResult?.error   || null
    }
  }

  // ── UPDATE user ──
  function update(id, body, user) {
    const profile = AuthService.getProfile(user)
    const allowedRoles = ['System Administrator','Bureau Director','Assistant Bureau Director']
    if (!allowedRoles.includes(profile.role) && id !== profile.id) {
      throw HttpError('Insufficient permissions', 403)
    }

    const sheet    = _usersSheet()
    const existing = SpreadsheetService.getRow(sheet, id)
    if (!existing) throw HttpError('User not found', 404)
    const updateBody = { ...body }

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

    AuditService.log('UPDATE_USER', 'Users', `Updated user: ${id}`, user)
    return updated
  }

  // ── ACTIVATE user ──
  function activate(id, user) {
    AuthService.requireRole(user, 'System Administrator')
    const sheet   = _usersSheet()
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('User not found', 404)

    SpreadsheetService.updateRow(sheet, id, {
      active:    true,
      updatedAt: new Date().toISOString()
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
    return { success: true }
  }

  // ── DEACTIVATE user ──
  function deactivate(id, user) {
    AuthService.requireRole(user, 'System Administrator')
    const sheet = _usersSheet()
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('User not found', 404)

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
    AuthService.requireRole(user, 'System Administrator')
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
      firstName:  body.firstName  || '',
      lastName:   body.lastName   || '',
      fullName:   `${body.firstName || ''} ${body.lastName || ''}`.trim(),
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
          if (form.userId === id && form.status === 'DRAFT') {
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
    _migratePlainTempPasswords(sheet)
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

  return { list, get, create, update, updateOwnProfile, activate, deactivate, resetPassword }
})()
