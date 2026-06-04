// ═══════════════════════════════════════════════════════════════
// 1. PEER ASSIGNMENT SERVICE
// ═══════════════════════════════════════════════════════════════

const PeerAssignmentService = (() => {

  function list(params, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.PEER_ASSIGNMENTS)
    let rows      = SpreadsheetService.getAllRows(sheet)

    // Non-admins only see assignments where they are the ratee or a peer
    if (!['System Administrator', 'Bureau Director', 'Assistant Bureau Director'].includes(profile.role)) {
      rows = rows.filter(r =>
        r.userId  === profile.id ||
        r.peer1Id === profile.id ||
        r.peer2Id === profile.id
      )
    }

    if (params.userId)   rows = rows.filter(r => r.userId   === params.userId)
    if (params.semester) rows = rows.filter(r => r.semester === params.semester)
    if (params.year)     rows = rows.filter(r => String(r.year) === String(params.year))

    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  function get(id, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.PEER_ASSIGNMENTS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Peer assignment not found', 404)
    return row
  }

  function assign(body, user) {
    AuthService.requireRole(user,
      'System Administrator', 'Bureau Director',
      'Assistant Bureau Director', 'Division Chief'
    )
    const profile = AuthService.getProfile(user)

    if (!body.userId || !body.peer1Id || !body.peer2Id) {
      throw HttpError('userId, peer1Id, and peer2Id are required', 400)
    }

    // Prevent duplicate assignment per ratee per period
    const sheet    = SpreadsheetService.getSheet(SHEET.PEER_ASSIGNMENTS)
    const existing = SpreadsheetService.getAllRows(sheet).find(r =>
      r.userId   === body.userId &&
      r.semester === body.semester &&
      String(r.year) === String(body.year)
    )
    if (existing) throw HttpError('Peer assignment already exists for this period', 409)

    const now        = new Date().toISOString()
    const assignment = {
      id:               SpreadsheetService.generateId('PA-'),
      userId:           body.userId          || '',
      userName:         body.userName        || '',
      divisionId:       body.divisionId      || '',
      peer1Id:          body.peer1Id         || '',
      peer1Name:        body.peer1Name       || '',
      peer1DivisionId:  body.peer1DivisionId || '',
      peer2Id:          body.peer2Id         || '',
      peer2Name:        body.peer2Name       || '',
      peer2DivisionId:  body.peer2DivisionId || '',
      semester:         body.semester        || '',
      year:             body.year            || new Date().getFullYear(),
      peer1Completed:   false,
      peer2Completed:   false,
      peer1CompletedAt: '',
      peer2CompletedAt: '',
      assignedAt:       now,
      assignedBy:       profile.id
    }

    SpreadsheetService.appendRow(sheet, assignment)
    AuditService.log('ASSIGN_PEERS', 'PeerAssignment', `Assigned peers for ${body.userId} (${body.semester} ${body.year})`, user)

    // Notify both peers
    ;['peer1', 'peer2'].forEach(p => {
      _notify(
        assignment[`${p}Id`],
        'assignment',
        `You have been assigned as a peer evaluator for ${body.userName} (${body.semester} ${body.year}).`,
        assignment.id,
        'PeerAssignment'
      )
    })

    return assignment
  }

  function markComplete(id, body, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.PEER_ASSIGNMENTS)
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Peer assignment not found', 404)

    const now     = new Date().toISOString()
    const updates = {}

    if (row.peer1Id === profile.id && !row.peer1Completed) {
      updates.peer1Completed   = true
      updates.peer1CompletedAt = now
    } else if (row.peer2Id === profile.id && !row.peer2Completed) {
      updates.peer2Completed   = true
      updates.peer2CompletedAt = now
    } else {
      throw HttpError('You are not a peer for this assignment, or you have already completed it', 400)
    }

    const updated = SpreadsheetService.updateRow(sheet, id, updates)
    AuditService.log('COMPLETE_PEER', 'PeerAssignment', `Peer ${profile.id} completed rating for assignment ${id}`, user)
    return updated
  }

  function _notify(recipientId, type, message, relatedId, module_) {
    try {
      SpreadsheetService.appendRow(SpreadsheetService.getSheet(SHEET.NOTIFICATIONS), {
        id:          SpreadsheetService.generateId('NOT-'),
        recipientId,
        type,
        message,
        relatedId,
        module:      module_,
        read:        false,
        createdAt:   new Date().toISOString()
      })
    } catch (e) {
      Logger.log('Notification error: ' + e.message)
    }
  }

  return { list, get, assign, markComplete }
})()


// ═══════════════════════════════════════════════════════════════
// 2. DEADLINES SERVICE
// ═══════════════════════════════════════════════════════════════

const DeadlinesService = (() => {

  function list(params, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.DEADLINES)
    let rows    = SpreadsheetService.getAllRows(sheet)

    if (params.semester) rows = rows.filter(r => r.semester === params.semester)
    if (params.year)     rows = rows.filter(r => String(r.year) === String(params.year))
    if (params.type)     rows = rows.filter(r => r.type     === params.type)
    if (params.active !== undefined && params.active !== '') {
      const isActive = params.active === 'true' || params.active === true
      rows = rows.filter(r => String(r.active) === String(isActive) || r.active === isActive)
    }

    rows.sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    return rows
  }

  function get(id, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.DEADLINES)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Deadline not found', 404)
    return row
  }

  function create(body, user) {
    AuthService.requireRole(user, 'System Administrator', 'Bureau Director')
    if (!body.name || !body.startDate || !body.endDate) {
      throw HttpError('name, startDate, and endDate are required', 400)
    }

    const profile  = AuthService.getProfile(user)
    const now      = new Date().toISOString()
    const deadline = {
      id:        SpreadsheetService.generateId('DL-'),
      name:      body.name      || '',
      type:      body.type      || 'Submission',
      semester:  body.semester  || '',
      year:      body.year      || new Date().getFullYear(),
      startDate: body.startDate || '',
      endDate:   body.endDate   || '',
      active:    body.active !== undefined ? body.active : true,
      createdBy: profile.id,
      createdAt: now
    }

    SpreadsheetService.appendRow(SpreadsheetService.getSheet(SHEET.DEADLINES), deadline)
    AuditService.log('CREATE', 'Deadlines', `Created deadline: ${deadline.name}`, user)
    return deadline
  }

  function update(id, body, user) {
    AuthService.requireRole(user, 'System Administrator', 'Bureau Director')
    const sheet = SpreadsheetService.getSheet(SHEET.DEADLINES)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Deadline not found', 404)

    const { id: _id, createdBy: _cb, createdAt: _ca, ...safe } = body
    const updated = SpreadsheetService.updateRow(sheet, id, safe)
    AuditService.log('UPDATE', 'Deadlines', `Updated deadline ${id}`, user)
    return updated
  }

  function remove(id, user) {
    AuthService.requireRole(user, 'System Administrator', 'Bureau Director')
    const sheet = SpreadsheetService.getSheet(SHEET.DEADLINES)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Deadline not found', 404)

    SpreadsheetService.updateRow(sheet, id, { active: false })
    AuditService.log('DELETE', 'Deadlines', `Deactivated deadline ${id}`, user)
    return { deleted: true }
  }

  return { list, get, create, update, remove }
})()