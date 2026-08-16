const OfficeRegistryService = (() => {
  const REGISTRY_HEADERS = [
    'id', 'officeId', 'officeCode', 'officeName', 'officeShortName',
    'primaryAdminEmail', 'officeStatus', 'portalScope', 'spreadsheetId',
    'spreadsheetStatus', 'schemaVersion', 'templateVersion',
    'lastValidatedAt', 'lastSyncAt', 'provisioningTransactionId',
    'provisioningError', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'
  ]

  const VALID_OFFICE_STATUS = ['DRAFT', 'FOR_CONFIGURATION', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'ARCHIVED']
  const VALID_SPREADSHEET_STATUS = ['NOT_PROVISIONED', 'PROVISIONING', 'FOR_VALIDATION', 'ACTIVE', 'INVALID_SCHEMA', 'INACCESSIBLE', 'SUSPENDED', 'ARCHIVED']
  const ORG_OPTION_HEADERS = [
    'id', 'officeId', 'optionType', 'parentId', 'name', 'code',
    'active', 'sequence', 'createdAt', 'updatedAt', 'updatedBy'
  ]
  const DEFAULT_REQUESTED_ROLES = ['Technical Staff', 'Section Head', 'Division Chief', 'Assistant Bureau Director', 'Bureau Director']

  function list(params, user) {
    requireCentralAdmin_(user)
    let rows = includeBuiltInStb_(SpreadsheetService.getAllRows(registrySheet_()))
    if (params.status) rows = rows.filter(r => r.officeStatus === params.status)
    if (params.search) {
      const q = String(params.search).toLowerCase()
      rows = rows.filter(r =>
        String(r.officeCode || '').toLowerCase().includes(q) ||
        String(r.officeName || '').toLowerCase().includes(q) ||
        String(r.primaryAdminEmail || '').toLowerCase().includes(q)
      )
    }
    rows = rows.sort((a, b) => String(a.officeCode).localeCompare(String(b.officeCode)))
    return SpreadsheetService.paginate(rows.map(safeRegistryRow_), params.page, params.pageSize || 50)
  }

  // A minimal office picker for the Add/Edit User form. That form needs a
  // simple id/name list of active offices to assign an office-scoped account
  // to — it does not need the full registry (admin emails, spreadsheet/schema
  // status, provisioning history) that requireCentralAdmin_ exists to gate.
  // Without this, any admin with User Management access but not a central
  // Access Group (the common case for an office-level super admin editing
  // their own account) gets a 403 from list() and can never populate or
  // change the Office field at all.
  function picker(params, user) {
    AuthService.requirePermission(user, 'manage_users')
    const rows = SpreadsheetService.getAllRows(registrySheet_())
      .filter(r => r.officeStatus === 'ACTIVE' || r.spreadsheetStatus === 'ACTIVE')
      .map(r => ({ officeId: r.officeId, officeCode: r.officeCode, officeName: r.officeName }))
      .sort((a, b) => String(a.officeCode).localeCompare(String(b.officeCode)))
    return { items: rows }
  }

  function get(id, user) {
    requireCentralAdmin_(user)
    const row = findByIdOrCode_(id)
    if (!row) throw HttpError('Office record not found.', 404)
    return safeRegistryRow_(row)
  }

  function monitoring(params, user) {
    requireCentralAdmin_(user)
    let rows = includeBuiltInStb_(SpreadsheetService.getAllRows(registrySheet_()))
    if (params.status) rows = rows.filter(r => r.officeStatus === params.status)
    if (params.search) {
      const q = String(params.search).toLowerCase()
      rows = rows.filter(r =>
        String(r.officeCode || '').toLowerCase().includes(q) ||
        String(r.officeName || '').toLowerCase().includes(q) ||
        String(r.primaryAdminEmail || '').toLowerCase().includes(q)
      )
    }

    const summaries = rows
      .sort((a, b) => String(a.officeCode).localeCompare(String(b.officeCode)))
      .map(row => summarizeOffice_(row))

    const totals = summaries.reduce((all, item) => {
      all.offices += 1
      if (item.officeStatus === 'ACTIVE') all.activeOffices += 1
      if (item.spreadsheetStatus === 'ACTIVE') all.activeSpreadsheets += 1
      if (item.health === 'Attention') all.attention += 1
      all.personnel += item.personnel.total
      all.assessmentRecords += item.assessments.total
      all.completedAssignments += item.assignments.completed
      all.pendingAssignments += item.assignments.pending
      return all
    }, {
      offices: 0,
      activeOffices: 0,
      activeSpreadsheets: 0,
      attention: 0,
      personnel: 0,
      assessmentRecords: 0,
      completedAssignments: 0,
      pendingAssignments: 0
    })

    return {
      items: summaries,
      total: summaries.length,
      totals
    }
  }

  function registrationOptions() {
    const stb = {
      officeId: 'STB',
      officeCode: 'STB',
      officeName: 'Social Technology Bureau',
      officeShortName: 'STB',
      systemScope: 'STB_FULL',
      portalScope: 'STB_FULL'
    }
    let offices = [stb]
    try {
      const active = SpreadsheetService.getAllRows(registrySheet_())
        .filter(row =>
          String(row.officeStatus || '').toUpperCase() === 'ACTIVE'
        )
        .map(row => ({
          officeId: row.officeId,
          officeCode: row.officeCode,
          officeName: row.officeName,
          officeShortName: row.officeShortName || row.officeCode,
          systemScope: 'CLUSTER_PORTAL',
          portalScope: row.portalScope || 'CLUSTER_PORTAL'
        }))
        .sort((a, b) => String(a.officeCode).localeCompare(String(b.officeCode)))
      offices = offices.concat(active)
    } catch (e) {
      Logger.log('[OfficeRegistry] registrationOptions error: ' + (e && e.message || e))
    }
    return offices
  }

  function registrationOrgOptions() {
    const map = {}
    try {
      registrationOptions().forEach(office => {
        if (!office || !office.officeId) return
        const options = getOrgOptionsForOffice_(office.officeId)
        officeAliasKeys_(office).forEach(key => {
          map[key] = options
          map[key.toUpperCase()] = options
        })
      })
    } catch (e) {
      Logger.log('[OfficeRegistry] registrationOrgOptions error: ' + (e && e.message || e))
    }
    return map
  }

  function orgOptions(id, user) {
    const row = findByIdOrCode_(id)
    if (!row) throw HttpError('Office record not found.', 404)
    requireOrgOptionsAccess_(row, user)
    return {
      office: safeRegistryRow_(row),
      ...getOrgOptionsForOffice_(row.officeId)
    }
  }

  function saveOrgOptions(id, body, user) {
    const row = findByIdOrCode_(id)
    if (!row) throw HttpError('Office record not found.', 404)
    const profile = requireOrgOptionsAccess_(row, user)
    const officeId = String(row.officeId || '').trim()
    if (!officeId) throw HttpError('Office record has no office ID.', 400)

    const divisions = normalizeOptionList_(body.divisions, 'division')
    const divisionIdsByName = {}
    divisions.forEach(item => {
      item.id = item.id || optionId_(officeId, 'DIV', item.name)
      divisionIdsByName[String(item.name || '').trim().toLowerCase()] = item.id
    })

    const sections = normalizeOptionList_(body.sections, 'section').map(item => {
      const parentName = String(item.divisionName || item.parentName || '').trim().toLowerCase()
      return {
        ...item,
        id: item.id || optionId_(officeId, 'SEC', `${item.parentId || parentName || 'general'}-${item.name}`),
        parentId: item.parentId || divisionIdsByName[parentName] || ''
      }
    })
    const roles = normalizeOptionList_(body.requestedRoles || body.roles, 'role')
      .map(item => ({ ...item, id: item.id || optionId_(officeId, 'ROLE', item.name), parentId: '' }))

    const now = new Date().toISOString()
    const updatedBy = profile.email || user.email || ''
    const savedRows = divisions.concat(sections).concat(roles).map((item, index) => ({
        id: item.id,
        officeId,
        optionType: item.optionType,
        parentId: item.parentId || '',
        name: item.name,
        code: item.code || '',
        active: true,
        sequence: item.sequence || index + 1,
        createdAt: now,
        updatedAt: now,
        updatedBy
    }))

    replaceOrgOptionRows_(officeId, savedRows)

    auditCentral_('SAVE_OFFICE_ORG_OPTIONS', 'Office', officeId, '', 'SUCCESS', 'Updated registration options for ' + row.officeCode, user)
    return {
      office: safeRegistryRow_(row),
      ...orgOptionsFromRows_(savedRows)
    }
  }

  function resolveRegistrationOffice(body) {
    const key = String(
      body && (body.officeId || body.officeCode || body.office)
      || 'STB'
    ).trim().toUpperCase()
    if (!key || key === 'STB' || key === 'SOCIAL TECHNOLOGY BUREAU') {
      return {
        officeId: 'STB',
        officeCode: 'STB',
        officeName: 'Social Technology Bureau',
        systemScope: 'STB_FULL',
        officeRole: 'STB_PERSONNEL'
      }
    }

    const row = findByIdOrCode_(key)
    if (!row) throw HttpError('Selected office is not registered in PMES.', 400)
    if (
      String(row.officeStatus || '').toUpperCase() !== 'ACTIVE'
    ) {
      throw HttpError('Selected office/program is not active yet. Please contact the System Admin.', 409)
    }
    return {
      officeId: row.officeId,
      officeCode: row.officeCode,
      officeName: row.officeName,
      systemScope: 'CLUSTER_PORTAL',
      officeRole: 'OFFICE_PERSONNEL'
    }
  }

  function provision(body, user) {
    const profile = requireCentralAdmin_(user)
    const now = new Date().toISOString()
    const input = normalizeInput_(body)
    validateInput_(input)

    const sheet = registrySheet_()
    const existing = SpreadsheetService.getAllRows(sheet)
    if (existing.some(r => String(r.officeCode || '').toUpperCase() === input.officeCode)) {
      throw HttpError('Office code already exists in the central registry.', 409)
    }

    const transactionId = 'PROV-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12)
    const officeId = 'OFF-' + input.officeCode
    const row = {
      id: officeId,
      officeId,
      officeCode: input.officeCode,
      officeName: input.officeName,
      officeShortName: input.officeShortName || input.officeCode,
      primaryAdminEmail: input.primaryAdminEmail,
      officeStatus: 'FOR_CONFIGURATION',
      portalScope: 'CLUSTER_PORTAL',
      spreadsheetId: '',
      spreadsheetStatus: 'PROVISIONING',
      schemaVersion: OfficeSchemaService.getSpec().schemaVersion,
      templateVersion: OfficeSchemaService.getSpec().templateVersion,
      lastValidatedAt: '',
      lastSyncAt: '',
      provisioningTransactionId: transactionId,
      provisioningError: '',
      createdAt: now,
      createdBy: profile.email || user.email || '',
      updatedAt: now,
      updatedBy: profile.email || user.email || ''
    }

    SpreadsheetService.appendRow(sheet, row)
    try {
      const result = OfficeProvisioningService.provisionEvaluationSpreadsheet({
        ...row,
        transactionId
      }, user)
      const status = result.validation.valid ? 'FOR_VALIDATION' : 'INVALID_SCHEMA'
      const updated = SpreadsheetService.updateRow(sheet, row.id, {
        spreadsheetId: result.spreadsheetId,
        spreadsheetStatus: status,
        officeStatus: result.validation.valid ? 'FOR_CONFIGURATION' : 'DRAFT',
        lastValidatedAt: now,
        provisioningError: result.validation.valid ? '' : result.validation.errors.join(' | '),
        updatedAt: new Date().toISOString(),
        updatedBy: profile.email || user.email || ''
      })
      auditCentral_('PROVISION_OFFICE', 'Office', row.officeId, transactionId, 'SUCCESS', 'Provisioned office spreadsheet for ' + row.officeCode, user)
      return {
        office: safeRegistryRow_(updated),
        validation: result.validation,
        transactionId
      }
    } catch (e) {
      SpreadsheetService.updateRow(sheet, row.id, {
        spreadsheetStatus: 'INACCESSIBLE',
        officeStatus: 'DRAFT',
        provisioningError: String(e.message || e).slice(0, 500),
        updatedAt: new Date().toISOString(),
        updatedBy: profile.email || user.email || ''
      })
      auditCentral_('PROVISION_OFFICE', 'Office', row.officeId, transactionId, 'FAILED', 'Provisioning failed for ' + row.officeCode, user)
      throw HttpError('Office provisioning failed. Review the central registry log and try again.', 500)
    }
  }

  function validate(id, user) {
    const profile = requireCentralAdmin_(user)
    const row = findByIdOrCode_(id)
    if (!row) throw HttpError('Office record not found.', 404)
    if (isStbRow_(row)) throw HttpError('STB uses the central PMES database and does not require office spreadsheet validation.', 400)
    if (!row.spreadsheetId) throw HttpError('Office has no provisioned spreadsheet to validate.', 400)
    const validation = OfficeSchemaService.validateSpreadsheet(row.spreadsheetId, row)
    SpreadsheetService.updateRow(registrySheet_(), row.id, {
      spreadsheetStatus: passingStatusFor_(row, validation),
      lastValidatedAt: new Date().toISOString(),
      provisioningError: validation.valid ? '' : validation.errors.join(' | '),
      updatedAt: new Date().toISOString(),
      updatedBy: profile.email || user.email || ''
    })
    auditCentral_('VALIDATE_OFFICE_SCHEMA', 'Office', row.officeId, '', validation.valid ? 'SUCCESS' : 'FAILED', 'Validated office schema for ' + row.officeCode, user)
    return { office: safeRegistryRow_(findByIdOrCode_(id)), validation }
  }

  // Adds headers the spec has grown since this office was provisioned —
  // e.g. an office activated before fpoPositionCategory/fpoWeightFactor were
  // added to AssessmentRecords. Only ever appends new columns to an existing
  // sheet; a missing sheet or a duplicate-header error still needs a human,
  // so this re-validates afterward and reports whatever is still wrong
  // rather than claiming success.
  function repair(id, user) {
    const profile = requireCentralAdmin_(user)
    const row = findByIdOrCode_(id)
    if (!row) throw HttpError('Office record not found.', 404)
    if (isStbRow_(row)) throw HttpError('STB uses the central PMES database and does not require office spreadsheet repair.', 400)
    if (!row.spreadsheetId) throw HttpError('Office has no provisioned spreadsheet to repair.', 400)

    const repaired = OfficeSchemaService.repairSpreadsheet(row.spreadsheetId)
    const validation = OfficeSchemaService.validateSpreadsheet(row.spreadsheetId, row)
    SpreadsheetService.updateRow(registrySheet_(), row.id, {
      spreadsheetStatus: passingStatusFor_(row, validation),
      lastValidatedAt: new Date().toISOString(),
      provisioningError: validation.valid ? '' : validation.errors.join(' | '),
      updatedAt: new Date().toISOString(),
      updatedBy: profile.email || user.email || ''
    })
    auditCentral_('REPAIR_OFFICE_SCHEMA', 'Office', row.officeId, '', validation.valid ? 'SUCCESS' : 'PARTIAL',
      'Repaired office schema for ' + row.officeCode + (repaired.length ? ': ' + repaired.join(' | ') : ' (nothing to add)'), user)
    return { office: safeRegistryRow_(findByIdOrCode_(id)), repaired, validation }
  }

  function activate(id, user) {
    const profile = requireCentralAdmin_(user)
    const row = findByIdOrCode_(id)
    if (!row) throw HttpError('Office record not found.', 404)
    if (isStbRow_(row)) throw HttpError('STB uses the central PMES database and does not require office spreadsheet activation.', 400)
    if (!row.spreadsheetId) throw HttpError('Office spreadsheet is not provisioned.', 400)
    const validation = OfficeSchemaService.validateSpreadsheet(row.spreadsheetId, row)
    if (!validation.valid) {
      SpreadsheetService.updateRow(registrySheet_(), row.id, {
        spreadsheetStatus: 'INVALID_SCHEMA',
        provisioningError: validation.errors.join(' | '),
        updatedAt: new Date().toISOString(),
        updatedBy: profile.email || user.email || ''
      })
      throw HttpError('Office cannot be activated until schema validation passes.', 409)
    }
    const updated = SpreadsheetService.updateRow(registrySheet_(), row.id, {
      officeStatus: 'ACTIVE',
      spreadsheetStatus: 'ACTIVE',
      lastValidatedAt: new Date().toISOString(),
      provisioningError: '',
      updatedAt: new Date().toISOString(),
      updatedBy: profile.email || user.email || ''
    })
    auditCentral_('ACTIVATE_OFFICE', 'Office', row.officeId, '', 'SUCCESS', 'Activated office ' + row.officeCode, user)
    return { office: safeRegistryRow_(updated), validation }
  }

  function getSpreadsheetForOffice(officeId, user) {
    const profile = AuthService.getProfile(user)
    const row = findByIdOrCode_(officeId)
    if (!row) throw HttpError('Office configuration was not found.', 404)
    if (row.officeStatus !== 'ACTIVE' || row.spreadsheetStatus !== 'ACTIVE') {
      throw HttpError('Office assessment portal is not active yet.', 409)
    }
    const profileOfficeKeys = [
      profile.officeId,
      profile.officeCode
    ].map(v => String(v || '').trim().toUpperCase()).filter(Boolean)
    const rowOfficeKeys = [
      row.officeId,
      row.officeCode
    ].map(v => String(v || '').trim().toUpperCase()).filter(Boolean)
    const sameOffice = profileOfficeKeys.some(k => rowOfficeKeys.indexOf(k) >= 0)
    if (!isCentralAdminProfile_(profile) && !sameOffice) {
      throw HttpError('Access denied to this office.', 403)
    }
    return SpreadsheetApp.openById(row.spreadsheetId)
  }

  function getSpreadsheetForCentralProcess(officeId, user) {
    const profile = AuthService.getProfile(user)
    if (!AuthService.hasPermission(profile, 'manage_users') && !isCentralAdminProfile_(profile)) {
      throw HttpError('Access denied to this office process.', 403)
    }
    const row = findByIdOrCode_(officeId)
    if (!row) throw HttpError('Office configuration was not found.', 404)
    if (row.officeStatus !== 'ACTIVE' || row.spreadsheetStatus !== 'ACTIVE') {
      throw HttpError('Office assessment portal is not active yet.', 409)
    }
    return SpreadsheetApp.openById(row.spreadsheetId)
  }

  function summarizeOffice_(row) {
    if (isStbRow_(row)) return summarizeStb_(row)

    const safe = safeRegistryRow_(row)
    const summary = {
      ...safe,
      health: 'Not ready',
      healthNote: '',
      personnel: { total: 0, active: 0, pending: 0 },
      assessments: { total: 0, computed: 0, final: 0, averageOverall: null },
      assignments: { total: 0, completed: 0, pending: 0 },
      lastActivityAt: row.lastSyncAt || row.lastValidatedAt || ''
    }

    if (!row.spreadsheetId) {
      summary.health = 'Attention'
      summary.healthNote = 'No provisioned spreadsheet.'
      return summary
    }
    if (row.officeStatus !== 'ACTIVE' || row.spreadsheetStatus !== 'ACTIVE') {
      summary.health = 'Not ready'
      summary.healthNote = 'Office is not active.'
      return summary
    }

    try {
      const ss = SpreadsheetApp.openById(row.spreadsheetId)
      const collected = SpreadsheetService.withSpreadsheet(ss, () => {
        const personnel = safeRows_('Personnel')
        const records = safeRows_('AssessmentRecords')
        const assignments = safeRows_('RaterAssignments')
        const scoreRows = records.filter(r => Number(r.overallScore) > 0)
        const latestDates = []
          .concat(records.map(r => r.updatedAt || r.createdAt || ''))
          .concat(assignments.map(r => r.updatedAt || r.createdAt || ''))
          .filter(Boolean)
          .sort()

        return {
          personnel: {
            total: personnel.length,
            active: personnel.filter(r => r.active === true || String(r.active).toLowerCase() === 'true').length,
            pending: personnel.filter(r => r.pendingActivation === true || String(r.pendingActivation).toLowerCase() === 'true').length
          },
          assessments: {
            total: records.length,
            computed: records.filter(r => String(r.status || '') === 'Computed').length,
            final: records.filter(r => String(r.status || '') === 'Final').length,
            averageOverall: scoreRows.length
              ? Math.round((scoreRows.reduce((sum, r) => sum + Number(r.overallScore || 0), 0) / scoreRows.length) * 100) / 100
              : null
          },
          assignments: {
            total: assignments.length,
            completed: assignments.filter(r => String(r.status || '') === 'Completed').length,
            pending: assignments.filter(r => String(r.status || 'Pending') !== 'Completed').length
          },
          lastActivityAt: latestDates.length ? latestDates[latestDates.length - 1] : ''
        }
      })

      summary.personnel = collected.personnel
      summary.assessments = collected.assessments
      summary.assignments = collected.assignments
      summary.lastActivityAt = collected.lastActivityAt || summary.lastActivityAt
      summary.health = 'Active'
      summary.healthNote = 'Office spreadsheet is reachable.'
    } catch (e) {
      summary.health = 'Attention'
      summary.healthNote = 'Spreadsheet is inaccessible or missing expected tabs.'
    }
    return summary
  }

  function safeRows_(sheetName) {
    try {
      return SpreadsheetService.getAllRows(SpreadsheetService.getSheet(sheetName))
    } catch (e) {
      return []
    }
  }

  function summarizeStb_(row) {
    const safe = safeRegistryRow_(row)
    const users = safeRows_(SHEET.USERS).filter(isStbUser_)
    const records = safeRows_(SHEET.IPAT_RECORDS)
    const assignments = safeRows_(SHEET.IPAT_ASSIGNMENTS)
    const scoreRows = records.filter(r => Number(r.overallScore) > 0)
    const latestDates = []
      .concat(users.map(r => r.updatedAt || r.createdAt || ''))
      .concat(records.map(r => r.updatedAt || r.createdAt || ''))
      .concat(assignments.map(r => r.updatedAt || r.createdAt || ''))
      .filter(Boolean)
      .sort()

    return {
      ...safe,
      health: 'Active',
      healthNote: 'Central PMES database is active.',
      personnel: {
        total: users.length,
        active: users.filter(isActiveRow_).length,
        pending: users.filter(r => r.pendingActivation === true || String(r.pendingActivation).toLowerCase() === 'true').length
      },
      assessments: {
        total: records.length,
        computed: records.filter(r => String(r.status || '') === 'Computed').length,
        final: records.filter(r => String(r.status || '') === 'Final').length,
        averageOverall: scoreRows.length
          ? Math.round((scoreRows.reduce((sum, r) => sum + Number(r.overallScore || 0), 0) / scoreRows.length) * 100) / 100
          : null
      },
      assignments: {
        total: assignments.length,
        completed: assignments.filter(r => String(r.status || '') === 'Completed').length,
        pending: assignments.filter(r => String(r.status || 'Pending') !== 'Completed').length
      },
      lastActivityAt: latestDates.length ? latestDates[latestDates.length - 1] : ''
    }
  }

  function isStbUser_(row) {
    const officeKey = String(row.officeId || row.officeCode || row.office || 'STB').trim().toUpperCase()
    return !officeKey || officeKey === 'STB' || officeKey === 'SOCIAL TECHNOLOGY BUREAU'
  }

  function isActiveRow_(row) {
    return row.active === true || String(row.active).toLowerCase() === 'true' || String(row.status || '').toUpperCase() === 'ACTIVE'
  }

  function requireCentralAdmin_(user) {
    const profile = AuthService.getProfile(user)
    if (!isCentralAdminProfile_(profile)) {
      throw HttpError('Access denied. Central administrator role required.', 403)
    }
    return profile
  }

  function isCentralAdminProfile_(profile) {
    return AuthService.hasPermission(profile, 'manage_office_registry') ||
      AuthService.hasPermission(profile, 'provision_office_spreadsheets') ||
      AuthService.hasPermission(profile, 'view_cluster_monitoring')
  }

  // Status to record after a validate/repair run.
  //
  // A passing check used to always write FOR_VALIDATION, including for an
  // office that was already ACTIVE — which silently took a live office
  // offline, because getSpreadsheetForOffice requires spreadsheetStatus
  // ACTIVE. Re-checking a healthy office is a read; it must not be able to
  // revoke access as a side effect. So a passing check now leaves an ACTIVE
  // office ACTIVE, and only promotes a not-yet-active office to "Ready to
  // Activate". A FAILING check still marks INVALID_SCHEMA even if the office
  // was active — a genuinely broken workbook should stop being served.
  function passingStatusFor_(row, validation) {
    if (!validation.valid) return 'INVALID_SCHEMA'
    return String(row.spreadsheetStatus || '') === 'ACTIVE' ? 'ACTIVE' : 'FOR_VALIDATION'
  }

  function requireOrgOptionsAccess_(row, user) {
    const profile = AuthService.getProfile(user)
    if (isCentralAdminProfile_(profile)) return profile

    const officeRole = String(profile.officeRole || '').toUpperCase()
    const canManageOwnOffice = officeRole === 'OFFICE_ADMIN' ||
      AuthService.hasPermission(profile, 'manage_office_users')
    if (!canManageOwnOffice) {
      throw HttpError('Access denied. Office administrator role required.', 403)
    }

    const rowOfficeKeys = officeAliasKeys_(row).map(normalizeOfficeLookupKey_).filter(Boolean)
    const profileOfficeKeys = officeAliasKeys_(profile).map(normalizeOfficeLookupKey_).filter(Boolean)
    const isOwnOffice = profileOfficeKeys.some(key => rowOfficeKeys.indexOf(key) >= 0)
    const isStb = rowOfficeKeys.indexOf('STB') >= 0 || rowOfficeKeys.indexOf('SOCIAL TECHNOLOGY BUREAU') >= 0
    if (!isOwnOffice || isStb) {
      throw HttpError('Access denied. You can only configure registration options for your own office.', 403)
    }
    return profile
  }

  function registrySheet_() {
    const ss = SpreadsheetService.getSpreadsheet()
    let sheet = ss.getSheetByName(SHEET.OFFICE_REGISTRY)
    if (!sheet) {
      sheet = ss.insertSheet(SHEET.OFFICE_REGISTRY)
      sheet.getRange(1, 1, 1, REGISTRY_HEADERS.length).setValues([REGISTRY_HEADERS])
      sheet.getRange(1, 1, 1, REGISTRY_HEADERS.length)
        .setBackground('#0D2137')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold')
      sheet.setFrozenRows(1)
    } else {
      ensureColumns_(sheet, REGISTRY_HEADERS)
    }
    return sheet
  }

  function orgOptionsSheet_() {
    const ss = SpreadsheetService.getSpreadsheet()
    const name = SHEET.OFFICE_ORG_OPTIONS || 'OfficeOrgOptions'
    let sheet = ss.getSheetByName(name)
    if (!sheet) {
      sheet = ss.insertSheet(name)
      sheet.getRange(1, 1, 1, ORG_OPTION_HEADERS.length).setValues([ORG_OPTION_HEADERS])
      sheet.getRange(1, 1, 1, ORG_OPTION_HEADERS.length)
        .setBackground('#0D2137')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold')
      sheet.setFrozenRows(1)
    } else {
      ensureColumns_(sheet, ORG_OPTION_HEADERS)
    }
    return sheet
  }

  function ensureColumns_(sheet, headers) {
    const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].filter(Boolean)
    const missing = headers.filter(h => existing.indexOf(h) < 0)
    if (missing.length) sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing])
  }

  function findByIdOrCode_(idOrCode) {
    const key = normalizeOfficeLookupKey_(idOrCode)
    if (!key) return null
    if (key === 'STB' || key === 'SOCIAL TECHNOLOGY BUREAU') return builtInStbRow_()
    return SpreadsheetService.getAllRows(registrySheet_()).find(r =>
      officeAliasKeys_(r).some(alias => normalizeOfficeLookupKey_(alias) === key)
    ) || null
  }

  function officeAliasKeys_(office) {
    const keys = [
      office && office.id,
      office && office.officeId,
      office && office.officeCode,
      office && office.officeShortName,
      office && office.officeName,
      office && office.office
    ].map(item => String(item || '').trim()).filter(Boolean)

    const normalized = keys.map(normalizeOfficeLookupKey_)
    function hasAny(candidates) {
      return candidates.some(candidate => normalized.indexOf(normalizeOfficeLookupKey_(candidate)) >= 0)
    }
    function add(items) {
      items.forEach(item => {
        const value = String(item || '').trim()
        if (value && keys.indexOf(value) < 0) keys.push(value)
      })
    }

    if (hasAny(['WGP', 'WALANG-GUTOM', 'WALANG GUTOM', 'WALANG GUTOM PROGRAM', 'OFF-WALANG-GUTOM'])) {
      add(['WGP', 'WALANG-GUTOM', 'WALANG GUTOM PROGRAM', 'OFF-WALANG-GUTOM'])
    }
    if (hasAny(['TBTP', 'TARA-BASA', 'TARA BASA', 'TARA BASA TUTORING PROGRAM', 'TARA, BASA! TUTORING PROGRAM', 'OFF-TARA-BASA'])) {
      add(['TBTP', 'TARA-BASA', 'TARA BASA TUTORING PROGRAM', 'OFF-TARA-BASA'])
    }

    return keys
  }

  function normalizeOfficeLookupKey_(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[!,.]/g, '')
      .replace(/\s+/g, ' ')
  }

  function normalizeInput_(body) {
    return {
      officeCode: String(body.officeCode || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, ''),
      officeName: String(body.officeName || '').trim(),
      officeShortName: String(body.officeShortName || '').trim(),
      primaryAdminEmail: String(body.primaryAdminEmail || '').trim().toLowerCase()
    }
  }

  function validateInput_(input) {
    if (!/^[A-Z0-9-]{2,24}$/.test(input.officeCode)) {
      throw HttpError('Office code must be 2-24 letters, numbers, or hyphens.', 400)
    }
    if (!input.officeName) throw HttpError('Office name is required.', 400)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.primaryAdminEmail)) {
      throw HttpError('A valid primary administrator email is required.', 400)
    }
  }

  function safeRegistryRow_(row) {
    // spreadsheetId is credential-like — it can open the office's spreadsheet
    // directly — so that alone is stripped. provisioningError is diagnostic
    // text only, and every caller of this function already sits behind
    // requireCentralAdmin_; stripping it just hid the reason a "Needs Repair"
    // office needs repair from the only people allowed to see this screen,
    // with no way to recover it short of re-running Validate.
    const { spreadsheetId, provisioningError, ...safe } = row || {}
    return {
      ...safe,
      provisioningError: provisioningError || '',
      hasSpreadsheet: !!spreadsheetId,
      hasProvisioningError: !!provisioningError
    }
  }

  function includeBuiltInStb_(rows) {
    const source = rows || []
    const hasStb = source.some(isStbRow_)
    return hasStb ? source : [builtInStbRow_()].concat(source)
  }

  function builtInStbRow_() {
    return {
      id: 'STB',
      officeId: 'STB',
      officeCode: 'STB',
      officeName: 'Social Technology Bureau',
      officeShortName: 'STB',
      primaryAdminEmail: 'systemadmin@dswd.gov.ph',
      officeStatus: 'ACTIVE',
      portalScope: 'STB_FULL',
      spreadsheetId: 'CENTRAL_PMES',
      spreadsheetStatus: 'ACTIVE',
      schemaVersion: 'CENTRAL_PMES',
      templateVersion: 'STB_FULL',
      lastValidatedAt: '',
      lastSyncAt: '',
      provisioningTransactionId: '',
      provisioningError: '',
      createdAt: '',
      createdBy: 'SYSTEM',
      updatedAt: '',
      updatedBy: 'SYSTEM'
    }
  }

  function isStbRow_(row) {
    const officeId = String(row && row.officeId || '').trim().toUpperCase()
    const officeCode = String(row && row.officeCode || '').trim().toUpperCase()
    const officeName = String(row && row.officeName || '').trim().toUpperCase()
    return officeId === 'STB' || officeCode === 'STB' || officeName === 'SOCIAL TECHNOLOGY BUREAU'
  }

  function getOrgOptionsForOffice_(officeId) {
    const rows = SpreadsheetService.getAllRows(orgOptionsSheet_())
      .filter(row =>
        String(row.officeId || '') === String(officeId || '') &&
        row.active !== false &&
        String(row.active).toLowerCase() !== 'false'
      )
      .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0) || String(a.name || '').localeCompare(String(b.name || '')))
    return orgOptionsFromRows_(rows)
  }

  function orgOptionsFromRows_(rows) {
    const divisions = rows
      .filter(row => row.optionType === 'division')
      .map(row => ({ id: row.id, officeId: row.officeId, name: row.name, code: row.code || '' }))
    const sections = rows
      .filter(row => row.optionType === 'section')
      .map(row => ({ id: row.id, officeId: row.officeId, divisionId: row.parentId || '', name: row.name, code: row.code || '' }))
    const requestedRoles = rows
      .filter(row => row.optionType === 'role')
      .map(row => row.name)
      .filter(Boolean)
    return {
      divisions,
      sections,
      requestedRoles: requestedRoles.length ? requestedRoles : DEFAULT_REQUESTED_ROLES
    }
  }

  function replaceOrgOptionRows_(officeId, replacementRows) {
    const sheet = orgOptionsSheet_()
    const lastColumn = Math.max(sheet.getLastColumn(), ORG_OPTION_HEADERS.length)
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    const lastRow = sheet.getLastRow()
    const existing = lastRow > 1
      ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues()
      : []
    const officeIdIdx = headers.indexOf('officeId')
    const keptRows = existing.filter(row => String(row[officeIdIdx] || '') !== officeId)
    const replacementValues = replacementRows.map(item => headers.map(header => {
      const value = item[header]
      return value === undefined || value === null ? '' : value
    }))
    const values = keptRows.concat(replacementValues)

    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, lastColumn).clearContent()
    }
    if (values.length) {
      sheet.getRange(2, 1, values.length, lastColumn).setValues(values)
    }
    try {
      if (typeof DataCacheService !== 'undefined') {
        DataCacheService.invalidate(sheet.getParent().getId(), sheet.getName())
      }
    } catch (e) {
      Logger.log('[OfficeRegistry] org options cache invalidation failed: ' + (e && e.message || e))
    }
  }

  function normalizeOptionList_(value, optionType) {
    const source = Array.isArray(value)
      ? value
      : String(value || '').split(/\r?\n/).map(line => {
        const parts = line.split('|').map(item => item.trim())
        if (optionType === 'section') {
          return parts.length > 1
            ? { divisionName: parts[0], name: parts.slice(1).join(' | ') }
            : { name: parts[0] }
        }
        return parts.length > 1
          ? { code: parts[0], name: parts.slice(1).join(' | ') }
          : { name: parts[0] }
      })
    return source
      .map((item, index) => ({
        id: String(item.id || '').trim(),
        optionType,
        parentId: String(item.parentId || item.divisionId || '').trim(),
        divisionName: String(item.divisionName || item.parentName || '').trim(),
        name: String(item.name || item.label || item.value || item).trim(),
        code: String(item.code || '').trim(),
        sequence: Number(item.sequence || index + 1)
      }))
      .filter(item => item.name)
  }

  function optionId_(officeId, prefix, value) {
    const slug = String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || Utilities.getUuid().slice(0, 8)
    return [officeId, prefix, slug].join('-')
  }

  function auditCentral_(action, entityType, entityId, transactionId, result, summary, user) {
    try {
      AuditService.log(action, 'Office Registry', summary, user)
    } catch (e) {
      Logger.log('[OfficeRegistry] AuditService log failed: ' + e.message)
    }
  }

  return {
    list,
    picker,
    get,
    repair,
    monitoring,
    registrationOptions,
    registrationOrgOptions,
    orgOptions,
    saveOrgOptions,
    resolveRegistrationOffice,
    provision,
    validate,
    activate,
    getSpreadsheetForCentralProcess,
    getSpreadsheetForOffice
  }
})()
