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
      headers.forEach((h, i) => { obj[h] = row[i] })
      return obj
    }).filter(r => r.id) // skip blank rows
  }

  // ── Get a single row by id ──
  function getRow(sheet, id) {
    return getAllRows(sheet).find(r => String(r.id) === String(id)) || null
  }

  // ── Append a new row ──
  function appendRow(sheet, data) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    const row     = headers.map(h => {
      const val = data[h]
      if (val === null || val === undefined) return ''
      if (typeof val === 'boolean') return val
      return val
    })
    sheet.appendRow(row)
    return data
  }

  // ── Update a row by id ──
  function updateRow(sheet, id, updates) {
    const data    = sheet.getDataRange().getValues()
    const headers = data[0]
    const idIdx   = headers.indexOf('id')

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(id)) {
        headers.forEach((h, colIdx) => {
          if (Object.prototype.hasOwnProperty.call(updates, h)) {
            const val = updates[h]
            sheet.getRange(i + 1, colIdx + 1).setValue(
              val === null || val === undefined ? '' : val
            )
          }
        })
        return { ...rowToObj(headers, data[i]), ...updates }
      }
    }
    throw HttpError(`Row with id "${id}" not found`, 404)
  }

  // ── Soft-delete a row by id (sets deleted flag) ──
  function softDelete(sheet, id) {
    updateRow(sheet, id, { deleted: true, deletedAt: new Date().toISOString() })
  }

  // ── Hard-delete a row by id (physically removes the row from the sheet) ──
  function hardDeleteRow(sheet, id) {
    const data   = sheet.getDataRange().getValues()
    const headers = data[0]
    const idIdx  = headers.indexOf('id')

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(id)) {
        sheet.deleteRow(i + 1) // +1 because sheet rows are 1-indexed and row 1 is headers
        return { deleted: true, id }
      }
    }
    throw HttpError(`Row with id "${id}" not found`, 404)
  }

  // ── Generate a unique ID ──
  function generateId(prefix = '') {
    return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 12)
  }

  // ── Pagination helper ──
  function paginate(rows, page = 1, pageSize = 20) {
    const total = rows.length
    const start = (Number(page) - 1) * Number(pageSize)
    const items = rows.slice(start, start + Number(pageSize))
    return { items, total, page: Number(page), pageSize: Number(pageSize) }
  }

  // ── Filter helper ──
  function filterRows(rows, filters) {
    return rows.filter(row => {
      return Object.entries(filters).every(([key, val]) => {
        if (!val) return true
        return String(row[key]).toLowerCase().includes(String(val).toLowerCase())
      })
    })
  }

  // ── Internal ──
  function rowToObj(headers, row) {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] })
    return obj
  }

  return {
    getSheet, getAllRows, getRow, appendRow, updateRow,
    softDelete, hardDeleteRow,
    generateId, paginate, filterRows
  }
})()