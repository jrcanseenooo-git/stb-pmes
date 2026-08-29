/**
 * PortalService.gs
 *
 * Lightweight, read-only summaries for the Innovation Cluster Personnel
 * Assessment Portal.
 *
 * This exists because DashboardService aggregates the STB Accomplishments
 * instrument, which participating offices do not use and which is absent from
 * the evaluation-only office spreadsheets. Rather than widening that service
 * with office branches, portal counters are computed here.
 *
 * Design rules for this file:
 *  - Aggregate on the server. The response carries counters, never rating rows.
 *  - Read each sheet at most once per request.
 *  - Stay read-only. Opening a dashboard must never write, compute or finalize.
 *
 * Office routing is applied by OfficeScopeService before this service runs, so
 * every sheet read here already resolves to the caller's designated office
 * spreadsheet. No office or spreadsheet identifier is accepted from the client.
 */
const PortalService = (() => {
  const DIVISION_NAME_FALLBACKS = {
    'admin-pool': 'Admin Pool',
    dfd: 'Design Formulation Division',
    pid: 'Pilot Implementation Division',
    staed: 'Social Technology Analysis and Evaluation Division'
  }
  const SECTION_NAME_FALLBACKS = {
    'children and youth': 'Children and Youth Section',
    'children and youth section': 'Children and Youth Section',
    'other marginalized group': 'Other Marginalized Groups Section',
    'other marginalized groups': 'Other Marginalized Groups Section',
    'other marginalized section': 'Other Marginalized Groups Section',
    'other marginalized group section': 'Other Marginalized Groups Section',
    'other marginalized groups section': 'Other Marginalized Groups Section',
    'women, pwd, op': 'Women, Persons with Disability and Older Persons Section',
    'women, pwd and op': 'Women, Persons with Disability and Older Persons Section',
    'women, pwd, and op': 'Women, Persons with Disability and Older Persons Section',
    'women, older persons and persons with disability section': 'Women, Persons with Disability and Older Persons Section',
    'women, older persons and persons with disabilities section': 'Women, Persons with Disability and Older Persons Section',
    'women, persons with disability and older persons': 'Women, Persons with Disability and Older Persons Section',
    'women, persons with disability and older persons section': 'Women, Persons with Disability and Older Persons Section',
    'promotion section': 'Social Technology Promotion Section',
    'promotions section': 'Social Technology Promotion Section',
    'social technology promotion section': 'Social Technology Promotion Section',
    'social technology evaluation section': 'Social Technology Evaluation Section',
    'social technology portfolio management section': 'Social Technology Portfolio Management Section'
  }

  function normalizeEmail_(value) {
    return String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase()
  }

  function profileRosterIdentity_(profile) {
    const ids = {}
    const emails = {}
    const addId = (value) => {
      const key = String(value || '').trim()
      if (key) ids[key] = true
    }
    const addEmail = (value) => {
      const key = normalizeEmail_(value)
      if (key) emails[key] = true
    }

    addId(profile && profile.id)
    addId(profile && profile.personnelId)
    addId(profile && profile.officePersonnelId)
    addEmail(profile && profile.email)

    try {
      const personnelSheet = SpreadsheetService.getSheet('Personnel')
      SpreadsheetService.getAllRows(personnelSheet).forEach(row => {
        const sameEmail = normalizeEmail_(row.email) && emails[normalizeEmail_(row.email)]
        const sameUid = String(row.uid || '').trim() &&
          String(profile && profile.uid || '').trim() &&
          String(row.uid || '').trim() === String(profile.uid || '').trim()
        if (sameEmail || sameUid) {
          addId(row.id)
          addEmail(row.email)
        }
      })
    } catch (e) {
      Logger.log('[Portal] Personnel identity lookup skipped: ' + e.message)
    }

    return { ids: Object.keys(ids), emails: Object.keys(emails) }
  }

  function isProfileRater_(row, identity) {
    const raterId = String(row && row.raterId || '').trim()
    const raterEmail = normalizeEmail_(row && row.raterEmail)
    return (raterId && identity.ids.indexOf(raterId) >= 0) ||
      (raterEmail && identity.emails.indexOf(raterEmail) >= 0)
  }

  function summary(params, user) {
    const profile = AuthService.getProfile(user)
    const identity = profileRosterIdentity_(profile)

    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    const allMyAssignments = SpreadsheetService.getAllRows(assignSheet).filter(row =>
      isProfileRater_(row, identity)
    )
    // The dashboard is a call to action, not a generic reporting filter. When
    // an employee has unfinished tasks from a previous semester, surface the
    // oldest such period first so "Open Evaluation" can take them straight to
    // the work that still needs attention. A supplied period remains an
    // explicit override for future consumers of this endpoint.
    const period = resolvePeriod_(params, allMyAssignments)
    const myAssignments = allMyAssignments.filter(row => matchesPeriod_(row, period))

    const completed = myAssignments.filter(row => String(row.status) === 'Completed')
    const outstanding = myAssignments.filter(row => String(row.status) !== 'Completed')

    // A task counts as a draft when this rater has already saved at least one
    // response against the linked record but has not submitted. Both rating
    // sheets are read once and reduced to a set of record ids.
    const startedRecordIds = ratedRecordIds_(identity.ids)
    const draft = outstanding.filter(row => row.ipatRecordId && startedRecordIds[String(row.ipatRecordId)])
    const pending = outstanding.length - draft.length

    return {
      person: {
        fullName: profile.fullName || '',
        position: profile.position || '',
        positionLevel: profile.positionLevel || '',
        officeName: profile.officeName || '',
        divisionName: profile.divisionName || '',
        section: profile.section || '',
        role: profile.role || ''
      },
      period: {
        semester: period.semester,
        year: period.year,
        label: 'Semester ' + period.semester + ' · ' + period.year
      },
      tasks: {
        total: myAssignments.length,
        pending: pending,
        draft: draft.length,
        completed: completed.length,
        completionRate: myAssignments.length
          ? Math.round((completed.length / myAssignments.length) * 100)
          : 0
      },
      generatedAt: new Date().toISOString()
    }
  }

  /**
   * The rating tasks list, shaped for the portal.
   *
   * IPATRaterAssignmentService.getMyRatees returns the full assignment row plus
   * score context. Ordinary personnel must not receive score fields for people
   * they rate, so this projects a deliberate, minimal subset.
   */
  function myTasks(params, user) {
    const profile = AuthService.getProfile(user)
    const period = resolvePeriod_(params)
    const identity = profileRosterIdentity_(profile)

    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    const rows = SpreadsheetService.getAllRows(assignSheet).filter(row =>
      isProfileRater_(row, identity) &&
      matchesPeriod_(row, period)
    )

    const startedRecordIds = ratedRecordIds_(identity.ids)

    const items = rows.map(row => {
      const submitted = String(row.status) === 'Completed'
      const started = Boolean(row.ipatRecordId && startedRecordIds[String(row.ipatRecordId)])
      return {
        id: row.id,
        rateeName: row.rateeName || '',
        rateePosition: row.rateePosition || row.positionLevel || '',
        organizationalUnit: row.rateeDivisionName || row.divisionName || '',
        raterType: row.raterType || '',
        semester: row.semester,
        year: row.year,
        status: submitted ? 'SUBMITTED' : (started ? 'DRAFT' : 'PENDING'),
        lastSavedAt: row.updatedAt || null,
        submittedAt: submitted ? (row.completedAt || row.updatedAt || null) : null,
        assessmentRecordId: row.ipatRecordId || ''
      }
    })

    return {
      items: items,
      period: { semester: period.semester, year: period.year },
      generatedAt: new Date().toISOString()
    }
  }

  /**
   * The ratee's own consolidated results.
   *
   * Confidentiality rules applied here, per section 14 of the specification:
   *  - Only the authenticated user's own records are returned. The underlying
   *    service already filters on rateeId; nothing accepts a ratee from the client.
   *  - Individual rater identities are never included.
   *  - The list of which rater types are still outstanding is reduced to a count.
   *    Naming the outstanding relationship ("Supervisor") points at one specific
   *    person in most units, which is exactly what confidentiality forbids.
   *  - Raw per-rater scores are not exposed; only consolidated domain scores.
   */
  function myResults(params, user) {
    const rows = IPATRaterAssignmentService.getMyResults(params || {}, user)

    const items = (rows || []).map(row => ({
      id: row.id,
      semester: row.semester,
      year: row.year,
      periodLabel: 'Semester ' + row.semester + ' · ' + row.year,
      organizationalUnit: row.divisionName || '',
      positionLevel: row.positionLevel || '',
      cbcScore: row.cbcScore,
      fpoScore: row.fpoScore,
      jfScore: row.jfScore,
      overallScore: row.overallScore,
      descriptor: descriptorForScore_(row.overallScore) || row.descriptor,
      status: row.status,
      // Progress only. No rater is named and no rater type is disclosed.
      raterProgress: {
        completed: row.completedRaters || 0,
        total: row.totalRaters || 0,
        allComplete: Boolean(row.allComplete)
      },
      // A ratee may see that their own score carries a deduction, since it is
      // their own record, but not any of the rating content behind it.
      hasDeduction: Boolean(row.cbcDeductionHasDeduction)
    }))

    items.sort((a, b) => (Number(b.year) - Number(a.year)) || (Number(b.semester) - Number(a.semester)))

    return { items: items, generatedAt: new Date().toISOString() }
  }

  /**
   * Read-only assessment library for the portal.
   *
   * Returns published assessment content and its categories only. KRA content is
   * structurally absent - it lives in STB-only sheets that the evaluation-only
   * office spreadsheets do not contain - so there is nothing to filter out here.
   * Authoring fields are dropped so the response cannot be mistaken for an
   * editing surface.
   */
  function library(params, user) {
    const categories = safeList_(() => AssessmentCategoryService.list({ pageSize: 200 }, user))
    const content = safeList_(() => AssessmentContentService.list({ pageSize: 500 }, user))

    const published = content.filter(row => {
      const status = String(row.status || '').toUpperCase()
      return status === '' || status === 'PUBLISHED' || status === 'ACTIVE'
    })

    const items = published.map(row => ({
      id: row.id,
      domain: row.domain || '',
      category: row.category || '',
      questionText: row.questionText || '',
      guidanceText: row.guidanceText || '',
      scaleType: row.scaleType || '',
      required: row.required,
      evidenceRequired: row.evidenceRequired,
      applicableRaters: row.applicableRaters || '',
      applicableLevels: row.applicableLevels || '',
      sequence: Number(row.sequence) || 0,
      version: row.version || '',
      period: row.period || ''
    }))

    return {
      categories: categories.map(row => ({
        id: row.id,
        name: row.name || row.category || '',
        domain: row.domain || '',
        description: row.description || '',
        weight: row.weight != null ? row.weight : null,
        sequence: Number(row.sequence) || 0
      })),
      items: items,
      version: items.length ? items[0].version : '',
      generatedAt: new Date().toISOString()
    }
  }

  /**
   * Office assessment analytics for office administrators.
   *
   * Aggregated entirely on the server. The response carries operational
   * rollups and consolidated personnel outcomes only; raw rating answers and
   * individual rater identities never leave the server. Office routing is
   * already applied, so an office administrator can only ever summarize their
   * own office; a central administrator may target one office explicitly and
   * that targeting is validated by OfficeScopeService, not here.
   */
  function officeSummary(params, user) {
    const profile = AuthService.getProfile(user)
    requireOfficeMonitoring_(profile)

    const period = resolvePeriod_(params)
    const scope = monitoringScope_(profile)

    const personnel = applyMonitoringScope_(safeRows_(SHEET.USERS, 'Personnel'), scope)
    const assignments = safeRows_(SHEET.IPAT_ASSIGNMENTS, 'RaterAssignments')
      .filter(row => matchesPeriod_(row, period))
      .filter(row => matchesMonitoringScope_(row, scope))
    const records = safeRows_(SHEET.IPAT_RECORDS, 'AssessmentRecords')
      .filter(row => matchesPeriod_(row, period))
      .filter(row => matchesMonitoringScope_(row, scope))

    const isTrue = (value) => value === true || String(value).toLowerCase() === 'true'
    const activePersonnel = personnel.filter(row => isTrue(row.active))
    const pendingPersonnel = personnel.filter(row => isTrue(row.pendingActivation))

    const completed = assignments.filter(row => String(row.status) === 'Completed')
    const outstanding = assignments.filter(row => String(row.status) !== 'Completed')

    const personDirectory = buildPersonDirectory_(personnel)
    const enrichedAssignments = enrichMonitoringRows_(assignments, personDirectory)
    const enrichedRecords = enrichMonitoringRows_(records, personDirectory)
    const insights = buildOfficeInsights_(personnel, enrichedAssignments, enrichedRecords, profile, personDirectory)

    return {
      period: {
        semester: period.semester,
        year: period.year,
        label: 'Semester ' + period.semester + ' · ' + period.year
      },
      kpis: {
        totalPersonnel: personnel.length,
        activePersonnel: activePersonnel.length,
        pendingValidation: pendingPersonnel.length,
        inactivePersonnel: personnel.length - activePersonnel.length - pendingPersonnel.length,
        totalTasks: assignments.length,
        submittedTasks: completed.length,
        outstandingTasks: outstanding.length,
        completionRate: assignments.length
          ? Math.round((completed.length / assignments.length) * 100)
          : 0,
        assessmentRecords: records.length,
        finalizedRecords: records.filter(row => ['Final', 'Computed'].indexOf(String(row.status || '')) >= 0).length
      },
      byStatus: [
        { label: 'Submitted', count: completed.length },
        { label: 'Outstanding', count: outstanding.length }
      ],
      byUnit: groupCompletion_(enrichedAssignments, row =>
        row.rateeDivisionName || row.divisionName || row.organizationalUnitName || 'Unassigned'
      ),
      byRaterType: groupCompletion_(assignments, row => row.raterType || 'Unspecified'),
      // These are configuration and workload signals. Return them only to the
      // assigned office administrator (or its delegated rater-tagging focal),
      // because ordinary personnel cannot act on them.
      attention: canReceiveOfficeAttention_(profile)
        ? buildAttention_(personnel.length, pendingPersonnel.length, assignments.length, completed.length)
        : [],
      insights: insights,
      generatedAt: new Date().toISOString()
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function requireOfficeMonitoring_(profile) {
    const allowed = AuthService.hasPermission(profile, 'view_bureau_monitoring') ||
      AuthService.hasPermission(profile, 'view_division_monitoring') ||
      AuthService.hasPermission(profile, 'view_cluster_monitoring') ||
      AuthService.hasPermission(profile, 'manage_office_users') ||
      AuthService.hasPermission(profile, 'manage_office_registry') ||
      String(profile.systemScope || '') === 'OFFICE_ADMIN' ||
      String(profile.officeRole || '') === 'OFFICE_ADMIN' ||
      String(profile.role || '') === 'Division Chief' ||
      String(profile.role || '') === 'Section Head'
    if (!allowed) throw HttpError('Access denied to office monitoring', 403)
  }

  function canReceiveOfficeAttention_(profile) {
    return String(profile.officeRole || '') === 'OFFICE_ADMIN' ||
      AuthService.hasPermission(profile, 'manage_office_users') ||
      AuthService.hasPermission(profile, 'manage_office_rater_matrix')
  }

  function monitoringScope_(profile) {
    const canSeeOffice = AuthService.hasPermission(profile, 'view_bureau_monitoring') ||
      AuthService.hasPermission(profile, 'view_cluster_monitoring') ||
      AuthService.hasPermission(profile, 'manage_office_users') ||
      AuthService.hasPermission(profile, 'manage_office_registry') ||
      String(profile.systemScope || '') === 'OFFICE_ADMIN' ||
      String(profile.officeRole || '') === 'OFFICE_ADMIN'
    if (canSeeOffice) return { level: 'office' }

    const divisionKeys = orgKeys_([
      profile.divisionId,
      profile.divisionName,
      profile.division
    ])
    if (AuthService.hasPermission(profile, 'view_division_monitoring') || String(profile.role || '') === 'Division Chief') {
      return { level: 'division', divisionKeys: divisionKeys }
    }

    if (String(profile.role || '') === 'Section Head') {
      return {
        level: 'section',
        divisionKeys: divisionKeys,
        sectionKeys: orgKeys_([profile.section, profile.sectionName])
      }
    }

    return {
      level: 'self',
      ids: orgKeys_([profile.id, profile.personnelId, profile.officePersonnelId]),
      emails: orgKeys_([profile.email])
    }
  }

  function applyMonitoringScope_(rows, scope) {
    return (rows || []).filter(row => matchesMonitoringScope_(row, scope))
  }

  function matchesMonitoringScope_(row, scope) {
    if (!scope || scope.level === 'office') return true
    if (scope.level === 'division') return intersects_(rowDivisionKeys_(row), scope.divisionKeys)
    if (scope.level === 'section') {
      return intersects_(rowDivisionKeys_(row), scope.divisionKeys) &&
        intersects_(rowSectionKeys_(row), scope.sectionKeys)
    }
    if (scope.level === 'self') {
      return intersects_(orgKeys_([row.id, row.rateeId, row.userId, row.email, row.rateeEmail]), scope.ids.concat(scope.emails))
    }
    return false
  }

  function rowDivisionKeys_(row) {
    return orgKeys_([
      row.rateeDivisionId,
      row.divisionId,
      row.division,
      row.rateeDivisionName,
      row.divisionName,
      row.organizationalUnitName
    ])
  }

  function rowSectionKeys_(row) {
    return orgKeys_([
      row.rateeSection,
      row.section,
      row.sectionName,
      sectionLabel_(row)
    ])
  }

  function orgKeys_(values) {
    const keys = []
    ;(values || []).forEach(value => {
      const raw = String(value || '').trim()
      if (!raw) return
      keys.push(raw)
      const fallback = DIVISION_NAME_FALLBACKS[raw.toLowerCase()]
      if (fallback) keys.push(fallback)
      Object.keys(DIVISION_NAME_FALLBACKS).forEach(id => {
        if (DIVISION_NAME_FALLBACKS[id].toLowerCase() === raw.toLowerCase()) keys.push(id)
      })
    })
    return Array.from(new Set(keys.map(normalizeOrgKey_).filter(Boolean)))
  }

  function normalizeOrgKey_(value) {
    return String(value || '').trim().toLowerCase()
  }

  function intersects_(left, right) {
    const rightSet = {}
    ;(right || []).forEach(key => { if (key) rightSet[key] = true })
    return (left || []).some(key => rightSet[key])
  }

  // Office spreadsheets use the IPAT-compatible tab names; the central STB
  // spreadsheet uses the original ones. Try the canonical name first, then the
  // office alias, so one code path serves both.
  function safeRows_(primaryName, fallbackName) {
    const names = [primaryName, fallbackName].filter(Boolean)
    for (let i = 0; i < names.length; i++) {
      try {
        return SpreadsheetService.getAllRows(SpreadsheetService.getSheet(names[i]))
      } catch (e) {
        // Try the next candidate name.
      }
    }
    Logger.log('[Portal] no readable sheet among: ' + names.join(', '))
    return []
  }

  function groupCompletion_(assignments, keyOf) {
    const groups = {}
    assignments.forEach(row => {
      const key = String(keyOf(row) || 'Unspecified')
      if (!groups[key]) groups[key] = { label: key, total: 0, completed: 0 }
      groups[key].total += 1
      if (String(row.status) === 'Completed') groups[key].completed += 1
    })
    return Object.keys(groups)
      .map(key => {
        const group = groups[key]
        return {
          label: group.label,
          total: group.total,
          completed: group.completed,
          outstanding: group.total - group.completed,
          completionRate: group.total ? Math.round((group.completed / group.total) * 100) : 0
        }
      })
      .sort((a, b) => b.total - a.total)
  }

  function buildOfficeInsights_(personnel, assignments, records, profile, personDirectory) {
    const scoredPersonnel = buildScoredPersonnel_(records, personDirectory)
    const pendingPersonnel = buildPendingPersonnel_(assignments, scoredPersonnel, personDirectory)
    const allPersonnelScores = buildAllPersonnelScores_(personnel, scoredPersonnel, pendingPersonnel)

    return {
      allPersonnelScores: allPersonnelScores,
      pendingPersonnel: pendingPersonnel,
      outstandingPersonnel: scoredPersonnel
        .filter(row => descriptorForScore_(row.score) === 'Outstanding')
        .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0) || a.name.localeCompare(b.name)),
      needsImprovementPersonnel: scoredPersonnel
        .filter(row => {
          const descriptor = descriptorForScore_(row.score)
          return descriptor === 'Needs Improvement' || descriptor === 'Requires Immediate Intervention'
        })
        .sort(scoreListSort_),
      lowestPersonnel: scoredPersonnel
        .slice()
        .sort(scoreListSort_)
        .slice(0, 10),
      top: {
        section: buildGroupInsights_(scoredPersonnel, assignments, row => sectionLabel_(row), profile),
        division: buildGroupInsights_(scoredPersonnel, assignments, row => divisionLabel_(row), profile),
        office: buildGroupInsights_(scoredPersonnel, assignments, row => officeLabel_(row, profile), profile)
      }
    }
  }

  function buildAllPersonnelScores_(personnel, scoredPersonnel, pendingPersonnel) {
    const rowsByPerson = {}
    ;(personnel || []).forEach(row => {
      const key = personKey_(row)
      if (!key || key === 'UNKNOWN') return
      rowsByPerson[key] = {
        id: key,
        name: personName_(row),
        division: divisionLabel_(row),
        section: sectionLabel_(row),
        role: row.role || row.position || row.positionLevel || '',
        score: null,
        descriptor: '',
        status: 'Not computed',
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0
      }
    })

    ;(pendingPersonnel || []).forEach(row => {
      const key = String(row.id || '').trim()
      if (!key) return
      rowsByPerson[key] = {
        ...(rowsByPerson[key] || {}),
        ...row,
        status: row.pendingTasks > 0 ? 'Pending tasks' : (row.status || 'Not computed')
      }
    })

    ;(scoredPersonnel || []).forEach(row => {
      const key = String(row.id || '').trim()
      if (!key) return
      rowsByPerson[key] = {
        ...(rowsByPerson[key] || {}),
        ...row,
        status: row.status || 'Computed'
      }
    })

    return Object.keys(rowsByPerson)
      .map(key => rowsByPerson[key])
      .sort(scoreListSort_)
  }

  function buildPersonDirectory_(personnel) {
    const directory = {}
    ;(personnel || []).forEach(row => {
      const org = {
        division: divisionLabel_(row),
        section: sectionLabel_(row),
        role: row.role || row.position || row.positionLevel || ''
      }
      personIdentityKeys_(row).forEach(key => {
        directory[key] = org
      })
    })
    return directory
  }

  function personOrg_(row, personDirectory) {
    const directory = personDirectory || {}
    const keys = personIdentityKeys_(row)
    for (let i = 0; i < keys.length; i += 1) {
      const found = directory[keys[i]]
      if (found) return found
    }
    return {
      division: divisionLabel_(row),
      section: sectionLabel_(row),
      role: row.role || row.rateeRole || row.rateePosition || row.position || row.positionLevel || ''
    }
  }

  function personIdentityKeys_(row) {
    return orgKeys_([
      row.id,
      row.userId,
      row.personnelId,
      row.officePersonnelId,
      row.rateeId,
      row.email,
      row.rateeEmail,
      row.fullName,
      row.name,
      row.rateeName,
      row.employeeNo,
      row.employeeNumber
    ])
  }

  function enrichMonitoringRows_(rows, personDirectory) {
    return (rows || []).map(row => {
      const org = personOrg_(row, personDirectory)
      return {
        ...row,
        divisionName: org.division,
        rateeDivisionName: org.division,
        section: org.section,
        rateeSection: org.section,
        position: org.role || row.position || row.rateePosition || row.positionLevel || '',
        rateeRole: org.role || row.rateeRole || row.rateePosition || row.position || row.positionLevel || ''
      }
    })
  }

  function buildPendingPersonnel_(assignments, scoredPersonnel, personDirectory) {
    const scoredByPerson = {}
    ;(scoredPersonnel || []).forEach(row => {
      scoredByPerson[String(row.id || '').trim()] = row
    })
    const groups = {}
    assignments.forEach(row => {
      const key = personKey_(row)
      const scored = scoredByPerson[key] || null
      const org = personOrg_(row, personDirectory)
      if (!groups[key]) {
        groups[key] = {
          id: key,
          name: personName_(row),
          division: org.division,
          section: org.section,
          role: org.role || row.rateeRole || row.rateePosition || row.position || '',
          score: scored ? scored.score : null,
          descriptor: scored ? scored.descriptor : '',
          scoreStatus: scored ? scored.status : '',
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          status: 'Pending'
        }
      }
      groups[key].totalTasks += 1
      if (String(row.status) === 'Completed') {
        groups[key].completedTasks += 1
      } else {
        groups[key].pendingTasks += 1
      }
    })

    return Object.keys(groups)
      .map(key => {
        const row = groups[key]
        row.completionRate = row.totalTasks ? Math.round((row.completedTasks / row.totalTasks) * 100) : 0
        return row
      })
      .filter(row => row.pendingTasks > 0)
      .sort((a, b) => b.pendingTasks - a.pendingTasks || a.completionRate - b.completionRate || a.name.localeCompare(b.name))
  }

  function buildScoredPersonnel_(records, personDirectory) {
    const latest = {}
    records.forEach(row => {
      const score = numericScore_(row.overallScore)
      const descriptor = descriptorForScore_(score) || descriptorLabel_(row)
      if (!descriptor && score === null) return
      const key = personKey_(row)
      const current = latest[key]
      const updatedAt = String(row.updatedAt || row.createdAt || '')
      if (!current || updatedAt > String(current.updatedAt || '')) {
        const org = personOrg_(row, personDirectory)
        latest[key] = {
          id: key,
          recordId: row.id || '',
          name: personName_(row),
          division: org.division,
          section: org.section,
          role: org.role || row.rateeRole || row.position || row.positionLevel || '',
          score: score,
          descriptor: descriptor,
          status: row.status || '',
          updatedAt: updatedAt
        }
      }
    })
    return Object.keys(latest).map(key => latest[key])
  }

  function buildGroupInsights_(scoredPersonnel, assignments, keyOf, profile) {
    const groups = {}
    const ensure = (label) => {
      const key = String(label || 'Unassigned').trim() || 'Unassigned'
      if (!groups[key]) {
        groups[key] = {
          id: key,
          label: key,
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          scoredCount: 0,
          scoreTotal: 0,
          outstandingCount: 0,
          needsImprovementCount: 0
        }
      }
      return groups[key]
    }

    ;(assignments || []).forEach(row => {
      const group = ensure(keyOf(row) || officeLabel_(row, profile))
      group.totalTasks += 1
      if (String(row.status) === 'Completed') {
        group.completedTasks += 1
      } else {
        group.pendingTasks += 1
      }
    })

    ;(scoredPersonnel || []).forEach(row => {
      const score = numericScore_(row.score)
      const descriptor = descriptorForScore_(score) || descriptorLabel_(row)
      const group = ensure(keyOf(row) || officeLabel_(row, profile))
      if (score !== null) {
        group.scoredCount += 1
        group.scoreTotal += score
      }
      if (descriptor === 'Outstanding') group.outstandingCount += 1
      if (descriptor === 'Needs Improvement' || descriptor === 'Requires Immediate Intervention') group.needsImprovementCount += 1
    })

    const rows = Object.keys(groups).map(key => {
      const group = groups[key]
      const averageScore = group.scoredCount ? Math.round((group.scoreTotal / group.scoredCount) * 100) / 100 : null
      return {
        id: group.id,
        label: group.label,
        totalTasks: group.totalTasks,
        completedTasks: group.completedTasks,
        pendingTasks: group.pendingTasks,
        completionRate: group.totalTasks ? Math.round((group.completedTasks / group.totalTasks) * 100) : 0,
        scoredCount: group.scoredCount,
        averageScore: averageScore,
        outstandingCount: group.outstandingCount,
        needsImprovementCount: group.needsImprovementCount
      }
    })

    return {
      outstanding: rows
        .filter(row => row.outstandingCount > 0)
        .sort((a, b) => b.outstandingCount - a.outstandingCount || (Number(b.averageScore) || 0) - (Number(a.averageScore) || 0))
        .slice(0, 3),
      needsImprovement: rows
        .filter(row => row.needsImprovementCount > 0)
        .sort((a, b) => b.needsImprovementCount - a.needsImprovementCount || (Number(a.averageScore) || 0) - (Number(b.averageScore) || 0))
        .slice(0, 3),
      pending: rows
        .filter(row => row.pendingTasks > 0)
        .sort((a, b) => b.pendingTasks - a.pendingTasks || a.completionRate - b.completionRate)
        .slice(0, 3),
      all: rows.sort((a, b) => a.label.localeCompare(b.label))
    }
  }

  function personKey_(row) {
    return String(row.rateeId || row.id || row.email || row.rateeName || row.fullName || 'UNKNOWN').trim()
  }

  function personName_(row) {
    return String(row.rateeName || row.fullName || row.name || row.email || 'Unspecified personnel').trim()
  }

  function divisionLabel_(row) {
    const raw = String(row.rateeDivisionName || row.divisionName || row.organizationalUnitName || row.division || row.rateeDivisionId || 'Unassigned').trim()
    return canonicalDivisionName_(raw)
  }

  function sectionLabel_(row) {
    const raw = String(row.rateeSection || row.section || row.sectionName || 'Unassigned').trim()
    return canonicalSectionName_(raw)
  }

  function canonicalDivisionName_(value) {
    const raw = String(value || '').trim()
    if (!raw) return 'Unassigned'
    return DIVISION_NAME_FALLBACKS[raw.toLowerCase()] || raw
  }

  function canonicalSectionName_(value) {
    const raw = String(value || '').trim()
    if (!raw) return 'Unassigned'
    const normalized = raw.toLowerCase()
      .replace(/\band\b/g, 'and')
      .replace(/&/g, 'and')
      .replace(/\s+/g, ' ')
      .trim()
    return SECTION_NAME_FALLBACKS[normalized] || raw
  }

  function officeLabel_(row, profile) {
    return String(row.officeName || row.officeShortName || (profile && (profile.officeName || profile.officeShortName)) || 'Office').trim() || 'Office'
  }

  function numericScore_(value) {
    const score = Number(value)
    return Number.isFinite(score) && score > 0 ? score : null
  }

  function scoreListSort_(a, b) {
    const left = numericScore_(a && a.score)
    const right = numericScore_(b && b.score)
    if (left !== null && right !== null) return right - left || String(a.name || '').localeCompare(String(b.name || ''))
    if (left !== null) return -1
    if (right !== null) return 1
    return String(a && a.name || '').localeCompare(String(b && b.name || ''))
  }

  function descriptorLabel_(row) {
    const value = String(row && row.descriptor || '').trim()
    if (!value) return ''
    const normalized = value.toLowerCase()
    if (normalized === 'outstanding' || normalized === 'excellent alignment') return 'Outstanding'
    if (normalized === 'very satisfactory') return 'Very Satisfactory'
    if (normalized === 'satisfactory') return 'Satisfactory'
    if (normalized === 'needs improvement') return 'Needs Improvement'
    if (normalized === 'requires immediate intervention') return 'Requires Immediate Intervention'
    return value
  }

  // Fallback used only when a record carries a score but no stored descriptor
  // (legacy, migrated, or manually encoded rows). It MUST agree with the
  // protocol's bands, because it feeds the office dashboard's Top Outstanding /
  // Top Needs Improvement lists and the per-unit outstanding counts.
  //
  // This previously used 3.51/3.01/2.51 with only four bands, which overstated
  // every result - 3.60 read as Outstanding when the protocol calls it Very
  // Satisfactory - and omitted 'Requires Immediate Intervention' entirely, so
  // the band that most needs surfacing could never appear. Delegating to
  // IPATService keeps one implementation of the bands.
  function descriptorForScore_(score) {
    const value = Number(score)
    if (!Number.isFinite(value) || value <= 0) return ''
    return IPATService.qualitativeDescriptor(value)
  }

  // Neutral operational signals only. These describe the state of the office's
  // configuration and progress, never a judgement about any employee.
  function buildAttention_(personnelCount, pendingCount, taskCount, completedCount) {
    const items = []
    if (!personnelCount) {
      items.push({ level: 'FOR_ATTENTION', label: 'No personnel on the roster', detail: 'Add or approve personnel before generating assignments.' })
    }
    if (pendingCount > 0) {
      items.push({ level: 'PENDING_VALIDATION', label: pendingCount + ' awaiting validation', detail: 'Review pending personnel so they can be assigned.' })
    }
    if (personnelCount && !taskCount) {
      items.push({ level: 'FOR_CONFIGURATION', label: 'No rating tasks for this period', detail: 'Generate assignments to start the assessment period.' })
    }
    if (taskCount && completedCount === 0) {
      items.push({ level: 'FOR_ATTENTION', label: 'No ratings submitted yet', detail: 'Raters have assignments but none have been submitted.' })
    }
    return items
  }

  // Both services paginate, and an office spreadsheet may legitimately have an
  // empty reference tab. Neither case should surface as an error to personnel.
  function safeList_(work) {
    try {
      const result = work()
      if (Array.isArray(result)) return result
      return (result && result.items) || []
    } catch (e) {
      Logger.log('[Portal] reference list unavailable: ' + e.message)
      return []
    }
  }

  // Returns a lookup of record ids this rater has already saved responses for.
  // Two sheet reads, reduced immediately; no rating values leave this function.
  function ratedRecordIds_(raterIds) {
    const idSet = {}
    ;(Array.isArray(raterIds) ? raterIds : [raterIds]).forEach(id => {
      const key = String(id || '').trim()
      if (key) idSet[key] = true
    })
    const seen = {}
    const collect = (sheetName) => {
      try {
        const sheet = SpreadsheetService.getSheet(sheetName)
        SpreadsheetService.getAllRows(sheet).forEach(row => {
          if (idSet[String(row.raterId || '').trim()] && row.ipatId) seen[String(row.ipatId)] = true
        })
      } catch (e) {
        // A missing rating tab means nothing has been saved yet in this office.
        Logger.log('[Portal] rating sheet unavailable: ' + sheetName + ' - ' + e.message)
      }
    }
    collect(SHEET.IPAT_CBC_RATINGS)
    collect(SHEET.IPAT_JF_RATINGS)
    return seen
  }

  function resolvePeriod_(params, assignments) {
    const hasExplicitPeriod = Boolean(params && (params.semester || params.year))
    const now = new Date()
    const year = Number(params && params.year) || now.getFullYear()
    const semester = Number(params && params.semester) || (now.getMonth() < 6 ? 1 : 2)
    if (hasExplicitPeriod) return { semester: semester, year: year, selection: 'requested' }

    const periods = {}
    ;(assignments || []).forEach(row => {
      const rowSemester = Number(row.semester)
      const rowYear = Number(row.year)
      if ((rowSemester !== 1 && rowSemester !== 2) || !rowYear) return
      const key = rowYear + ':' + rowSemester
      if (!periods[key]) {
        periods[key] = { semester: rowSemester, year: rowYear, hasOutstanding: false }
      }
      if (String(row.status || '').toLowerCase() !== 'completed') {
        periods[key].hasOutstanding = true
      }
    })

    const candidates = Object.keys(periods).map(key => periods[key])
    const outstanding = candidates
      .filter(period => period.hasOutstanding)
      .sort((a, b) => a.year - b.year || a.semester - b.semester)
    if (outstanding.length) return { ...outstanding[0], selection: 'pending' }

    // No action is required, so keep the completion card meaningful by showing
    // the most recent period in which the employee actually had a task.
    const latest = candidates.sort((a, b) => b.year - a.year || b.semester - a.semester)[0]
    if (latest) return { ...latest, selection: 'latest' }
    return { semester: semester, year: year, selection: 'current' }
  }

  function matchesPeriod_(row, period) {
    if (!period) return true
    return String(row.semester) === String(period.semester) &&
      String(row.year) === String(period.year)
  }

  return { summary, myTasks, myResults, library, officeSummary }
})()
