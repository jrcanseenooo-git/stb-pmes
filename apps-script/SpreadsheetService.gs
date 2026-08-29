/**
 * SpreadsheetService.gs - Fixed version
 * Added: hardDeleteRow() - physically removes the row from the sheet
 * Fixed: updateRow() - now writes ALL changed fields correctly
 */

const SpreadsheetService = (() => {

  const DEFAULT_SPREADSHEET_ID = '1lCJaa2ywDjlRHrltCDgpY-I_kCR5WxfBXwvIUVSRqrU'
  let _ss = null
  let _ssId = ''
  let _overrideSs = null
  let _overrideSsId = ''

  function getSpreadsheetId() {
    if (_overrideSsId) return _overrideSsId
    return PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID
  }

  function getSpreadsheet() {
    if (_overrideSs) return _overrideSs
    const spreadsheetId = getSpreadsheetId()
    if (!_ss || _ssId !== spreadsheetId) {
      _ss = SpreadsheetApp.openById(spreadsheetId)
      _ssId = spreadsheetId
    }
    return _ss
  }

  // ── Sheet rename compatibility ──────────────────────────────────────────────
  // Tab renames cannot be atomic with a code deploy: getSheet() throws on a
  // missing tab, so whichever happens first, every request fails until the other
  // catches up. This map lets the SAME deployed code work with either the new
  // name or the old one, which turns a risky cutover into three safe steps:
  //
  //   1. Deploy this (accepts both names)      - nothing breaks, nothing renamed
  //   2. Rename the tabs in the spreadsheet    - no downtime, code already copes
  //   3. Later, delete this map                - once every tab is renamed
  //
  // Key = the name the code asks for. Values = older names to fall back to.
  const SHEET_NAME_FALLBACKS = {
    'Users':                    ['Personnel'],
    'Divisions':                ['OrganizationalUnits'],
    'AssessmentRecords':        ['IPATRecords'],
    'CompetencyBehaviorRatings':['IPATCBCRatings'],
    'JobFitnessRatings':        ['IPATJFRatings'],
    'RaterAssignments':         ['IPATRaterAssignments'],
    'AuditLogs':                ['AuditLog']
  }

  function getSheet(name) {
    const ss = getSpreadsheet()
    let sheet = ss.getSheetByName(name)
    if (sheet) return sheet

    const fallbacks = SHEET_NAME_FALLBACKS[name] || []
    for (let i = 0; i < fallbacks.length; i++) {
      sheet = ss.getSheetByName(fallbacks[i])
      if (sheet) return sheet
    }

    // Also resolve the reverse direction, so code still referring to an old name
    // keeps working after the tab has been renamed to its new one.
    const newNames = Object.keys(SHEET_NAME_FALLBACKS)
    for (let i = 0; i < newNames.length; i++) {
      if (SHEET_NAME_FALLBACKS[newNames[i]].indexOf(name) >= 0) {
        sheet = ss.getSheetByName(newNames[i])
        if (sheet) return sheet
      }
    }

    throw new Error(`Sheet "${name}" not found`)
  }

  function withSpreadsheet(spreadsheet, work) {
    if (!spreadsheet || typeof work !== 'function') return work()
    const previousSs = _overrideSs
    const previousId = _overrideSsId
    _overrideSs = spreadsheet
    _overrideSsId = spreadsheet.getId ? spreadsheet.getId() : ''
    try {
      return work()
    } finally {
      _overrideSs = previousSs
      _overrideSsId = previousId
    }
  }

  function withSpreadsheetId(spreadsheetId, work) {
    if (!spreadsheetId) return work()
    return withSpreadsheet(SpreadsheetApp.openById(spreadsheetId), work)
  }

  // Runs `work` against the CENTRAL PMES database, temporarily suspending any
  // office-scope override currently in effect.
  //
  // Office scoping (OfficeScopeService) sets a process-wide override so that a
  // whole request's sheet reads land in one office workbook. That is right for
  // working data - Personnel, assessment records, ratings - but shared system
  // configuration (OfficeRegistry, OfficeOrgOptions, RaterMatrix, Users) lives
  // ONLY in the central workbook. A service that owns central config must not
  // silently follow an ambient override into a per-office workbook, where the
  // tab does not exist and gets created empty: reads then return nothing and
  // writes land in a shadow copy nobody else can see.
  //
  // Nesting is safe - the previous override is restored on the way out, so a
  // caller can hop central -> office -> central within one request.
  function withCentralSpreadsheet(work) {
    const previousSs = _overrideSs
    const previousId = _overrideSsId
    _overrideSs = null
    _overrideSsId = ''
    try {
      return work()
    } finally {
      _overrideSs = previousSs
      _overrideSsId = previousId
    }
  }

  // Same resolution as getSheet() but returns null instead of throwing. The
  // initializers use this so they never create a duplicate empty tab for a sheet
  // that already exists under its other name.
  function findSheet(name) {
    try { return getSheet(name) } catch (e) { return null }
  }

  // Identifies which spreadsheet a Sheet object belongs to, so cache entries for
  // the same tab name in different office spreadsheets never collide.
  function sheetOwnerId_(sheet) {
    try {
      const parent = sheet.getParent()
      return parent ? parent.getId() : getSpreadsheetId()
    } catch (e) {
      return getSpreadsheetId()
    }
  }

  function sheetNameOf_(sheet) {
    try { return sheet.getName() } catch (e) { return '' }
  }

  // Drops cached reads for a tab. Every write path calls this, so a read issued
  // after a write in the same request sees the new data rather than the copy
  // taken before it.
  function invalidateCache_(sheet) {
    if (typeof DataCacheService === 'undefined') return
    try {
      DataCacheService.invalidate(sheetOwnerId_(sheet), sheetNameOf_(sheet))
    } catch (e) {
      Logger.log('[SpreadsheetService] cache invalidation failed: ' + e.message)
    }
  }

  function invalidateSheet(sheet) {
    invalidateCache_(sheet)
  }

  // ── Read all rows as objects ──
  // Routed through DataCacheService: repeated reads of the same tab within one
  // request are served from memory instead of re-hitting the Sheets backend,
  // and slow-moving reference tabs are additionally shared across executions.
  // See DataCacheService.gs for why transactional tabs are memo-only.
  function getAllRows(sheet) {
    const read = () => readAllRowsUncached_(sheet)
    if (typeof DataCacheService === 'undefined') return read()
    return DataCacheService.readThrough(sheetOwnerId_(sheet), sheetNameOf_(sheet), read)
  }

  function readAllRowsUncached_(sheet) {
    const data = sheet.getDataRange().getValues()
    if (data.length < 2) return []
    const headers = data[0]
    return data.slice(1).map(row => {
      const obj = {}
      headers.forEach((h, i) => {
        // Normalize booleans stored as strings
        const val = row[i]
        if (val === 'TRUE'  || val === true)  obj[h] = true
        else if (val === 'FALSE' || val === false) obj[h] = false
        else obj[h] = val
      })
      return obj
    }).filter(r => r.id) // skip blank rows
  }

  // ── Get a single row by id ──
  function getRow(sheet, id) {
    return getAllRows(sheet).find(r => r.id === id) || null
  }

  // ── Neutralise spreadsheet formula injection ──
  //
  // Sheets parses a written string the same way it parses typed input, so a
  // free-text field that begins with = + - or @ becomes a live formula rather
  // than the text somebody entered. That is not only a display problem: a
  // stored =IMPORTXML(...) or =IMPORTDATA(...) executes with the sheet's own
  // access and can push the surrounding rows to an external URL. The same
  // strings execute in Excel when a report is exported to CSV.
  //
  // A leading apostrophe is Sheets' own "treat this as text" marker: it is not
  // part of the stored string and does not come back from getValue(), so the
  // value round-trips unchanged while losing its formula meaning.
  //
  // Deliberately narrow, because over-sanitising corrupts real data:
  //   - only strings are touched; numbers, booleans and dates pass through
  //   - only the FIRST character matters to the parser, so nothing inside the
  //     string is rewritten
  //   - a plain numeric string such as "-5" or "+12.5" is data, not a formula,
  //     and keeps its numeric meaning
  //   - an already-escaped value is left alone, so repeated writes cannot
  //     accumulate apostrophes
  function escapeFormula_(value) {
    if (typeof value !== 'string' || !value) return value
    if (value.charAt(0) === "'") return value
    if (!/^[=+\-@\t\r]/.test(value)) return value
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(value)) return value
    return "'" + value
  }

  // ── Append a new row ──
  function appendRow(sheet, data) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    const row     = headers.map(h => {
      const val = data[h]
      if (val === undefined || val === null) return ''
      return escapeFormula_(val)
    })
    sheet.appendRow(row)
    invalidateCache_(sheet)
    return data
  }

  // ── Append many rows in one Sheets write ──
  function appendRows(sheet, rows) {
    const items = Array.isArray(rows) ? rows.filter(Boolean) : []
    if (!items.length) return []
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    const values = items.map(data => headers.map(h => {
      const val = data[h]
      if (val === undefined || val === null) return ''
      return escapeFormula_(val)
    }))
    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values)
    invalidateCache_(sheet)
    return items
  }

  // ── Update a row by id - writes ALL provided fields ──
  function updateRow(sheet, id, updates) {
    const data    = sheet.getDataRange().getValues()
    const headers = data[0]
    const idIdx   = headers.indexOf('id')

    const unknownKeys = Object.keys(updates).filter(k => headers.indexOf(k) < 0)
    if (unknownKeys.length) {
      Logger.log(
        `⚠️ updateRow: column(s) [${unknownKeys.join(', ')}] don't exist in sheet "${sheet.getName()}" - ` +
        `those fields were NOT written, even though the response will look like they were. ` +
        `Run initializeSheets() to add missing columns.`
      )
    }

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(id)) {
        // Patch the row in memory, then write it back in ONE setValues call.
        //
        // This previously issued a separate sheet.getRange().setValue() per
        // changed field. Each of those is a round trip to the Sheets backend
        // (~100-300ms), so a 13-field update such as setCbcDeduction spent
        // several seconds writing - which is what made saving feel slow.
        // One setValues for the whole row costs a single round trip regardless
        // of how many fields changed.
        const rowValues = data[i].slice()
        let touched = false
        Object.keys(updates).forEach(key => {
          const colIdx = headers.indexOf(key)
          if (colIdx < 0) return
          let cellVal = updates[key]
          if (cellVal === null || cellVal === undefined) cellVal = ''
          rowValues[colIdx] = escapeFormula_(cellVal)
          touched = true
        })

        if (touched) {
          sheet.getRange(i + 1, 1, 1, headers.length).setValues([rowValues])
          invalidateCache_(sheet)
        }

        // Return merged object
        const merged = {}
        headers.forEach((h, idx) => { merged[h] = rowValues[idx] })
        return merged
      }
    }
    throw HttpError(`Row with id "${id}" not found`, 404)
  }

  // ── HARD DELETE - physically removes the row from the sheet ──
  function hardDeleteRow(sheet, id) {
    const data   = sheet.getDataRange().getValues()
    const headers = data[0]
    const idIdx  = headers.indexOf('id')

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(id)) {
        sheet.deleteRow(i + 1)  // +1 because sheet rows are 1-indexed, and data[0] is header
        invalidateCache_(sheet)
        Logger.log('Hard deleted row with id: ' + id + ' from row ' + (i + 1))
        return { success: true, deletedId: id }
      }
    }
    throw HttpError(`Row with id "${id}" not found for deletion`, 404)
  }

  // ── Soft delete - keeps row but marks as deleted ──
  function softDelete(sheet, id) {
    return updateRow(sheet, id, {
      deleted:   true,
      deletedAt: new Date().toISOString()
    })
  }

  // ── Generate a unique ID ──
  function generateId(prefix = '') {
    return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 12)
  }

  // ── Pagination helper ──
  function paginate(rows, page = 1, pageSize = 50) {
    page     = Math.max(1, parseInt(page)     || 1)
    pageSize = Math.max(1, parseInt(pageSize) || 50)
    const total = rows.length
    const start = (page - 1) * pageSize
    const items = rows.slice(start, start + pageSize)
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  // ── Filter helper ──
  function filterRows(rows, filters) {
    return rows.filter(row =>
      Object.entries(filters).every(([key, val]) => {
        if (!val) return true
        return String(row[key] || '').toLowerCase().includes(String(val).toLowerCase())
      })
    )
  }

  return {
    getSpreadsheet, getSpreadsheetId,
    getSheet, findSheet, getAllRows, getRow,
    appendRow, appendRows, updateRow,
    invalidateSheet,
    hardDeleteRow, softDelete,
    generateId, paginate, filterRows,
    // Exported for the few writers that build raw row arrays and call
    // setValues directly instead of going through appendRow/updateRow.
    escapeFormula: escapeFormula_,
    withSpreadsheet, withSpreadsheetId, withCentralSpreadsheet
  }
})()
