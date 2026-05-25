/**
 * AccomplishmentsService.gs
 * Handles all IPCR / CCEF accomplishment CRUD, status workflow,
 * approval, revision requests, and history tracking.
 */

const AccomplishmentsService = (() => {

  const ALLOWED_TRANSITIONS = {
    'Not Started':  ['Ongoing'],
    'Ongoing':      ['Submitted', 'Delayed'],
    'Submitted':    ['Approved', 'For Revision'],
    'For Revision': ['Submitted', 'Ongoing'],
    'Approved':     ['Completed'],
    'Delayed':      ['Ongoing', 'Submitted'],
    'Completed':    []
  }

  // ── LIST (with filters + pagination) ──
  function list(params, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    let rows      = SpreadsheetService.getAllRows(sheet).filter(r => !r.deleted)

    // Scope by role
    rows = applyRoleScope(rows, profile)

    // Apply query filters
    const filters = {
      status:     params.status     || '',
      divisionId: params.divisionId || '',
      kraId:      params.kraId      || ''
    }
    rows = SpreadsheetService.filterRows(rows, filters)

    // Text search
    if (params.search) {
      const q = params.search.toLowerCase()
      rows = rows.filter(r =>
        r.employeeName?.toLowerCase().includes(q) ||
        r.target?.toLowerCase().includes(q) ||
        r.kraTitle?.toLowerCase().includes(q)
      )
    }

    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  // ── GET single ──
  function get(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Accomplishment not found', 404)
    guardAccess(row, profile)
    return row
  }

  // ── CREATE ──
  function create(body, user) {
    const profile = AuthService.getProfile(user)

    // Staff can only create for themselves
    if (profile.role === 'Staff' && body.userId && body.userId !== profile.id) {
      throw HttpError('Staff can only create entries for themselves', 403)
    }

    const now  = new Date().toISOString()
    const entry = {
      id:            SpreadsheetService.generateId('ACC-'),
      userId:        body.userId        || profile.id,
      employeeName:  body.employeeName  || profile.fullName,
      divisionId:    body.divisionId    || profile.divisionId,
      division:      body.division      || profile.divisionName,
      kraId:         body.kraId         || '',
      kraTitle:      body.kraTitle      || '',
      siId:          body.siId          || '',
      target:        body.target        || '',
      accomplished:  0,
      progressPct:   0,
      status:        'Not Started',
      deadline:      body.deadline      || '',
      remarks:       '',
      revisions:     0,
      movCount:      0,
      type:          body.type          || 'IPCR',   // IPCR | CCEF
      semester:      body.semester      || '',
      year:          body.year          || new Date().getFullYear(),
      createdBy:     profile.id,
      createdAt:     now,
      updatedAt:     now,
      deleted:       false
    }

    SpreadsheetService.appendRow(SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS), entry)
    AuditService.log('CREATE', 'Accomplishments', `Created entry: ${entry.id}`, user)
    return entry
  }

  // ── UPDATE ──
  function update(id, body, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    const existing = SpreadsheetService.getRow(sheet, id)
    if (!existing) throw HttpError('Accomplishment not found', 404)
    guardAccess(existing, profile)

    // Recompute progress
    if (body.accomplished !== undefined && existing.targetQty) {
      body.progressPct = Math.min(100, Math.round((body.accomplished / existing.targetQty) * 100))
    }

    const updated = SpreadsheetService.updateRow(sheet, id, {
      ...body,
      updatedAt: new Date().toISOString()
    })
    AuditService.log('UPDATE', 'Accomplishments', `Updated entry: ${id}`, user)
    return updated
  }

  // ── UPDATE STATUS ──
  function updateStatus(id, body, user) {
    const { status, remarks } = body
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Not found', 404)

    const allowed = ALLOWED_TRANSITIONS[row.status] || []
    if (!allowed.includes(status)) {
      throw HttpError(`Cannot transition from "${row.status}" to "${status}"`, 400)
    }

    const updated = SpreadsheetService.updateRow(sheet, id, {
      status,
      remarks:   remarks || row.remarks,
      updatedAt: new Date().toISOString(),
      submittedAt: status === 'Submitted' ? new Date().toISOString() : row.submittedAt
    })

    logRevision(id, row.status, status, remarks, profile)
    AuditService.log('STATUS_CHANGE', 'Accomplishments', `${id}: ${row.status} → ${status}`, user)
    NotificationsService.createForStatusChange(updated, status, profile)
    return updated
  }

  // ── APPROVE ──
  function approve(id, body, user) {
    const profile = AuthService.requireRole(user, 'System Administrator', 'Bureau Director', 'Assistant Bureau Director', 'Division Chief')
    return updateStatus(id, { status: 'Approved', remarks: body.remarks }, user)
  }

  // ── REQUEST REVISION ──
  function requestRevision(id, body, user) {
    AuthService.requireRole(user, 'System Administrator', 'Bureau Director', 'Assistant Bureau Director', 'Division Chief')
    const sheet = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Not found', 404)

    // Increment revision counter
    SpreadsheetService.updateRow(sheet, id, { revisions: (Number(row.revisions) || 0) + 1 })

    return updateStatus(id, { status: 'For Revision', remarks: body.remarks }, user)
  }

  // ── HISTORY ──
  function history(id, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.REVISIONS)
    return SpreadsheetService.getAllRows(sheet).filter(r => r.accomplishmentId === id)
  }

  // ── Internals ──
  function applyRoleScope(rows, profile) {
    const { role, id: userId, divisionId } = profile
    if (role === 'System Administrator' || role === 'Bureau Director') return rows
    if (role === 'Assistant Bureau Director') return rows.filter(r => r.divisionId === 'admin-pool')
    if (role === 'Division Chief') return rows.filter(r => r.divisionId === divisionId)
    return rows.filter(r => r.userId === userId) // Staff: own only
  }

  function guardAccess(row, profile) {
    const { role, id: userId, divisionId } = profile
    if (['System Administrator', 'Bureau Director'].includes(role)) return
    if (role === 'Assistant Bureau Director' && row.divisionId === 'admin-pool') return
    if (role === 'Division Chief' && row.divisionId === divisionId) return
    if (row.userId === userId) return
    throw HttpError('Access denied to this record', 403)
  }

  function logRevision(accomplishmentId, fromStatus, toStatus, remarks, profile) {
    const sheet = SpreadsheetService.getSheet(SHEET.REVISIONS)
    SpreadsheetService.appendRow(sheet, {
      id:               SpreadsheetService.generateId('REV-'),
      accomplishmentId,
      fromStatus,
      toStatus,
      remarks:          remarks || '',
      changedBy:        profile.id,
      changedByName:    profile.fullName,
      changedAt:        new Date().toISOString()
    })
  }

  return { list, get, create, update, updateStatus, approve, requestRevision, history }
})()
