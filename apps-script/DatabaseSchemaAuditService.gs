/**
 * DatabaseSchemaAuditService.gs
 *
 * Read-only schema audit for rollout checks. It compares the live central PMES
 * workbook and every registered office workbook against the schema expected by
 * the deployed backend. It never repairs, seeds, clears, or writes data.
 */

function runDatabaseSchemaAudit() {
  return DatabaseSchemaAuditService.run()
}

const DatabaseSchemaAuditService = (() => {
  function runForUser(user) {
    AuthService.requirePermission(user, 'manage_database')
    return run()
  }

  function run() {
    const generatedAt = new Date().toISOString()
    const central = SpreadsheetService.withCentralSpreadsheet(() => {
      const ss = SpreadsheetService.getSpreadsheet()
      const schema = DatabaseMaintenanceService.getSpec().activeSchema
      return auditSpreadsheet_(ss, schema, [])
    })

    const officeSpec = OfficeSchemaService.getSpec()
    const officeSchema = Object.keys(officeSpec.sheets).map(name => ({
      name,
      headers: officeSpec.sheets[name]
    }))
    const offices = SpreadsheetService.withCentralSpreadsheet(() => officeRegistryRows_())
      .map(row => auditOffice_(row, officeSchema, officeSpec.excludedStbSheets))

    const officeTotals = offices.reduce((acc, item) => {
      acc.total += 1
      if (item.ok) acc.ok += 1
      if (item.skipped) acc.skipped += 1
      if (item.errors && item.errors.length) acc.withErrors += 1
      if (item.warnings && item.warnings.length) acc.withWarnings += 1
      return acc
    }, { total: 0, ok: 0, skipped: 0, withErrors: 0, withWarnings: 0 })

    return {
      generatedAt,
      central: summarizeAudit_(central),
      offices,
      summary: {
        clean: central.ok && offices.every(item => item.ok || item.skipped),
        centralOk: central.ok,
        officeTotals
      }
    }
  }

  function auditOffice_(row, schema, excludedSheets) {
    const officeId = String(row.officeId || '').trim()
    const officeName = String(row.officeName || row.officeCode || officeId || '').trim()
    const spreadsheetId = String(row.spreadsheetId || '').trim()
    if (!spreadsheetId) {
      return {
        officeId,
        officeName,
        skipped: true,
        ok: false,
        errors: ['No spreadsheetId registered for this office.'],
        warnings: []
      }
    }

    try {
      const ss = SpreadsheetApp.openById(spreadsheetId)
      const audit = auditSpreadsheet_(ss, schema, excludedSheets)
      const validation = OfficeSchemaService.validateSpreadsheet(spreadsheetId, row)
      const errors = audit.errors.concat(validation.errors || [])
      const warnings = audit.warnings.concat(validation.warnings || [])
      return {
        officeId,
        officeCode: row.officeCode || '',
        officeName,
        spreadsheetStatus: row.spreadsheetStatus || '',
        ok: audit.ok && validation.valid,
        errors: unique_(errors),
        warnings: unique_(warnings),
        sheetsChecked: audit.sheetsChecked,
        rowCounts: audit.rowCounts,
        details: audit.details.filter(item => !item.ok)
      }
    } catch (e) {
      return {
        officeId,
        officeCode: row.officeCode || '',
        officeName,
        spreadsheetStatus: row.spreadsheetStatus || '',
        ok: false,
        errors: ['Spreadsheet cannot be opened: ' + String(e && e.message || e)],
        warnings: []
      }
    }
  }

  function auditSpreadsheet_(ss, schema, forbiddenSheetNames) {
    const expectedNames = schema.map(item => item.name)
    const existingNames = ss.getSheets().map(sheet => sheet.getName())
    const expectedSet = toSet_(expectedNames)
    const forbiddenSet = toSet_(forbiddenSheetNames || [])
    const errors = []
    const warnings = []
    const details = []
    const rowCounts = {}

    schema.forEach(item => {
      const sheet = ss.getSheetByName(item.name)
      if (!sheet) {
        errors.push('Missing required sheet: ' + item.name)
        details.push({ name: item.name, ok: false, exists: false, missingHeaders: item.headers })
        return
      }

      const headers = getHeaders_(sheet)
      const duplicateHeaders = duplicates_(headers)
      const missingHeaders = item.headers.filter(header => headers.indexOf(header) < 0)
      const expectedPrefix = headers.slice(0, item.headers.length)
      const orderMismatch = expectedPrefix.join('\u0001') !== item.headers.join('\u0001')
      const extraHeaders = headers.filter(header => item.headers.indexOf(header) < 0)
      const ok = !duplicateHeaders.length && !missingHeaders.length && !orderMismatch

      if (duplicateHeaders.length) errors.push('Duplicate headers in ' + item.name + ': ' + duplicateHeaders.join(', '))
      if (missingHeaders.length) errors.push('Missing headers in ' + item.name + ': ' + missingHeaders.join(', '))
      if (orderMismatch) warnings.push('Header order differs in ' + item.name + '.')
      if (extraHeaders.length) warnings.push('Extra headers in ' + item.name + ': ' + extraHeaders.join(', '))

      rowCounts[item.name] = Math.max(sheet.getLastRow() - 1, 0)
      details.push({
        name: item.name,
        ok,
        exists: true,
        rows: rowCounts[item.name],
        missingHeaders,
        duplicateHeaders,
        extraHeaders,
        orderMismatch
      })
    })

    existingNames.forEach(name => {
      if (forbiddenSet[name]) errors.push('Forbidden sheet exists: ' + name)
      if (!expectedSet[name] && !forbiddenSet[name]) warnings.push('Unexpected sheet exists: ' + name)
    })

    return {
      ok: errors.length === 0,
      errors: unique_(errors),
      warnings: unique_(warnings),
      sheetsChecked: schema.length,
      rowCounts,
      details
    }
  }

  function officeRegistryRows_() {
    const sheet = SpreadsheetService.findSheet(SHEET.OFFICE_REGISTRY || 'OfficeRegistry')
    if (!sheet) return []
    return SpreadsheetService.getAllRows(sheet)
      .filter(row => String(row.officeStatus || '').toUpperCase() !== 'ARCHIVED')
      .filter(row => String(row.spreadsheetId || '').trim())
  }

  function summarizeAudit_(audit) {
    return {
      ok: audit.ok,
      errors: audit.errors,
      warnings: audit.warnings,
      sheetsChecked: audit.sheetsChecked,
      rowCounts: audit.rowCounts,
      details: audit.details.filter(item => !item.ok)
    }
  }

  function getHeaders_(sheet) {
    if (!sheet || sheet.getLastColumn() < 1) return []
    return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(value => String(value || '').trim())
      .filter(Boolean)
  }

  function duplicates_(items) {
    const seen = {}
    const dupes = {}
    items.forEach(item => {
      if (!item) return
      if (seen[item]) dupes[item] = true
      seen[item] = true
    })
    return Object.keys(dupes)
  }

  function unique_(items) {
    const seen = {}
    return (items || []).filter(item => {
      const key = String(item || '')
      if (!key || seen[key]) return false
      seen[key] = true
      return true
    })
  }

  function toSet_(items) {
    return (items || []).reduce((acc, item) => {
      acc[item] = true
      return acc
    }, {})
  }

  return { run, runForUser }
})()
