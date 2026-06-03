function patchUsersSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName('Users')
  if (!sheet) { Logger.log('Users sheet not found'); return }

  const headers     = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
  const newCols     = ['positionLevel', 'sgLevel']
  let   addedCount  = 0

  newCols.forEach(col => {
    if (!headers.includes(col)) {
      const nextCol = sheet.getLastColumn() + 1
      sheet.getRange(1, nextCol).setValue(col)
      // Style to match existing header row
      sheet.getRange(1, nextCol)
        .setBackground('#0D2137')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold')
        .setFontSize(10)
      Logger.log('Added column: ' + col)
      addedCount++
    } else {
      Logger.log('Column already exists, skipped: ' + col)
    }
  })

  // Auto-populate positionLevel for existing users from their position field
  const data    = sheet.getDataRange().getValues()
  const hdr     = data[0]
  const posIdx  = hdr.indexOf('position')
  const lvlIdx  = hdr.indexOf('positionLevel')

  if (posIdx >= 0 && lvlIdx >= 0) {
    let updated = 0
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      if (!row[posIdx]) continue          // no position set
      if (row[lvlIdx])  continue          // positionLevel already filled

      const level = _resolveLevel(String(row[posIdx]))
      sheet.getRange(i + 1, lvlIdx + 1).setValue(level)
      updated++
    }
    Logger.log('Back-filled positionLevel for ' + updated + ' existing user(s)')
  }

  SpreadsheetApp.getUi().alert(
    '✅ Users sheet patched!\n' +
    'New columns added: ' + addedCount + '\n' +
    'Check logs for details.'
  )
}

function createMasterKRALibrarySheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet()
  let   sheet = ss.getSheetByName('MasterKRALibrary')

  if (sheet) {
    Logger.log('MasterKRALibrary already exists — skipping creation')
    SpreadsheetApp.getUi().alert('MasterKRALibrary sheet already exists.')
    return
  }

  sheet = ss.insertSheet('MasterKRALibrary')

  const headers = [
    'id', 'phase', 'kraName', 'classification', 'performanceIndicator',
    'weightII', 'weightIII', 'weightIV',
    'efficiencyGuide', 'qualityGuide', 'timelinessGuide',
    'meansOfVerification', 'applicableTo', 'functionType',
    'remarks', 'active'
  ]

  const headerRange = sheet.getRange(1, 1, 1, headers.length)
  headerRange.setValues([headers])
  headerRange
    .setBackground('#0D2137')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(10)

  sheet.setFrozenRows(1)
  sheet.autoResizeColumns(1, headers.length)

  Logger.log('Created MasterKRALibrary sheet')
  SpreadsheetApp.getUi().alert(
    '✅ MasterKRALibrary sheet created!\n' +
    'You can now seed it from the Enhanced STB protocol spreadsheet.'
  )
}

// ── Shared level resolver (mirrors PositionHelper.resolveLevel) ──
function _resolveLevel(position) {
  if (!position) return 'III'
  const match = String(position).trim().match(/\b(VII|VI|V|IV|III|II|I)\b(?:\s*\/.*)?$/)
  if (!match) return 'IV'
  const roman = match[1].toUpperCase()
  if (roman === 'I' || roman === 'II') return 'II'
  if (roman === 'III')                 return 'III'
  return 'IV'
}