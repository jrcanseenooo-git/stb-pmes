/**
 * UsersService.gs — Updated with Firebase Auth integration
 * When a user is created → Firebase Auth account is also created
 * When activated/deactivated → Firebase account is enabled/disabled
 * When password is reset → Firebase password is updated
 */

const UsersService = (() => {

  // ── LIST users ──
  function list(params, user) {
    const sheet   = SpreadsheetService.getSheet(SHEET.USERS)
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

    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  // ── GET single user ──
  function get(id, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('User not found', 404)
    return row
  }

  // ── CREATE user — also creates Firebase Auth account ──
  function create(body, user) {
    AuthService.requireRole(user, 'System Administrator')

    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    const now   = new Date().toISOString()

    // 1. Create in Sheets first
    const newUser = {
      id:                 SpreadsheetService.generateId('USR-'),
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
      tempPassword:       body.tempPassword || '',
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
      ...newUser,
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

    const sheet    = SpreadsheetService.getSheet(SHEET.USERS)
    const existing = SpreadsheetService.getRow(sheet, id)
    if (!existing) throw HttpError('User not found', 404)

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
    }

    const updated = SpreadsheetService.updateRow(sheet, id, {
      ...body,
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
    const sheet   = SpreadsheetService.getSheet(SHEET.USERS)
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
    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
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
    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('User not found', 404)

    const newTempPassword = body.tempPassword || ''

    // Update in Sheets
    SpreadsheetService.updateRow(sheet, id, {
      tempPassword:       newTempPassword,
      mustChangePassword: true,
      updatedAt:          new Date().toISOString()
    })

    // Update Firebase password
    let firebaseResult = { success: false }
    if (row.uid && newTempPassword) {
      try {
        firebaseResult = FirebaseAuthService.updatePassword(row.uid, newTempPassword)
      } catch (e) {
        Logger.log('Could not update Firebase password: ' + e.message)
        firebaseResult = { success: false, error: e.message }
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
        Logger.log('Could not create Firebase user during reset: ' + e.message)
      }
    }

    AuditService.log('RESET_PASSWORD', 'Users',
      `Reset password for: ${row.email} | Firebase: ${firebaseResult.success ? '✅' : '❌'}`,
      user
    )
    return {
      success:         true,
      firebaseUpdated: firebaseResult.success,
      note:            firebaseResult.success
        ? 'Password updated in both Firebase Auth and PMES Database.'
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

    const sheet   = SpreadsheetService.getSheet(SHEET.USERS)
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
    return updated
  }

  return { list, get, create, update, updateOwnProfile, activate, deactivate, resetPassword }
})()