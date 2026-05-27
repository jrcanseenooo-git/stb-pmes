/**
 * InitMasterKRAs.gs
 * Run ONCE to create the MasterKRALibrary sheet and seed it with 
 * all KRAs + Success Indicators from the Enhanced STB Performance Evaluation Protocol.
 * Also creates IPCRForms and FormEntries sheets.
 *
 * How to run:
 *   1. Open your Google Apps Script project
 *   2. Select "initMasterKRALibrary" in the function dropdown
 *   3. Click ► Run
 *   4. Authorize when prompted
 */

function initMasterKRALibrary() {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
  )

  // ── 1. Create MasterKRALibrary sheet ──
  createSheetIfMissing(ss, 'MasterKRALibrary', [
    'id','phase','kraName','classification','performanceIndicator',
    'weightII','weightIII','weightIV',
    'efficiencyGuide','qualityGuide','timelinessGuide',
    'meansOfVerification','applicableTo','functionType','remarks','active'
  ])

  // ── 2. Create IPCRForms sheet ──
  createSheetIfMissing(ss, 'IPCRForms', [
    'id','type','userId','employeeName','position','positionLevel',
    'divisionId','divisionName','semester','year',
    'status','coreFunctionWeight','supportFunctionWeight',
    'finalNumericalRating','adjectivalRating',
    'submittedAt','approvedAt','ratedAt','finalizedAt',
    'immediateSupervisor','approvingAuthority',
    'dateSignedRatee','dateSignedSupervisor','dateSignedAuthority',
    'feedbackStrengths','feedbackImprovements','feedbackComments',
    'createdAt','updatedAt'
  ])

  // ── 3. Create FormEntries sheet ──
  createSheetIfMissing(ss, 'FormEntries', [
    'id','formId','masterKRAId','functionType','kraName',
    'successIndicator','applicableRatingPeriod','weight','classification',
    'efficiencyGuide','qualityGuide','timelinessGuide',
    'meansOfVerification','accomplishment',
    'ratingEfficiency','ratingQuality','ratingTimeliness','ratingAverage',
    'movReferences','remarks','isCustom','order',
    'createdAt','updatedAt'
  ])

  // ── 4. Create JRBRatings sheet ──
  createSheetIfMissing(ss, 'JRBRatings', [
    'id','formId','userId','raterType','raterId','raterName',
    'domain','itemNumber','itemText','rating',
    'createdAt','updatedAt'
  ])

  // ── 5. Create AttendanceRatings sheet ──
  createSheetIfMissing(ss, 'AttendanceRatings', [
    'id','formId','userId','semester','year',
    'tardinessCount','absenceCount','rating','label',
    'createdAt','updatedAt'
  ])

  // ── 6. Seed Master KRA Library ──
  const sheet = ss.getSheetByName('MasterKRALibrary')
  const existing = sheet.getLastRow()
  if (existing > 1) {
    Logger.log('MasterKRALibrary already has data (' + (existing-1) + ' rows). Skipping seed.')
    Logger.log('✅ All new sheets created successfully!')
    return
  }

  const kras = getMasterKRAData()
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]

  kras.forEach(kra => {
    const row = headers.map(h => kra[h] ?? '')
    sheet.appendRow(row)
  })

  Logger.log('✅ Seeded ' + kras.length + ' KRA indicators into MasterKRALibrary')
  Logger.log('✅ All new sheets created and seeded successfully!')
}

function createSheetIfMissing(ss, name, headers) {
  let sheet = ss.getSheetByName(name)
  if (sheet) {
    Logger.log('Sheet already exists: ' + name)
    return sheet
  }
  sheet = ss.insertSheet(name)
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1A56B0')
    .setFontColor('#FFFFFF')
  sheet.setFrozenRows(1)
  Logger.log('Created sheet: ' + name)
  return sheet
}

/**
 * Master KRA Library Data
 * Extracted from the Enhanced STB Performance Evaluation Protocol
 */
