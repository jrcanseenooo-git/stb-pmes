/**
 * InitSheets.gs v2 — PMES Complete Database Setup
 *
 * Run this ONCE to create/verify ALL required sheets.
 * Safe to re-run — skips sheets that already exist.
 *
 * How to run:
 *   1. Open Apps Script editor
 *   2. Select "initializeAllSheets" in the dropdown
 *   3. Click ► Run → Authorize when prompted
 */

function initializeAllSheets() {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
  )

  const SHEETS = {

    // ── CORE TABLES ──────────────────────────────────────────
    Users: [
      'id', 'uid', 'email', 'fullName', 'firstName', 'lastName',
      'role', 'positionLevel',  // positionLevel: II / III / IV
      'divisionId', 'divisionName', 'position', 'employeeNo',
      'type',                  // Regular / Co-terminal / Casual / CoS
      'tempPassword', 'mustChangePassword',
      'active', 'createdAt', 'updatedAt', 'lastLoginAt'
    ],

    Divisions: [
      'id', 'name', 'code', 'chiefId', 'chiefName',
      'adminId', 'adminName',   // Division Admin (attendance monitor)
      'parentId', 'color', 'active', 'createdAt'
    ],

    // ── MASTER KRA LIBRARY (from Enhanced STB Protocol) ──────
    MasterKRALibrary: [
      'id', 'phase', 'kraName', 'classification',
      'performanceIndicator',
      'weightII', 'weightIII', 'weightIV',
      'efficiencyGuide', 'qualityGuide', 'timelinessGuide',
      'meansOfVerification',
      'applicableTo',          // IPCRF / CCEF / BOTH
      'functionType',          // Core / Strategic / Support
      'remarks', 'active'
    ],

    // ── IPCRF / CCEF FORMS ───────────────────────────────────
    IPCRForms: [
      'id',
      'type',                  // IPCRF / CCEF
      'userId', 'employeeName',
      'position', 'positionLevel',
      'divisionId', 'divisionName',
      'semester', 'year',
      'status',                // DRAFT / SUBMITTED / APPROVED / ONGOING / FOR_RATING / RATED / FINALIZED
      'coreFunctionWeight',    // 70
      'supportFunctionWeight', // 30
      'finalNumericalRating',
      'adjectivalRating',
      'immediateSupervisor', 'supervisorPosition',
      'approvingAuthority', 'authorityPosition',
      'dateSignedRatee', 'dateSignedSupervisor', 'dateSignedAuthority',
      'feedbackStrengths', 'feedbackAreasForImprovement',
      'feedbackComments', 'feedbackRecommendations',
      'submittedAt', 'approvedAt', 'ratedAt', 'finalizedAt',
      'createdAt', 'updatedAt'
    ],

    // ── FORM ENTRIES (rows inside IPCRF/CCEF) ────────────────
    FormEntries: [
      'id', 'formId',
      'masterKRAId',           // null if custom
      'functionType',          // Core / Strategic / Support
      'kraName',
      'successIndicator',
      'applicableRatingPeriod',// 1st Semester / 2nd Semester / Both semesters
      'weight',
      'classification',        // Simple / Complex / Highly Technical / Exempted
      'efficiencyGuide', 'qualityGuide', 'timelinessGuide',
      'meansOfVerification',
      'accomplishment',
      'ratingEfficiency', 'ratingQuality', 'ratingTimeliness', 'ratingAverage',
      'movReferences',         // comma-separated reference codes
      'remarks',
      'isCustom',              // true if staff-added, not from library
      'order',                 // display order
      'createdAt', 'updatedAt'
    ],

    // ── JRB RATINGS ──────────────────────────────────────────
    JRBRatings: [
      'id', 'formId',
      'userId',                // ratee ID
      'raterType',             // SUPERVISOR / PEER1 / PEER2
      'raterId', 'raterName',
      'domain',                // 1-4 (Quality, Interpersonal, Work Habits, Personal Dev)
      'domainName',
      'itemNumber',            // 1-20
      'itemText',
      'rating',                // 1-4
      'semester', 'year',
      'createdAt', 'updatedAt'
    ],

    // ── PEER ASSIGNMENTS ─────────────────────────────────────
    PeerAssignments: [
      'id',
      'userId', 'userName',     // ratee
      'divisionId',
      'peer1Id', 'peer1Name', 'peer1DivisionId',  // same division
      'peer2Id', 'peer2Name', 'peer2DivisionId',  // different division
      'semester', 'year',
      'peer1Completed', 'peer2Completed',
      'peer1CompletedAt', 'peer2CompletedAt',
      'assignedAt', 'assignedBy'
    ],

    // ── ATTENDANCE RECORDS (monthly, per Division Admin) ─────
    AttendanceRecords: [
      'id', 'userId', 'userName',
      'divisionId', 'divisionName',
      'month', 'year',
      'tardinessCount', 'undertimeCount',
      'absenceCount', 'approvedLeaveCount',
      'recordedBy', 'recordedByName',
      'remarks',
      'createdAt', 'updatedAt'
    ],

    // ── ATTENDANCE RATINGS (semester summary) ────────────────
    AttendanceRatings: [
      'id', 'formId', 'userId',
      'semester', 'year',
      'tardinessTotal', 'undertimeTotal',
      'absenceTotal', 'approvedLeaveTotal',
      'rating',                // 1-5
      'label',                 // Outstanding/Very Satisfactory/etc
      'computedBy', 'computedAt',
      'createdAt'
    ],

    // ── ACCOMPLISHMENTS (from old schema, kept for reference) ─
    Accomplishments: [
      'id', 'type', 'semester', 'year',
      'userId', 'employeeName',
      'divisionId', 'division',
      'kraId', 'kraTitle',
      'siId', 'target', 'targetQty', 'targetUnit',
      'accomplished', 'progressPct',
      'status', 'deadline',
      'submittedAt', 'approvedAt', 'approvedBy',
      'remarks', 'revisions', 'movCount',
      'createdBy', 'createdAt', 'updatedAt',
      'deleted', 'deletedAt'
    ],

    // ── REVISIONS ────────────────────────────────────────────
    Revisions: [
      'id', 'accomplishmentId', 'fromStatus', 'toStatus',
      'remarks', 'changedBy', 'changedByName', 'changedAt'
    ],

    // ── MOV FILES ────────────────────────────────────────────
    MOVFiles: [
      'id', 'driveFileId', 'driveUrl', 'fileName', 'mimeType', 'sizeBytes',
      'description', 'accomplishmentId', 'formEntryId',
      'kraId', 'siId', 'divisionId',
      'uploadedBy', 'uploadedByName', 'uploadedAt',
      'verified', 'verifiedBy', 'verifiedAt',
      'deleted', 'deletedAt'
    ],

    // ── EVALUATIONS (Final computed scores) ──────────────────
    Evaluations: [
      'id', 'formId', 'userId', 'employeeName',
      'divisionId', 'semester', 'year',
      'spmsScore',             // IPCRF/CCEF final score (out of 5)
      'jrbSupervisorScore',    // Out of 4
      'jrbPeer1Score',         // Out of 4
      'jrbPeer2Score',         // Out of 4
      'attendanceScore',       // Out of 5
      'overallPercentage',     // Final computed %
      'overallRating',         // 1-5 scale
      'adjectivalRating',
      'manuallyAdjusted', 'adjustedBy', 'adjustedAt',
      'evaluatorRemarks',
      'computedBy', 'computedAt',
      'finalizedAt'
    ],

    // ── NOTIFICATIONS ────────────────────────────────────────
    Notifications: [
      'id', 'recipientId', 'type',
      'message', 'relatedId', 'module',
      'read', 'readAt', 'createdAt'
    ],

    // ── AUDIT LOG ────────────────────────────────────────────
    AuditLog: [
      'id', 'timestamp',
      'userId', 'userEmail', 'userName', 'role',
      'action', 'module', 'details', 'ipAddress'
    ],

    // ── REPORTS ──────────────────────────────────────────────
    Reports: [
      'id', 'name', 'type',
      'divisionId', 'semester', 'year',
      'format', 'driveFileId', 'driveUrl',
      'generatedBy', 'generatedAt'
    ],

    // ── DEADLINES ────────────────────────────────────────────
    Deadlines: [
      'id', 'name', 'type',
      'semester', 'year',
      'startDate', 'endDate',
      'active', 'createdBy', 'createdAt'
    ]
  }

  let created = 0
  let skipped = 0

  Object.entries(SHEETS).forEach(([name, headers]) => {
    const existing = ss.getSheetByName(name)
    if (existing) {
      Logger.log('  → Skipped (exists): ' + name)
      skipped++
    } else {
      const sheet = ss.insertSheet(name)
      sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      // Style header row
      const headerRange = sheet.getRange(1, 1, 1, headers.length)
      headerRange.setFontWeight('bold')
        .setBackground('#1A3A5C')
        .setFontColor('#FFFFFF')
        .setFontSize(10)
      sheet.setFrozenRows(1)
      sheet.setColumnWidth(1, 180) // ID column
      Logger.log('  ✅ Created: ' + name + ' (' + headers.length + ' columns)')
      created++
    }
  })

  // ── Seed Divisions if empty ──────────────────────────────
  seedDivisions(ss)

  Logger.log('\n════════════════════════════════')
  Logger.log('✅ PMES Sheets initialization complete')
  Logger.log('   Created: ' + created + ' new sheets')
  Logger.log('   Skipped: ' + skipped + ' existing sheets')
  Logger.log('\nNext: Run initMasterKRALibrary() to seed the KRA indicator library')
  Logger.log('════════════════════════════════')
}

function seedDivisions(ss) {
  // ss might be undefined if called incorrectly — get it fresh
  if (!ss) {
    ss = SpreadsheetApp.openById(
      PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
    )
  }

  const sheet = ss.getSheetByName('Divisions')
  if (!sheet) {
    Logger.log('  → Divisions sheet not found, skipping seed')
    return
  }

  const rows = sheet.getLastRow()
  if (rows > 1) {
    Logger.log('  → Divisions already seeded')
    return
  }

  const now = new Date().toISOString()
  const divisions = [
    ['admin-pool', 'Admin Pool', 'AP', '', '', '', '', '', 'blue', true, now],
    ['dfd', 'Design Formulation Division', 'DFD', '', '', '', '', '', 'green', true, now],
    ['pid', 'Pilot Implementation Division', 'PID', '', '', '', '', '', 'amber', true, now],
    ['staed', 'Social Technology Analysis and Evaluation Division', 'STAED', '', '', '', '', '', 'red', true, now]
  ]
  divisions.forEach(row => sheet.appendRow(row))
  Logger.log('  ✅ Seeded 4 divisions')
}
