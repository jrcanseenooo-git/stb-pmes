/**
 * MigrationOpenAssessmentLevels.gs
 *
 * One-off migration. Run once from the Apps Script editor's Run dropdown.
 *
 * WHY
 * Every assessment question written before this change carries
 * applicableLevels = ["Technical Staff","Section Head","Division Chief"] -
 * STB's three-rung ladder, which the old code hardcoded as the only vocabulary.
 * The offices in the cluster define twelve distinct roles between them (Admin
 * Staff, Assistant Division Chief, Deputy Program Manager, National Program
 * Manager, Director, Undersecretary and more). A ratee holding any of the other
 * nine matched NO question, so their raters opened an empty form: nothing to
 * answer, and no way to submit.
 *
 * WHAT IT DOES
 * Clears applicableLevels to [] on every question whose list is exactly that
 * legacy trio. An empty list means "applies to every role", which is the intent
 * for the general HEARTWORK and Job Fitness items. Questions an administrator
 * has deliberately targeted at some other set of roles are left untouched.
 *
 * Runs against the central workbook and every ACTIVE office workbook, because
 * office spreadsheets are provisioned with a copied snapshot of the questions.
 *
 * SAFE TO RE-RUN. Rows already cleared no longer match the legacy trio, so a
 * second run reports 0 changes. It only ever widens who can be assessed - it
 * never narrows a form or touches a submitted rating.
 */

// No trailing underscore: this must stay visible in the editor's Run dropdown.
function migrateOpenAssessmentLevels() {
  return MigrationOpenAssessmentLevels_.run({ dryRun: false })
}

// Prints exactly what a real run would change, without writing anything.
function previewOpenAssessmentLevels() {
  return MigrationOpenAssessmentLevels_.run({ dryRun: true })
}

const MigrationOpenAssessmentLevels_ = (() => {
  const LEGACY_TRIO = ['Technical Staff', 'Section Head', 'Division Chief']

  function isLegacyTrio_(raw) {
    let list = raw
    if (typeof list === 'string') {
      const text = String(list).trim()
      if (!text) return false
      try {
        list = JSON.parse(text)
      } catch (e) {
        list = text.split(',').map(v => v.trim()).filter(Boolean)
      }
    }
    if (!Array.isArray(list) || list.length !== LEGACY_TRIO.length) return false
    const keys = list.map(v => String(v || '').trim().toLowerCase()).sort()
    const want = LEGACY_TRIO.map(v => v.toLowerCase()).sort()
    return keys.join('|') === want.join('|')
  }

  function migrateOneWorkbook_(ss, label, dryRun) {
    const sheet = ss.getSheetByName('AssessmentContent')
    if (!sheet) return { label, skipped: 'no AssessmentContent tab', changed: 0, scanned: 0 }

    const lastRow = sheet.getLastRow()
    const lastCol = sheet.getLastColumn()
    if (lastRow < 2 || lastCol < 1) return { label, skipped: 'no question rows', changed: 0, scanned: 0 }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    const col = headers.indexOf('applicableLevels')
    if (col < 0) return { label, skipped: 'no applicableLevels column', changed: 0, scanned: 0 }

    const range = sheet.getRange(2, col + 1, lastRow - 1, 1)
    const values = range.getValues()
    let changed = 0
    values.forEach((row, i) => {
      if (!isLegacyTrio_(row[0])) return
      values[i][0] = '[]'
      changed++
    })

    // One setValues for the whole column rather than a write per row.
    if (changed && !dryRun) {
      range.setValues(values)
      try { SpreadsheetService.invalidateSheet(sheet) } catch (e) { /* cache is optional */ }
    }
    return { label, changed, scanned: values.length }
  }

  function run(options) {
    const dryRun = !!(options && options.dryRun)
    const results = []

    results.push(migrateOneWorkbook_(
      SpreadsheetApp.openById(SpreadsheetService.getSpreadsheetId()),
      'CENTRAL',
      dryRun
    ))

    // Office workbooks hold a provisioned copy of the same questions. Read the
    // registry from the central workbook explicitly: this runs from the editor
    // with no office scope in effect, and the registry lives centrally.
    let offices = []
    try {
      offices = SpreadsheetService.withCentralSpreadsheet(() =>
        SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.OFFICE_REGISTRY))
      )
    } catch (e) {
      results.push({ label: 'OFFICE REGISTRY', skipped: 'unreadable: ' + e.message, changed: 0, scanned: 0 })
    }

    offices.forEach(office => {
      const id = String(office.spreadsheetId || '').trim()
      const name = String(office.officeCode || office.officeId || office.id || '?')
      if (!id) return
      if (String(office.spreadsheetStatus || '') !== 'ACTIVE') {
        results.push({ label: name, skipped: 'spreadsheetStatus ' + office.spreadsheetStatus, changed: 0, scanned: 0 })
        return
      }
      try {
        results.push(migrateOneWorkbook_(SpreadsheetApp.openById(id), name, dryRun))
      } catch (e) {
        results.push({ label: name, skipped: 'open failed: ' + e.message, changed: 0, scanned: 0 })
      }
    })

    let total = 0
    Logger.log(dryRun ? '=== PREVIEW - nothing written ===' : '=== MIGRATION - writing changes ===')
    results.forEach(r => {
      total += r.changed
      Logger.log('  ' + r.label + ': ' + (r.skipped
        ? 'skipped (' + r.skipped + ')'
        : r.changed + ' of ' + r.scanned + ' questions opened to all roles'))
    })
    Logger.log('TOTAL: ' + total + (dryRun ? ' question(s) would be updated' : ' question(s) updated'))
    return { dryRun, total, results }
  }

  return { run }
})()
