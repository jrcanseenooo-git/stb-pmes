// ═══════════════════════════════════════════════════════════════
// 1. ATTENDANCE SERVICE
// ═══════════════════════════════════════════════════════════════

const AttendanceService = (() => {

  // ── List attendance records ──
  function list(params, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.ATTENDANCE_RECORDS)
    let rows      = SpreadsheetService.getAllRows(sheet)

    // Scope by role
    if (!['System Administrator', 'Bureau Director', 'Assistant Bureau Director'].includes(profile.role)) {
      if (profile.role === 'Division Chief') {
        rows = rows.filter(r => r.divisionId === profile.divisionId)
      } else {
        rows = rows.filter(r => r.userId === profile.id)
      }
    }

    if (params.userId)    rows = rows.filter(r => r.userId    === params.userId)
    if (params.divisionId) rows = rows.filter(r => r.divisionId === params.divisionId)
    if (params.month)     rows = rows.filter(r => String(r.month) === String(params.month))
    if (params.year)      rows = rows.filter(r => String(r.year)  === String(params.year))

    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  // ── Get single record ──
  function get(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.ATTENDANCE_RECORDS)
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Attendance record not found', 404)
    _guardAccess(row, profile)
    return row
  }

  // ── Record (HR / supervisor enters attendance data) ──
  function record(body, user) {
    AuthService.requireRole(user,
      'System Administrator', 'Bureau Director',
      'Assistant Bureau Director', 'Division Chief'
    )
    const profile = AuthService.getProfile(user)

    // Prevent duplicates for same user/month/year
    const sheet    = SpreadsheetService.getSheet(SHEET.ATTENDANCE_RECORDS)
    const existing = SpreadsheetService.getAllRows(sheet).find(r =>
      r.userId === body.userId &&
      String(r.month) === String(body.month) &&
      String(r.year)  === String(body.year)
    )
    if (existing) throw HttpError('Attendance record already exists for this period. Use update instead.', 409)

    const now    = new Date().toISOString()
    const record = {
      id:                SpreadsheetService.generateId('ATT-'),
      userId:            body.userId            || '',
      userName:          body.userName          || '',
      divisionId:        body.divisionId        || '',
      divisionName:      body.divisionName      || '',
      month:             body.month             || '',
      year:              body.year              || new Date().getFullYear(),
      tardinessCount:    Number(body.tardinessCount)  || 0,
      undertimeCount:    Number(body.undertimeCount)  || 0,
      absenceCount:      Number(body.absenceCount)    || 0,
      approvedLeaveCount: Number(body.approvedLeaveCount) || 0,
      recordedBy:        profile.id,
      recordedByName:    profile.fullName,
      remarks:           body.remarks           || '',
      createdAt:         now,
      updatedAt:         now
    }

    SpreadsheetService.appendRow(sheet, record)
    AuditService.log('RECORD', 'Attendance', `Recorded attendance for user ${body.userId} (${body.month}/${body.year})`, user)
    return record
  }

  // ── Update existing record ──
  function update(id, body, user) {
    AuthService.requireRole(user,
      'System Administrator', 'Bureau Director',
      'Assistant Bureau Director', 'Division Chief'
    )
    const sheet = SpreadsheetService.getSheet(SHEET.ATTENDANCE_RECORDS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Attendance record not found', 404)

    const { id: _id, userId: _uid, createdAt: _c, ...safe } = body
    const updated = SpreadsheetService.updateRow(sheet, id, {
      ...safe,
      updatedAt: new Date().toISOString()
    })
    AuditService.log('UPDATE', 'Attendance', `Updated record ${id}`, user)
    return updated
  }

  // ── Compute attendance rating for a form period ──
  function computeRating(body, user) {
    const { formId, userId, semester, year } = body
    if (!formId || !userId) throw HttpError('formId and userId are required', 400)

    AuthService.requireRole(user,
      'System Administrator', 'Bureau Director',
      'Assistant Bureau Director', 'Division Chief'
    )
    const profile = AuthService.getProfile(user)

    // Pull all monthly records for the semester
    const recordsSheet = SpreadsheetService.getSheet(SHEET.ATTENDANCE_RECORDS)
    const semesterMonths = _semesterMonths(semester)
    const records = SpreadsheetService.getAllRows(recordsSheet).filter(r =>
      r.userId === userId &&
      String(r.year) === String(year) &&
      semesterMonths.includes(String(r.month))
    )

    const totals = records.reduce((acc, r) => ({
      tardiness:    acc.tardiness    + (Number(r.tardinessCount)    || 0),
      undertime:    acc.undertime    + (Number(r.undertimeCount)    || 0),
      absences:     acc.absences     + (Number(r.absenceCount)      || 0),
      approvedLeave: acc.approvedLeave + (Number(r.approvedLeaveCount) || 0)
    }), { tardiness: 0, undertime: 0, absences: 0, approvedLeave: 0 })

    // CSC formula: deduct 0.5 per half-day tardiness/undertime, 1 per day absence
    const deduction = (totals.tardiness * 0.5) + (totals.undertime * 0.5) + (totals.absences * 1)
    const adjustedDeduction = Math.max(0, deduction - totals.approvedLeave)

    let rating, label
    if (adjustedDeduction === 0)      { rating = 5; label = 'Outstanding' }
    else if (adjustedDeduction <= 1)  { rating = 4; label = 'Very Satisfactory' }
    else if (adjustedDeduction <= 2)  { rating = 3; label = 'Satisfactory' }
    else if (adjustedDeduction <= 3)  { rating = 2; label = 'Unsatisfactory' }
    else                               { rating = 1; label = 'Poor' }

    // Upsert attendance rating
    const ratingsSheet = SpreadsheetService.getSheet(SHEET.ATTENDANCE_RATINGS)
    const existing     = SpreadsheetService.getAllRows(ratingsSheet).find(r =>
      r.formId === formId && r.userId === userId
    )
    const now      = new Date().toISOString()
    const ratingData = {
      formId, userId, semester, year,
      tardinessTotal:    totals.tardiness,
      undertimeTotal:    totals.undertime,
      absenceTotal:      totals.absences,
      approvedLeaveTotal: totals.approvedLeave,
      rating, label,
      computedBy:  profile.id,
      computedAt:  now
    }

    if (existing) {
      SpreadsheetService.updateRow(ratingsSheet, existing.id, ratingData)
    } else {
      SpreadsheetService.appendRow(ratingsSheet, {
        id: SpreadsheetService.generateId('ATTR-'),
        ...ratingData,
        createdAt: now
      })
    }

    AuditService.log('COMPUTE_ATTENDANCE', 'Attendance', `Computed rating for user ${userId} form ${formId}: ${rating} (${label})`, user)
    return { ...ratingData, deductionTotal: adjustedDeduction }
  }

  // ── List attendance ratings ──
  function listRatings(params, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.ATTENDANCE_RATINGS)
    let rows      = SpreadsheetService.getAllRows(sheet)

    if (!['System Administrator', 'Bureau Director', 'Assistant Bureau Director'].includes(profile.role)) {
      rows = rows.filter(r => r.userId === profile.id)
    }

    if (params.formId)   rows = rows.filter(r => r.formId   === params.formId)
    if (params.userId)   rows = rows.filter(r => r.userId   === params.userId)
    if (params.semester) rows = rows.filter(r => r.semester === params.semester)
    if (params.year)     rows = rows.filter(r => String(r.year) === String(params.year))

    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  function _guardAccess(row, profile) {
    const { role, id: userId, divisionId } = profile
    if (['System Administrator', 'Bureau Director'].includes(role)) return
    if (role === 'Division Chief' && row.divisionId === divisionId) return
    if (row.userId === userId) return
    throw HttpError('Access denied', 403)
  }

  function _semesterMonths(semester) {
    // S1 = Jan-Jun (1-6), S2 = Jul-Dec (7-12)
    if (!semester) return ['1','2','3','4','5','6','7','8','9','10','11','12']
    return semester.startsWith('S1') || semester === '1'
      ? ['1','2','3','4','5','6']
      : ['7','8','9','10','11','12']
  }

  return { list, get, record, update, computeRating, listRatings }
})()


