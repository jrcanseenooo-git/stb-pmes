const UsersService = (() => {

  function list(params, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    let rows    = SpreadsheetService.getAllRows(sheet)
                  .filter(r => !r.deleted)

    // Scope by role
    const profile = AuthService.getProfile(user)
    if (!['System Administrator','Bureau Director'].includes(profile.role)) {
      rows = rows.filter(r => r.divisionId === profile.divisionId)
    }

    if (params.search) {
      const q = params.search.toLowerCase()
      rows = rows.filter(r =>
        r.fullName?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.role?.toLowerCase().includes(q)
      )
    }

    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  function get(id, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('User not found', 404)
    return row
  }

  // ── Create Firebase Auth account via REST API ──
  function createFirebaseAuthUser(email, password) {
    const apiKey = PropertiesService.getScriptProperties().getProperty('FIREBASE_WEB_API_KEY')
    if (!apiKey) {
      Logger.log('FIREBASE_WEB_API_KEY not set — skipping Firebase Auth creation')
      return null
    }
    try {
      const url  = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`
      const resp = UrlFetchApp.fetch(url, {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify({ email, password, returnSecureToken: false }),
        muteHttpExceptions: true
      })
      const result = JSON.parse(resp.getContentText())
      if (result.error) {
        Logger.log('Firebase Auth create error: ' + result.error.message)
        return null
      }
      return result.localId  // Firebase UID
    } catch (err) {
      Logger.log('Firebase Auth create exception: ' + err.message)
      return null
    }
  }

  function create(body, user) {
    AuthService.requireRole(user, 'System Administrator')
    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    const now   = new Date().toISOString()

    // Create Firebase Auth account so the user can actually log in with email+password
    const firebaseUid = createFirebaseAuthUser(body.email, body.tempPassword || '')

    const newUser = {
      id:           SpreadsheetService.generateId('USR-'),
      uid:          firebaseUid || '',
      email:        body.email        || '',
      fullName:     body.fullName     || `${body.firstName} ${body.lastName}`,
      firstName:    body.firstName    || '',
      lastName:     body.lastName     || '',
      role:         body.role         || 'Staff',
      divisionId:   body.divisionId   || '',
      divisionName: body.divisionName || body.division || '',
      position:     body.position     || '',
      employeeNo:   body.employeeNo   || '',
      type:         body.type         || 'Regular',
      tempPassword: body.tempPassword || '',
      mustChangePassword: true,
      active:       true,
      createdAt:    now,
      updatedAt:    now,
      lastLoginAt:  ''
    }

    SpreadsheetService.appendRow(sheet, newUser)
    AuditService.log('CREATE', 'Users', `Created user: ${newUser.email} (Firebase UID: ${firebaseUid || 'not created'})`, user)
    return newUser
  }

  function update(id, body, user) {
    AuthService.requireRole(user, 'System Administrator', 'Bureau Director')
    const sheet   = SpreadsheetService.getSheet(SHEET.USERS)
    const updated = SpreadsheetService.updateRow(sheet, id, {
      ...body,
      updatedAt: new Date().toISOString()
    })
    AuditService.log('UPDATE', 'Users', `Updated user: ${id}`, user)
    return updated
  }

  // Self-service: any user can update their own non-sensitive fields
  function updateOwnProfile(id, body, user) {
    const profile = AuthService.getProfile(user)
    if (profile.id !== id) {
      throw HttpError('You can only update your own profile', 403)
    }
    const ALLOWED_FIELDS = ['fullName', 'firstName', 'lastName', 'position', 'employeeNo']
    const sanitized = {}
    ALLOWED_FIELDS.forEach(f => { if (body[f] !== undefined) sanitized[f] = body[f] })

    // Keep fullName in sync
    if (sanitized.firstName || sanitized.lastName) {
      const fn = sanitized.firstName || profile.firstName || ''
      const ln = sanitized.lastName  || profile.lastName  || ''
      sanitized.fullName = `${fn} ${ln}`.trim()
    }
    sanitized.updatedAt = new Date().toISOString()

    const sheet   = SpreadsheetService.getSheet(SHEET.USERS)
    const updated = SpreadsheetService.updateRow(sheet, id, sanitized)
    AuditService.log('UPDATE_PROFILE', 'Users', `User updated own profile: ${id}`, user)
    return updated
  }

  function activate(id, user) {
    AuthService.requireRole(user, 'System Administrator')
    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    SpreadsheetService.updateRow(sheet, id, { active: true, updatedAt: new Date().toISOString() })
    AuditService.log('ACTIVATE', 'Users', `Activated user: ${id}`, user)
    return { success: true }
  }

  function deactivate(id, user) {
    AuthService.requireRole(user, 'System Administrator')
    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    SpreadsheetService.updateRow(sheet, id, { active: false, updatedAt: new Date().toISOString() })
    AuditService.log('DEACTIVATE', 'Users', `Deactivated user: ${id}`, user)
    return { success: true }
  }

  function resetPassword(id, body, user) {
    AuthService.requireRole(user, 'System Administrator')
    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    SpreadsheetService.updateRow(sheet, id, {
      tempPassword:       body.tempPassword || '',
      mustChangePassword: true,
      updatedAt:          new Date().toISOString()
    })
    AuditService.log('RESET_PASSWORD', 'Users', `Reset password for: ${id}`, user)
    return { success: true }
  }

  return { list, get, create, update, updateOwnProfile, activate, deactivate, resetPassword }
})()