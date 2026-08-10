/**
 * IPATService.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * Innovations Performance Assessment Tool (IPAT)
 * Per AO No. 11 s. 2025 — DSWD DSPMS / Innovations Cluster
 *
 * THREE DOMAINS:
 *   A. Core Behavioral Competencies (CBC) — 30%
 *      5 HEARTWORK values · 5 indicators each · 1–4 Likert
 *      Multi-rater: Self(15%) + Peer(15%) + Sub(15%) + Supervisor(30%) + Skip(25%)
 *      If no subordinate: Peer becomes 30%
 *
 *   B. Functional Performance Output (FPO) — 55%
 *      IPCRF/DPCR final numerical rating (1–5 scale, converted to 1–4)
 *
 *   C. Job Fitness (JF) — 15%
 *      5 indicators - Self + Immediate Supervisor / 2
 *
 * FORMULA: Overall = (CBCI × 0.30) + (FPOI × 0.55) + (JFI × 0.15)
 *
 * DESCRIPTORS:
 *   >= 4.00 - Outstanding
 *   >= 3.50 - Very Satisfactory
 *   >= 2.75 - Satisfactory
 *   >= 2.00 - Needs Improvement
 *   <  2.00 - Requires Immediate Intervention
 */

const IPATService = (() => {

  function writeContiguousRows(sheet, updates, columnCount) {
    if (!updates.length) return
    updates.sort((a, b) => a.rowNumber - b.rowNumber)

    let startRow = updates[0].rowNumber
    let rows = [updates[0].row]

    for (let i = 1; i < updates.length; i++) {
      const update = updates[i]
      const expectedRow = startRow + rows.length
      if (update.rowNumber === expectedRow) {
        rows.push(update.row)
      } else {
        sheet.getRange(startRow, 1, rows.length, columnCount).setValues(rows)
        startRow = update.rowNumber
        rows = [update.row]
      }
    }

    sheet.getRange(startRow, 1, rows.length, columnCount).setValues(rows)
  }

  function getRowContext(sheet, id) {
    const values = sheet.getDataRange().getValues()
    const headers = values[0] || []
    const idIdx = headers.indexOf('id')
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idIdx]) === String(id)) {
        const record = {}
        headers.forEach((h, idx) => { record[h] = values[i][idx] })
        return { headers, rowValues: values[i], rowNumber: i + 1, record }
      }
    }
    return null
  }

  function writeRowContext(sheet, ctx, updates) {
    const row = ctx.headers.map((h, idx) => {
      const val = Object.prototype.hasOwnProperty.call(updates, h) ? updates[h] : ctx.rowValues[idx]
      return val === undefined || val === null ? '' : val
    })
    sheet.getRange(ctx.rowNumber, 1, 1, ctx.headers.length).setValues([row])
    return { ...ctx.record, ...updates }
  }

  // Columns ensureRecordSchema() adds to IPATRecords if absent. Named for the
  // migration it performs rather than for one feature, since it now also
  // carries the FPO position-differential fields.
  const AUTO_MIGRATED_RECORD_HEADERS = [
    'cbcBaseScore',
    'cbcNteLevel',
    'cbcNteDeductionPct',
    'cbcOffenseLevel',
    'cbcOffenseDeduction',
    'cbcDeductionNote',
    'cbcDeductionBy',
    'cbcDeductionByName',
    'cbcDeductionAt',
    // Protocol V.B.1 position weight differential — recorded so a synced score
    // is auditable: which category was matched and what factor was applied.
    'fpoPositionCategory',
    'fpoWeightFactor'
  ]

  const CONDUCT_LEVELS = {
    none: {
      label: 'None',
      ntePct: 0,
      offensePoints: 0
    },
    light: {
      label: 'Light offense',
      ntePct: 5,
      offensePoints: 0.25
    },
    less_grave: {
      label: 'Less grave offense',
      ntePct: 10,
      offensePoints: 0.5
    },
    serious_grave: {
      label: 'Serious/Grave offense',
      ntePct: 15,
      offensePoints: 1
    }
  }

  function ensureRecordSchema() {
    const sheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const lastColumn = Math.max(sheet.getLastColumn(), 1)
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String)
    const missing = AUTO_MIGRATED_RECORD_HEADERS.filter(h => headers.indexOf(h) < 0)
    if (missing.length) {
      sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing])
      sheet.getRange(1, headers.length + 1, 1, missing.length)
        .setBackground('#0F2742')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold')
      SpreadsheetApp.flush()
    }
    return sheet
  }

  function normalizeConductLevel(level) {
    const raw = String(level || 'none').trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/\//g, '_')
    if (raw === 'serious' || raw === 'grave' || raw === 'seriousgrave' || raw === 'serious_grave_offense') return 'serious_grave'
    if (raw === 'lessgrave' || raw === 'less_grave_offense') return 'less_grave'
    if (raw === 'light_offense') return 'light'
    return CONDUCT_LEVELS[raw] ? raw : 'none'
  }

  function getDeductionValues(record) {
    const nteLevel = normalizeConductLevel(record.cbcNteLevel)
    const offenseLevel = normalizeConductLevel(record.cbcOffenseLevel)
    const ntePct = Number(record.cbcNteDeductionPct) || CONDUCT_LEVELS[nteLevel].ntePct || 0
    const offenseDeduction = Number(record.cbcOffenseDeduction) || CONDUCT_LEVELS[offenseLevel].offensePoints || 0
    return {
      nteLevel,
      nteLabel: CONDUCT_LEVELS[nteLevel].label,
      ntePct,
      offenseLevel,
      offenseLabel: CONDUCT_LEVELS[offenseLevel].label,
      offenseDeduction,
      hasDeduction: ntePct > 0 || offenseDeduction > 0
    }
  }

  function applyCbcDeductions(baseScore, record) {
    const base = Number(baseScore)
    if (!Number.isFinite(base) || base <= 0) {
      return { baseScore: '', adjustedScore: '', cbcWeightedScore: '', ...getDeductionValues(record) }
    }

    const d = getDeductionValues(record)
    const basePct = Math.max(0, Math.min(100, (base / 4) * 100))
    const afterNtePct = Math.max(0, basePct - d.ntePct)
    const afterNteScore = Math.max(0, Math.min(4, (afterNtePct / 100) * 4))
    const cbcWeightedScore = afterNteScore * 0.30
    return {
      ...d,
      baseScore: round2(base),
      basePct: round2(basePct),
      afterNteScore: round2(afterNteScore),
      adjustedScore: round2(afterNteScore),
      finalOverallDeduction: round2(d.offenseDeduction),
      cbcWeightedScore: round2(cbcWeightedScore)
    }
  }

  function canEditCbcDeduction(profile, record) {
    if (!profile || !record) return false
    if (profile.role === 'System Administrator') return true
    return profile.role === 'Division Chief' && String(profile.divisionId || '') === String(record.divisionId || '')
  }

  function decorateCbcDeduction(row, profile) {
    if (!row) return row
    const canEdit = canEditCbcDeduction(profile, row)
    const isRatee = profile && String(profile.id || '') === String(row.rateeId || '')
    const values = applyCbcDeductions(row.cbcBaseScore || row.cbcScore, row)
    const decorated = {
      ...row,
      cbcDeductionCanEdit: canEdit,
      cbcDeductionVisible: canEdit || isRatee,
      cbcDeductionHasDeduction: values.hasDeduction,
      cbcDeductionSummary: values
    }
    if (!canEdit) {
      delete decorated.cbcDeductionNote
      delete decorated.cbcDeductionBy
      delete decorated.cbcDeductionByName
    }
    return decorated
  }

  // Single source of truth for the domain weights. These were previously written
  // as literals inside BOTH calculateOverall and computeOverall; changing one and
  // not the other produced two different overall scores depending on the code path
  // taken. Read them from here only.
  //
  // Cluster-wide readiness (risk R2) requires these to become per-office
  // configuration rather than constants. This function is the single place that
  // then needs to resolve them from SystemSettings.
  const DOMAIN_WEIGHTS = { cbc: 0.30, fpo: 0.55, jf: 0.15 }
  const CBC_RATER_WEIGHTS = {
    self: 0.15,
    supervisor: 0.30,
    skipSupervisor: 0.25,
    peerStaffPrimary: 0.15,
    peerStaffSecondary: 0.15,
    peerLegacy: 0.30,
    peerWithSubordinate: 0.15,
    subordinate: 0.15
  }

  function domainWeights() {
    return typeof AssessmentRulesService !== 'undefined'
      ? AssessmentRulesService.getDomainWeights()
      : DOMAIN_WEIGHTS
  }

  function cbcRaterWeights() {
    return typeof AssessmentRulesService !== 'undefined'
      ? AssessmentRulesService.getCbcRaterWeights()
      : CBC_RATER_WEIGHTS
  }

  function calculateOverall(record, fpoScoreOverride) {
    const weights = domainWeights()
    const rawCbc = record.cbcScore !== '' && record.cbcScore !== null && record.cbcScore !== undefined ? Number(record.cbcScore) : null
    const rawJf  = record.jfScore  !== '' && record.jfScore  !== null && record.jfScore  !== undefined ? Number(record.jfScore)  : null

    let rawFpo = fpoScoreOverride !== undefined
      ? Number(fpoScoreOverride)
      : (record.fpoScore !== '' && record.fpoScore !== null && record.fpoScore !== undefined ? Number(record.fpoScore) : null)
    if (rawFpo !== null && rawFpo > 4) {
      rawFpo = round2(((rawFpo - 1) / 4) * 3 + 1)
    }

    // Missing components are excluded and the weights of the components actually
    // present are renormalised, so the formula always sums to 1.0. Note that this
    // means a score computed without FPO (55%) is driven entirely by CBC and JF
    // scaled up — appliedWeights below records what the score was actually built
    // from, so a renormalised score is never mistaken for a complete one.
    let weightedSum = 0
    let totalWeight = 0
    const appliedWeights = []
    if (rawCbc !== null) { weightedSum += rawCbc * weights.cbc; totalWeight += weights.cbc; appliedWeights.push('CBC') }
    if (rawFpo !== null) { weightedSum += rawFpo * weights.fpo; totalWeight += weights.fpo; appliedWeights.push('FPO') }
    if (rawJf  !== null) { weightedSum += rawJf  * weights.jf;  totalWeight += weights.jf;  appliedWeights.push('JF')  }

    if (totalWeight === 0) throw HttpError('No component scores available to compute overall', 400)

    const offenseDeduction = Number(record.cbcOffenseDeduction || 0)
    const overallScore = round2(Math.max(0, (weightedSum / totalWeight) - offenseDeduction))
    return {
      cbcScore: rawCbc !== null ? rawCbc : 0,
      normalizedFpoScore: rawFpo !== null ? rawFpo : 0,
      jfScore: rawJf !== null ? rawJf : 0,
      overallScore,
      descriptor: qualitativeDescriptor(overallScore),
      // Diagnostics — which components contributed, and how much weight was
      // actually present before renormalisation.
      appliedComponents: appliedWeights,
      missingComponents: ['CBC', 'FPO', 'JF'].filter(c => appliedWeights.indexOf(c) < 0),
      totalWeightPresent: round2(totalWeight),
      domainWeights: weights,
      offenseDeduction
    }
  }

  function recomputeOverallForRecord(recSheet, ipatId, fallbackRecord) {
    const latest = SpreadsheetService.getRow(recSheet, ipatId) || fallbackRecord
    if (!latest) return null
    try {
      const computed = calculateOverall(latest)
      SpreadsheetService.updateRow(recSheet, ipatId, {
        overallScore: computed.overallScore,
        descriptor: computed.descriptor,
        status: 'Computed',
        updatedAt: new Date().toISOString()
      })
      return computed
    } catch (e) {
      Logger.log('[PMES] recomputeOverallForRecord skipped for ' + ipatId + ': ' + e.message)
      return null
    }
  }

  // ── HEARTWORK Competency Themes ──────────────────────────────────────────
  // Exact indicators per the Innovations Unified Performance Audit Tool document
  const HEARTWORK_THEMES = [
    {
      id: 'makatao',
      label: 'Makatao',
      description: 'Reflects the commitment of personnel to uphold the dignity, worth, and rights of every individual by fostering a workplace culture grounded in respect, empathy, inclusivity, and fairness.',
      indicators: [
        'Demonstrates cultural competence and unwavering respect for the dignity of all service participants and stakeholders.',
        'Cultivates a professional environment grounded in mutual trust, empowerment, and psychological safety.',
        'Exhibits high emotional intelligence by acknowledging and valuing diverse perspectives and stakeholder interests.',
        'Addresses disagreements and workplace concerns in a constructive, respectful, and solution-oriented manner.',
        'Ensures that decisions, communications, and actions are free from gender bias and contribute to a safe, respectful, and inclusive work environment for all.'
      ]
    },
    {
      id: 'mapagpalaya',
      label: 'Mapagpalaya',
      description: 'Represents the transformative and liberating power of social work and social development, specifically through the design and implementation of innovative programs.',
      indicators: [
        'Proactively communicates procedural updates to colleagues to ensure operational continuity and team alignment.',
        'Inspires collaborative effort and shared commitment toward the achievement of Bureau objectives.',
        'Upholds collective team decisions and demonstrates professional solidarity in their execution.',
        'Identifies processes that foster collaboration and establish partnerships to facilitate knowledge exchanges.',
        'States goals and behavioral objectives of an information campaign utilizing the perspective of the target audience.'
      ]
    },
    {
      id: 'marangal',
      label: 'Marangal',
      description: 'Represents the commitment to ethical excellence, accountability, and continuous professional development in social work and public service.',
      indicators: [
        'Demonstrates consistent alignment with organizational policies, professional norms, and administrative protocols.',
        'Assumes full ownership of work outcomes, focusing on solution-recovery rather than externalizing setbacks.',
        'Upholds the highest standards of public service ethics, strictly adhering to RA 6713 and RA 3019 in all professional dealings.',
        'Takes quiet satisfaction in delivering high-quality work that meets the Bureau\'s standards of excellence.',
        'Exercises ethical transparency by seeking guidance and collaborative input when navigating complex moral or professional dilemmas.'
      ]
    },
    {
      id: 'marunong',
      label: 'Marunong',
      description: 'Refers to an employee\'s ability to demonstrate sound technical knowledge, critical thinking, continuous learning, and innovation in the performance of their duties.',
      indicators: [
        'Translates verbal directions and stakeholder needs into clear insights, ensuring all important details are understood before starting a task.',
        'Elicits real and potential issues during planning and implementation exercising good judgment through fact-based analysis.',
        'Identifies and assists with removing barriers and/or resolves issues that are impeding the progress of project team members.',
        'Identifies reasons for non-compliance or failure to meet expected results; applies varied techniques and methods in gathering data.',
        'Develops, formulates, and reviews for enhancement the processes, policies, and procedures which govern the execution of tasks, activities, or projects to ensure work is accomplished effectively and efficiently.'
      ]
    },
    {
      id: 'mapagpabago',
      label: 'Mapagpabago',
      description: 'Represents the commitment to transformational leadership and the pursuit of systemic change through innovation, continuous improvement, and sustainable social development.',
      indicators: [
        'Proactively identifies operational bottlenecks and proposes creative, viable solutions within their scope of authority.',
        'Shares and teaches knowledge, expertise, lessons learned, new approaches, and trends in the project.',
        'Leverages updated and appropriate technology to optimize the capture, storage, and dissemination of technical knowledge and project innovations.',
        'Adopts measures to drive compliance and is proactive in responding to opportunities for improving or streamlining based on experience, feedback, emerging technologies, and new direction.',
        'Keeps oneself informed of broad agency concerns, national issues which have impact on the agency, as well as emerging trends in social protection and development that may redefine strategy.'
      ]
    }
  ]

  // ── Job Fitness Indicators (5) ───────────────────────────────────────────
  // Raters: Self + Immediate Supervisor (÷2)
  const JOB_FITNESS_INDICATORS = [
    'Educational Qualification Fit: demonstrates and applies academic knowledge, specialized training, or theoretical foundations effectively to execute daily job functions and solve role-specific problems.',
    'Relevant Work Experience Alignment: demonstrates prior experiences that directly supports the competencies and technical requirements of the current role.',
    'Training and Skills Applicability: actively integrates skills gained from training or professional development directly into work workflows to improve efficiency.',
    'Commitment to Organizational Objectives: demonstrates alignment with program goals through consistent work engagement and support for organizational priorities.',
    // The previous wording claimed this was "scored based on DTR records using
    // the threshold table". No attendance data is ingested by this system and
    // none is planned — attendance is tracked outside it — so that sentence
    // described behaviour that does not exist. It is rated by the supervisor
    // like every other Job Fitness indicator; the protocol's bands are restated
    // here so the rater applies them consistently rather than by impression.
    'Attendance and Punctuality Compliance: maintains regular attendance and adheres to prescribed work schedules, with minimal unexcused absences or tardiness. Rate against the monthly attendance record — 4: 0–2 late, full attendance (excluding filed VL/PL/SL); 3: 3–5 late or 1–2 days unplanned absence; 2: 6–9 late or 3–5 days unplanned absence; 1: 10 or more late, or frequent emergency leaves.'
  ]

  // ── Qualitative Descriptors ──────────────────────────────────────────────
  function qualitativeDescriptor(score) {
    const s = Number(score)
    if (s >= 4.00) return 'Outstanding'
    if (s >= 3.50) return 'Very Satisfactory'
    if (s >= 2.75) return 'Satisfactory'
    if (s >= 2.00) return 'Needs Improvement'
    return 'Requires Immediate Intervention'
  }

  function round2(v) { return Math.round(v * 100) / 100 }

  // CBC and JF are both 1–4 Likert (see the header block). Values arrive over the
  // API as strings, and `Number(x) || 1` alone would silently accept 99 or -5 and
  // carry it straight into the weighted score. Reject out-of-range input instead:
  // the rating UI can only emit 1–4, so anything else is a client fault or tampering.
  const RATING_MIN = 1
  const RATING_MAX = 4

  function normalizeRating(value, context) {
    const num = Number(value)
    if (!isFinite(num) || num < RATING_MIN || num > RATING_MAX) {
      throw HttpError(
        `Invalid rating${context ? ' for ' + context : ''}. Ratings must be between ${RATING_MIN} and ${RATING_MAX}.`,
        400
      )
    }
    return num
  }

  function isObsoleteAssignment(row) {
    return ['JFPeer', 'JobFitnessPeer'].includes(String(row && row.raterType || ''))
  }

  function activeProtocolAssignments(rows) {
    return (rows || []).filter(r => !isObsoleteAssignment(r))
  }

  function samePeriod(row, semester, year) {
    return String(row.semester) === String(semester) && String(row.year) === String(year)
  }

  function recordScore(record, assignments) {
    const linked = assignments.filter(a => String(a.ipatRecordId) === String(record.id))
    const completed = linked.filter(a => a.status === 'Completed').length
    const hasScore = record.overallScore || record.cbcScore || record.jfScore || record.fpoScore ? 1 : 0
    const created = record.createdAt ? new Date(record.createdAt).getTime() : 0
    return (linked.length * 1000) + (completed * 100) + (hasScore * 10) - (created || 0) / 10000000000000
  }

  function findCanonicalRecord(records, assignments, rateeId, semester, year) {
    const matches = records.filter(r => String(r.rateeId) === String(rateeId) && samePeriod(r, semester, year))
    if (!matches.length) return null
    return matches.sort((a, b) => recordScore(b, assignments) - recordScore(a, assignments))[0]
  }

  function collapseCanonicalRecords(rows) {
    let assignments = []
    try {
      assignments = activeProtocolAssignments(SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)))
    } catch (e) {
      return rows
    }

    const grouped = {}
    rows.forEach(r => {
      const key = [r.rateeId, r.semester, r.year].map(String).join('|')
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(r)
    })

    return Object.keys(grouped)
      .map(key => findCanonicalRecord(grouped[key], assignments, grouped[key][0].rateeId, grouped[key][0].semester, grouped[key][0].year))
      .filter(Boolean)
  }

  // ─────────────────────────────────────────────
  // IPAT RECORDS — CRUD
  // ─────────────────────────────────────────────

  function list(params, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = ensureRecordSchema()
    let rows      = SpreadsheetService.getAllRows(sheet)

    const canViewAllAssessments = AuthService.hasPermission(profile, 'manage_ipat_scores') ||
      ['System Administrator', 'Bureau Director', 'Assistant Bureau Director'].includes(profile.role)

    if (!canViewAllAssessments) {
      if (profile.role === 'Division Chief') {
        rows = rows.filter(r => r.divisionId === profile.divisionId)
      } else {
        rows = rows.filter(r => r.rateeId === profile.id || r.raterId === profile.id)
      }
    }

    if (params.rateeId)    rows = rows.filter(r => r.rateeId    === params.rateeId)
    // Sheets returns a numeric cell as a Number, while the API always sends the
    // period as a String — so `1 === '1'` was false and this filter silently
    // dropped every row. `year` was already coerced; `semester` was not.
    if (params.semester)   rows = rows.filter(r => String(r.semester) === String(params.semester))
    if (params.year)       rows = rows.filter(r => String(r.year) === String(params.year))
    if (params.status)     rows = rows.filter(r => r.status     === params.status)
    if (params.divisionId) rows = rows.filter(r => r.divisionId === params.divisionId)

    rows = collapseCanonicalRecords(rows)
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    rows = rows.map(r => decorateCbcDeduction(r, profile))
    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  function get(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet = ensureRecordSchema()
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('IPAT record not found', 404)
    row.cbcRatings = getCBCRatings(id)
    row.jfRatings  = getJFRatings(id)

    // Section 11: Detect significant variance between Self and Supervisor in JF
    // Flag for Skip Supervisor review if |selfAvg - supervisorAvg| >= 1.0
    if (row.jfRatings.length) {
      const selfJF = row.jfRatings.filter(r => r.raterType === 'Self')
      const supJF  = row.jfRatings.filter(r => r.raterType === 'Supervisor')
      if (selfJF.length && supJF.length) {
        const avg = (arr) => arr.reduce((s, r) => s + Number(r.rating || 0), 0) / arr.length
        const gap = Math.abs(avg(selfJF) - avg(supJF))
        row.jfVarianceFlagged = gap >= 1.0
        row.jfVarianceGap     = Math.round(gap * 100) / 100
      } else {
        row.jfVarianceFlagged = false
        row.jfVarianceGap     = null
      }
    }

    return decorateCbcDeduction(row, profile)
  }

  function create(body, user) {
    const profile = AuthService.getProfile(user)
    const now     = new Date().toISOString()
    const sheet   = ensureRecordSchema()

    // The uncoerced `r.semester === body.semester` comparison here meant this
    // duplicate guard never fired: the sheet holds semester as a Number and the
    // request sends a String. That is the origin of the duplicate IPATRecords
    // rows (81 rows for 47 ratee/period keys as of 2026-08-04) that
    // findCanonicalRecord() exists to work around at read time.
    const existing = SpreadsheetService.getAllRows(sheet).find(r =>
      r.rateeId  === (body.rateeId || profile.id) &&
      String(r.semester) === String(body.semester) &&
      String(r.year) === String(body.year)
    )
    if (existing) throw HttpError('An IPAT record already exists for this ratee and period', 409)

    const rateeId  = body.rateeId  || profile.id
    const semester = body.semester || ''
    const year     = body.year     || new Date().getFullYear()

    // FPO is never taken from client input — it always comes from the
    // ratee's own IPCRF/CCEF Final Numerical Rating for this same period.
    const sourceForm = IpcrfService.getFinalRatingForUser(rateeId, semester, year)

    const record = {
      id:             SpreadsheetService.generateId('IPAT-'),
      rateeId,
      rateeName:      body.rateeName    || profile.fullName,
      divisionId:     body.divisionId   || profile.divisionId  || '',
      divisionName:   body.divisionName || profile.divisionName || '',
      position:       body.position     || profile.position     || '',
      positionLevel:  PositionHelper.resolveLevel(profile.position || ''),
      semester,
      year,
      hasSubordinate: body.hasSubordinate === true || body.hasSubordinate === 'true' || false,
      status:         'Draft',
      cbcBaseScore:   '',
      cbcScore:       '',
      cbcNteLevel:    'none',
      cbcNteDeductionPct: '',
      cbcOffenseLevel: 'none',
      cbcOffenseDeduction: '',
      cbcDeductionNote: '',
      cbcDeductionBy: '',
      cbcDeductionByName: '',
      cbcDeductionAt: '',
      fpoScore:       sourceForm ? sourceForm.finalNumericalRating : '',
      jfScore:        '',
      overallScore:   '',
      descriptor:     '',
      ipcrfFormId:    sourceForm ? sourceForm.id : '',
      createdAt:      now,
      updatedAt:      now
    }

    SpreadsheetService.appendRow(sheet, record)
    AuditService.log('CREATE', 'IPAT', `Created IPAT record ${record.id} for ${record.rateeName}`, user)
    return record
  }

  function updateRecord(id, body, user) {
    const sheet   = ensureRecordSchema()
    const updated = SpreadsheetService.updateRow(sheet, id, { ...body, updatedAt: new Date().toISOString() })
    AuditService.log('UPDATE', 'IPAT', `Updated record ${id}`, user)
    return updated
  }

  function updateStatus(id, body, user) {
    const sheet   = ensureRecordSchema()
    const updated = SpreadsheetService.updateRow(sheet, id, {
      status: body.status || body,
      updatedAt: new Date().toISOString()
    })
    AuditService.log('UPDATE_STATUS', 'IPAT', `Status updated for ${id}`, user)
    return updated
  }

  // ─────────────────────────────────────────────
  // CBC RATINGS
  // Multi-rater: Self(15%) + Peer(15% or 30%) + Sub(15%) + Supervisor(30%) + Skip(25%)
  // ─────────────────────────────────────────────

  function saveCBCRatings(ipatId, body, user) {
    const profile = AuthService.getProfile(user)
    const record  = _getRecord(ipatId)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPAT_CBC_RATINGS)
    const now     = new Date().toISOString()
    // gasWrite sends body as flattened params — ratings may arrive as JSON string
    let ratings = body.ratings || []
    if (typeof ratings === 'string') { try { ratings = JSON.parse(ratings) } catch(e) { ratings = [] } }
    if (!Array.isArray(ratings)) ratings = []

    const keyFor = (row) => [
      row.ipatId,
      row.raterId,
      row.themeId,
      String(row.indicatorIdx)
    ].join('|')
    const values = sheet.getDataRange().getValues()
    const headers = values[0] || []
    const rowFor = (data, base) => headers.map((h, idx) => {
      const val = Object.prototype.hasOwnProperty.call(data, h) ? data[h] : (base ? base[idx] : '')
      return val === undefined || val === null ? '' : val
    })
    const existingByKey = {}
    for (let i = 1; i < values.length; i++) {
      const obj = {}
      headers.forEach((h, idx) => { obj[h] = values[i][idx] })
      if (obj.id) existingByKey[keyFor(obj)] = { obj, values: values[i], rowNumber: i + 1 }
    }
    const rowsToUpdate = []
    const rowsToAppend = []

    ratings.forEach(r => {
      const ratingRow = {
        ipatId,
        rateeId:      record.rateeId,
        raterId:      r.raterId      || profile.id,
        raterName:    r.raterName    || profile.fullName,
        raterType:    r.raterType    || 'Self',
        themeId:      r.themeId,
        themeName:    r.themeName    || '',
        indicator:    r.indicator    || '',
        indicatorIdx: Number(r.indicatorIdx) || 0,
        rating:       normalizeRating(r.rating, 'competency indicator ' + (Number(r.indicatorIdx) || 0)),
        semester:     record.semester,
        year:         record.year,
        updatedAt:    now
      }
      const key = keyFor(ratingRow)
      const existing = existingByKey[key]

      if (existing) {
        rowsToUpdate.push({ rowNumber: existing.rowNumber, row: rowFor(ratingRow, existing.values) })
      } else {
        const newRow = {
          id: SpreadsheetService.generateId('CBC-'),
          ...ratingRow,
          createdAt: now
        }
        rowsToAppend.push(rowFor(newRow))
        existingByKey[key] = { obj: newRow, values: null, rowNumber: null }
      }
    })

    writeContiguousRows(sheet, rowsToUpdate, headers.length)
    if (rowsToAppend.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend)
    }

    AuditService.log('SAVE_CBC', 'IPAT', `Saved ${ratings.length} CBC ratings for ${ipatId}`, user)
    return { saved: ratings.length }
  }

  function computeCBC(ipatId, user) {
    const record      = _getRecord(ipatId)
    const ratings     = getCBCRatings(ipatId)
    const hasSubordinate = record.hasSubordinate === true || record.hasSubordinate === 'true'

    if (!ratings.length) throw HttpError('No CBC ratings found for this record', 400)

    const raterWeights = cbcRaterWeights()
    const themeScores = HEARTWORK_THEMES.map(theme => {
      const themeRatings = ratings.filter(r => r.themeId === theme.id)

      const indicatorScores = theme.indicators.map((_, idx) => {
        const indRatings = themeRatings.filter(r => Number(r.indicatorIdx) === idx)

        const get = (type) => {
          const r = indRatings.find(r => r.raterType === type)
          return r ? Number(r.rating) : null
        }

        const self  = get('Self')
        const peer  = get('Peer')
        const peer1 = get('Peer1')
        const peer2 = get('Peer2')
        const sub   = get('Subordinate')
        const sup   = get('Supervisor')
        const skip  = get('SkipSupervisor')

        // Apply weights per formula
        let score = 0, totalWeight = 0

        if (self !== null) { score += self * raterWeights.self; totalWeight += raterWeights.self }
        if (sup  !== null) { score += sup  * raterWeights.supervisor; totalWeight += raterWeights.supervisor }
        if (skip !== null) { score += skip * raterWeights.skipSupervisor; totalWeight += raterWeights.skipSupervisor }

        if (!hasSubordinate) {
          // Technical Staff: Peer1 15% + Peer2 15%
          // Legacy single-Peer path: redistributed to 30%
          if (peer1 !== null || peer2 !== null) {
            if (peer1 !== null) { score += peer1 * raterWeights.peerStaffPrimary; totalWeight += raterWeights.peerStaffPrimary }
            if (peer2 !== null) { score += peer2 * raterWeights.peerStaffSecondary; totalWeight += raterWeights.peerStaffSecondary }
          } else if (peer !== null) {
            score += peer * raterWeights.peerLegacy; totalWeight += raterWeights.peerLegacy
          }
        } else {
          if (peer !== null) { score += peer * raterWeights.peerWithSubordinate; totalWeight += raterWeights.peerWithSubordinate }
          if (sub  !== null) { score += sub  * raterWeights.subordinate; totalWeight += raterWeights.subordinate }
        }

        return totalWeight > 0 ? score / totalWeight : 0
      })

      const themeScore = round2(
        indicatorScores.reduce((s, x) => s + x, 0) / theme.indicators.length
      )
      return { themeId: theme.id, themeLabel: theme.label, score: themeScore, indicatorScores }
    })

    const cbcBaseScore = round2(
      themeScores.reduce((s, t) => s + t.score, 0) / themeScores.length
    )
    const adjusted = applyCbcDeductions(cbcBaseScore, record)
    const cbcScore = adjusted.adjustedScore

    const recSheet = ensureRecordSchema()
    const updatedRecord = SpreadsheetService.updateRow(recSheet, ipatId, {
      cbcBaseScore,
      cbcScore,
      cbcNteDeductionPct: adjusted.ntePct || '',
      cbcOffenseDeduction: adjusted.offenseDeduction || '',
      updatedAt: new Date().toISOString()
    })
    const overall = recomputeOverallForRecord(recSheet, ipatId, updatedRecord)

    AuditService.log('COMPUTE_CBC', 'IPAT', `CBC=${cbcScore} base=${cbcBaseScore} NTE=${adjusted.ntePct}% CBC weighted=${adjusted.cbcWeightedScore} offense=${adjusted.offenseDeduction} for ${ipatId}`, user)
    return {
      cbcScore,
      cbcBaseScore,
      cbcDeductionSummary: adjusted,
      themeScores,
      overallScore: overall ? overall.overallScore : '',
      descriptor: overall ? overall.descriptor : ''
    }
  }

  function setCbcDeduction(ipatId, body, user) {
    const profile = AuthService.getProfile(user)
    const recSheet = ensureRecordSchema()
    const record = SpreadsheetService.getRow(recSheet, ipatId)
    if (!record) throw HttpError('IPAT record not found', 404)
    if (!canEditCbcDeduction(profile, record)) throw HttpError('Unauthorized', 403)

    const nteLevel = normalizeConductLevel(body.cbcNteLevel || body.nteLevel)
    const offenseLevel = normalizeConductLevel(body.cbcOffenseLevel || body.offenseLevel)
    const draft = {
      ...record,
      cbcNteLevel: nteLevel,
      cbcNteDeductionPct: CONDUCT_LEVELS[nteLevel].ntePct || '',
      cbcOffenseLevel: offenseLevel,
      cbcOffenseDeduction: CONDUCT_LEVELS[offenseLevel].offensePoints || '',
      cbcDeductionNote: String(body.cbcDeductionNote || body.note || '').trim(),
      cbcDeductionBy: profile.id,
      cbcDeductionByName: profile.fullName,
      cbcDeductionAt: new Date().toISOString()
    }

    const base = record.cbcBaseScore || record.cbcScore || ''
    const adjusted = applyCbcDeductions(base, draft)
    const updates = {
      cbcBaseScore: adjusted.baseScore || base || '',
      cbcScore: adjusted.adjustedScore || record.cbcScore || '',
      cbcNteLevel: draft.cbcNteLevel,
      cbcNteDeductionPct: draft.cbcNteDeductionPct,
      cbcOffenseLevel: draft.cbcOffenseLevel,
      cbcOffenseDeduction: draft.cbcOffenseDeduction,
      cbcDeductionNote: draft.cbcDeductionNote,
      cbcDeductionBy: draft.cbcDeductionBy,
      cbcDeductionByName: draft.cbcDeductionByName,
      cbcDeductionAt: draft.cbcDeductionAt,
      updatedAt: new Date().toISOString()
    }

    const merged = { ...record, ...updates }
    if (merged.cbcScore || merged.fpoScore || merged.jfScore) {
      try {
        const overall = calculateOverall(merged)
        updates.overallScore = overall.overallScore
        updates.descriptor = overall.descriptor
        updates.status = 'Computed'
      } catch(e) {
        Logger.log('[PMES] setOffensesDeduction overall recompute skipped: ' + e.message)
      }
    }

    const updated = SpreadsheetService.updateRow(recSheet, ipatId, updates)

    AuditService.log('SET_CBC_DEDUCTION', 'IPAT',
      `Updated confidential offenses deduction for ${ipatId}: NTE=${nteLevel}, offense=${offenseLevel}`, user)

    return decorateCbcDeduction(updated, profile)
  }

  // ─────────────────────────────────────────────
  // JOB FITNESS RATINGS
  // Raters: Self + Immediate Supervisor (average of 2)
  // ─────────────────────────────────────────────

  function saveJFRatings(ipatId, body, user) {
    const profile = AuthService.getProfile(user)
    const record  = _getRecord(ipatId)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPAT_JF_RATINGS)
    const now     = new Date().toISOString()
    let ratings = body.ratings || []
    if (typeof ratings === 'string') { try { ratings = JSON.parse(ratings) } catch(e) { ratings = [] } }
    if (!Array.isArray(ratings)) ratings = []
    ratings = ratings.filter(r => ['Self', 'Supervisor'].includes(String(r.raterType || 'Self')))
    if (!ratings.length) throw HttpError('No valid Job Fitness ratings submitted', 400)

    const keyFor = (row) => [
      row.ipatId,
      row.raterId,
      String(row.indicatorIdx)
    ].join('|')
    const values = sheet.getDataRange().getValues()
    const headers = values[0] || []
    const rowFor = (data, base) => headers.map((h, idx) => {
      const val = Object.prototype.hasOwnProperty.call(data, h) ? data[h] : (base ? base[idx] : '')
      return val === undefined || val === null ? '' : val
    })
    const existingByKey = {}
    for (let i = 1; i < values.length; i++) {
      const obj = {}
      headers.forEach((h, idx) => { obj[h] = values[i][idx] })
      if (obj.id) existingByKey[keyFor(obj)] = { obj, values: values[i], rowNumber: i + 1 }
    }
    const rowsToUpdate = []
    const rowsToAppend = []

    ratings.forEach(r => {
      const ratingRow = {
        ipatId,
        rateeId:      record.rateeId,
        raterId:      r.raterId   || profile.id,
        raterName:    r.raterName || profile.fullName,
        raterType:    r.raterType || 'Self',   // Self | Supervisor
        indicator:    r.indicator || '',
        indicatorIdx: Number(r.indicatorIdx) || 0,
        rating:       normalizeRating(r.rating, 'job fitness indicator ' + (Number(r.indicatorIdx) || 0)),
        evidence:     r.evidence  || '',
        semester:     record.semester,
        year:         record.year,
        updatedAt:    now
      }
      const key = keyFor(ratingRow)
      const existing = existingByKey[key]

      if (existing) {
        rowsToUpdate.push({ rowNumber: existing.rowNumber, row: rowFor(ratingRow, existing.values) })
      } else {
        const newRow = {
          id: SpreadsheetService.generateId('JF-'),
          ...ratingRow,
          createdAt: now
        }
        rowsToAppend.push(rowFor(newRow))
        existingByKey[key] = { obj: newRow, values: null, rowNumber: null }
      }
    })

    writeContiguousRows(sheet, rowsToUpdate, headers.length)
    if (rowsToAppend.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend)
    }

    AuditService.log('SAVE_JF', 'IPAT', `Saved ${ratings.length} JF ratings for ${ipatId}`, user)
    return { saved: ratings.length }
  }

  function computeJF(ipatId, user) {
    const ratings = getJFRatings(ipatId).filter(r => ['Self', 'Supervisor'].includes(String(r.raterType || '')))
    if (!ratings.length) throw HttpError('No Job Fitness ratings found', 400)

    // JF Indicator Score = (Self + Supervisor) ÷ 2
    // JF Score = Sum of Indicator Scores ÷ 5
    const indicatorScores = JOB_FITNESS_INDICATORS.map((label, idx) => {
      const indRatings = ratings.filter(r => Number(r.indicatorIdx) === idx)

      const self = indRatings.find(r => r.raterType === 'Self')
      const sup  = indRatings.find(r => r.raterType === 'Supervisor')

      const values = [self, sup].filter(Boolean).map(r => Number(r.rating))
      const score  = values.length > 0
        ? round2(values.reduce((s, v) => s + v, 0) / values.length)
        : 0

      return { indicator: label, indicatorIdx: idx, score }
    })

    const jfScore = round2(
      indicatorScores.reduce((s, i) => s + i.score, 0) / JOB_FITNESS_INDICATORS.length
    )

    // Section 11: Flag significant variance between Self and Supervisor averages
    const selfRatings = ratings.filter(r => r.raterType === 'Self')
    const supRatings  = ratings.filter(r => r.raterType === 'Supervisor')
    let jfVarianceFlagged = false
    let jfVarianceGap     = null
    if (selfRatings.length && supRatings.length) {
      const avg = (arr) => arr.reduce((s, r) => s + Number(r.rating || 0), 0) / arr.length
      const gap = Math.abs(avg(selfRatings) - avg(supRatings))
      jfVarianceFlagged = gap >= 1.0
      jfVarianceGap     = Math.round(gap * 100) / 100
    }

    const recSheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const updatedRecord = SpreadsheetService.updateRow(recSheet, ipatId, { jfScore, updatedAt: new Date().toISOString() })
    const overall = recomputeOverallForRecord(recSheet, ipatId, updatedRecord)

    AuditService.log('COMPUTE_JF', 'IPAT', `JF=${jfScore} for ${ipatId}`, user)
    return {
      jfScore,
      indicatorScores,
      jfVarianceFlagged,
      jfVarianceGap,
      overallScore: overall ? overall.overallScore : '',
      descriptor: overall ? overall.descriptor : ''
    }
  }

  // ─────────────────────────────────────────────
  // SYNC FPO FROM IPCRF/CCEF
  // For STB, FPO is re-pulled from the ratee's own IPCRF/CCEF Final Numerical
  // Rating for this same period. Participating offices use their own approved
  // instrument and record the figure through setFPO.
  // ─────────────────────────────────────────────

  /**
   * Applies the protocol V.B.1 position weight differential to a rating pulled
   * from the IPCRF/CCEF.
   *
   * The configured factors default to 1.00, so this is a no-op until somebody
   * deliberately sets them. That default is intentional: the protocol's 22% and
   * 34% differentials describe how a position's TARGETS are weighted when
   * commitments are set, which happens inside the IPCR computation — the value
   * arriving here is an already-normalised 1–5 final rating. Multiplying it by
   * 1.22 would push results past the top of the scale.
   *
   * The result is clamped to the 1–5 scale regardless, so a mis-set factor
   * cannot produce an out-of-range score that would corrupt the overall
   * computation.
   */
  function applyFpoPositionDifferential_(record, rawScore) {
    const raw = Number(rawScore)
    const fallback = { fpoScore: raw, category: '', factor: 1 }

    try {
      if (typeof AssessmentRulesService === 'undefined') return fallback

      const positionText = record.position || record.positionLevel || ''
      const category = AssessmentRulesService.resolvePositionCategory(positionText)
      if (!category) return fallback

      const weights = AssessmentRulesService.getFpoPositionWeights()
      const factor = Number(weights[category])
      if (!isFinite(factor) || factor <= 0 || factor === 1) {
        return { fpoScore: raw, category: category, factor: 1 }
      }

      const adjusted = Math.min(5, Math.max(1, raw * factor))
      return { fpoScore: round2(adjusted), category: category, factor: factor }
    } catch (e) {
      // A misconfigured rule must never block a sync — fall back to the raw
      // IPCRF rating, which is the pre-differential behaviour.
      Logger.log('[IPAT] FPO position differential skipped: ' + e.message)
      return fallback
    }
  }

  // True only for the STB full scope, which is the one office whose FPO
  // instrument (IPCRF/DPCR) is implemented in this system.
  function requireIpcrfFpoOffice_(user) {
    const profile = AuthService.getProfile(user)
    const scope = String(profile.systemScope || 'STB_FULL')
    const officeKey = String(profile.officeId || profile.officeCode || 'STB').trim().toUpperCase()
    const isStb = scope === 'STB_FULL' && (!officeKey || officeKey === 'STB' || officeKey === 'OFF-STB')
    if (!isStb) {
      throw HttpError(
        'This office records its Functional Performance Output through its own approved ' +
        'instrument. Enter the rating directly instead of syncing from IPCRF/CCEF.',
        400
      )
    }
  }

  function syncFPO(ipatId, user) {
    // Only STB's Functional Performance Output instrument (the DSPMS
    // IPCRF/DPCR) lives in this system. Participating offices adopted their own
    // instruments under the protocol and record the resulting figure through
    // setFPO instead. The UI hides this control for them; this rejects the call
    // outright so a stale client or a crafted request cannot pull an STB
    // IPCRF rating into another office's assessment record.
    requireIpcrfFpoOffice_(user)

    const record = _getRecord(ipatId)
    const sourceForm = IpcrfService.getFinalRatingForUser(record.rateeId, record.semester, record.year)

    if (!sourceForm) {
      throw HttpError(
        'No rated or finalized IPCRF/CCEF form found for this employee for this period yet. ' +
        'The IPCRF/CCEF must be rated before the FPO score can be pulled in.',
        404
      )
    }

    const recSheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const ctx = getRowContext(recSheet, ipatId)
    if (!ctx) throw HttpError('IPAT record not found', 404)

    // Position weight differential (protocol V.B.1) applies ONLY on this path —
    // a score pulled from the IPCRF/CCEF. A manually entered FPO figure has
    // already had the office's own weighting applied before it was typed in, so
    // setFPO deliberately does not call this; applying it there would
    // double-count. It is STB-only by construction, because syncFPO itself is
    // STB-only (see requireIpcrfFpoOffice_).
    const adjusted = applyFpoPositionDifferential_(ctx.record, sourceForm.finalNumericalRating)

    const computed = calculateOverall(ctx.record, adjusted.fpoScore)
    writeRowContext(recSheet, ctx, {
      fpoScore:    adjusted.fpoScore,
      ipcrfFormId: sourceForm.id,
      fpoPositionCategory: adjusted.category,
      fpoWeightFactor: adjusted.factor,
      overallScore: computed.overallScore,
      descriptor: computed.descriptor,
      status: 'Computed',
      updatedAt:   new Date().toISOString()
    })

    AuditService.log('SYNC_FPO', 'IPAT',
      `FPO synced from ${sourceForm.type} ${sourceForm.id} (raw ${sourceForm.finalNumericalRating}` +
      (adjusted.factor !== 1 ? `, ${adjusted.category} ×${adjusted.factor} → ${adjusted.fpoScore}` : '') +
      `) for ${ipatId}`, user)

    return {
      fpoScore: adjusted.fpoScore,
      rawFpoScore: sourceForm.finalNumericalRating,
      fpoPositionCategory: adjusted.category,
      fpoWeightFactor: adjusted.factor,
      normalizedFpoScore: computed.normalizedFpoScore,
      cbcScore: computed.cbcScore,
      jfScore: computed.jfScore,
      overallScore: computed.overallScore,
      descriptor: computed.descriptor,
      source: {
        formId:            sourceForm.id,
        type:               sourceForm.type,
        status:             sourceForm.status,
        adjectivalRating:   sourceForm.adjectivalRating,
        semester:           sourceForm.semester,
        year:               sourceForm.year
      }
    }
  }

  function setFPO(ipatId, body, user) {
    // Encoding an FPO score is a scoring-administration action, not an
    // assignment-generation one. Gated on generate_ipat_assignments until
    // 2026-08-04, which would have removed it from the Bureau Director and ABD
    // when generation became System Administrator-only.
    AuthService.requirePermission(user, 'manage_ipat_scores')
    const score = Number(body.fpoScore)
    if (isNaN(score) || score < 0 || score > 5) throw HttpError('FPO score must be between 0 and 5', 400)
    const recSheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const ctx = getRowContext(recSheet, ipatId)
    if (!ctx) throw HttpError('IPAT record not found', 404)
    const computed = calculateOverall(ctx.record, score)
    writeRowContext(recSheet, ctx, {
      fpoScore: score,
      overallScore: computed.overallScore,
      descriptor: computed.descriptor,
      status: 'Computed',
      updatedAt: new Date().toISOString()
    })
    AuditService.log('SET_FPO', 'IPAT', 'Manual FPO score set to ' + score + ' for ' + ipatId, user)
    return {
      ipatId,
      fpoScore: score,
      normalizedFpoScore: computed.normalizedFpoScore,
      cbcScore: computed.cbcScore,
      jfScore: computed.jfScore,
      overallScore: computed.overallScore,
      descriptor: computed.descriptor
    }
  }

  // ─────────────────────────────────────────────
  // COMPUTE FINAL OVERALL SCORE
  // Overall = (CBCI × 0.30) + (FPOI × 0.55) + (JFI × 0.15)
  // ─────────────────────────────────────────────

  function computeOverall(ipatId, user) {
    const recSheet = ensureRecordSchema()
    const record   = SpreadsheetService.getRow(recSheet, ipatId)
    if (!record) throw HttpError('IPAT record not found', 404)

    // Delegates to calculateOverall so there is exactly one implementation of the
    // formula. This function previously carried a second, independently maintained
    // copy of the same arithmetic and the same weight literals.
    const computed = calculateOverall(record)

    const overall    = computed.overallScore
    const descriptor = computed.descriptor
    const cbc = computed.cbcScore
    const fpo = computed.normalizedFpoScore
    const jf  = computed.jfScore

    SpreadsheetService.updateRow(recSheet, ipatId, {
      overallScore: overall,
      descriptor,
      status:       'Computed',
      updatedAt:    new Date().toISOString()
    })

    AuditService.log('COMPUTE_OVERALL', 'IPAT',
      `Overall=${overall} (${descriptor}) CBC=${cbc} FPO=${fpo} JF=${jf} ` +
      `offenseDeduction=${computed.offenseDeduction} weights=${computed.totalWeightPresent} ` +
      `applied=[${computed.appliedComponents.join(',')}] missing=[${computed.missingComponents.join(',')}] for ${ipatId}`, user)

    return {
      ipatId,
      cbcScore: cbc,
      fpoScore: fpo,
      jfScore: jf,
      overallScore: overall,
      descriptor,
      // Surfaced so callers and monitoring can tell a complete score from a
      // renormalised one. 24 of 42 live records were computed without FPO.
      appliedComponents:  computed.appliedComponents,
      missingComponents:  computed.missingComponents,
      totalWeightPresent: computed.totalWeightPresent
    }
  }

  // ─────────────────────────────────────────────
  // META ENDPOINTS
  // ─────────────────────────────────────────────

  function getThemes()       { return HEARTWORK_THEMES }
  function getJFIndicators() { return JOB_FITNESS_INDICATORS.map((label, idx) => ({ idx, label })) }

  function getCBCRatings(ipatId) {
    const sheet = SpreadsheetService.getSheet(SHEET.IPAT_CBC_RATINGS)
    return SpreadsheetService.getAllRows(sheet).filter(r => r.ipatId === ipatId)
  }

  function getJFRatings(ipatId) {
    const sheet = SpreadsheetService.getSheet(SHEET.IPAT_JF_RATINGS)
    return SpreadsheetService.getAllRows(sheet).filter(r => r.ipatId === ipatId)
  }

  function _getRecord(id) {
    const sheet = ensureRecordSchema()
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('IPAT record not found', 404)
    return row
  }

  return {
    list, get, create, updateRecord, updateStatus,
    saveCBCRatings, computeCBC,
    setCbcDeduction,
    saveJFRatings,  computeJF,
    syncFPO, setFPO,
    computeOverall,
    getThemes, getJFIndicators,
    getCBCRatings, getJFRatings,
    ensureRecordSchema
  }

})()
