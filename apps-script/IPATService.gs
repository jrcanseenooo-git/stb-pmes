/**
 * IPATService.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * Innovations Performance Assessment Tool (IPAT)
 * Supplemental evaluation system per AO No. 11 s. 2025 (DSPMS)
 *
 * THREE DOMAINS:
 *   A. Core Behavioral Competencies (CBC) — 30%  — 5 HEARTWORK values, 5 indicators each
 *   B. Functional Performance Output  (FPO) — 55%  — IPCRF/DPCR score (from IPCRFService)
 *   C. Job Fitness                    (JF)  — 15%  — 7 alignment indicators
 *
 * FINAL FORMULA:
 *   Overall = (CBCI × 0.30) + (FPOI × 0.55) + (JFI × 0.15)
 *
 * CBC MULTI-RATER WEIGHTS:
 *   Self: 15% | Peer: 15% (or 30% if no subordinate) | Subordinate: 15%
 *   Immediate Supervisor: 30% | Skip Supervisor: 25%
 *
 * RATING SCALE (CBC & JF):  1-4 Likert
 *   1 = Rarely/Never | 2 = Sometimes | 3 = Most of the Time | 4 = Always
 *
 * QUALITATIVE DESCRIPTORS:
 *   3.50–4.00 = Excellent Alignment
 *   2.50–3.49 = Satisfactory Alignment
 *   1.50–2.49 = Needs Development
 *   1.00–1.49 = Requires Immediate Intervention
 */

