function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()

  const SHEETS = {
    // ── Core ──
    Users: [
      'id', 'uid', 'email', 'fullName', 'firstName', 'lastName',
      'role', 'divisionId', 'divisionName', 'position', 'employeeNo',
      'type', 'positionLevel', 'sgLevel', 'active', 'createdAt', 'updatedAt', 'lastLoginAt'
    ],
    Divisions: [
      'id', 'name', 'code', 'chiefId', 'chiefName', 'parentId', 'color', 'active', 'createdAt'
    ],
    KRAs: [
      'id', 'title', 'description', 'functionType', 'applicableTo',
      'semester', 'year', 'weight', 'active', 'createdAt', 'updatedAt'
    ],
    SuccessIndicators: [
      'id', 'kraId', 'title', 'targetQty', 'targetUnit',
      'efficiencyGuide', 'qualityGuide', 'timelinessGuide',
      'meansOfVerification', 'deadline', 'semester', 'year',
      'active', 'createdAt', 'updatedAt'
    ],
    Accomplishments: [
      'id', 'type', 'semester', 'year',
      'userId', 'employeeName', 'divisionId', 'division',
      'kraId', 'kraTitle', 'siId', 'target', 'targetQty', 'targetUnit',
      'accomplished', 'progressPct', 'status', 'deadline',
      'submittedAt', 'approvedAt', 'approvedBy',
      'remarks', 'revisions', 'movCount',
      'createdBy', 'createdAt', 'updatedAt', 'deleted', 'deletedAt'
    ],
    Revisions: [
      'id', 'accomplishmentId', 'fromStatus', 'toStatus',
      'remarks', 'changedBy', 'changedByName', 'changedAt'
    ],
    MOVFiles: [
      'id', 'driveFileId', 'driveUrl', 'fileName', 'mimeType', 'sizeBytes',
      'description', 'accomplishmentId', 'kraId', 'siId', 'divisionId',
      'uploadedBy', 'uploadedByName', 'uploadedAt',
      'verified', 'verifiedBy', 'verifiedAt', 'deleted', 'deletedAt'
    ],
    Evaluations: [
      'id', 'userId', 'employeeName', 'divisionId', 'semester', 'year',
      'efficiency', 'quality', 'timeliness', 'overall', 'label',
      'targetCount', 'manuallyAdjusted', 'adjustedBy', 'adjustedAt',
      'evaluatorRemarks', 'computedBy', 'computedAt'
    ],
    Notifications: [
      'id', 'recipientId', 'type', 'message', 'relatedId', 'module',
      'read', 'readAt', 'createdAt'
    ],
    AuditLog: [
      'id', 'timestamp', 'userId', 'userEmail', 'userName', 'role',
      'action', 'module', 'details', 'ipAddress'
    ],
    Reports: [
      'id', 'name', 'type', 'divisionId', 'semester', 'year',
      'format', 'driveFileId', 'driveUrl', 'generatedBy', 'generatedAt'
    ],
    Deadlines: [
      'id', 'name', 'type', 'semester', 'year',
      'startDate', 'endDate', 'active', 'createdBy', 'createdAt'
    ],

    // ── IPCRF / CCEF Form sheets (previously missing) ──
    IPCRForms: [
      'id', 'type', 'userId', 'employeeName', 'position', 'positionLevel',
      'divisionId', 'divisionName', 'semester', 'year', 'status',
      'coreFunctionWeight', 'supportFunctionWeight',
      'finalNumericalRating', 'adjectivalRating',
      'immediateSupervisor', 'supervisorPosition',
      'approvingAuthority', 'authorityPosition',
      'dateSignedRatee', 'dateSignedSupervisor', 'dateSignedAuthority',
      'feedbackStrengths', 'feedbackAreasForImprovement',
      'feedbackComments', 'feedbackRecommendations',
      'submittedAt', 'approvedAt', 'ratedAt', 'finalizedAt',
      'createdAt', 'updatedAt'
    ],
    FormEntries: [
      'id', 'formId', 'masterKRAId', 'functionType', 'kraName',
      'successIndicator', 'applicableRatingPeriod', 'weight', 'classification',
      'efficiencyGuide', 'qualityGuide', 'timelinessGuide', 'meansOfVerification',
      'accomplishment',
      'ratingEfficiency', 'ratingQuality', 'ratingTimeliness', 'ratingAverage',
      'movReferences', 'remarks', 'isCustom', 'order',
      'createdAt', 'updatedAt'
    ],
    JRBRatings: [
      'id', 'formId', 'userId', 'raterType', 'raterId', 'raterName',
      'domain', 'domainName', 'itemNumber', 'itemText', 'rating',
      'semester', 'year', 'createdAt', 'updatedAt'
    ],
    PeerAssignments: [
      'id', 'userId', 'userName', 'divisionId',
      'peer1Id', 'peer1Name', 'peer1DivisionId',
      'peer2Id', 'peer2Name', 'peer2DivisionId',
      'semester', 'year',
      'peer1Completed', 'peer2Completed',
      'peer1CompletedAt', 'peer2CompletedAt',
      'assignedAt', 'assignedBy'
    ],
    AttendanceRecords: [
      'id', 'userId', 'userName', 'divisionId', 'divisionName',
      'month', 'year',
      'tardinessCount', 'undertimeCount', 'absenceCount', 'approvedLeaveCount',
      'recordedBy', 'recordedByName', 'remarks',
      'createdAt', 'updatedAt'
    ],
    AttendanceRatings: [
      'id', 'formId', 'userId', 'semester', 'year',
      'tardinessTotal', 'undertimeTotal', 'absenceTotal', 'approvedLeaveTotal',
      'rating', 'label',
      'computedBy', 'computedAt', 'createdAt'
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

    // Add any missing columns to existing sheets without wiping data
    if (sheet.getLastRow() === 0) {
      // Brand new sheet – write headers fresh
      const headerRange = sheet.getRange(1, 1, 1, headers.length)
      headerRange.setValues([headers])
      headerRange
        .setBackground('#0D2137')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold')
        .setFontSize(10)
      sheet.setFrozenRows(1)
      sheet.autoResizeColumns(1, headers.length)
    } else {
      // Existing sheet – only append NEW columns (don't touch existing data)
      const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      const existingSet = new Set(existingHeaders.map(h => String(h).trim()))
      const missingCols = headers.filter(h => !existingSet.has(h))

      if (missingCols.length > 0) {
        const startCol = sheet.getLastColumn() + 1
        missingCols.forEach((col, idx) => {
          const cell = sheet.getRange(1, startCol + idx)
          cell.setValue(col)
          cell.setBackground('#0D2137').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(10)
        })
        Logger.log(`  Added missing columns to ${name}: ${missingCols.join(', ')}`)
      }
    }
  })

  // ── Seed Divisions (only if empty) ──
  seedDivisions(ss)

  Logger.log('✅ PMES sheets initialized successfully.')
  // getUi() only works when triggered from the Apps Script editor menu,
  // not from the Run button or a web-app context — so we guard it.
  try {
    SpreadsheetApp.getUi().alert(
      '✅ PMES sheets initialized successfully!\n\n' +
      'Sheets managed: ' + Object.keys(SHEETS).join(', ')
    )
  } catch (e) {
    Logger.log('(Alert skipped – not running in UI context)')
  }
}

