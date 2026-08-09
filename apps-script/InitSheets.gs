function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()

  const SHEETS = {
    // ── Core ──
    Users: [
      'id', 'uid', 'email', 'fullName',
      'role', 'divisionId', 'divisionName', 'section', 'position', 'employeeNo',
      'type', 'positionLevel', 'sgLevel',
      'tempPassword', 'tempPasswordHash', 'mustChangePassword',
      'permissionGroups', 'permissions',
      'officeId', 'officeCode', 'officeName', 'systemScope', 'officeRole', 'centralRoles',
      'active', 'createdAt', 'updatedAt', 'lastLoginAt',
      // Self-registration and name-part columns. These were added directly to the
      // production sheet and were missing from this definition until 2026-08-04.
      // They are load-bearing: AuthService.whoami reads pendingActivation, and the
      // self-registration flow writes all seven. Without them a fresh rebuild would
      // produce a Users tab that looks correct while updateRow silently discarded
      // those fields (updateRow logs unknown columns but does not fail).
      'pendingActivation', 'requestedRole', 'selfRegistered',
      'firstName', 'middleName', 'lastName', 'suffix'
    ],
    Divisions: [
      'id', 'name', 'code', 'chiefId', 'chiefName', 'parentId', 'color', 'active', 'createdAt'
    ],
    // Reference list for the Section field. Section was free text, which produced
    // ~3 real sections per division written 8-9 different ways ("Promotion
    // Section" vs "Promotions Section", four spellings of the evaluation
    // section). That matters beyond tidiness: the IPAT rater engine matches peers
    // and supervisors on an EXACT section string, so a spelling variant silently
    // removes someone from their own section's rater pool.
    Sections: [
      'id', 'divisionId', 'name', 'code', 'active', 'sequence', 'createdAt', 'updatedAt'
    ],
    OfficeOrgOptions: [
      'id', 'officeId', 'optionType', 'parentId', 'name', 'code',
      'active', 'sequence', 'createdAt', 'updatedAt', 'updatedBy'
    ],
    SystemSettings: [
      'id', 'key', 'value', 'description', 'updatedBy', 'updatedByName', 'updatedAt'
    ],
    AssessmentRules: [
      'id', 'officeId', 'ruleType', 'ruleKey', 'label', 'value',
      'active', 'description', 'createdAt', 'updatedAt', 'updatedBy'
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
      'formId', 'entryId',
      'kraId', 'kraTitle', 'siId', 'target', 'targetQty', 'targetUnit',
      'accomplishment', 'movReferences',
      'ratingEfficiency', 'ratingQuality', 'ratingTimeliness', 'ratingAverage',
      'submittedAt', 'approvedAt', 'approvedBy',
      'remarks', 'revisions', 'movCount',
      'createdBy', 'createdAt', 'updatedAt', 'deleted', 'deletedAt'
    ],
    Revisions: [
      'id', 'accomplishmentId', 'fromStatus', 'toStatus',
      'remarks', 'changedBy', 'changedByName', 'changedAt'
    ],
    FocalAssignments: [
      'id', 'assignmentType', 'divisionId', 'divisionName',
      'focalRole',
      'userId', 'userName', 'userEmail', 'active',
      'assignedBy', 'assignedByName', 'assignedAt', 'updatedAt'
    ],
    ReviewComments: [
      'id', 'formId', 'entryId', 'reviewType',
      'comment', 'reviewerId', 'reviewerName',
      'createdAt', 'updatedAt'
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
      'divisionId', 'divisionName', 'sectionName', 'semester', 'year', 'status',
      'coreFunctionWeight', 'supportFunctionWeight',
      'finalNumericalRating', 'adjectivalRating',
      'immediateSupervisor', 'supervisorPosition',
      'approvingAuthority', 'authorityPosition',
      'dateSignedRatee', 'dateSignedSupervisor', 'dateSignedAuthority',
      'feedbackStrengths', 'feedbackAreasForImprovement',
      'feedbackComments', 'feedbackRecommendations',
      'submittedAt', 'approvedAt', 'ratedAt', 'finalizedAt',
      'targetReviewStage', 'targetRoutedToUserId', 'targetRoutedToName',
      'targetRoutedAt', 'targetCompletedAt',
      'ratingReviewStage', 'ratingRoutedToUserId', 'ratingRoutedToName',
      'ratingRoutedAt', 'ratingCompletedAt',
      'docFileId', 'targetsGeneratedAt', 'ratingsGeneratedAt', 's1RatingsGeneratedAt', 's2RatingsGeneratedAt',
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
    ],
    AssessmentContent: [
      'id', 'domain', 'category', 'questionText', 'guidanceText', 'sequence',
      'scaleType', 'required', 'evidenceRequired',
      'applicableRaters', 'applicableLevels',
      'status', 'period', 'version', 'hasBeenUsed', 'changeNotes',
      'createdBy', 'createdByName', 'createdAt', 'updatedAt', 'archivedAt'
    ]
  }

  Object.entries(SHEETS).forEach(([name, headers]) => {
    // Alias-aware: a tab already renamed (e.g. AuditLog -> AuditLogs) must not
    // be re-created here as an empty duplicate under its old name.
    let sheet = SpreadsheetService.findSheet(name)
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
  seedSections(ss)

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

/**
 * Seeds the canonical section list (only if the sheet is empty).
 *
 * These names were derived on 2026-08-04 by grouping the 39 populated free-text
 * `Users.section` values by meaning. Each division was found to have three real
 * sections recorded 8-9 different ways.
 *
 * ⚠️ THE NAMES BELOW ARE A PROPOSAL, NOT AN AUTHORITY.
 * The division chiefs must confirm the official wording before this is used for
 * a live assessment cycle — "Other Marginalized Group" and "Other Marginalized
 * Groups" may genuinely be one section or two, and only they can say. Edit the
 * rows in the sheet directly; nothing in the code depends on these exact strings.
 *
 * This does NOT touch existing Users rows. Re-pointing personnel at canonical
 * sections is a separate, deliberate migration — see PMES_DATA_QUALITY_FINDINGS
 * D-03. Seeding here only gives new registrations a controlled vocabulary.
 */
function seedSections(ss) {
  const sheet = ss.getSheetByName('Sections')
  if (!sheet || sheet.getLastRow() > 1) return  // already seeded or missing

  const now = new Date().toISOString()
  const rows = [
    // Admin Pool
    ['SEC-admin-office', 'admin-pool', 'Office Admin Personnel', 'OAP', true, 1, now, now],
    // Design Formulation Division
    ['SEC-dfd-cy',   'dfd',   'Children and Youth Section',                                  'CY',  true, 1, now, now],
    ['SEC-dfd-omg',  'dfd',   'Other Marginalized Groups Section',                           'OMG', true, 2, now, now],
    ['SEC-dfd-wpo',  'dfd',   'Women, Persons with Disability and Older Persons Section',    'WPO', true, 3, now, now],
    // Pilot Implementation Division
    ['SEC-pid-cy',   'pid',   'Children and Youth Section',                                  'CY',  true, 1, now, now],
    ['SEC-pid-omg',  'pid',   'Other Marginalized Groups Section',                           'OMG', true, 2, now, now],
    ['SEC-pid-wpo',  'pid',   'Women, Persons with Disability and Older Persons Section',    'WPO', true, 3, now, now],
    // Social Technology Analysis and Evaluation Division
    ['SEC-staed-ev', 'staed', 'Social Technology Evaluation Section',                        'STE', true, 1, now, now],
    ['SEC-staed-pm', 'staed', 'Social Technology Portfolio Management Section',              'STPM',true, 2, now, now],
    ['SEC-staed-pr', 'staed', 'Social Technology Promotion Section',                         'STPR',true, 3, now, now]
  ]
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows)
  Logger.log('Seeded Sections with ' + rows.length + ' proposed canonical rows (confirm names with division chiefs).')
}

// ── Utility: delete ALL sheets and rebuild from all init functions ──
function nukeAndRebuildSheets_DANGER() {
  Logger.log('nukeAndRebuildSheets_DANGER is disabled. Use clearTransactionalData_KEEP_USERS_DIVISIONS_KRAS instead.')
  try {
    SpreadsheetApp.getUi().alert(
      'Disabled for safety',
      'This function deletes Users, Divisions, and MasterKRALibrary. Use clearTransactionalData_KEEP_USERS_DIVISIONS_KRAS instead.',
      SpreadsheetApp.getUi().ButtonSet.OK
    )
  } catch (e) {}
  return

  let confirmed = false
  try {
    const ui = SpreadsheetApp.getUi()
    const result = ui.alert(
      '⚠️ IRREVERSIBLE — DELETE EVERYTHING',
      'This will permanently DELETE ALL SHEETS AND ALL DATA, then rebuild empty sheets from scratch.\n\nAre you absolutely sure?',
      ui.ButtonSet.YES_NO
    )
    confirmed = (result === ui.Button.YES)
  } catch (e) {
    Logger.log('⚠️ nukeAndRebuildSheets_DANGER must be run from the Apps Script editor menu. Aborting.')
    return
  }
  if (!confirmed) return

  const ss = SpreadsheetApp.getActiveSpreadsheet()

  // Google Sheets requires at least one sheet at all times — insert a placeholder
  const temp = ss.insertSheet('__rebuilding__')

  // Delete every other sheet
  ss.getSheets().forEach(sheet => {
    if (sheet.getName() !== '__rebuilding__') ss.deleteSheet(sheet)
  })
  Logger.log('All sheets deleted.')

  // Rebuild from all three init functions
  initializeSheets()      // Core sheets (Users, IPCRForms, Accomplishments, etc.)
  initIPATSheets()        // IPAT sheets
  initMasterKRALibrary()  // MasterKRALibrary + KRA seed data

  // Remove the placeholder
  const placeholder = ss.getSheetByName('__rebuilding__')
  if (placeholder) ss.deleteSheet(placeholder)

  Logger.log('✅ All sheets nuked and rebuilt successfully.')
  try {
    SpreadsheetApp.getUi().alert('✅ Done! All sheets deleted and rebuilt from scratch.')
  } catch (e) {}
}

// ── Utility: clear all data rows (keep headers) – use with caution ──
function clearAllData_DANGER() {
  Logger.log('clearAllData_DANGER is disabled. Use clearTransactionalData_KEEP_USERS_DIVISIONS_KRAS instead.')
  try {
    SpreadsheetApp.getUi().alert(
      'Disabled for safety',
      'This function clears every sheet. Use clearTransactionalData_KEEP_USERS_DIVISIONS_KRAS instead.',
      SpreadsheetApp.getUi().ButtonSet.OK
    )
  } catch (e) {}
  return

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

// Safe reset: clear transactional/test rows only.
// Preserves all sheet tabs, headers, Users, Divisions, and MasterKRALibrary.
function clearTransactionalData_KEEP_USERS_DIVISIONS_KRAS() {
  let confirmed = false
  try {
    const ui = SpreadsheetApp.getUi()
    const result = ui.alert(
      'Reset transactional PMES data?',
      'This will clear data rows from transactional sheets only.\n\nPreserved sheets:\n- Users\n- Divisions\n- MasterKRALibrary\n\nA backup copy of the database will be created before clearing. Continue?',
      ui.ButtonSet.YES_NO
    )
    confirmed = (result === ui.Button.YES)
  } catch (e) {
    Logger.log('clearTransactionalData_KEEP_USERS_DIVISIONS_KRAS must be run from the Apps Script editor UI. Aborting.')
    return
  }

  if (!confirmed) return

  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'))
  const backup = DriveApp.getFileById(ss.getId()).makeCopy(
    'PMES Database Backup ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')
  )
  const preserved = {
    Users: true,
    Divisions: true,
    MasterKRALibrary: true
  }
  let deletedRows = 0

  ss.getSheets().forEach(sheet => {
    if (preserved[sheet.getName()]) return
    const rows = Math.max(sheet.getLastRow() - 1, 0)
    if (rows > 0) {
      sheet.getRange(2, 1, rows, Math.max(sheet.getLastColumn(), 1)).clearContent()
      deletedRows += rows
    }
  })

  Logger.log('Transactional data cleared. Deleted rows: ' + deletedRows + '. Backup: ' + backup.getUrl())
  try {
    SpreadsheetApp.getUi().alert(
      'Reset complete',
      'Transactional data cleared.\n\nDeleted rows: ' + deletedRows + '\nBackup created: ' + backup.getName(),
      SpreadsheetApp.getUi().ButtonSet.OK
    )
  } catch (e) {}
}
