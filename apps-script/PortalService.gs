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

  function summary(params, user) {
    const profile = AuthService.getProfile(user)
    const period = resolvePeriod_(params)

    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    const myAssignments = SpreadsheetService.getAllRows(assignSheet).filter(row =>
      String(row.raterId) === String(profile.id) &&
      matchesPeriod_(row, period)
    )

    const completed = myAssignments.filter(row => String(row.status) === 'Completed')
    const outstanding = myAssignments.filter(row => String(row.status) !== 'Completed')

    // A task counts as a draft when this rater has already saved at least one
    // response against the linked record but has not submitted. Both rating
    // sheets are read once and reduced to a set of record ids.
    const startedRecordIds = ratedRecordIds_(profile.id)
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

    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    const rows = SpreadsheetService.getAllRows(assignSheet).filter(row =>
      String(row.raterId) === String(profile.id) &&
      matchesPeriod_(row, period)
    )

    const startedRecordIds = ratedRecordIds_(profile.id)

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

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Returns a lookup of record ids this rater has already saved responses for.
  // Two sheet reads, reduced immediately; no rating values leave this function.
  function ratedRecordIds_(raterId) {
    const seen = {}
    const collect = (sheetName) => {
      try {
        const sheet = SpreadsheetService.getSheet(sheetName)
        SpreadsheetService.getAllRows(sheet).forEach(row => {
          if (String(row.raterId) === String(raterId) && row.ipatId) seen[String(row.ipatId)] = true
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

  return { summary, myTasks }
})()