function seedDivisions(ss) {
  const sheet = ss.getSheetByName('Divisions')
  if (!sheet || sheet.getLastRow() > 1) return  // already seeded

  const now = new Date().toISOString()
  const divs = [
    ['admin-pool', 'Admin Pool', 'AP', '', '', null, 'blue', true, now],
    ['dfd', 'Design Formulation Division', 'DFD', '', '', null, 'green', true, now],
    ['pid', 'Pilot Implementation Division', 'PID', '', '', null, 'gold', true, now],
    ['staed', 'Social Technology Analysis and Evaluation Division', 'STAED', '', '', null, 'red', true, now]
  ]
  sheet.getRange(2, 1, divs.length, divs[0].length).setValues(divs)
  Logger.log('Seeded Divisions.')
}

// ── Utility: clear all data rows (keep headers) – use with caution ──
function clearAllData_DANGER() {
  // Must be run from a menu trigger (not the Run button) for getUi() to work
  let confirmed = false
  try {
    const ui = SpreadsheetApp.getUi()
    const result = ui.alert(
      '⚠️ DANGER',
      'This will DELETE ALL DATA from every sheet (headers kept). Continue?',
      ui.ButtonSet.YES_NO
    )
    confirmed = (result === ui.Button.YES)
  } catch (e) {
    // Running from Run button — log warning and abort for safety
    Logger.log('⚠️ clearAllData_DANGER must be run from the Apps Script menu, not the Run button. Aborting.')
    return
  }

  if (!confirmed) return

  const ss = SpreadsheetApp.getActiveSpreadsheet()
  ss.getSheets().forEach(sheet => {
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1)
    }
  })
  Logger.log('All data cleared.')
}