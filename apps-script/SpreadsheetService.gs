/**
 * SpreadsheetService.gs — Fixed version
 * Added: hardDeleteRow() — physically removes the row from the sheet
 * Fixed: updateRow() — now writes ALL changed fields correctly
 */

const SpreadsheetService = (() => {

  const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')

  let _ss = null
  function getSpreadsheet() {
    if (!_ss) _ss = SpreadsheetApp.openById(SPREADSHEET_ID)
    return _ss
  }

  function getSheet(name) {
    const sheet = getSpreadsheet().getSheetByName(name)
    if (!sheet) throw new Error(`Sheet "${name}" not found`)
    return sheet
  }

  // ── Read all rows as objects ──
  function getAllRows(sheet) {
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

  // ── Append a new row ──
  function appendRow(sheet, data) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    const row     = headers.map(h => {
      const val = data[h]
      if (val === undefined || val === null) return ''
      return val
    })
    sheet.appendRow(row)
    return data
  }

  // ── Update a row by id — writes ALL provided fields ──
  function updateRow(sheet, id, updates) {
    const data    = sheet.getDataRange().getValues()
    const headers = data[0]
    const idIdx   = headers.indexOf('id')

    const unknownKeys = Object.keys(updates).filter(k => headers.indexOf(k) < 0)
    if (unknownKeys.length) {
      Logger.log(
        `⚠️ updateRow: column(s) [${unknownKeys.join(', ')}] don't exist in sheet "${sheet.getName()}" — ` +
        `those fields were NOT written, even though the response will look like they were. ` +
        `Run initializeSheets() to add missing columns.`
      )
    }

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(id)) {
        // Write each updated field individually
        Object.entries(updates).forEach(([key, value]) => {
          const colIdx = headers.indexOf(key)
          if (colIdx >= 0) {
            // Convert value to proper type for Sheets
            let cellVal = value
            if (cellVal === null || cellVal === undefined) cellVal = ''
            if (typeof cellVal === 'boolean') cellVal = cellVal  // keep boolean
            sheet.getRange(i + 1, colIdx + 1).setValue(cellVal)
          }
        })
        // Return merged object
        const merged = {}
        headers.forEach((h, idx) => { merged[h] = data[i][idx] })
        Object.assign(merged, updates)
        return merged
      }
    }
    throw HttpError(`Row with id "${id}" not found`, 404)
  }

  // ── HARD DELETE — physically removes the row from the sheet ──
  function hardDeleteRow(sheet, id) {
    const data   = sheet.getDataRange().getValues()
    const headers = data[0]
    const idIdx  = headers.indexOf('id')

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(id)) {
        sheet.deleteRow(i + 1)  // +1 because sheet rows are 1-indexed, and data[0] is header
        Logger.log('Hard deleted row with id: ' + id + ' from row ' + (i + 1))
        return { success: true, deletedId: id }
      }
    }
    throw HttpError(`Row with id "${id}" not found for deletion`, 404)
  }

  // ── Soft delete — keeps row but marks as deleted ──
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
    getSpreadsheet,
    getSheet, getAllRows, getRow,
    appendRow, updateRow,
    hardDeleteRow, softDelete,
    generateId, paginate, filterRows
  }
})()
