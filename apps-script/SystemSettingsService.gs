const SystemSettingsService = (() => {
  const ACCESS_MODE_KEY = 'systemAccessMode'
  const MODE_EVALUATION_ONLY = 'evaluation_only'
  const MODE_FULL_ACCESS = 'full_access'
  const HEADERS = ['id', 'key', 'value', 'description', 'updatedBy', 'updatedByName', 'updatedAt']

  function ensureSheet_() {
    const ss = SpreadsheetService.getSpreadsheet()
    const name = SHEET.SYSTEM_SETTINGS || 'SystemSettings'
    let sheet = ss.getSheetByName(name)
    if (!sheet) {
      sheet = ss.insertSheet(name)
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      sheet.setFrozenRows(1)
    }

    const lastCol = Math.max(sheet.getLastColumn(), 1)
    const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].filter(Boolean)
    const missing = HEADERS.filter(h => existing.indexOf(h) < 0)
    if (missing.length) {
      sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing])
    }
    seedDefaults_(sheet)
    return sheet
  }

  function seedDefaults_(sheet) {
    const rows = SpreadsheetService.getAllRows(sheet)
    if (rows.some(r => r.key === ACCESS_MODE_KEY)) return
    SpreadsheetService.appendRow(sheet, {
      id: SpreadsheetService.generateId('SET-'),
      key: ACCESS_MODE_KEY,
      value: MODE_EVALUATION_ONLY,
      description: 'Controls whether normal users see only Evaluation or the full PMES modules.',
      updatedBy: 'system',
      updatedByName: 'System Default',
      updatedAt: new Date().toISOString()
    })
  }

  function normaliseAccessMode_(value) {
    return value === MODE_FULL_ACCESS ? MODE_FULL_ACCESS : MODE_EVALUATION_ONLY
  }

  function getAccessMode() {
    try {
      const sheet = ensureSheet_()
      const row = SpreadsheetService.getAllRows(sheet).find(r => r.key === ACCESS_MODE_KEY)
      return normaliseAccessMode_(row && row.value)
    } catch (e) {
      Logger.log('[SystemSettings] getAccessMode fallback: ' + e.message)
      return MODE_EVALUATION_ONLY
    }
  }

  function list(user) {
    AuthService.requirePermission(user, 'manage_users')
    return {
      accessMode: getAccessMode(),
      modes: [
        {
          value: MODE_EVALUATION_ONLY,
          label: 'Evaluation Monitoring only',
          description: 'Regular users can only access Evaluation and Profile Settings. Hidden module deep links redirect back to Evaluation.'
        },
        {
          value: MODE_FULL_ACCESS,
          label: 'Full module access',
          description: 'Users can access modules allowed by their role and permissions.'
        }
      ]
    }
  }

  function update(body, user) {
    const profile = AuthService.requirePermission(user, 'manage_users')
    const mode = normaliseAccessMode_(body.accessMode)
    const sheet = ensureSheet_()
    const rows = SpreadsheetService.getAllRows(sheet)
    const row = rows.find(r => r.key === ACCESS_MODE_KEY)
    const payload = {
      key: ACCESS_MODE_KEY,
      value: mode,
      description: 'Controls whether normal users see only Evaluation or the full PMES modules.',
      updatedBy: profile.id,
      updatedByName: profile.fullName || profile.email || '',
      updatedAt: new Date().toISOString()
    }

    if (row) {
      SpreadsheetService.updateRow(sheet, row.id, payload)
    } else {
      SpreadsheetService.appendRow(sheet, {
        id: SpreadsheetService.generateId('SET-'),
        ...payload
      })
    }

    AuditService.log('UPDATE_SYSTEM_SETTINGS', 'SystemSettings', `Access mode changed to ${mode}`, user)
    return list(user)
  }

  return {
    getAccessMode,
    list,
    update
  }
})()