const IPATService = (() => {

  // ── HEARTWORK competency themes and their indicators ──
  const HEARTWORK_THEMES = [
    {
      id: 'makatao',
      label: 'Makatao',
      description: 'Human worth, dignity, inclusivity, equity, and human rights',
      indicators: [
        'Champions equality and social justice in program designs and practices',
        'Integrates HRBA, GEDSI, and cultural inclusivity into work outputs',
        'Centers the needs of marginalized and vulnerable groups in decision-making',
        'Advocates for evidence and rights-based solutions that empower communities',
        'Demonstrates sensitivity to diverse identities, cultures, and lived experiences'
      ]
    },
    {
      id: 'mapagpalaya',
      label: 'Mapagpalaya',
      description: 'Empowerment, advocacy, liberation, and transformative social work',
      indicators: [
        'Facilitates participatory approaches that empower communities and stakeholders',
        'Advocates for policies and programs that address root causes of social issues',
        'Supports individuals and groups in exercising their rights and capabilities',
        'Challenges systemic barriers and structures that perpetuate inequality',
        'Demonstrates a strengths-based and empowerment-oriented approach in work'
      ]
    },
    {
      id: 'marangal',
      label: 'Marangal',
      description: 'Integrity, professionalism, accountability, and ethical conduct',
      indicators: [
        'Upholds integrity, transparency, and ethical standards in all work activities',
        'Takes responsibility for decisions, actions, and their outcomes',
        'Maintains professional conduct and respects institutional policies and protocols',
        'Demonstrates accountability by fulfilling commitments and meeting obligations',
        'Models professionalism through punctuality, reliability, and quality of work'
      ]
    },
    {
      id: 'marunong',
      label: 'Marunong',
      description: 'Competence, continuous learning, knowledge sharing, and adaptability',
      indicators: [
        'Applies relevant technical knowledge and skills effectively to assigned tasks',
        'Continuously updates skills and knowledge through learning and development',
        'Shares expertise and information to support team and organizational learning',
        'Adapts approaches and methods in response to evolving challenges and contexts',
        'Demonstrates critical thinking and sound judgment in work decisions'
      ]
    },
    {
      id: 'mapagpabago',
      label: 'Mapagpabago',
      description: 'Transformational leadership, innovation, and systemic change',
      indicators: [
        'Demonstrates visionary and purpose-driven leadership aligned with org mission',
        'Champions systemic and sustainable reforms to address root causes',
        'Empowers and inspires others toward shared organizational goals',
        'Integrates inclusive and sustainable development principles in work',
        'Initiates and supports innovation and continuous improvement'
      ]
    }
  ]

  // ── Job Fitness indicators ──
  const JOB_FITNESS_INDICATORS = [
    'Educational Qualification Fit',
    'Relevant Work Experience Alignment',
    'Training and Skills Applicability',
    'Workplace Conduct Suitability',
    'Attendance and Punctuality Compliance',
    'Commitment to Organizational Objectives',
    'Physical and Cognitive Work Capacity'
  ]

  // ── Qualitative descriptor lookup ──
  function qualitativeDescriptor(score) {
    const s = Number(score)
    if (s >= 3.50) return 'Excellent Alignment'
    if (s >= 2.50) return 'Satisfactory Alignment'
    if (s >= 1.50) return 'Needs Development'
    return 'Requires Immediate Intervention'
  }

  function round2(v) { return Math.round(v * 100) / 100 }

  // ─────────────────────────────────────────────
  // IPAT RECORDS — CRUD
  // ─────────────────────────────────────────────

  function list(params, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    let rows      = SpreadsheetService.getAllRows(sheet)

    if (!['System Administrator', 'Bureau Director', 'Assistant Bureau Director'].includes(profile.role)) {
      if (profile.role === 'Division Chief') {
        rows = rows.filter(r => r.divisionId === profile.divisionId)
      } else {
        rows = rows.filter(r => r.rateeId === profile.id || r.raterId === profile.id)
      }
    }

    if (params.rateeId)   rows = rows.filter(r => r.rateeId   === params.rateeId)
    if (params.semester)  rows = rows.filter(r => r.semester  === params.semester)
    if (params.year)      rows = rows.filter(r => String(r.year) === String(params.year))
    if (params.status)    rows = rows.filter(r => r.status    === params.status)
    if (params.divisionId) rows = rows.filter(r => r.divisionId === params.divisionId)

    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  function get(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('IPAT record not found', 404)

    // Attach CBC ratings, JF ratings
    row.cbcRatings = getCBCRatings(id)
    row.jfRatings  = getJFRatings(id)
    return row
  }

  function create(body, user) {
    const profile = AuthService.getProfile(user)
    const now     = new Date().toISOString()
    const sheet   = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)

    // Prevent duplicate per ratee per semester/year
    const existing = SpreadsheetService.getAllRows(sheet).find(r =>
      r.rateeId === (body.rateeId || profile.id) &&
      r.semester === body.semester &&
      String(r.year) === String(body.year)
    )
    if (existing) throw HttpError('An IPAT record already exists for this ratee and period', 409)

    const record = {
      id:           SpreadsheetService.generateId('IPAT-'),
      rateeId:      body.rateeId      || profile.id,
      rateeName:    body.rateeName    || profile.fullName,
      divisionId:   body.divisionId   || profile.divisionId || '',
      divisionName: body.divisionName || profile.divisionName || '',
      position:     body.position     || profile.position || '',
      positionLevel: PositionHelper.resolveLevel(profile.position || ''),
      semester:     body.semester     || '',
      year:         body.year         || new Date().getFullYear(),
      hasSubordinate: body.hasSubordinate === true || body.hasSubordinate === 'true' || false,
      status:       'Draft',
      // Domain scores (computed)
      cbcScore:     '',
      fpoScore:     body.fpoScore     || '',  // pulled from IPCRF
      jfScore:      '',
      overallScore: '',
      descriptor:   '',
      // Linked IPCRF form
      ipcrfFormId:  body.ipcrfFormId  || '',
      createdAt:    now,
      updatedAt:    now
    }

    SpreadsheetService.appendRow(sheet, record)
    AuditService.log('CREATE', 'IPAT', `Created IPAT record ${record.id} for ${record.rateeName}`, user)
    return record
  }

  function updateStatus(id, body, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('IPAT record not found', 404)
    const updated = SpreadsheetService.updateRow(sheet, id, { status: body.status, updatedAt: new Date().toISOString() })
    AuditService.log('UPDATE_STATUS', 'IPAT', `Status changed to ${body.status} for ${id}`, user)
    return updated
  }

  // ─────────────────────────────────────────────
  // CBC RATINGS — save & compute
  // ─────────────────────────────────────────────

  function saveCBCRatings(ipatId, body, user) {
    const profile = AuthService.getProfile(user)
    const record  = _getRecord(ipatId)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPAT_CBC_RATINGS)
    const now     = new Date().toISOString()
    const ratings = body.ratings || []

    ratings.forEach(r => {
      const existing = SpreadsheetService.getAllRows(sheet).find(row =>
        row.ipatId    === ipatId &&
        row.raterId   === (r.raterId || profile.id) &&
        row.themeId   === r.themeId &&
        row.indicator === r.indicator
      )

      const ratingRow = {
        ipatId,
        rateeId:      record.rateeId,
        raterId:      r.raterId      || profile.id,
        raterName:    r.raterName    || profile.fullName,
        raterType:    r.raterType    || 'Self',   // Self | Peer | Subordinate | Supervisor | SkipSupervisor
        themeId:      r.themeId,
        themeName:    r.themeName    || '',
        indicator:    r.indicator,
        indicatorIdx: r.indicatorIdx || 0,
        rating:       Number(r.rating) || 1,     // 1–4
        semester:     record.semester,
        year:         record.year,
        updatedAt:    now
      }

      if (existing) {
        SpreadsheetService.updateRow(sheet, existing.id, ratingRow)
      } else {
        SpreadsheetService.appendRow(sheet, {
          id: SpreadsheetService.generateId('CBC-'),
          ...ratingRow,
          createdAt: now
        })
      }
    })

    AuditService.log('SAVE_CBC', 'IPAT', `Saved ${ratings.length} CBC ratings for IPAT ${ipatId}`, user)
    return { saved: ratings.length }
  }

  function computeCBC(ipatId, user) {
    const record  = _getRecord(ipatId)
    const ratings = getCBCRatings(ipatId)
    const hasSubordinate = record.hasSubordinate === true || record.hasSubordinate === 'true'

    if (!ratings.length) throw HttpError('No CBC ratings found for this record', 400)

    // Group by theme, then by indicator
    // Compute indicator score per theme, then average across themes
    const themeScores = HEARTWORK_THEMES.map(theme => {
      const themeRatings = ratings.filter(r => r.themeId === theme.id)

      const indicatorScores = theme.indicators.map((_, idx) => {
        const indRatings = themeRatings.filter(r => r.indicatorIdx === idx)

        const get = (type) => {
          const r = indRatings.find(r => r.raterType === type)
          return r ? Number(r.rating) : null
        }

        const self       = get('Self')
        const peer       = get('Peer')
        const sub        = get('Subordinate')
        const supervisor = get('Supervisor')
        const skip       = get('SkipSupervisor')

        // Apply weights per formula
        let score = 0
        let totalWeight = 0

        if (self       !== null) { score += self       * 0.15; totalWeight += 0.15 }
        if (supervisor !== null) { score += supervisor * 0.30; totalWeight += 0.30 }
        if (skip       !== null) { score += skip       * 0.25; totalWeight += 0.25 }

        if (!hasSubordinate) {
          // Sub weight (15%) redistributed to Peer → Peer = 30%
          if (peer !== null) { score += peer * 0.30; totalWeight += 0.30 }
        } else {
          if (peer !== null) { score += peer * 0.15; totalWeight += 0.15 }
          if (sub  !== null) { score += sub  * 0.15; totalWeight += 0.15 }
        }

        // If not all raters have rated, normalize by actual weight collected
        return totalWeight > 0 ? score / totalWeight : 0
      })

      const themeScore = indicatorScores.reduce((s, x) => s + x, 0) / theme.indicators.length
      return { themeId: theme.id, themeLabel: theme.label, score: round2(themeScore), indicatorScores }
    })

    const cbcScore = round2(
      themeScores.reduce((s, t) => s + t.score, 0) / themeScores.length
    )

    // Persist CBC score
    const recSheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    SpreadsheetService.updateRow(recSheet, ipatId, { cbcScore, updatedAt: new Date().toISOString() })

    AuditService.log('COMPUTE_CBC', 'IPAT', `CBC score = ${cbcScore} for IPAT ${ipatId}`, user)
    return { cbcScore, themeScores }
  }

  // ─────────────────────────────────────────────
  // JOB FITNESS RATINGS — save & compute
  // ─────────────────────────────────────────────

  function saveJFRatings(ipatId, body, user) {
    const profile = AuthService.getProfile(user)
    const record  = _getRecord(ipatId)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPAT_JF_RATINGS)
    const now     = new Date().toISOString()
    const ratings = body.ratings || []

    ratings.forEach(r => {
      const existing = SpreadsheetService.getAllRows(sheet).find(row =>
        row.ipatId    === ipatId &&
        row.raterId   === (r.raterId || profile.id) &&
        row.indicator === r.indicator
      )

      const ratingRow = {
        ipatId,
        rateeId:      record.rateeId,
        raterId:      r.raterId   || profile.id,
        raterName:    r.raterName || profile.fullName,
        raterType:    r.raterType || 'Self',   // Self | Supervisor
        indicator:    r.indicator,
        indicatorIdx: r.indicatorIdx || 0,
        rating:       Number(r.rating) || 1,
        evidence:     r.evidence || '',
        semester:     record.semester,
        year:         record.year,
        updatedAt:    now
      }

      if (existing) {
        SpreadsheetService.updateRow(sheet, existing.id, ratingRow)
      } else {
        SpreadsheetService.appendRow(sheet, {
          id: SpreadsheetService.generateId('JF-'),
          ...ratingRow,
          createdAt: now
        })
      }
    })

    AuditService.log('SAVE_JF', 'IPAT', `Saved ${ratings.length} Job Fitness ratings for IPAT ${ipatId}`, user)
    return { saved: ratings.length }
  }

  function computeJF(ipatId, user) {
    const record  = _getRecord(ipatId)
    const ratings = getJFRatings(ipatId)

    if (!ratings.length) throw HttpError('No Job Fitness ratings found', 400)

    // JF Indicator Score = (Self + Supervisor) / 2
    // JF Score = Sum of Indicator Scores / 7
    const indicatorScores = JOB_FITNESS_INDICATORS.map((label, idx) => {
      const indRatings = ratings.filter(r => r.indicatorIdx === idx)
      const selfR = indRatings.find(r => r.raterType === 'Self')
      const supR  = indRatings.find(r => r.raterType === 'Supervisor')

      const self = selfR ? Number(selfR.rating) : 0
      const sup  = supR  ? Number(supR.rating)  : 0
      const count = (selfR ? 1 : 0) + (supR ? 1 : 0)

      return {
        indicator: label,
        score: count > 0 ? round2((self + sup) / count) : 0
      }
    })

    const jfScore = round2(
      indicatorScores.reduce((s, i) => s + i.score, 0) / JOB_FITNESS_INDICATORS.length
    )

    const recSheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    SpreadsheetService.updateRow(recSheet, ipatId, { jfScore, updatedAt: new Date().toISOString() })

    AuditService.log('COMPUTE_JF', 'IPAT', `JF score = ${jfScore} for IPAT ${ipatId}`, user)
    return { jfScore, indicatorScores }
  }

  // ─────────────────────────────────────────────
  // COMPUTE FINAL OVERALL SCORE
  // ─────────────────────────────────────────────

  function computeOverall(ipatId, user) {
    const recSheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const record   = SpreadsheetService.getRow(recSheet, ipatId)
    if (!record) throw HttpError('IPAT record not found', 404)

    const cbc = Number(record.cbcScore)  || 0
    const jf  = Number(record.jfScore)   || 0

    // FPO comes from linked IPCRF form's finalNumericalRating (converted to 4-pt scale)
    // or from a manually set fpoScore (stored as 0–100 or 0–5 range)
    // Normalize: IPCRF score is 1–5, IPAT is 1–4 → convert: (score - 1) / 4 * 3 + 1
    let fpo = Number(record.fpoScore) || 0
    if (fpo > 4) {
      // Convert from 5-pt IPCRF scale to 4-pt IPAT scale
      fpo = round2((fpo - 1) / 4 * 3 + 1)
    }

    // Formula: Overall = (CBCI × 0.30) + (FPOI × 0.55) + (JFI × 0.15)
    const overall    = round2((cbc * 0.30) + (fpo * 0.55) + (jf * 0.15))
    const descriptor = qualitativeDescriptor(overall)

    SpreadsheetService.updateRow(recSheet, ipatId, {
      overallScore: overall,
      descriptor,
      status:       'Computed',
      updatedAt:    new Date().toISOString()
    })

    AuditService.log('COMPUTE_OVERALL', 'IPAT',
      `Overall = ${overall} (${descriptor}) for IPAT ${ipatId}. CBC=${cbc} FPO=${fpo} JF=${jf}`, user)

    return {
      ipatId,
      cbcScore:     cbc,
      fpoScore:     fpo,
      jfScore:      jf,
      overallScore: overall,
      descriptor
    }
  }

  // ─────────────────────────────────────────────
  // META / HELPERS
  // ─────────────────────────────────────────────

  function getThemes(params, user) {
    return HEARTWORK_THEMES
  }

  function getJFIndicators(params, user) {
    return JOB_FITNESS_INDICATORS.map((label, idx) => ({ idx, label }))
  }

  function getCBCRatings(ipatId) {
    const sheet = SpreadsheetService.getSheet(SHEET.IPAT_CBC_RATINGS)
    return SpreadsheetService.getAllRows(sheet).filter(r => r.ipatId === ipatId)
  }

  function getJFRatings(ipatId) {
    const sheet = SpreadsheetService.getSheet(SHEET.IPAT_JF_RATINGS)
    return SpreadsheetService.getAllRows(sheet).filter(r => r.ipatId === ipatId)
  }

  function _getRecord(id) {
    const sheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('IPAT record not found', 404)
    return row
  }

  return {
    list, get, create, updateStatus,
    saveCBCRatings, computeCBC,
    saveJFRatings, computeJF,
    computeOverall,
    getThemes, getJFIndicators
  }

})()