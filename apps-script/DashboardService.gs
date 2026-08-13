/**
 * DashboardService.gs
 * Aggregates data from multiple sheets for dashboard analytics.
 * Results are intentionally scoped by user role.
 */

const DashboardService = (() => {

  function summary(params, user) {
    const profile  = AuthService.getProfile(user)
    const accSheet = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    const usrSheet = SpreadsheetService.getSheet(SHEET.USERS)

    let accs  = SpreadsheetService.getAllRows(accSheet).filter(r => !r.deleted)
    let users = SpreadsheetService.getAllRows(usrSheet).filter(r => r.active)

    accs  = applyScope(accs,  profile)
    users = applyUserScope(users, profile)

    // Filter by period if given
    if (params.semester) accs = accs.filter(r => String(r.semester) === String(params.semester))
    if (params.year)     accs = accs.filter(r => r.year == params.year)

    const completed = accs.filter(r => ['Completed','Approved'].includes(r.status)).length
    const delayed   = accs.filter(r => r.status === 'Delayed').length
    const pending   = accs.filter(r => r.status === 'Submitted').length
    const total     = accs.length

    return {
      totalPersonnel:   users.length,
      totalTargets:     total,
      completionRate:   total ? Math.round((completed / total) * 100) : 0,
      delayed,
      pending,
      completed
    }
  }

  function divisions(params, user) {
    const profile  = AuthService.getProfile(user)
    if (!AuthService.hasPermission(profile, 'view_bureau_monitoring') &&
        !AuthService.hasPermission(profile, 'view_division_monitoring')) {
      throw HttpError('Access denied to dashboard monitoring', 403)
    }

    const divSheet = SpreadsheetService.getSheet(SHEET.DIVISIONS)
    const accSheet = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    let divs       = SpreadsheetService.getAllRows(divSheet)
    let accs       = SpreadsheetService.getAllRows(accSheet).filter(r => !r.deleted)
    if (!AuthService.hasPermission(profile, 'view_bureau_monitoring')) {
      divs = divs.filter(d => d.id === profile.divisionId)
      accs = accs.filter(r => r.divisionId === profile.divisionId)
    }

    return divs.map(div => {
      const divAccs = accs.filter(r => r.divisionId === div.id)
      const completed = divAccs.filter(r => ['Completed','Approved'].includes(r.status)).length
      const total     = divAccs.length
      return {
        id:             div.id,
        name:           div.name,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
        total,
        completed,
        delayed:        divAccs.filter(r => r.status === 'Delayed').length,
        color:          div.color || 'blue'
      }
    })
  }

  function statusBreakdown(params, user) {
    const profile  = AuthService.getProfile(user)
    const accSheet = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    let accs       = SpreadsheetService.getAllRows(accSheet).filter(r => !r.deleted)
    accs           = applyScope(accs, profile)

    if (params.semester) accs = accs.filter(r => String(r.semester) === String(params.semester))
    if (params.year)     accs = accs.filter(r => r.year == params.year)

    const STATUS_LIST = ['Not Started','Ongoing','Submitted','For Revision','Approved','Delayed','Completed']
    return STATUS_LIST.map(s => ({
      status: s,
      count:  accs.filter(r => r.status === s).length
    })).filter(s => s.count > 0)
  }

  function monthlyActivity(params, user) {
    const profile  = AuthService.getProfile(user)
    const accSheet = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    const type     = params.type || 'IPCR'
    let accs       = SpreadsheetService.getAllRows(accSheet)
      .filter(r => !r.deleted && r.type === type && r.submittedAt)
    accs = applyScope(accs, profile)

    const year = params.year || new Date().getFullYear()
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

    return MONTHS.map((label, idx) => {
      const count = accs.filter(r => {
        const d = new Date(r.submittedAt)
        return d.getFullYear() == year && d.getMonth() === idx
      }).length
      return { label, count }
    })
  }

  // The frontend used to call summary/divisions/status/activity as four
  // separate requests. Each one is its own Apps Script execution, and each
  // independently re-read the full Accomplishments (and Users/Divisions)
  // sheet from scratch — the per-execution memo in DataCacheService only
  // helps repeated reads *within* one execution, not across four separate
  // ones. Four full-table reads per dashboard load, and once the frontend
  // started firing them concurrently instead of one-after-another, four
  // executions competing for Apps Script's limited concurrency at once —
  // a direct contributor to requests timing out under Vercel's Hobby-plan
  // function limit. This reads each sheet exactly once and computes all
  // four results from that single pass.
  function all(params, user) {
    const profile  = AuthService.getProfile(user)
    const accSheet = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    const usrSheet = SpreadsheetService.getSheet(SHEET.USERS)

    const allAccs  = SpreadsheetService.getAllRows(accSheet).filter(r => !r.deleted)
    const allUsers = SpreadsheetService.getAllRows(usrSheet).filter(r => r.active)
    const scopedAccs  = applyScope(allAccs, profile)
    const scopedUsers = applyUserScope(allUsers, profile)

    // summary
    let periodAccs = scopedAccs
    if (params.semester) periodAccs = periodAccs.filter(r => String(r.semester) === String(params.semester))
    if (params.year)     periodAccs = periodAccs.filter(r => r.year == params.year)
    const completed = periodAccs.filter(r => ['Completed','Approved'].includes(r.status)).length
    const delayed   = periodAccs.filter(r => r.status === 'Delayed').length
    const pending   = periodAccs.filter(r => r.status === 'Submitted').length
    const total     = periodAccs.length
    const summaryResult = {
      totalPersonnel: scopedUsers.length,
      totalTargets:   total,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
      delayed, pending, completed
    }

    // statusBreakdown
    const STATUS_LIST = ['Not Started','Ongoing','Submitted','For Revision','Approved','Delayed','Completed']
    const statusResult = STATUS_LIST.map(s => ({
      status: s,
      count:  periodAccs.filter(r => r.status === s).length
    })).filter(s => s.count > 0)

    // monthlyActivity
    const type = params.type || 'IPCR'
    const typeAccs = applyScope(allAccs.filter(r => r.type === type && r.submittedAt), profile)
    const activityYear = params.year || new Date().getFullYear()
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const monthlyResult = MONTHS.map((label, idx) => ({
      label,
      count: typeAccs.filter(r => {
        const d = new Date(r.submittedAt)
        return d.getFullYear() == activityYear && d.getMonth() === idx
      }).length
    }))

    // divisions — permission-gated like the standalone endpoint, but
    // returns an empty array here instead of throwing 403, since a combined
    // endpoint can't fail the whole dashboard load over one section a given
    // user isn't permitted to see.
    let divisionsResult = []
    const canSeeDivisions = AuthService.hasPermission(profile, 'view_bureau_monitoring') ||
      AuthService.hasPermission(profile, 'view_division_monitoring')
    if (canSeeDivisions) {
      const divSheet = SpreadsheetService.getSheet(SHEET.DIVISIONS)
      let divs = SpreadsheetService.getAllRows(divSheet)
      let dAccs = allAccs
      if (!AuthService.hasPermission(profile, 'view_bureau_monitoring')) {
        divs  = divs.filter(d => d.id === profile.divisionId)
        dAccs = dAccs.filter(r => r.divisionId === profile.divisionId)
      }
      divisionsResult = divs.map(div => {
        const divAccs = dAccs.filter(r => r.divisionId === div.id)
        const divCompleted = divAccs.filter(r => ['Completed','Approved'].includes(r.status)).length
        const divTotal = divAccs.length
        return {
          id:             div.id,
          name:           div.name,
          completionRate: divTotal ? Math.round((divCompleted / divTotal) * 100) : 0,
          total:          divTotal,
          completed:      divCompleted,
          delayed:        divAccs.filter(r => r.status === 'Delayed').length,
          color:          div.color || 'blue'
        }
      })
    }

    return { summary: summaryResult, divisions: divisionsResult, statusBreakdown: statusResult, monthlyActivity: monthlyResult }
  }

  // ── Scope helpers ──
  function applyScope(rows, profile) {
    if (AuthService.hasPermission(profile, 'view_bureau_monitoring')) return rows
    if (AuthService.hasPermission(profile, 'view_division_monitoring')) return rows.filter(r => r.divisionId === profile.divisionId)
    return rows.filter(r => r.userId === profile.id)
  }

  function applyUserScope(users, profile) {
    if (AuthService.hasPermission(profile, 'view_bureau_monitoring')) return users
    if (AuthService.hasPermission(profile, 'view_division_monitoring')) return users.filter(u => u.divisionId === profile.divisionId)
    return users.filter(u => u.id === profile.id)
  }

  return { summary, divisions, statusBreakdown, monthlyActivity, all }
})()
