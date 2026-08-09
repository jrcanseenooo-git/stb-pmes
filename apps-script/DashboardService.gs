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

  return { summary, divisions, statusBreakdown, monthlyActivity }
})()
