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
 *      7 indicators · Self + Immediate Supervisor ÷ 2
 *
 * FORMULA: Overall = (CBCI × 0.30) + (FPOI × 0.55) + (JFI × 0.15)
 *
 * DESCRIPTORS:
 *   3.50–4.00 → Excellent Alignment
 *   2.50–3.49 → Satisfactory Alignment
 *   1.50–2.49 → Needs Development
 *   1.00–1.49 → Requires Immediate Intervention
 */

const IPATService = (() => {

  // ── HEARTWORK Competency Themes ──────────────────────────────────────────
  // Exact indicators per the Innovations Unified Performance Audit Tool document
  const HEARTWORK_THEMES = [
    {
      id: 'makatao',
      label: 'Makatao',
      description: 'Human worth, dignity, inclusivity, equity, and human rights in social work and public service',
      indicators: [
        'Championing Equality and Social Justice: actively leads efforts to embed equity and social justice principles into program designs and practices, ensuring that every output serves as a meaningful protection and empowerment mechanism for the most vulnerable sectors',
        'Embodying Compassion and Respect: consistently models and promotes a culture of compassion and respect in all professional interactions and outputs; actively ensures that program designs and workplace practices honor the diverse identities, backgrounds, and lived experiences of clients and colleagues',
        'Promoting Cultural Competence: demonstrates awareness, understanding, and respect for diverse cultural identities, beliefs, values, and practices; integrates culturally responsive approaches in communication, service delivery, and decision-making',
        'Driving Inclusive Practices: actively promotes and integrates inclusive principles into programs, policies, services, and workplace practices; ensures equitable access to opportunities, resources, and participation for individuals of diverse backgrounds',
        'Empowering Communities: consistently places community well-being and voice at the center of all program development and innovation work; designs and champions meaningful participation mechanisms that position communities as active decision-makers'
      ]
    },
    {
      id: 'mapagpalaya',
      label: 'Mapagpalaya',
      description: 'Empowerment, advocacy, liberation, and transformative social work through innovative programs',
      indicators: [
        'Foster Client Autonomy: promotes client self-determination by ensuring that programs, services, and interventions respect individual choice, encourage informed decision-making, and reduce dependency; creates opportunities for beneficiaries to actively participate in shaping solutions',
        'Build Resilience and Independence: strengthens the capacity of individuals, families, and communities to overcome challenges, adapt to changing circumstances, and sustain positive outcomes beyond program support',
        'Collaborate for Change: encourages meaningful partnerships with clients, communities, stakeholders, and colleagues in the design, implementation, and improvement of programs; fosters inclusive participation to drive sustainable social transformation',
        'Advocate for Freedom from Oppression: promotes the identification and removal of systemic, institutional, and social barriers that hinder equity, inclusion, and access to opportunities; challenges discriminatory practices and advances social justice',
        'Promote Sustainable Empowerment: ensures that interventions build lasting capacities, local ownership, and self-sustaining systems that continue to generate positive impact over time'
      ]
    },
    {
      id: 'marangal',
      label: 'Marangal',
      description: 'Ethical excellence, accountability, integrity, and continuous professional development',
      indicators: [
        'Demonstrates honesty, integrity, and fairness in all official transactions and work-related dealings including but not limited to accomplishment of Daily Time Records (DTR), accomplishment reports, and feedback reports',
        'Practices established policies, guidelines, procedures, and ethical standards in tasks, decisions, outputs, and individual actions that enhance personnel credibility in pursuit of ethical excellence and integrity',
        'Proper usage of government resources and information; performs effectively during work hours; and uses authority responsibly and only for official purposes',
        'Demonstrates professionalism and accountability in all interactions with colleagues, clients, and stakeholders by maintaining respectful, ethical, and confidential relationships, promoting transparency, and strengthening public trust',
        'Demonstrates a commitment to continuous learning and professional growth by actively seeking opportunities to develop knowledge, skills, and competencies'
      ]
    },
    {
      id: 'marunong',
      label: 'Marunong',
      description: 'Technical knowledge, critical thinking, continuous learning, and innovation in performance of duties',
      indicators: [
        'Demonstrates technical mastery and functional expertise essential to the office\'s mandates',
        'Delivers high-quality outputs characterized by precision, thoroughness, and adherence to technical standards',
        'Exhibits adaptability and openness to emerging methodologies and evolving organizational needs',
        'Proactively identifies operational bottlenecks and proposes creative, viable solutions within their scope of authority',
        'Navigates uncertainty with composure, adapting quickly to risks with a solution-oriented mindset'
      ]
    },
    {
      id: 'mapagpabago',
      label: 'Mapagpabago',
      description: 'Transformational leadership, innovation, and pursuit of systemic change for sustainable social development',
      indicators: [
        'Demonstrates Visionary and Purpose-Driven Leadership: aligns actions, decisions, and work outputs with the organization\'s mission, long-term goals, and the broader objective of sustainable social development',
        'Champions Systemic and Sustainable Reforms: proactively identifies opportunities for improvement and advocates for policies, programs, or practices that address root causes and promote lasting positive change',
        'Empowers and Inspires Others toward Shared Goals: encourages and motivates colleagues, partners, stakeholders, and communities to actively participate, collaborate, and contribute toward common organizational and development objectives',
        'Integrates Inclusive and Sustainable Development Principles in Work: promotes inclusive, client-centered, equitable, and sustainable approaches in planning, decision-making, and service delivery, ensuring that no one is left behind',
        'Initiates and Supports Innovation and Continuous Improvement: demonstrates openness to new ideas and technologies, proposes innovative solutions, and actively supports continuous learning and organizational improvement'
      ]
    }
  ]

  // ── Job Fitness Indicators (7) ───────────────────────────────────────────
  // Raters: Self + Immediate Supervisor + Skip Supervisor (÷3)
  const JOB_FITNESS_INDICATORS = [
    'Educational Qualification Fit: possesses academic qualifications that meet or exceed the minimum requirements of the position and are relevant to assigned functions',
    'Relevant Work Experience Alignment: demonstrates prior experience that directly supports the competencies and technical requirements of the current role',
    'Training and Skills Applicability: has completed relevant training or learning interventions that are directly applicable to job tasks and improve work performance',
    'Workplace Conduct Suitability: demonstrates behavior consistent with organizational standards, including respect for policies, colleagues, and institutional protocols',
    'Attendance and Punctuality Compliance: maintains regular attendance and adheres to prescribed work schedules, with minimal unexcused absences or tardiness',
    'Commitment to Organizational Objectives: demonstrates alignment with program goals through consistent work engagement and support for organizational priorities',
    'Physical and Cognitive Work Capacity: maintains sufficient physical stamina and mental focus to perform job duties consistently and safely under normal work conditions'
  ]

  // ── Qualitative Descriptors ──────────────────────────────────────────────
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

    if (params.rateeId)    rows = rows.filter(r => r.rateeId    === params.rateeId)
    if (params.semester)   rows = rows.filter(r => r.semester   === params.semester)
    if (params.year)       rows = rows.filter(r => String(r.year) === String(params.year))
    if (params.status)     rows = rows.filter(r => r.status     === params.status)
    if (params.divisionId) rows = rows.filter(r => r.divisionId === params.divisionId)

    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  function get(id, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
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

    return row
  }

  function create(body, user) {
    const profile = AuthService.getProfile(user)
    const now     = new Date().toISOString()
    const sheet   = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)

    const existing = SpreadsheetService.getAllRows(sheet).find(r =>
      r.rateeId  === (body.rateeId || profile.id) &&
      r.semester === body.semester &&
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
      cbcScore:       '',
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
    const sheet   = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const updated = SpreadsheetService.updateRow(sheet, id, { ...body, updatedAt: new Date().toISOString() })
    AuditService.log('UPDATE', 'IPAT', `Updated record ${id}`, user)
    return updated
  }

  function updateStatus(id, body, user) {
    const sheet   = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
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

    ratings.forEach(r => {
      const existing = SpreadsheetService.getAllRows(sheet).find(row =>
        row.ipatId        === ipatId &&
        row.raterId       === (r.raterId || profile.id) &&
        row.themeId       === r.themeId &&
        String(row.indicatorIdx) === String(r.indicatorIdx)
      )

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
        rating:       Number(r.rating)       || 1,
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

    AuditService.log('SAVE_CBC', 'IPAT', `Saved ${ratings.length} CBC ratings for ${ipatId}`, user)
    return { saved: ratings.length }
  }

  function computeCBC(ipatId, user) {
    const record      = _getRecord(ipatId)
    const ratings     = getCBCRatings(ipatId)
    const hasSubordinate = record.hasSubordinate === true || record.hasSubordinate === 'true'

    if (!ratings.length) throw HttpError('No CBC ratings found for this record', 400)

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

        if (self !== null) { score += self * 0.15; totalWeight += 0.15 }
        if (sup  !== null) { score += sup  * 0.30; totalWeight += 0.30 }
        if (skip !== null) { score += skip * 0.25; totalWeight += 0.25 }

        if (!hasSubordinate) {
          // Technical Staff: Peer1 15% + Peer2 15%
          // Legacy single-Peer path: redistributed to 30%
          if (peer1 !== null || peer2 !== null) {
            if (peer1 !== null) { score += peer1 * 0.15; totalWeight += 0.15 }
            if (peer2 !== null) { score += peer2 * 0.15; totalWeight += 0.15 }
          } else if (peer !== null) {
            score += peer * 0.30; totalWeight += 0.30
          }
        } else {
          if (peer !== null) { score += peer * 0.15; totalWeight += 0.15 }
          if (sub  !== null) { score += sub  * 0.15; totalWeight += 0.15 }
        }

        return totalWeight > 0 ? score / totalWeight : 0
      })

      const themeScore = round2(
        indicatorScores.reduce((s, x) => s + x, 0) / theme.indicators.length
      )
      return { themeId: theme.id, themeLabel: theme.label, score: themeScore, indicatorScores }
    })

    const cbcScore = round2(
      themeScores.reduce((s, t) => s + t.score, 0) / themeScores.length
    )

    const recSheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    SpreadsheetService.updateRow(recSheet, ipatId, { cbcScore, updatedAt: new Date().toISOString() })

    AuditService.log('COMPUTE_CBC', 'IPAT', `CBC=${cbcScore} for ${ipatId}`, user)
    return { cbcScore, themeScores }
  }

  // ─────────────────────────────────────────────
  // JOB FITNESS RATINGS
  // Raters: Self + Immediate Supervisor only (average of 2)
  // Per updated spec: only ratee and immediate supervisor rate JF.
  // ─────────────────────────────────────────────

  function saveJFRatings(ipatId, body, user) {
    const profile = AuthService.getProfile(user)
    const record  = _getRecord(ipatId)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPAT_JF_RATINGS)
    const now     = new Date().toISOString()
    let ratings = body.ratings || []
    if (typeof ratings === 'string') { try { ratings = JSON.parse(ratings) } catch(e) { ratings = [] } }
    if (!Array.isArray(ratings)) ratings = []

    ratings.forEach(r => {
      const existing = SpreadsheetService.getAllRows(sheet).find(row =>
        row.ipatId   === ipatId &&
        row.raterId  === (r.raterId || profile.id) &&
        String(row.indicatorIdx) === String(r.indicatorIdx)
      )

      const ratingRow = {
        ipatId,
        rateeId:      record.rateeId,
        raterId:      r.raterId   || profile.id,
        raterName:    r.raterName || profile.fullName,
        raterType:    r.raterType || 'Self',   // Self | Supervisor | SkipSupervisor
        indicator:    r.indicator || '',
        indicatorIdx: Number(r.indicatorIdx) || 0,
        rating:       Number(r.rating)       || 1,
        evidence:     r.evidence  || '',
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

    AuditService.log('SAVE_JF', 'IPAT', `Saved ${ratings.length} JF ratings for ${ipatId}`, user)
    return { saved: ratings.length }
  }

  function computeJF(ipatId, user) {
    const ratings = getJFRatings(ipatId)
    if (!ratings.length) throw HttpError('No Job Fitness ratings found', 400)

    // JF Indicator Score = (Self + Supervisor) ÷ 2
    // JF Score = Sum of Indicator Scores ÷ 7
    const indicatorScores = JOB_FITNESS_INDICATORS.map((label, idx) => {
      const indRatings = ratings.filter(r => Number(r.indicatorIdx) === idx)

      // JF Indicator Score = (Self-Rating + Immediate Supervisor Rating) ÷ 2
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
    SpreadsheetService.updateRow(recSheet, ipatId, { jfScore, updatedAt: new Date().toISOString() })

    AuditService.log('COMPUTE_JF', 'IPAT', `JF=${jfScore} for ${ipatId}`, user)
    return { jfScore, indicatorScores, jfVarianceFlagged, jfVarianceGap }
  }

  // ─────────────────────────────────────────────
  // SYNC FPO FROM IPCRF/CCEF
  // FPO is never entered manually — it is always re-pulled from the
  // ratee's own IPCRF/CCEF Final Numerical Rating for this same period.
  // ─────────────────────────────────────────────

  function syncFPO(ipatId, user) {
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
    SpreadsheetService.updateRow(recSheet, ipatId, {
      fpoScore:    sourceForm.finalNumericalRating,
      ipcrfFormId: sourceForm.id,
      updatedAt:   new Date().toISOString()
    })

    AuditService.log('SYNC_FPO', 'IPAT',
      `FPO synced from ${sourceForm.type} ${sourceForm.id} (${sourceForm.finalNumericalRating}) for ${ipatId}`, user)

    return {
      fpoScore: sourceForm.finalNumericalRating,
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

  // ─────────────────────────────────────────────
  // COMPUTE FINAL OVERALL SCORE
  // Overall = (CBCI × 0.30) + (FPOI × 0.55) + (JFI × 0.15)
  // ─────────────────────────────────────────────

  function computeOverall(ipatId, user) {
    const recSheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const record   = SpreadsheetService.getRow(recSheet, ipatId)
    if (!record) throw HttpError('IPAT record not found', 404)

    // Only include components that have actual data — missing components are excluded
    // and the weights of present components are scaled proportionally so the formula
    // always sums to 1.0 regardless of which sub-scores are available.
    const rawCbc = record.cbcScore !== '' && record.cbcScore !== null && record.cbcScore !== undefined ? Number(record.cbcScore) : null
    const rawJf  = record.jfScore  !== '' && record.jfScore  !== null && record.jfScore  !== undefined ? Number(record.jfScore)  : null

    let rawFpo = record.fpoScore !== '' && record.fpoScore !== null && record.fpoScore !== undefined ? Number(record.fpoScore) : null
    if (rawFpo !== null && rawFpo > 4) {
      rawFpo = round2((rawFpo - 1) / 4 * 3 + 1)
    }

    // Build weighted sum from only the available components
    let weightedSum  = 0
    let totalWeight  = 0
    if (rawCbc !== null) { weightedSum += rawCbc * 0.30; totalWeight += 0.30 }
    if (rawFpo !== null) { weightedSum += rawFpo * 0.55; totalWeight += 0.55 }
    if (rawJf  !== null) { weightedSum += rawJf  * 0.15; totalWeight += 0.15 }

    if (totalWeight === 0) throw HttpError('No component scores available to compute overall', 400)

    // Normalize so missing components don't drag the score down
    const overall    = round2(weightedSum / totalWeight)
    const descriptor = qualitativeDescriptor(overall)

    const cbc = rawCbc !== null ? rawCbc : 0
    const fpo = rawFpo !== null ? rawFpo : 0
    const jf  = rawJf  !== null ? rawJf  : 0

    SpreadsheetService.updateRow(recSheet, ipatId, {
      overallScore: overall,
      descriptor,
      status:       'Computed',
      updatedAt:    new Date().toISOString()
    })

    AuditService.log('COMPUTE_OVERALL', 'IPAT',
      `Overall=${overall} (${descriptor}) CBC=${rawCbc} FPO=${rawFpo} JF=${rawJf} weights=${round2(totalWeight)} for ${ipatId}`, user)

    return { ipatId, cbcScore: cbc, fpoScore: fpo, jfScore: jf, overallScore: overall, descriptor }
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
    const sheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('IPAT record not found', 404)
    return row
  }

  // ─────────────────────────────────────────────
  // EDAP — Employee Development and Action Plan
  // Stored as one row per IPAT record (upsert)
  // ─────────────────────────────────────────────

  function saveEdap(ipatId, body, user) {
    const record = _getRecord(ipatId)
    const sheet  = SpreadsheetService.getSheet(SHEET.IPAT_EDAP)
    const now    = new Date().toISOString()

    let rows = body.rows || []
    if (typeof rows === 'string') { try { rows = JSON.parse(rows) } catch(e) { rows = [] } }

    const existing = SpreadsheetService.getAllRows(sheet).find(r => r.ipatId === ipatId)
    const edapData = {
      ipatId,
      rateeId:    record.rateeId,
      rateeName:  record.rateeName,
      rows:       JSON.stringify(rows),
      sem1Status: body.sem1Status || 'not-started',
      sem1Notes:  body.sem1Notes  || '',
      sem2Status: body.sem2Status || 'not-started',
      sem2Notes:  body.sem2Notes  || '',
      updatedAt:  now
    }

    if (existing) {
      SpreadsheetService.updateRow(sheet, existing.id, edapData)
    } else {
      SpreadsheetService.appendRow(sheet, {
        id: SpreadsheetService.generateId('EDAP-'),
        ...edapData,
        createdAt: now
      })
    }

    AuditService.log('SAVE_EDAP', 'IPAT', `EDAP saved for ${ipatId}`, user)
    return { saved: true }
  }

  function getEdap(ipatId, user) {
    const sheet   = SpreadsheetService.getSheet(SHEET.IPAT_EDAP)
    const existing = SpreadsheetService.getAllRows(sheet).find(r => r.ipatId === ipatId)
    if (!existing) return null
    try { existing.rows = JSON.parse(existing.rows) } catch(e) { existing.rows = [] }
    return existing
  }

  return {
    list, get, create, updateRecord, updateStatus,
    saveCBCRatings, computeCBC,
    saveJFRatings,  computeJF,
    syncFPO,
    computeOverall,
    saveEdap, getEdap,
    getThemes, getJFIndicators,
    getCBCRatings, getJFRatings
  }

})()