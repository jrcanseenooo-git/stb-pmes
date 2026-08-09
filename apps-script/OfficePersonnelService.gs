const OfficePersonnelService = (() => {
  const HEADERS = [
    'id', 'uid', 'email', 'fullName', 'employeeNo', 'position', 'positionLevel',
    'role', 'divisionId', 'divisionName', 'organizationalUnitId',
    'organizationalUnitName', 'section', 'officeRole', 'systemScope',
    'accountStatus', 'active', 'pendingActivation',
    'createdAt', 'updatedAt', 'validatedAt', 'validatedBy'
  ]

  function list(params, user) {
    return withOffice_(params, user, () => {
      let rows = SpreadsheetService.getAllRows(personnelSheet_()).map(safeRow_)
      if (params.search) {
        const q = String(params.search).toLowerCase()
        rows = rows.filter(r =>
          String(r.fullName || '').toLowerCase().includes(q) ||
          String(r.email || '').toLowerCase().includes(q) ||
          String(r.role || '').toLowerCase().includes(q) ||
          String(r.divisionName || r.organizationalUnitName || '').toLowerCase().includes(q) ||
          String(r.section || '').toLowerCase().includes(q)
        )
      }
      if (params.role) rows = rows.filter(r => String(r.role || '') === String(params.role))
      if (params.status) rows = rows.filter(r => statusOf_(r) === String(params.status))
      rows.sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || '')))
      return SpreadsheetService.paginate(rows, params.page, params.pageSize || 100)
    })
  }

  function create(body, user) {
    const profile = canManageOffice_(user, body || {})
    return withOffice_(body, user, () => {
      const sheet = personnelSheet_()
      const email = String(body.email || '').trim().toLowerCase()
      if (!email) throw HttpError('Email is required.', 400)
      const existing = SpreadsheetService.getAllRows(sheet).find(r =>
        String(r.email || '').trim().toLowerCase() === email
      )
      if (existing) throw HttpError('Personnel email already exists in this office.', 409)
      const now = new Date().toISOString()
      const row = toRow_({
        ...body,
        id: SpreadsheetService.generateId('PER-'),
        email,
        active: true,
        pendingActivation: false,
        accountStatus: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        validatedAt: now,
        validatedBy: profile.email || user.email || ''
      })
      SpreadsheetService.appendRow(sheet, row)
      audit_('CREATE_PERSONNEL', row.id, 'Created office personnel ' + row.email, user)
      return safeRow_(row)
    })
  }

  function update(id, body, user) {
    const profile = canManageOffice_(user, body || {})
    return withOffice_(body, user, () => {
      const sheet = personnelSheet_()
      const current = SpreadsheetService.getRow(sheet, id)
      if (!current) throw HttpError('Personnel record not found.', 404)
      const updated = SpreadsheetService.updateRow(sheet, id, toRow_({
        ...current,
        ...body,
        id,
        email: current.email,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
        validatedAt: new Date().toISOString(),
        validatedBy: profile.email || user.email || ''
      }))
      audit_('UPDATE_PERSONNEL', id, 'Updated office personnel ' + updated.email, user)
      return safeRow_(updated)
    })
  }

  function deactivate(id, user) {
    canManageOffice_(user, {})
    return withOffice_({}, user, () => {
      const sheet = personnelSheet_()
      const updated = SpreadsheetService.updateRow(sheet, id, {
        active: false,
        accountStatus: 'INACTIVE',
        updatedAt: new Date().toISOString()
      })
      audit_('DEACTIVATE_PERSONNEL', id, 'Deactivated office personnel ' + updated.email, user)
      return safeRow_(updated)
    })
  }

  function syncFromCentralUser(centralUser, user) {
    const profile = AuthService.getProfile(user)
    const officeId = String(centralUser.officeId || centralUser.officeCode || '').trim()
    const central = AuthService.hasPermission(profile, 'manage_users') ||
      AuthService.hasPermission(profile, 'manage_office_registry') ||
      AuthService.hasPermission(profile, 'manage_cluster_office_admins')
    const officeAdmin = AuthService.hasPermission(profile, 'manage_office_users') ||
      String(profile.systemScope || '') === 'OFFICE_ADMIN' ||
      String(profile.officeRole || '') === 'OFFICE_ADMIN'
    const profileOffice = String(profile.officeId || profile.officeCode || '').trim().toUpperCase()
    if (!central && !(officeAdmin && officeId && officeId.toUpperCase() === profileOffice && officeId.toUpperCase() !== 'STB')) {
      throw HttpError('Access denied. User approval permission required.', 403)
    }
    if (!officeId || officeId.toUpperCase() === 'STB') {
      return { synced: false, skipped: true, reason: 'STB user' }
    }
    const ss = central
      ? OfficeRegistryService.getSpreadsheetForCentralProcess(officeId, user)
      : OfficeRegistryService.getSpreadsheetForOffice(officeId, user)
    return SpreadsheetService.withSpreadsheet(ss, () => {
      const sheet = personnelSheet_()
      const email = String(centralUser.email || '').trim().toLowerCase()
      if (!email) throw HttpError('Approved user has no email to sync to office personnel.', 400)
      const now = new Date().toISOString()
      const existing = SpreadsheetService.getAllRows(sheet).find(r =>
        String(r.email || '').trim().toLowerCase() === email
      )
      const row = toRow_({
        ...centralUser,
        email,
        role: centralUser.role || centralUser.requestedRole || 'Technical Staff',
        accountStatus: 'ACTIVE',
        active: true,
        pendingActivation: false,
        systemScope: centralUser.systemScope || 'CLUSTER_PORTAL',
        officeRole: centralUser.officeRole || 'OFFICE_PERSONNEL',
        updatedAt: now,
        validatedAt: now,
        validatedBy: profile.email || user.email || ''
      })
      if (existing) {
        const updated = SpreadsheetService.updateRow(sheet, existing.id, {
          ...row,
          id: existing.id,
          createdAt: existing.createdAt || centralUser.createdAt || now
        })
        audit_('SYNC_PERSONNEL_APPROVAL', updated.id, 'Synced approved central user ' + email, user)
        return { synced: true, action: 'updated', personnel: safeRow_(updated) }
      }
      const created = {
        ...row,
        id: SpreadsheetService.generateId('PER-'),
        createdAt: centralUser.createdAt || now
      }
      SpreadsheetService.appendRow(sheet, created)
      audit_('SYNC_PERSONNEL_APPROVAL', created.id, 'Synced approved central user ' + email, user)
      return { synced: true, action: 'created', personnel: safeRow_(created) }
    })
  }

  function withOffice_(params, user, work) {
    const profile = AuthService.getProfile(user)
    const officeId = resolveOfficeId_(profile, params || {})
    if (!officeId || String(officeId).toUpperCase() === 'STB') {
      throw HttpError('Office personnel management is only available for participating office portals.', 400)
    }
    const ss = OfficeRegistryService.getSpreadsheetForOffice(officeId, user)
    return SpreadsheetService.withSpreadsheet(ss, work)
  }

  function canManageOffice_(user, params) {
    const profile = AuthService.getProfile(user)
    const central = AuthService.hasPermission(profile, 'manage_office_registry') ||
      AuthService.hasPermission(profile, 'manage_cluster_office_admins')
    const officeAdmin = String(profile.systemScope || '') === 'OFFICE_ADMIN' ||
      String(profile.officeRole || '') === 'OFFICE_ADMIN'
    if (!central && !officeAdmin) throw HttpError('Access denied. Office administrator role required.', 403)
    resolveOfficeId_(profile, params || {})
    return profile
  }

  function resolveOfficeId_(profile, params) {
    const explicit = String(params.officeId || params.officeCode || '').trim()
    const central = AuthService.hasPermission(profile, 'manage_office_registry') ||
      AuthService.hasPermission(profile, 'manage_cluster_office_admins') ||
      AuthService.hasPermission(profile, 'view_cluster_monitoring')
    if (explicit && central) return explicit
    return String(profile.officeId || profile.officeCode || '').trim()
  }

  function personnelSheet_() {
    let sheet
    try {
      sheet = SpreadsheetService.getSheet('Personnel')
    } catch (e) {
      sheet = SpreadsheetService.getSpreadsheet().insertSheet('Personnel')
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      sheet.setFrozenRows(1)
    }
    const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].filter(Boolean)
    const missing = HEADERS.filter(h => existing.indexOf(h) < 0)
    if (missing.length) sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing])
    return sheet
  }

  function toRow_(body) {
    return {
      id: body.id || '',
      uid: body.uid || '',
      email: String(body.email || '').trim().toLowerCase(),
      fullName: body.fullName || '',
      employeeNo: body.employeeNo || '',
      position: body.position || '',
      positionLevel: body.positionLevel || body.role || '',
      role: body.role || 'Technical Staff',
      divisionId: body.divisionId || body.organizationalUnitId || '',
      divisionName: body.divisionName || body.organizationalUnitName || '',
      organizationalUnitId: body.organizationalUnitId || body.divisionId || '',
      organizationalUnitName: body.organizationalUnitName || body.divisionName || '',
      section: body.section || '',
      officeRole: body.officeRole || 'OFFICE_PERSONNEL',
      systemScope: body.systemScope || 'CLUSTER_PORTAL',
      accountStatus: body.accountStatus || (body.active === false ? 'INACTIVE' : 'ACTIVE'),
      active: body.active === false || String(body.active).toLowerCase() === 'false' ? false : true,
      pendingActivation: body.pendingActivation === true || String(body.pendingActivation).toLowerCase() === 'true',
      createdAt: body.createdAt || '',
      updatedAt: body.updatedAt || '',
      validatedAt: body.validatedAt || '',
      validatedBy: body.validatedBy || ''
    }
  }

  function safeRow_(row) {
    return {
      ...row,
      status: statusOf_(row)
    }
  }

  function statusOf_(row) {
    if (row.pendingActivation === true || String(row.pendingActivation).toLowerCase() === 'true') return 'Pending'
    if (row.active === false || String(row.active).toLowerCase() === 'false') return 'Inactive'
    return 'Active'
  }

  function audit_(action, entityId, summary, user) {
    try {
      const sheet = SpreadsheetService.getSheet('AuditLogs')
      const profile = AuthService.getProfile(user)
      SpreadsheetService.appendRow(sheet, {
        id: SpreadsheetService.generateId('AUD-'),
        timestamp: new Date().toISOString(),
        userId: profile.id || '',
        userEmail: user.email || '',
        userName: profile.fullName || user.email || '',
        officeId: profile.officeId || '',
        action,
        entityType: 'Personnel',
        entityId,
        transactionId: '',
        result: 'SUCCESS',
        summary,
        createdAt: new Date().toISOString()
      })
    } catch (e) {
      Logger.log('[OfficePersonnel] audit skipped: ' + e.message)
    }
  }

  return { list, create, update, deactivate, syncFromCentralUser }
})()
