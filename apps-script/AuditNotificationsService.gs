// ═══════════════════════════════════════════════════════════════
// AUDIT SERVICE
// ═══════════════════════════════════════════════════════════════

const AuditService = (() => {

  function log(action, module_, details, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.AUDIT)
    SpreadsheetService.appendRow(sheet, {
      id:          SpreadsheetService.generateId('AUD-'),
      timestamp:   new Date().toISOString(),
      userId:      profile.id,
      userEmail:   user.email,
      userName:    profile.fullName,
      role:        profile.role,
      action:      action,
      module:      module_,
      details:     details || '',
      ipAddress:   ''   // GAS cannot read client IP
    })
    return { logged: true }
  }

  function list(params, user) {
    const profile = AuthService.getProfile(user)
    const isAdmin = isSystemAdmin_(profile)

    // FIX: Staff can read their OWN records (needed for Profile → Recent Activity).
    // Admins can read everything (with optional filters).
    if (!isAdmin && params.userId && params.userId !== profile.id) {
      throw HttpError('Insufficient permissions to view other users\' audit logs', 403)
    }

    const sheet = SpreadsheetService.getSheet(SHEET.AUDIT)
    let rows    = SpreadsheetService.getAllRows(sheet)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    // Non-admins are always scoped to their own records
    if (!isAdmin) {
      rows = rows.filter(r => r.userId === profile.id)
    }

    // Filters (admins only for cross-user queries)
    if (params.userId) rows = rows.filter(r => r.userId === params.userId)
    if (params.module) rows = rows.filter(r => r.module === params.module)
    if (params.action) rows = rows.filter(r => r.action === params.action)
    if (params.from)   rows = rows.filter(r => r.timestamp >= params.from)
    if (params.to)     rows = rows.filter(r => r.timestamp <= params.to)

    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  function export_(params, user) {
    const profile = AuthService.getProfile(user)
    if (!isSystemAdmin_(profile)) throw HttpError('STB System Administrator access required.', 403)
    const { items } = list({ ...params, pageSize: 9999 }, user)
    const headers = ['timestamp','userEmail','userName','role','action','module','details']
    const lines   = [headers.join(',')]
    const csvCell = value => {
      const text = value instanceof Date
        ? value.toISOString()
        : String(value === undefined || value === null ? '' : value)
      return `"${text.replace(/"/g, '""')}"`
    }
    items.forEach(r => {
      lines.push(headers.map(h => csvCell(r[h])).join(','))
    })
    return { csv: lines.join('\n') }
  }

  function isSystemAdmin_(profile) {
    if (String(profile && profile.role || '') !== 'System Administrator') return false
    if (String(profile && profile.systemScope || 'STB_FULL') !== 'STB_FULL') return false
    const officeKey = String(
      (profile && (profile.officeId || profile.officeCode || profile.officeName)) ||
      'STB'
    ).trim().toUpperCase()
    return !officeKey || officeKey === 'STB' || officeKey === 'SOCIAL TECHNOLOGY BUREAU'
  }

  return { log, list, export_ }
})()


// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS SERVICE
// ═══════════════════════════════════════════════════════════════

const NotificationsService = (() => {

  function list(user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.NOTIFICATIONS)
    return SpreadsheetService.getAllRows(sheet)
      .filter(r => r.recipientId === profile.id || r.recipientId === 'all')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 30)
  }

  function markRead(id, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.NOTIFICATIONS)
    return SpreadsheetService.updateRow(sheet, id, { read: true, readAt: new Date().toISOString() })
  }

  function markAllRead(user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.NOTIFICATIONS)
    const rows    = SpreadsheetService.getAllRows(sheet)
      .filter(r => r.recipientId === profile.id && !r.read)
    rows.forEach(r => SpreadsheetService.updateRow(sheet, r.id, { read: true }))
    return { updated: rows.length }
  }

  /** Called internally when accomplishment status changes */
  function createForStatusChange(accomplishment, newStatus, actorProfile) {
    const sheet = SpreadsheetService.getSheet(SHEET.NOTIFICATIONS)
    const messages = {
      'Approved':     `Your IPCR entry "${accomplishment.target}" has been approved.`,
      'For Revision': `Revision requested for "${accomplishment.target}". Please check remarks.`,
      'Delayed':      `Target "${accomplishment.target}" is now marked as Delayed.`
    }
    const message = messages[newStatus]
    if (!message) return

    SpreadsheetService.appendRow(sheet, {
      id:          SpreadsheetService.generateId('NOT-'),
      recipientId: accomplishment.userId,
      type:        newStatus === 'Approved' ? 'approval' : newStatus === 'For Revision' ? 'revision' : 'alert',
      message,
      relatedId:   accomplishment.id,
      module:      'Accomplishments',
      read:        false,
      createdAt:   new Date().toISOString()
    })
  }

  /** Scheduled: create deadline reminder notifications */
  function createDeadlineReminders() {
    const accSheet   = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    const notifSheet = SpreadsheetService.getSheet(SHEET.NOTIFICATIONS)
    const rows       = SpreadsheetService.getAllRows(accSheet)
      .filter(r => !r.deleted && !['Completed', 'Approved'].includes(r.status))
    const now        = new Date()
    const twoDaysOut = new Date(now.getTime() + 2 * 86400000)

    rows.forEach(r => {
      if (!r.deadline) return
      const dl = new Date(r.deadline)
      if (dl > now && dl <= twoDaysOut) {
        SpreadsheetService.appendRow(notifSheet, {
          id:          SpreadsheetService.generateId('NOT-'),
          recipientId: r.userId,
          type:        'deadline',
          message:     `Deadline in 2 days: "${r.target}" (${r.deadline})`,
          relatedId:   r.id,
          module:      'Accomplishments',
          read:        false,
          createdAt:   now.toISOString()
        })
      }
    })
  }

  /**
   * Refers a Job Fitness record to the skip supervisor.
   *
   * The protocol treats a significant gap between the ratee's self-assessment
   * and the immediate supervisor's as "a concern requiring further review,
   * clarification, or appropriate action by the skip supervisor". Detecting the
   * gap is not enough on its own - without this the flag was only ever visible
   * to whoever happened to open the record, which is not the skip supervisor.
   */
  function createForJfVariance(record, skipSupervisorId, gap) {
    if (!skipSupervisorId) return false
    const sheet = SpreadsheetService.getSheet(SHEET.NOTIFICATIONS)
    SpreadsheetService.appendRow(sheet, {
      id:          SpreadsheetService.generateId('NOT-'),
      recipientId: skipSupervisorId,
      type:        'alert',
      message:     `Job Fitness review needed for ${record.rateeName || 'a staff member'}: ` +
                   `the self-rating and supervisor rating differ by ${gap} points.`,
      relatedId:   record.id,
      module:      'IPAT',
      read:        false,
      createdAt:   new Date().toISOString()
    })
    return true
  }

  return { list, markRead, markAllRead, createForStatusChange, createDeadlineReminders, createForJfVariance }
})()
