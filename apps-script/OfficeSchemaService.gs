const OfficeSchemaService = (() => {
  const SCHEMA_VERSION = 'ICPAP_SCHEMA_V1'
  const TEMPLATE_VERSION = 'ICPAP_TEMPLATE_V1'

  const SHEETS = {
    OfficeConfig: [
      'id', 'officeId', 'officeCode', 'officeName', 'officeShortName',
      'officeStatus', 'spreadsheetStatus', 'schemaVersion', 'templateVersion',
      'primaryAdminEmail', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'
    ],
    Personnel: [
      'id', 'uid', 'email', 'fullName', 'employeeNo', 'position', 'positionLevel',
      'role', 'divisionId', 'divisionName',
      'organizationalUnitId', 'organizationalUnitName', 'section', 'officeRole',
      'systemScope', 'accountStatus', 'active', 'pendingActivation',
      'createdAt', 'updatedAt', 'validatedAt', 'validatedBy'
    ],
    OrganizationalUnits: [
      'id', 'officeId', 'name', 'code', 'parentId', 'unitType', 'active',
      'sequence', 'createdAt', 'updatedAt'
    ],
    Positions: [
      'id', 'officeId', 'title', 'positionLevel', 'roleEquivalent',
      'reportsToLevel', 'active', 'sequence', 'createdAt', 'updatedAt'
    ],
    AssessmentPeriods: [
      'id', 'officeId', 'semester', 'year', 'name', 'startDate', 'endDate',
      'status', 'createdAt', 'updatedAt'
    ],
    AssessmentRules: [
      'id', 'officeId', 'ruleType', 'ruleKey', 'label', 'value',
      'active', 'description', 'createdAt', 'updatedAt', 'updatedBy'
    ],
    AssessmentCategories: [
      'id', 'domainId', 'domainName', 'categoryId', 'categoryName',
      'description', 'sequence', 'status', 'templateVersion',
      'createdAt', 'updatedAt'
    ],
    AssessmentContent: [
      'id', 'domain', 'category', 'questionText', 'guidanceText', 'sequence',
      'scaleType', 'required', 'evidenceRequired', 'applicableRaters',
      'applicableLevels', 'status', 'period', 'version', 'templateVersion',
      'createdAt', 'updatedAt'
    ],
    RaterAssignments: [
      'id', 'officeId', 'semester', 'year',
      'rateeId', 'rateeName', 'rateeDivisionId', 'rateeUnitId', 'rateeRole', 'rateeSection',
      'raterId', 'raterName', 'raterType', 'ipatRecordId', 'assessmentRecordId',
      'status', 'createdAt', 'updatedAt'
    ],
    RatingDrafts: [
      'id', 'officeId', 'assignmentId', 'rateeId', 'raterId',
      'cbcRatingsJson', 'jfRatingsJson', 'savedAt', 'updatedAt'
    ],
    CompetencyBehaviorRatings: [
      'id', 'officeId', 'ipatId', 'assessmentRecordId', 'rateeId', 'raterId',
      'raterName', 'raterType', 'themeId', 'themeName', 'indicator',
      'indicatorIdx', 'rating', 'semester', 'year', 'createdAt', 'updatedAt'
    ],
    JobFitnessRatings: [
      'id', 'officeId', 'ipatId', 'assessmentRecordId', 'rateeId', 'raterId',
      'raterName', 'raterType', 'indicator', 'indicatorIdx', 'rating',
      'evidence', 'semester', 'year', 'createdAt', 'updatedAt'
    ],
    AssessmentRecords: [
      'id', 'officeId', 'rateeId', 'rateeName',
      'divisionId', 'divisionName', 'organizationalUnitId',
      'position', 'positionLevel', 'semester', 'year', 'hasSubordinate', 'status',
      'cbcBaseScore', 'cbcScore', 'fpoScore', 'jfScore', 'overallScore',
      'descriptor', 'ipcrfFormId', 'fpoPositionCategory', 'fpoWeightFactor',
      'cbcNteLevel', 'cbcNteDeductionPct', 'cbcOffenseLevel', 'cbcOffenseDeduction',
      'cbcDeductionNote', 'cbcDeductionBy', 'cbcDeductionByName', 'cbcDeductionAt',
      'createdAt', 'updatedAt'
    ],
    Notifications: [
      'id', 'officeId', 'recipientId', 'type', 'message', 'relatedId',
      'module', 'read', 'readAt', 'createdAt'
    ],
    AuditLogs: [
      'id', 'timestamp', 'userId', 'userEmail', 'userName', 'officeId',
      'action', 'entityType', 'entityId', 'transactionId', 'result',
      'summary', 'createdAt'
    ],
    SchemaVersion: [
      'id', 'officeId', 'schemaVersion', 'templateVersion', 'validatedAt',
      'validatedBy', 'status', 'notes'
    ]
  }

  const EXCLUDED_STB_SHEETS = [
    'Users', 'Divisions', 'Sections', 'KRAs', 'SuccessIndicators',
    'Accomplishments', 'Revisions', 'FocalAssignments', 'ReviewComments',
    'MOVFiles', 'Evaluations', 'Reports', 'Deadlines', 'IPCRForms',
    'FormEntries', 'JRBRatings', 'PeerAssignments', 'AttendanceRecords',
    'AttendanceRatings', 'IPATRecords', 'IPATCBCRatings', 'IPATJFRatings',
    'IPATRaterAssignments', 'AssessmentResults', 'RatingResponses',
    'MasterKRALibrary', 'SystemSettings', 'AuditLog'
  ]

  function getSpec() {
    return {
      schemaVersion: SCHEMA_VERSION,
      templateVersion: TEMPLATE_VERSION,
      sheets: SHEETS,
      excludedStbSheets: EXCLUDED_STB_SHEETS
    }
  }

  function initializeSpreadsheet(ss, office, user) {
    const now = new Date().toISOString()
    Object.keys(SHEETS).forEach(name => {
      let sheet = ss.getSheetByName(name)
      if (!sheet) sheet = ss.insertSheet(name)
      setHeaders_(sheet, SHEETS[name])
    })

    const defaultSheet = ss.getSheetByName('Sheet1')
    if (defaultSheet && Object.keys(SHEETS).length > 1) ss.deleteSheet(defaultSheet)

    appendByHeaders_(ss.getSheetByName('OfficeConfig'), {
      id: 'CFG-' + office.officeId,
      officeId: office.officeId,
      officeCode: office.officeCode,
      officeName: office.officeName,
      officeShortName: office.officeShortName || office.officeCode,
      officeStatus: 'FOR_CONFIGURATION',
      spreadsheetStatus: 'FOR_VALIDATION',
      schemaVersion: SCHEMA_VERSION,
      templateVersion: TEMPLATE_VERSION,
      primaryAdminEmail: office.primaryAdminEmail || '',
      createdAt: now,
      createdBy: user.email || '',
      updatedAt: now,
      updatedBy: user.email || ''
    })

    appendByHeaders_(ss.getSheetByName('SchemaVersion'), {
      id: 'SCH-' + office.officeId,
      officeId: office.officeId,
      schemaVersion: SCHEMA_VERSION,
      templateVersion: TEMPLATE_VERSION,
      validatedAt: '',
      validatedBy: '',
      status: 'PENDING_VALIDATION',
      notes: ''
    })

    appendByHeaders_(ss.getSheetByName('AuditLogs'), {
      id: 'AUD-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12),
      timestamp: now,
      userId: '',
      userEmail: user.email || '',
      userName: user.name || user.email || '',
      officeId: office.officeId,
      action: 'PROVISION_SPREADSHEET',
      entityType: 'Office',
      entityId: office.officeId,
      transactionId: office.transactionId || '',
      result: 'STARTED',
      summary: 'Evaluation-only office spreadsheet initialized.',
      createdAt: now
    })

    if (typeof AssessmentRulesService !== 'undefined') {
      AssessmentRulesService.ensureDefaultsForSpreadsheet(ss, office, user)
    }
    copyAssessmentReference_(ss)
    applyProtections_(ss)
    return validateSpreadsheet(ss.getId(), office)
  }

  function validateSpreadsheet(spreadsheetId, office) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      schemaVersion: SCHEMA_VERSION,
      templateVersion: TEMPLATE_VERSION
    }
    let ss
    try {
      ss = SpreadsheetApp.openById(spreadsheetId)
    } catch (e) {
      return {
        valid: false,
        errors: ['Spreadsheet is inaccessible to the backend.'],
        warnings: [],
        schemaVersion: SCHEMA_VERSION,
        templateVersion: TEMPLATE_VERSION
      }
    }

    Object.keys(SHEETS).forEach(name => {
      const sheet = ss.getSheetByName(name)
      if (!sheet) {
        result.valid = false
        result.errors.push('Missing required sheet: ' + name)
        return
      }
      const headers = getHeaders_(sheet)
      const duplicates = headers.filter((h, idx) => h && headers.indexOf(h) !== idx)
      if (duplicates.length) {
        result.valid = false
        result.errors.push('Duplicate headers in ' + name + ': ' + Array.from(new Set(duplicates)).join(', '))
      }
      const missing = SHEETS[name].filter(h => headers.indexOf(h) < 0)
      if (missing.length) {
        result.valid = false
        result.errors.push('Missing headers in ' + name + ': ' + missing.join(', '))
      }
    })

    EXCLUDED_STB_SHEETS.forEach(name => {
      if (ss.getSheetByName(name)) {
        result.valid = false
        result.errors.push('STB-only sheet must not exist in office spreadsheet: ' + name)
      }
    })

    const config = readFirstRow_(ss.getSheetByName('OfficeConfig'))
    if (config.officeId !== office.officeId) {
      result.valid = false
      result.errors.push('OfficeConfig officeId does not match registry.')
    }
    if (config.officeCode !== office.officeCode) {
      result.valid = false
      result.errors.push('OfficeConfig officeCode does not match registry.')
    }
    if (config.schemaVersion !== SCHEMA_VERSION) {
      result.valid = false
      result.errors.push('Unsupported schema version.')
    }
    if (config.templateVersion !== TEMPLATE_VERSION) {
      result.valid = false
      result.errors.push('Unsupported template version.')
    }

    if (ss.getSheetByName('AssessmentCategories').getLastRow() < 2) {
      result.valid = false
      result.errors.push('AssessmentCategories has no approved reference rows.')
    }
    if (ss.getSheetByName('AssessmentContent').getLastRow() < 2) {
      result.valid = false
      result.errors.push('AssessmentContent has no approved reference rows.')
    }

    return result
  }

  // Appends headers the current spec requires but an already-provisioned
  // office spreadsheet predates — e.g. fpoPositionCategory/fpoWeightFactor,
  // added to AssessmentRecords after some offices were already provisioned.
  // Only ever adds new columns at the end via getRange(...).setValues(); it
  // never touches setHeaders_'s sheet.clear() path, so existing rows and
  // columns are untouched. A sheet that's missing entirely, or a duplicate
  // header, is a different class of problem this does not attempt to fix —
  // those still surface through validateSpreadsheet as before.
  function repairMissingHeaders_(ss) {
    const repaired = []
    Object.keys(SHEETS).forEach(name => {
      const sheet = ss.getSheetByName(name)
      if (!sheet) return
      const headers = getHeaders_(sheet)
      const missing = SHEETS[name].filter(h => headers.indexOf(h) < 0)
      if (!missing.length) return
      sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing])
      sheet.getRange(1, headers.length + 1, 1, missing.length)
        .setBackground('#0D2137')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold')
        .setFontSize(10)
      repaired.push(name + ': ' + missing.join(', '))
    })
    if (repaired.length) SpreadsheetApp.flush()
    return repaired
  }

  function repairSpreadsheet(spreadsheetId) {
    const ss = SpreadsheetApp.openById(spreadsheetId)
    return repairMissingHeaders_(ss)
  }

  function setHeaders_(sheet, headers) {
    sheet.clear()
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#0D2137')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setFontSize(10)
    sheet.setFrozenRows(1)
    sheet.autoResizeColumns(1, headers.length)
  }

  function getHeaders_(sheet) {
    if (!sheet || sheet.getLastColumn() < 1) return []
    return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim())
  }

  function appendByHeaders_(sheet, row) {
    const headers = getHeaders_(sheet)
    sheet.appendRow(headers.map(h => row[h] === undefined || row[h] === null ? '' : row[h]))
  }

  function readFirstRow_(sheet) {
    if (!sheet || sheet.getLastRow() < 2) return {}
    const headers = getHeaders_(sheet)
    const values = sheet.getRange(2, 1, 1, headers.length).getValues()[0]
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] })
    return row
  }

  function copyAssessmentReference_(targetSs) {
    copyRows_(SHEET.ASSESSMENT_CATEGORIES, targetSs.getSheetByName('AssessmentCategories'), [
      'id', 'domainId', 'domainName', 'categoryId', 'categoryName', 'description', 'sequence', 'status'
    ])
    copyRows_(SHEET.ASSESSMENT_CONTENT, targetSs.getSheetByName('AssessmentContent'), [
      'id', 'domain', 'category', 'questionText', 'guidanceText', 'sequence',
      'scaleType', 'required', 'evidenceRequired', 'applicableRaters',
      'applicableLevels', 'status', 'period', 'version'
    ])
  }

  function copyRows_(sourceSheetName, targetSheet, columns) {
    try {
      const source = SpreadsheetService.getSheet(sourceSheetName)
      const rows = SpreadsheetService.getAllRows(source)
        .filter(r => !r.status || ['Active', 'Published'].indexOf(String(r.status)) >= 0)
      const headers = getHeaders_(targetSheet)
      rows.forEach(row => {
        const next = {}
        columns.forEach(col => { next[col] = row[col] || '' })
        next.templateVersion = TEMPLATE_VERSION
        next.createdAt = row.createdAt || new Date().toISOString()
        next.updatedAt = row.updatedAt || ''
        targetSheet.appendRow(headers.map(h => next[h] === undefined || next[h] === null ? '' : next[h]))
      })
    } catch (e) {
      Logger.log('[OfficeSchema] Reference copy skipped for ' + sourceSheetName + ': ' + e.message)
    }
  }

  function applyProtections_(ss) {
    Object.keys(SHEETS).forEach(name => {
      const sheet = ss.getSheetByName(name)
      if (!sheet) return
      try {
        const protection = sheet.getRange(1, 1, 1, sheet.getLastColumn()).protect()
        protection.setDescription('Protected ICPAP structural headers: ' + name)
        protection.setWarningOnly(true)
      } catch (e) {
        Logger.log('[OfficeSchema] Could not protect headers for ' + name + ': ' + e.message)
      }
    })
  }

  return {
    getSpec,
    initializeSpreadsheet,
    validateSpreadsheet,
    repairSpreadsheet
  }
})()
