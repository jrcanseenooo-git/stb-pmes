/**
 * InitIPATSheets.gs
 * Run once to create the three IPAT sheet tabs in the PMES Database spreadsheet.
 * Trigger: Apps Script editor → select initIPATSheets → Run
 */

function initIPATSheets() {
  const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID)

  // 1. IPATRecords
  _createSheetIfMissing(ss, 'IPATRecords', [
    'id','rateeId','rateeName','divisionId','divisionName','position','positionLevel',
    'semester','year','hasSubordinate','status',
    'cbcBaseScore','cbcScore',
    'cbcNteLevel','cbcNteDeductionPct','cbcOffenseLevel','cbcOffenseDeduction',
    'cbcDeductionNote','cbcDeductionBy','cbcDeductionByName','cbcDeductionAt',
    'fpoScore','jfScore','overallScore','descriptor',
    'ipcrfFormId','createdAt','updatedAt'
  ])

  // 2. IPATCBCRatings
  _createSheetIfMissing(ss, 'IPATCBCRatings', [
    'id','ipatId','rateeId','raterId','raterName','raterType',
    'themeId','themeName','indicator','indicatorIdx',
    'rating','semester','year','createdAt','updatedAt'
  ])

  // 3. IPATJFRatings
  _createSheetIfMissing(ss, 'IPATJFRatings', [
    'id','ipatId','rateeId','raterId','raterName','raterType',
    'indicator','indicatorIdx','rating','evidence',
    'semester','year','createdAt','updatedAt'
  ])

  // 4. IPATRaterAssignments — auto-generated rater assignments per period
  _createSheetIfMissing(ss, 'IPATRaterAssignments', [
    'id','semester','year',
    'rateeId','rateeName','rateeDivisionId','rateeRole','rateeSection',
    'raterId','raterName','raterType',
    'ipatRecordId',
    'status',
    'createdAt','updatedAt'
  ])

  Logger.log('IPAT sheets initialized successfully.')
}

function _createSheetIfMissing(ss, name, headers) {
  // Alias-aware — see SHEET_NAME_FALLBACKS in SpreadsheetService. A tab already
  // renamed (e.g. IPATRecords -> AssessmentRecords) must not be re-created here
  // as an empty duplicate under its old name.
  let sheet = SpreadsheetService.findSheet(name)
  if (!sheet) {
    sheet = ss.insertSheet(name)
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#0D2137')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
    sheet.setFrozenRows(1)
    Logger.log('Created sheet: ' + name)
  } else {
    Logger.log('Sheet already exists: ' + name)
  }
}
