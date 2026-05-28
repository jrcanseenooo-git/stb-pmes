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

  function create(body, user) {
    AuthService.requireRole(user, 'System Administrator')
    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    const now   = new Date().toISOString()

    const newUser = {
      id:           SpreadsheetService.generateId('USR-'),
      uid:          '',
      email:        body.email        || '',
      fullName:     body.fullName     || `${body.firstName} ${body.lastName}`,
      firstName:    body.firstName    || '',
      lastName:     body.lastName     || '',
      role:         body.role         || 'Staff',
      divisionId:   body.divisionId   || '',
      divisionName: body.division     || '',
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
    AuditService.log('CREATE', 'Users', `Created user: ${newUser.email}`, user)
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

  return { list, get, create, update, activate, deactivate, resetPassword }
})()