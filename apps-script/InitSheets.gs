/**
 * InitSheets.gs
 * ─────────────
 * Run this function ONCE from the Apps Script editor to create
 * all required sheets and their header rows.
 *
 * How to run:
 *   1. Open your Google Apps Script project
 *   2. Select "initializeSheets" in the function dropdown
 *   3. Click ▶ Run
 *   4. Authorize when prompted
 */

function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()

  const SHEETS = {
    Users: [
      'id','uid','email','fullName','firstName','lastName',
      'role','divisionId','divisionName','position','employeeNo',
      'type','active','createdAt','updatedAt','lastLoginAt'
    ],
    Divisions: [
      'id','name','code','chiefId','chiefName','parentId','color','active','createdAt'
    ],
    KRAs: [
      'id','title','description','functionType','applicableTo',
      'semester','year','weight','active','createdAt','updatedAt'
    ],
    SuccessIndicators: [
      'id','kraId','title','targetQty','targetUnit',
      'efficiencyGuide','qualityGuide','timelinessGuide',
      'meansOfVerification','deadline','semester','year',
      'active','createdAt','updatedAt'
    ],
    Accomplishments: [
      'id','type','semester','year',
      'userId','employeeName','divisionId','division',
      'kraId','kraTitle','siId','target','targetQty','targetUnit',
      'accomplished','progressPct','status','deadline',
      'submittedAt','approvedAt','approvedBy',
      'remarks','revisions','movCount',
      'createdBy','createdAt','updatedAt','deleted','deletedAt'
    ],
    Revisions: [
      'id','accomplishmentId','fromStatus','toStatus',
      'remarks','changedBy','changedByName','changedAt'
    ],
    MOVFiles: [
      'id','driveFileId','driveUrl','fileName','mimeType','sizeBytes',
      'description','accomplishmentId','kraId','siId','divisionId',
      'uploadedBy','uploadedByName','uploadedAt',
      'verified','verifiedBy','verifiedAt','deleted','deletedAt'
    ],
    Evaluations: [
      'id','userId','employeeName','divisionId','semester','year',
      'efficiency','quality','timeliness','overall','label',
      'targetCount','manuallyAdjusted','adjustedBy','adjustedAt',
      'evaluatorRemarks','computedBy','computedAt'
    ],
    Notifications: [
      'id','recipientId','type','message','relatedId','module',
      'read','readAt','createdAt'
    ],
    AuditLog: [
      'id','timestamp','userId','userEmail','userName','role',
      'action','module','details','ipAddress'
    ],
    Reports: [
      'id','name','type','divisionId','semester','year',
      'format','driveFileId','driveUrl','generatedBy','generatedAt'
    ],
    Deadlines: [
      'id','name','type','semester','year',
      'startDate','endDate','active','createdBy','createdAt'
    ]
  }

  Object.entries(SHEETS).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name)
    if (!sheet) {
      sheet = ss.insertSheet(name)
      Logger.log('Created sheet: ' + name)
    } else {
      Logger.log('Sheet already exists: ' + name)
    }

    // Write headers only if the sheet is empty
    if (sheet.getLastRow() === 0) {
      const headerRange = sheet.getRange(1, 1, 1, headers.length)
      headerRange.setValues([headers])

      // Style the header row
      headerRange
        .setBackground('#0D2137')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold')
        .setFontSize(10)

      // Freeze header row
      sheet.setFrozenRows(1)

      // Auto-resize columns
      sheet.autoResizeColumns(1, headers.length)
    }
  })

  // ── Seed Divisions ──
  seedDivisions(ss)

  Logger.log('✅ PMES sheets initialized successfully.')
  SpreadsheetApp.getUi().alert('✅ PMES sheets initialized successfully!\n\nSheets created: ' + Object.keys(SHEETS).join(', '))
}

function seedDivisions(ss) {
  const sheet = ss.getSheetByName('Divisions')
  if (sheet.getLastRow() > 1) return  // already seeded

  const now = new Date().toISOString()
  const divs = [
    ['admin-pool',           'Admin Pool',                        'AP',   '', '', null,  'blue',  true, now],
    ['design-formulation',   'Design Formulation Division',       'DFD',  '', '', null,  'green', true, now],
    ['pilot-implementation', 'Pilot Implementation Division',     'PID',  '', '', null,  'gold',  true, now],
    ['stae',                 'Social Technology Analysis & Eval.','STAE', '', '', null,  'red',   true, now]
  ]
  sheet.getRange(2, 1, divs.length, divs[0].length).setValues(divs)
  Logger.log('Seeded Divisions.')
}

// ── Utility: clear all data rows (keep headers) – use with caution ──
function clearAllData_DANGER() {
  const ui = SpreadsheetApp.getUi()
  const result = ui.alert(
    '⚠️ DANGER',
    'This will DELETE ALL DATA from every sheet (headers kept). Continue?',
    ui.ButtonSet.YES_NO
  )
  if (result !== ui.Button.YES) return

  const ss = SpreadsheetApp.getActiveSpreadsheet()
  ss.getSheets().forEach(sheet => {
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1)
    }
  })
  Logger.log('All data cleared.')
}