// ═══════════════════════════════════════════════════════════════
// 2. PEER ASSIGNMENT SERVICE
// ═══════════════════════════════════════════════════════════════

const PeerAssignmentService = (() => {

  function list(params, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.PEER_ASSIGNMENTS)
    let rows      = SpreadsheetService.getAllRows(sheet)

    if (!['System Administrator', 'Bureau Director', 'Assistant Bureau Director'].includes(profile.role)) {
      rows = rows.filter(r =>
        r.userId    === profile.id ||
        r.peer1Id   === profile.id ||
        r.peer2Id   === profile.id
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

    // Prevent duplicate assignment per period
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
      userId:           body.userId           || '',
      userName:         body.userName         || '',
      divisionId:       body.divisionId       || '',
      peer1Id:          body.peer1Id          || '',
      peer1Name:        body.peer1Name        || '',
      peer1DivisionId:  body.peer1DivisionId  || '',
      peer2Id:          body.peer2Id          || '',
      peer2Name:        body.peer2Name        || '',
      peer2DivisionId:  body.peer2DivisionId  || '',
      semester:         body.semester         || '',
      year:             body.year             || new Date().getFullYear(),
      peer1Completed:   false,
      peer2Completed:   false,
      peer1CompletedAt: '',
      peer2CompletedAt: '',
      assignedAt:       now,
      assignedBy:       profile.id
    }

    SpreadsheetService.appendRow(sheet, assignment)
    AuditService.log('ASSIGN_PEERS', 'PeerAssignment', `Assigned peers for ${body.userId}`, user)

    // Notify peers
    ['peer1', 'peer2'].forEach(p => {
      _notifyUser(
        assignment[`${p}Id`],
        'assignment',
        `You have been assigned as peer evaluator for ${body.userName} (${body.semester} ${body.year}).`,
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

    const now = new Date().toISOString()
    const updates = {}

    if (row.peer1Id === profile.id && !row.peer1Completed) {
      updates.peer1Completed  = true
      updates.peer1CompletedAt = now
    } else if (row.peer2Id === profile.id && !row.peer2Completed) {
      updates.peer2Completed  = true
      updates.peer2CompletedAt = now
    } else {
      throw HttpError('You are not a peer for this assignment, or already completed', 400)
    }

    const updated = SpreadsheetService.updateRow(sheet, id, updates)
    AuditService.log('COMPLETE_PEER', 'PeerAssignment', `Peer ${profile.id} completed rating for assignment ${id}`, user)
    return updated
  }

  function _notifyUser(recipientId, type, message, relatedId, module_) {
    try {
      const sheet = SpreadsheetService.getSheet(SHEET.NOTIFICATIONS)
      SpreadsheetService.appendRow(sheet, {
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
// 3. DEADLINES SERVICE
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

    const profile = AuthService.getProfile(user)
    const now     = new Date().toISOString()
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