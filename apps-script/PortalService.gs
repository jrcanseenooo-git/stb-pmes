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
    const period = resolvePeriod_(params)
    const identity = profileRosterIdentity_(profile)

    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    const myAssignments = SpreadsheetService.getAllRows(assignSheet).filter(row =>
      isProfileRater_(row, identity) &&
      matchesPeriod_(row, period)
    )

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
      descriptor: row.descriptor,
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
   * structurally absent — it lives in STB-only sheets that the evaluation-only
   * office spreadsheets do not contain — so there is nothing to filter out here.
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
   * Aggregated entirely on the server: the response carries counts and
   * percentages, never personnel rows or rating values. Office routing is
   * already applied, so an office administrator can only ever summarize their
   * own office; a central administrator may target one office explicitly and
   * that targeting is validated by OfficeScopeService, not here.
   */
  function officeSummary(params, user) {
    const profile = AuthService.getProfile(user)
    requireOfficeMonitoring_(profile)

    const period = resolvePeriod_(params)

    const personnel = safeRows_(SHEET.USERS, 'Personnel')
    const assignments = safeRows_(SHEET.IPAT_ASSIGNMENTS, 'RaterAssignments')
      .filter(row => matchesPeriod_(row, period))
    const records = safeRows_(SHEET.IPAT_RECORDS, 'AssessmentRecords')
      .filter(row => matchesPeriod_(row, period))

    const isTrue = (value) => value === true || String(value).toLowerCase() === 'true'
    const activePersonnel = personnel.filter(row => isTrue(row.active))
    const pendingPersonnel = personnel.filter(row => isTrue(row.pendingActivation))

    const completed = assignments.filter(row => String(row.status) === 'Completed')
    const outstanding = assignments.filter(row => String(row.status) !== 'Completed')

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
      byUnit: groupCompletion_(assignments, row =>
        row.rateeDivisionName || row.divisionName || row.organizationalUnitName || 'Unassigned'
      ),
      byRaterType: groupCompletion_(assignments, row => row.raterType || 'Unspecified'),
      attention: buildAttention_(personnel.length, pendingPersonnel.length, assignments.length, completed.length),
      generatedAt: new Date().toISOString()
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function requireOfficeMonitoring_(profile) {
    const allowed = AuthService.hasPermission(profile, 'view_bureau_monitoring') ||
      AuthService.hasPermission(profile, 'view_division_monitoring') ||
      AuthService.hasPermission(profile, 'view_cluster_monitoring') ||
      AuthService.hasPermission(profile, 'manage_office_users') ||
      String(profile.systemScope || '') === 'OFFICE_ADMIN' ||
      String(profile.officeRole || '') === 'OFFICE_ADMIN'
    if (!allowed) throw HttpError('Access denied to office monitoring', 403)
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
    if (!items.length) {
      items.push({ level: 'ON_TRACK', label: 'No items need attention', detail: 'Personnel and rating tasks are progressing normally.' })
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
        Logger.log('[Portal] rating sheet unavailable: ' + sheetName + ' — ' + e.message)
      }
    }
    collect(SHEET.IPAT_CBC_RATINGS)
    collect(SHEET.IPAT_JF_RATINGS)
    return seen
  }

  function resolvePeriod_(params) {
    const now = new Date()
    const year = Number(params && params.year) || now.getFullYear()
    const semester = Number(params && params.semester) || (now.getMonth() < 6 ? 1 : 2)
    return { semester: semester, year: year }
  }

  function matchesPeriod_(row, period) {
    if (!period) return true
    return String(row.semester) === String(period.semester) &&
      String(row.year) === String(period.year)
  }

  return { summary, myTasks, myResults, library, officeSummary }
})()
