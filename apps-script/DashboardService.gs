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
    if (params.semester) accs = accs.filter(r => r.semester === params.semester)
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
    AuthService.requireRole(user, 'System Administrator', 'Bureau Director', 'Assistant Bureau Director', 'Division Chief')

    const divSheet = SpreadsheetService.getSheet(SHEET.DIVISIONS)
    const accSheet = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    const divs     = SpreadsheetService.getAllRows(divSheet)
    const accs     = SpreadsheetService.getAllRows(accSheet).filter(r => !r.deleted)

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

    if (params.semester) accs = accs.filter(r => r.semester === params.semester)

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
    if (['System Administrator','Bureau Director'].includes(profile.role)) return rows
    if (profile.role === 'Assistant Bureau Director') return rows.filter(r => r.divisionId === 'admin-pool')
    if (profile.role === 'Division Chief') return rows.filter(r => r.divisionId === profile.divisionId)
    return rows.filter(r => r.userId === profile.id)
  }

  function applyUserScope(users, profile) {
    if (['System Administrator','Bureau Director'].includes(profile.role)) return users
    if (profile.role === 'Assistant Bureau Director') return users.filter(u => u.divisionId === 'admin-pool')
    if (profile.role === 'Division Chief') return users.filter(u => u.divisionId === profile.divisionId)
    return users.filter(u => u.id === profile.id)
  }

  return { summary, divisions, statusBreakdown, monthlyActivity }
})()