function getMasterKRAData() {
  let id = 0
  function mkl(phase, kraName, classification, indicator, wII, wIII, wIV, effGuide, qualGuide, timeGuide, mov, funcType, remarks) {
    id++
    return {
      id: 'MKL-' + String(id).padStart(4, '0'),
      phase, kraName, classification,
      performanceIndicator: indicator,
      weightII: wII, weightIII: wIII, weightIV: wIV,
      efficiencyGuide: effGuide || '',
      qualityGuide: qualGuide || '',
      timelinessGuide: timeGuide || '',
      meansOfVerification: mov || '',
      applicableTo: 'BOTH',
      functionType: funcType || 'Core',
      remarks: remarks || '',
      active: true
    }
  }

  // Standard rating guides reused across many indicators
  const EFF_STANDARD = '5: 100% accomplished within timeline\n4: 76-99.99% accomplished within timeline\n3: 51-75.99% accomplished within timeline\n2: 26-50.99% accomplished within timeline\n1: 25.99% & below accomplished within timeline'
  const QUAL_DC_REVISIONS = '5: approved by DC without revisions\n4: approved by DC with 1 revision\n3: approved by DC with 2 revisions\n2: approved by DC with 3 revisions\n1: approved by DC with 4 revisions'
  const TIME_WITHIN_DUE = '5: 3 hours before end of regular working hours or earlier\n4: 1 to 2 hours 59 mins before end of regular working hours\n3: Less than an hour or on the deadline\n2: After deadline until noon of following day\n1: Beyond 12 noon of following day or later'
  const TIME_3D = '5: 2 days before deadline or earlier\n4: 1 day before deadline\n3: On the deadline\n2: 1 day after deadline\n1: 2 days after deadline or later'
  const TIME_5D = '5: 2 days before deadline or earlier\n4: 1 day before deadline\n3: On the deadline\n2: 1 day after deadline\n1: 2 days after deadline or later'
  const TIME_7D = '5: 3 days before deadline or earlier\n4: 1-2 days before deadline\n3: On the deadline\n2: 1-2 days after deadline\n1: 3 days after deadline or later'
  const TIME_10D = '5: 3 days before deadline or earlier\n4: 2 days before deadline\n3: 1 day before or on the deadline\n2: 1-4 days after deadline\n1: 5 days after deadline or later'
  const TIME_15D = '5: 5 days before deadline or earlier\n4: 3-4 days before deadline\n3: 2 days before or on the deadline\n2: 1-6 days after deadline\n1: 7 days after deadline or later'
  const TIME_20D = '5: 6 days before deadline or earlier\n4: 3-5 days before deadline\n3: 2 days before or on the deadline\n2: 1-9 days after deadline\n1: 10 days after deadline or later'
  const TIME_30D = '5: 9 days before deadline or earlier\n4: 5-8 days before deadline\n3: 4 days before or on the deadline\n2: 1-14 days after deadline\n1: 15 days after deadline or later'
  const TIME_60D = '5: 18 days before deadline or earlier\n4: 9-17 days before deadline\n3: 8 days before or on the deadline\n2: 1-29 days after deadline\n1: 30 days after deadline or later'

  return [
    // ═══════════════════════════════════════════════════════════
    // ANALYSIS PHASE
    // ═══════════════════════════════════════════════════════════
    mkl('ANALYSIS', 'Research', 'Complex',
      'Number of proposal/terms of reference crafted within prescribed template per memorandum or guidelines, approved by DC 7 working days from assignment/within set deadline',
      10, 8, 5, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_7D,
      'Activity Proposal/Terms of Reference with Memo endorsement approved by DC', 'Core'),

    mkl('ANALYSIS', 'Research', 'Highly Technical',
      'Number of research design developed within prescribed template per memorandum or guidelines, approved by DC 15 working days from approval of project proposal',
      15, 12, 8, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_15D,
      'Research Design with Memo endorsement approved by DC', 'Core'),

    mkl('ANALYSIS', 'Research', 'Complex',
      'Number of research tool developed within prescribed template per memorandum or guidelines, approved by DC 10 working days from approval of project proposal',
      10, 8, 5, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_10D,
      'Research Tool with Memo endorsement approved by DC', 'Core'),

    mkl('ANALYSIS', 'Research', 'Simple',
      'Percentage of data collected transcribed/encoded 5 working days after the conduct of the activity',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_5D,
      'Transcription files', 'Core'),

    mkl('ANALYSIS', 'Research', 'Simple',
      'Number of report on data gathering activity within prescribed template per memorandum or guidelines, with analysis and recommendations, approved by DC 7 working days after activity',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_7D,
      'Memo on Feedback Report on data gathering/validation activities approved by DC', 'Core'),

    mkl('ANALYSIS', 'Research', 'Complex',
      'Number of report on validation activity within prescribed template per memorandum or guidelines, with analysis and recommendations, approved by DC 5 working days after activity',
      7, 5, 4, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_5D,
      'Report on Consultation/Validation Workshop with Memo endorsement approved by DC', 'Core'),

    mkl('ANALYSIS', 'Research', 'Simple',
      'Number of report on consultation meetings within prescribed template per memorandum or guidelines, with analysis and recommendations, approved by DC 5 working days after activity',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_5D,
      'Report on Consultation Workshop with Memo endorsement approved by DC', 'Core'),

    mkl('ANALYSIS', 'Research', 'Complex',
      'Number of data presentation with findings prepared within prescribed template, incorporated in report 7 days after assignment',
      10, 8, 5, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_7D,
      'Inputs to Research/Situational Analysis Report through email endorsement and/or GDocs History', 'Core'),

    mkl('ANALYSIS', 'Research', 'Complex',
      'Number of data analysis prepared within prescribed template, incorporated in report 7 days after assignment',
      10, 8, 5, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_7D,
      'Inputs to Research/Situational Analysis Report through email endorsement and/or GDocs History', 'Core'),

    mkl('ANALYSIS', 'Research', 'Exempted',
      'Number of research/situational analysis report developed within prescribed template, approved by DC 30 working days after last data gathering activity',
      35, 27, 18, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_30D,
      'Research Report/Situational Analysis with Memo endorsement approved by DC', 'Core'),

    // ═══════════════════════════════════════════════════════════
    // DESIGN PHASE
    // ═══════════════════════════════════════════════════════════
    mkl('DESIGN', 'Conceptualization', 'Exempted',
      'Number of concept paper formulated within prescribed template, approved by DC 20 working days after approval of research/situational analysis report',
      35, 27, 18, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_20D,
      'Concept Note with Memo endorsement approved by DC', 'Core', 'Indicator may be duplicated per project'),

    mkl('DESIGN', 'ST Designing', 'Exempted',
      'Number of ST design developed within prescribed template, approved by DC 20 working days after approval of logical framework',
      35, 27, 18, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_20D,
      'Program Design with Memo endorsement approved by DC', 'Core', 'Follow AO Guidelines on Development of Social Technology'),

    mkl('DESIGN', 'ST Designing', 'Highly Technical',
      'Number of logical/results framework developed within prescribed template, approved by DC 20 working days after approval of concept paper',
      15, 12, 8, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_20D,
      'Logical/Results Framework with Memo endorsement approved by DC', 'Core', 'Submit together with Program Design'),

    mkl('DESIGN', 'ST Designing', 'Simple',
      'Number of gantt chart developed within prescribed template, approved by DC 20 working days after approval of logical/results framework',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_20D,
      'Gantt chart with Memo endorsement approved by DC', 'Core', 'Submit together with Program Design'),

    mkl('DESIGN', 'ST Designing', 'Complex',
      'Number of work and financial plan developed for the duration of program/project, approved by DC 20 working days after approval of logical/results framework',
      10, 8, 5, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_20D,
      'Work and Financial Plan approved by DC', 'Core', 'Submit together with Program Design'),

    mkl('DESIGN', 'ST Designing', 'Simple',
      'Number of monitoring tool developed within prescribed template, approved by DC 20 working days after approval of logical/results framework',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_20D,
      'Monitoring tool with Memo endorsement approved by DC', 'Core', 'Submit together with Program Design'),

    mkl('DESIGN', 'ST Designing', 'Highly Technical',
      'Number of communication plan developed within prescribed template, approved by DC 20 working days after approval of logical/results framework',
      15, 12, 8, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_20D,
      'Communication Plan with Memo endorsement approved by DC', 'Core'),

    mkl('DESIGN', 'ST Visual/Brand Identity Guideline', 'Complex',
      'Number of visual/brand identity guideline developed for the program/project, approved by DC 10 working days after approval of ST design',
      10, 8, 5, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_10D,
      'Visual/brand identity guideline with Memo endorsement approved by DC', 'Core'),

    mkl('DESIGN', 'ST SBCC Materials', 'Highly Technical',
      'Percentage of visual/brand identity materials developed for the program/project, approved by DC 15 working days after approval of ST visual/brand identity guideline',
      20, 16, 10, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_15D,
      'Visual/brand identity materials with Memo endorsement approved by DC', 'Core'),

    mkl('DESIGN', 'Social Media Posting', 'Complex',
      'Number of digital media content produced within social media prescribed template approved by DC within date of assignment/set deadline',
      10, 8, 5, '5: 130% accomplished\n4: 115% accomplished\n3: 100% accomplished\n2: 85% accomplished\n1: 70% accomplished', QUAL_DC_REVISIONS, TIME_WITHIN_DUE,
      'Posted digital media content', 'Core', 'For a target of 24 digital media content, 10 weighted allocation'),

    mkl('DESIGN', 'Material Development', 'Simple',
      'Number of data privacy manual developed for ST materials, approved by DC 10 working days from assignment/within set deadline',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_10D,
      'Data Privacy Manual with Memo endorsement approved by DC', 'Core'),

    mkl('DESIGN', 'Pilot Implementation Guidelines Formulation', 'Exempted',
      'Number of pilot implementation guidelines formulated within prescribed template, approved by DC 20 working days after approval of all supplemental ST materials',
      35, 27, 18, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_20D,
      'Pilot Implementation Guidelines with Memo endorsement approved by DC', 'Core'),

    mkl('DESIGN', 'Business Process & Requirements Analysis Review', 'Highly Technical',
      'Number of report on business process and requirements analysis within prescribed template, approved by DC 15 working days from assignment/within set deadline',
      15, 12, 8, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_15D,
      'BPRA with Memo approved by DC', 'Core'),

    mkl('DESIGN', 'System/Application Design', 'Highly Technical',
      'Number of system/application architecture and design developed, approved by DC 15 working days after approval of BPRA',
      15, 12, 8, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_15D,
      'System/application architecture and design with Memo approved by DC', 'Core'),

    mkl('DESIGN', 'System Development Front-End/Back-End', 'Highly Technical',
      'Number of status report reflecting actual progress on system development accepted by DC within due date',
      15, 12, 8, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_WITHIN_DUE,
      'Status report with Memo approved by DC', 'Core'),

    mkl('DESIGN', 'User Acceptance Test', 'Highly Technical',
      'Number of user acceptance report conducted with corresponding report indicating actions taken on user feedback accepted by DC 20 working days after stage deployment',
      15, 12, 8, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_20D,
      'User Acceptance Testing document Memo approved by DC', 'Core'),

    mkl('DESIGN', 'System/Application User Guide', 'Complex',
      'Number of system/application user guide developed and approved by DC 5 working days after approval of UAT report',
      9, 7, 5, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_5D,
      'System/application user guide with Memo approved by DC', 'Core'),

    mkl('DESIGN', 'User Training', 'Simple',
      'Number of feedback report as resource person/facilitator on user training within prescribed template, approved by DC 5 working days after activity',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_5D,
      'Feedback Report as SME/Facilitator during Capability Building Activity with Memo approved by DC', 'Core'),

    mkl('DESIGN', 'System/Application Deployment', 'Simple',
      'Number of report on system/application deployment within prescribed template, approved by DC 3 working days after approval of user guide',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_3D,
      'Email/Memo', 'Core'),

    mkl('DESIGN', 'System/Application Maintenance', 'Complex',
      'Percentage of change requests and system issues acted upon within 7 working days after receipt of request',
      10, 8, 5, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_7D,
      'Email/Memo (incident/change request log)', 'Core'),

    mkl('DESIGN', 'Design/Guidelines Amendment', 'Simple',
      'Percentage of amendment requests acted upon within 7 working days after receipt of request',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_7D,
      'Email/Memo (incident/change request log)', 'Core'),

    // ═══════════════════════════════════════════════════════════
    // TESTING PHASE
    // ═══════════════════════════════════════════════════════════
    mkl('TESTING', 'Memorandum of Agreement', 'Complex',
      'Number of memorandum of agreement developed approved by DC 10 working days after transmittal of turnover documents or approval of pilot implementation guidelines',
      10, 8, 5, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_10D,
      'MOA with Memo approved by DC', 'Core'),

    mkl('TESTING', 'Orientation', 'Simple',
      'Number of orientation materials developed approved by DC 15 working days after approval of pilot implementation guidelines',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_15D,
      'Email/Memo with orientation materials', 'Core', 'Slide deck, Briefer'),

    mkl('TESTING', 'Training', 'Simple',
      'Number of training/activity design formulated within prescribed template, approved by DC 30 working days before the training/activity',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_30D,
      'Training/activity design with Memo approved by DC', 'Core'),

    mkl('TESTING', 'Pilot Demonstration', 'Simple',
      'Number of report on pilot demonstration within prescribed template approved by DC 5 working days after activity',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_5D,
      'Report on pilot demonstration with Memo approved by DC', 'Core'),

    mkl('TESTING', 'Monitoring and Technical Assistance', 'Complex',
      'Number of report on quarterly project monitoring within prescribed template, approved by DC every 10th day of succeeding quarter',
      10, 8, 5, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_10D,
      'Report on quarterly monitoring with Memo approved by DC', 'Core'),

    mkl('TESTING', 'Pilot Testing', 'Highly Technical',
      'Number of semestral pilot testing report developed within prescribed template, approved by DC every 12th calendar day of succeeding semestral',
      15, 12, 8, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_15D,
      'Pre/Post Pilot Testing Reports, MOA signing reports, etc.', 'Core'),

    mkl('TESTING', 'Pilot Testing', 'Exempted',
      'Number of full pilot testing documentation report developed within prescribed template, approved by DC 30 working days after last pilot testing activity',
      35, 27, 18, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_30D,
      'Full pilot testing documentation report with Memo approved by DC', 'Core'),

    mkl('TESTING', 'Exit Conference', 'Simple',
      'Number of report on preparatory meetings for exit conference within prescribed template, approved by DC 5 working days after activity',
      3, 2, 2, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_5D,
      'Feedback report with Memo endorsement approved by DC', 'Core'),

    mkl('TESTING', 'Exit Conference', 'Simple',
      'Number of exit conference conducted with report, within prescribed template, approved by DC 5 working days after activity',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_5D,
      'Report on exit conference with Memo endorsement approved by DC', 'Core'),

    // ═══════════════════════════════════════════════════════════
    // EVALUATION PHASE
    // ═══════════════════════════════════════════════════════════
    mkl('EVALUATION', 'Evaluation', 'Complex',
      'Number of proposal/terms of reference crafted within prescribed template, approved by DC 7 working days from assignment/within set deadline',
      10, 8, 5, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_7D,
      'Activity Proposal/Terms of Reference with Memo endorsement approved by DC', 'Core'),

    mkl('EVALUATION', 'Evaluation', 'Highly Technical',
      'Number of evaluation design developed within prescribed template, approved by DC 15 working days from approval of ST design',
      15, 12, 8, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_15D,
      'Evaluation Design with Memo endorsement approved by DC', 'Core'),

    mkl('EVALUATION', 'Evaluation', 'Complex',
      'Number of evaluation tool developed within prescribed template, approved by DC 10 working days from approval of evaluation design',
      10, 8, 5, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_10D,
      'Evaluation Tool with Memo endorsement approved by DC', 'Core'),

    mkl('EVALUATION', 'Evaluation', 'Exempted',
      'Number of evaluation report developed within prescribed template, approved by DC 30 working days after last data gathering activity',
      35, 27, 18, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_30D,
      'Evaluation Report with Memo endorsement approved by DC', 'Core'),

    // ═══════════════════════════════════════════════════════════
    // PORTFOLIO / PROMOTION
    // ═══════════════════════════════════════════════════════════
    mkl('PROMOTION', 'ST Manual', 'Exempted',
      'Number of ST manual developed, approved by DC 30 working days after approval of evaluation report recommending promotion and institutionalization',
      35, 27, 18, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_30D,
      'ST Manual with Memo approved by DC', 'Core'),

    mkl('PROMOTION', 'National Implementation Guidelines Formulation', 'Exempted',
      'Number of national implementation guidelines formulated within prescribed template, approved by DC 20 working days after approval of evaluation report',
      35, 27, 18, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_20D,
      'Project/Program Guidelines with Memo approved by DC', 'Core'),

    mkl('PORTFOLIO', 'ST Portfolio', 'Highly Technical',
      'Number of ST portfolio developed, approved by DC 30 working days after approval ST manual',
      20, 16, 10, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_30D,
      'ST Portfolio with Memo approved by DC', 'Core'),

    mkl('SOCIAL_MARKETING', 'Social Media Management', 'Complex',
      'Number of digital media content produced within social media prescribed template approved by DC within date of assignment/set deadline',
      10, 8, 5, '5: 130% accomplished\n4: 115%\n3: 100%\n2: 85%\n1: 70%', QUAL_DC_REVISIONS, TIME_WITHIN_DUE,
      'Digital media content', 'Core', 'For a target of 24 digital media content, 10 weighted allocation'),

    mkl('SOCIAL_MARKETING', 'Social Media Management', 'Exempted',
      '6 monthly social media calendar approved by DC 15 days before succeeding month',
      25, 20, 13, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_15D,
      'Monthly social media calendar', 'Core'),

    // ═══════════════════════════════════════════════════════════
    // STRATEGIC PRIORITIES
    // ═══════════════════════════════════════════════════════════
    mkl('STRATEGIC', 'Special Directives', 'Highly Technical',
      'Special directives approved without revision and within due date',
      17, 14, 10, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_WITHIN_DUE,
      'Transmittals, screenshot of email', 'Strategic',
      'Other special directives are confidential. Tasks from DC/BD not part of individual IPC.'),

    mkl('STRATEGIC', 'Efficient Service Delivery', 'Complex',
      '100% of documents acted upon within EoDB Law Timelines (3 working days simple, 7 complex, 20 highly technical)',
      10, 8, 5, EFF_STANDARD, '', '',
      'Cascaded DPCRF Score', 'Strategic'),

    // ═══════════════════════════════════════════════════════════
    // SUPPORT FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    mkl('SUPPORT', 'Input to Documents', 'Highly Technical',
      'Number of highly technical/exempted document development process supported through provision of technical inputs approved by DC within set timeline',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_WITHIN_DUE,
      'Screenshot of email/GDocs comment accepted with timestamp', 'Support'),

    mkl('SUPPORT', 'Input to Documents', 'Complex',
      'Number of complex document development process supported through provision of technical inputs approved by DC within set timeline',
      4, 3, 2, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_WITHIN_DUE,
      'Screenshot of email/GDocs comment accepted with timestamp', 'Support'),

    mkl('SUPPORT', 'Input to Documents', 'Simple',
      'Number of simple document development process supported through provision of technical inputs approved by DC within set timeline',
      3, 2, 1, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_WITHIN_DUE,
      'Screenshot of email/GDocs comment accepted with timestamp', 'Support'),

    mkl('SUPPORT', 'Planning Concerns (DSPMS)', 'Complex',
      '100% of assigned D/IPCRF/CCEF documents reviewed and provided with comments following the DSPMS Guidelines 3 working days after receipt of document',
      10, 8, 5, EFF_STANDARD, '', TIME_3D,
      '100% of assigned IPCR reviewed endorsed to DC', 'Support', 'For DSPMS focals'),

    mkl('SUPPORT', 'HPMES (Division Focals)', 'Highly Technical',
      '1 Semestral Division Physical and Financial Accomplishment Report within prescribed template, approved by DC every 10th day of succeeding semester',
      5, 3, 2, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_10D,
      'Approved accomplishment report', 'Support'),

    mkl('SUPPORT', 'Representation to Inter-Agency/Inter-Bureau Committee', 'Complex',
      '100% of interagency meetings/activities attended with feedback reports submitted to DC within prescribed template and set timeline',
      10, 8, 5, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_WITHIN_DUE,
      'Reports', 'Support'),

    mkl('SUPPORT', 'Risk Management', 'Complex',
      '100% compliance to RM related document approved by BD/DC after 2 revisions within due date',
      10, 7, 4, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_WITHIN_DUE,
      'Inputs to RM related document endorsed/approved by DC/BD', 'Support'),

    mkl('SUPPORT', 'ISSP', 'Complex',
      '1 ISSP Consistent with approved WFP, within template, approved by BD/DC after 2 revisions within due date',
      10, 7, 4, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_WITHIN_DUE,
      'Approved consolidated work with memo endorsement to ICTMS approved by Bureau Director', 'Support'),

    mkl('SUPPORT', 'PMIS', 'Simple',
      'Inputs to PMIS Manual incorporated in final manual within due date',
      5, 3, 2, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_WITHIN_DUE,
      'Inputs with Memo endorsement approved by DC/BD', 'Support'),

    mkl('SUPPORT', '7S Good Housekeeping', 'Simple',
      '100% Good housekeeping Audit Checklist without revision, approved by DC, 20 days prior to implementation',
      3, 3, 2, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_20D,
      'Approved checklist', 'Support'),

    mkl('SUPPORT', 'Internal Quality Audit', 'Highly Technical',
      'Internal Quality Audit Report, approved by DC after 2 revisions, 10 days after audit',
      17, 14, 10, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_10D,
      'Approved audit report', 'Support'),

    mkl('SUPPORT', 'Accomplishment Reports', 'Complex',
      '2 Quarterly Bureau Accomplishment Report approved by DC every 15th day of first month of succeeding quarter',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_15D,
      'Quarterly Report endorsed/approved by DC/BD', 'Support'),

    mkl('SUPPORT', 'Accomplishment Reports', 'Complex',
      '6 monthly bureau accomplishment report approved by DC every 10th day of succeeding month',
      5, 4, 3, EFF_STANDARD, QUAL_DC_REVISIONS, TIME_10D,
      'Monthly Bureau ARs', 'Support'),
  ]
}
