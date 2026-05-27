/**
 * AttendanceService.gs
 * Division Admin logs monthly attendance records.
 * System computes semester attendance rating (1-5).
 */

const AttendanceService = (() => {

  // Rating scale (DSPMS standard)
  const RATING_SCALE = [
    { rating: 5, label: 'Outstanding',         maxTardiness: 0,  maxAbsence: 0 },
    { rating: 4, label: 'Very Satisfactory',   maxTardiness: 2,  maxAbsence: 1 },
    { rating: 3, label: 'Satisfactory',         maxTardiness: 4,  maxAbsence: 2 },
    { rating: 2, label: 'Unsatisfactory',       maxTardiness: 6,  maxAbsence: 4 },
    { rating: 1, label: 'Poor',                 maxTardiness: 999, maxAbsence: 999 }
  ]

  function listRecords(params, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet('AttendanceRecords')
    let rows = SpreadsheetService.getAllRows(sheet)

    // Division Admin sees only their division
    if (profile.role === 'Division Admin') {
      rows = rows.filter(r => r.divisionId === profile.divisionId)
    } else if (['Staff','Contractor'].includes(profile.role)) {
      rows = rows.filter(r => r.userId === profile.id)
    }

    if (params.userId)     rows = rows.filter(r => r.userId === params.userId)
    if (params.divisionId) rows = rows.filter(r => r.divisionId === params.divisionId)
    if (params.month)      rows = rows.filter(r => String(r.month) === String(params.month))
    if (params.year)       rows = rows.filter(r => String(r.year) === String(params.year))

    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  function logRecord(body, user) {
    const profile = AuthService.getProfile(user)
    const allowed = ['Division Admin','Division Chief','Bureau Director','Assistant Bureau Director','System Administrator']
    if (!allowed.includes(profile.role)) {
      throw HttpError('Only Division Admins can log attendance records', 403)
    }

    const sheet = SpreadsheetService.getSheet('AttendanceRecords')
    const now   = new Date().toISOString()

    // Check if record already exists for this user/month/year
    const existing = SpreadsheetService.getAllRows(sheet).find(r =>
      r.userId === body.userId &&
      String(r.month) === String(body.month) &&
      String(r.year)  === String(body.year)
    )

    if (existing) {
      // Update existing record
      return SpreadsheetService.updateRow(sheet, existing.id, {
        tardinessCount:   body.tardinessCount   || 0,
        undertimeCount:   body.undertimeCount   || 0,
        absenceCount:     body.absenceCount     || 0,
        approvedLeaveCount: body.approvedLeaveCount || 0,
        remarks:          body.remarks          || '',
        updatedAt:        now
      })
    }

    const record = {
      id:               SpreadsheetService.generateId('ATT-'),
      userId:           body.userId         || '',
      userName:         body.userName       || '',
      divisionId:       body.divisionId     || profile.divisionId || '',
      divisionName:     body.divisionName   || '',
      month:            body.month          || '',
      year:             body.year           || new Date().getFullYear(),
      tardinessCount:   body.tardinessCount || 0,
      undertimeCount:   body.undertimeCount || 0,
      absenceCount:     body.absenceCount   || 0,
      approvedLeaveCount: body.approvedLeaveCount || 0,
      recordedBy:       profile.id,
      recordedByName:   profile.fullName,
      remarks:          body.remarks        || '',
      createdAt:        now,
      updatedAt:        now
    }

    SpreadsheetService.appendRow(sheet, record)
    AuditService.log('LOG_ATTENDANCE', 'Attendance', `Logged ${body.month}/${body.year} for ${body.userName}`, user)
    return record
  }

  function computeSemesterRating(userId, semester, year, user) {
    const sheet = SpreadsheetService.getSheet('AttendanceRecords')
    const rows  = SpreadsheetService.getAllRows(sheet).filter(r =>
      r.userId === userId && String(r.year) === String(year)
    )

    // Determine months for each semester
    const sem1Months = [1, 2, 3, 4, 5, 6]
    const sem2Months = [7, 8, 9, 10, 11, 12]
    const months = Number(semester) === 1 ? sem1Months : sem2Months

    const semRecords = rows.filter(r => months.includes(Number(r.month)))

    let totalTardiness = 0
    let totalAbsence   = 0

    semRecords.forEach(r => {
      totalTardiness += (Number(r.tardinessCount) || 0) + (Number(r.undertimeCount) || 0)
      const netAbsence = Math.max(0, (Number(r.absenceCount) || 0) - (Number(r.approvedLeaveCount) || 0))
      totalAbsence += netAbsence
    })

    // Average per month
    const monthCount     = semRecords.length || 1
    const avgTardiness   = totalTardiness / monthCount
    const avgAbsence     = totalAbsence   / monthCount

    // Find rating
    let rating = 1
    let label  = 'Poor'
    for (const scale of RATING_SCALE) {
      if (avgTardiness <= scale.maxTardiness && avgAbsence <= scale.maxAbsence) {
        rating = scale.rating
        label  = scale.label
        break
      }
    }

    const profile = AuthService.getProfile(user)
    const ratingSheet = SpreadsheetService.getSheet('AttendanceRatings')
    const now = new Date().toISOString()

    // Check existing
    const existing = SpreadsheetService.getAllRows(ratingSheet).find(r =>
      r.userId === userId && String(r.semester) === String(semester) && String(r.year) === String(year)
    )

    const data = {
      userId, semester, year,
      tardinessTotal: totalTardiness,
      undertimeTotal: 0,
      absenceTotal:   totalAbsence,
      approvedLeaveTotal: 0,
      rating, label,
      computedBy:   profile.id,
      computedAt:   now,
      createdAt:    now
    }

    if (existing) {
      SpreadsheetService.updateRow(ratingSheet, existing.id, { ...data, createdAt: existing.createdAt })
    } else {
      data.id = SpreadsheetService.generateId('ATTR-')
      SpreadsheetService.appendRow(ratingSheet, data)
    }

    AuditService.log('COMPUTE_ATTENDANCE', 'Attendance', `Rating ${rating} (${label}) for ${userId} S${semester}/${year}`, user)
    return { userId, semester, year, totalTardiness, totalAbsence, rating, label, monthsRecorded: semRecords.length }
  }

  function getRating(userId, semester, year, user) {
    const sheet = SpreadsheetService.getSheet('AttendanceRatings')
    const rows  = SpreadsheetService.getAllRows(sheet)
    return rows.find(r =>
      r.userId === userId &&
      String(r.semester) === String(semester) &&
      String(r.year) === String(year)
    ) || null
  }

  return { listRecords, logRecord, computeSemesterRating, getRating }
})()


// ══════════════════════════════════════════════════════════════
// JRBService.gs
// Job-Related Behavior ratings: Supervisor (15%) + Peer (10%)
// ══════════════════════════════════════════════════════════════

const JRBService = (() => {

  const JRB_ITEMS = [
    // Domain 1: Quality of Work (items 1-5)
    { number: 1,  domain: 1, domainName: 'Quality of Work',         text: 'Produces quality outputs that meet the standards and requirements of the task' },
    { number: 2,  domain: 1, domainName: 'Quality of Work',         text: 'Demonstrates technical competency relevant to the assigned task' },
    { number: 3,  domain: 1, domainName: 'Quality of Work',         text: 'Complies with office rules, regulations, and established policies' },
    { number: 4,  domain: 1, domainName: 'Quality of Work',         text: 'Adapts effectively to changing work demands and new assignments' },
    { number: 5,  domain: 1, domainName: 'Quality of Work',         text: 'Manages time efficiently and prioritizes tasks appropriately' },
    // Domain 2: Interpersonal Relationships (items 6-10)
    { number: 6,  domain: 2, domainName: 'Interpersonal Relationships', text: 'Works effectively and collaboratively with team members' },
    { number: 7,  domain: 2, domainName: 'Interpersonal Relationships', text: 'Shows respect for diversity and treats colleagues with dignity' },
    { number: 8,  domain: 2, domainName: 'Interpersonal Relationships', text: 'Communicates clearly and professionally (written and verbal)' },
    { number: 9,  domain: 2, domainName: 'Interpersonal Relationships', text: 'Provides constructive and helpful feedback to peers' },
    { number: 10, domain: 2, domainName: 'Interpersonal Relationships', text: 'Supports and assists colleagues to achieve team goals' },
    // Domain 3: Work Habits (items 11-15)
    { number: 11, domain: 3, domainName: 'Work Habits',             text: 'Reports for work on time and maintains proper attendance' },
    { number: 12, domain: 3, domainName: 'Work Habits',             text: 'Completes assigned tasks within set deadlines' },
    { number: 13, domain: 3, domainName: 'Work Habits',             text: 'Takes personal responsibility and accountability for own work' },
    { number: 14, domain: 3, domainName: 'Work Habits',             text: 'Shows initiative and proactively addresses work challenges' },
    { number: 15, domain: 3, domainName: 'Work Habits',             text: 'Maintains professional behavior and work ethics at all times' },
    // Domain 4: Personal Development (items 16-20)
    { number: 16, domain: 4, domainName: 'Personal Development',    text: 'Actively pursues continuous learning and professional development' },
    { number: 17, domain: 4, domainName: 'Personal Development',    text: 'Applies newly acquired knowledge and skills to improve work output' },
    { number: 18, domain: 4, domainName: 'Personal Development',    text: 'Shares knowledge, skills, and best practices with the team' },
    { number: 19, domain: 4, domainName: 'Personal Development',    text: 'Accepts and acts positively on feedback for improvement' },
    { number: 20, domain: 4, domainName: 'Personal Development',    text: 'Demonstrates commitment to public service and DSWD core values' }
  ]

  function getJRBItems() {
    return JRB_ITEMS
  }

  function submitRatings(formId, body, user) {
    const profile  = AuthService.getProfile(user)
    const raterType = body.raterType // SUPERVISOR / PEER1 / PEER2
    const sheet    = SpreadsheetService.getSheet('JRBRatings')
    const now      = new Date().toISOString()

    // Validate rater type permissions
    if (raterType === 'SUPERVISOR') {
      if (!['Division Chief','Assistant Bureau Director','Bureau Director','System Administrator'].includes(profile.role)) {
        throw HttpError('Only supervisors can submit JRB supervisor ratings', 403)
      }
    }

    const ratings = body.ratings || [] // Array of { itemNumber, rating }
    const saved   = []

    // Delete existing ratings for this form+rater to allow re-rating
    const existing = SpreadsheetService.getAllRows(sheet)
      .filter(r => r.formId === formId && r.raterId === profile.id)
    existing.forEach(r => SpreadsheetService.softDelete(sheet, r.id))

    ratings.forEach(item => {
      const jrbItem = JRB_ITEMS.find(i => i.number === Number(item.itemNumber))
      if (!jrbItem) return

      const row = {
        id:          SpreadsheetService.generateId('JRB-'),
        formId,
        userId:      body.rateeId || '',
        raterType,
        raterId:     profile.id,
        raterName:   profile.fullName,
        domain:      jrbItem.domain,
        domainName:  jrbItem.domainName,
        itemNumber:  jrbItem.number,
        itemText:    jrbItem.text,
        rating:      Number(item.rating) || 0,
        semester:    body.semester || '',
        year:        body.year     || '',
        createdAt:   now,
        updatedAt:   now
      }
      SpreadsheetService.appendRow(sheet, row)
      saved.push(row)
    })

    // Compute average
    const validRatings = saved.filter(r => r.rating > 0)
    const avgScore = validRatings.length > 0
      ? validRatings.reduce((s, r) => s + r.rating, 0) / validRatings.length
      : 0

    AuditService.log('JRB_RATING', 'JRB', `${raterType} rating submitted for form ${formId} by ${profile.fullName}. Score: ${avgScore.toFixed(2)}`, user)

    return { saved: saved.length, averageScore: avgScore.toFixed(5), raterType }
  }

  function getFormRatings(formId, user) {
    const sheet = SpreadsheetService.getSheet('JRBRatings')
    return SpreadsheetService.getAllRows(sheet)
      .filter(r => r.formId === formId && !r.deleted)
      .sort((a, b) => Number(a.itemNumber) - Number(b.itemNumber))
  }

  function assignPeers(userId, semester, year, user) {
    const profile = AuthService.getProfile(user)
    if (!['Division Chief','Bureau Director','Assistant Bureau Director','System Administrator'].includes(profile.role)) {
      throw HttpError('Only supervisors can assign peers', 403)
    }

    // Get target user's division
    const userSheet = SpreadsheetService.getSheet('Users')
    const targetUser = SpreadsheetService.getRow(userSheet, userId)
    if (!targetUser) throw HttpError('User not found', 404)

    const allUsers = SpreadsheetService.getAllRows(userSheet)
      .filter(u => u.active !== false && u.active !== 'false' && u.id !== userId)

    // Same division peers
    const sameDivision  = allUsers.filter(u => u.divisionId === targetUser.divisionId)
    // Different division peers
    const otherDivision = allUsers.filter(u => u.divisionId !== targetUser.divisionId)

    if (sameDivision.length === 0)  throw HttpError('No peers available in same division', 400)
    if (otherDivision.length === 0) throw HttpError('No peers available in other divisions', 400)

    const peer1 = sameDivision[Math.floor(Math.random() * sameDivision.length)]
    const peer2 = otherDivision[Math.floor(Math.random() * otherDivision.length)]

    const assignSheet = SpreadsheetService.getSheet('PeerAssignments')
    const now = new Date().toISOString()

    // Check if already assigned
    const existing = SpreadsheetService.getAllRows(assignSheet).find(r =>
      r.userId === userId && String(r.semester) === String(semester) && String(r.year) === String(year)
    )

    const assignment = {
      id:                SpreadsheetService.generateId('PA-'),
      userId,            userName: targetUser.fullName,
      divisionId:        targetUser.divisionId,
      peer1Id:           peer1.id,   peer1Name: peer1.fullName,   peer1DivisionId: peer1.divisionId,
      peer2Id:           peer2.id,   peer2Name: peer2.fullName,   peer2DivisionId: peer2.divisionId,
      semester, year,
      peer1Completed:    false, peer1CompletedAt: '',
      peer2Completed:    false, peer2CompletedAt: '',
      assignedAt:        now,
      assignedBy:        profile.id
    }

    if (existing) {
      SpreadsheetService.updateRow(assignSheet, existing.id, assignment)
    } else {
      SpreadsheetService.appendRow(assignSheet, assignment)
    }

    // Notify peers
    NotificationsService.create(peer1.id, 'PEER_RATING', `You have been assigned to rate ${targetUser.fullName} for S${semester}/${year}. Please complete the JRB peer rating form.`, userId, 'JRB')
    NotificationsService.create(peer2.id, 'PEER_RATING', `You have been assigned to rate ${targetUser.fullName} for S${semester}/${year}. Please complete the JRB peer rating form.`, userId, 'JRB')

    AuditService.log('ASSIGN_PEERS', 'JRB', `Assigned peers for ${targetUser.fullName}: ${peer1.fullName} (same div) & ${peer2.fullName} (other div)`, user)
    return assignment
  }

  function getAssignment(userId, semester, year, user) {
    const sheet = SpreadsheetService.getSheet('PeerAssignments')
    const rows  = SpreadsheetService.getAllRows(sheet)
    return rows.find(r =>
      r.userId === userId &&
      String(r.semester) === String(semester) &&
      String(r.year) === String(year)
    ) || null
  }

  function getMyPeerForms(semester, year, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet('PeerAssignments')
    const rows    = SpreadsheetService.getAllRows(sheet)

    // Find assignments where current user is a peer
    return rows.filter(r =>
      (r.peer1Id === profile.id || r.peer2Id === profile.id) &&
      String(r.semester) === String(semester) &&
      String(r.year) === String(year)
    )
  }

  return {
    getJRBItems,
    submitRatings,
    getFormRatings,
    assignPeers,
    getAssignment,
    getMyPeerForms
  }
})()


// ══════════════════════════════════════════════════════════════
// NotificationsService — simple helper used by other services
// ══════════════════════════════════════════════════════════════
const NotificationsService = (() => {

  function create(recipientId, type, message, relatedId, module_) {
    try {
      const sheet = SpreadsheetService.getSheet('Notifications')
      SpreadsheetService.appendRow(sheet, {
        id:          SpreadsheetService.generateId('NOTIF-'),
        recipientId, type, message,
        relatedId:   relatedId || '',
        module:      module_ || '',
        read:        false,
        readAt:      '',
        createdAt:   new Date().toISOString()
      })
    } catch(e) {
      Logger.log('NotificationsService.create error: ' + e.message)
    }
  }

  function list(user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet('Notifications')
    const rows    = SpreadsheetService.getAllRows(sheet)
      .filter(r => r.recipientId === profile.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return rows.slice(0, 50)
  }

  function markRead(id, user) {
    const sheet = SpreadsheetService.getSheet('Notifications')
    return SpreadsheetService.updateRow(sheet, id, { read: true, readAt: new Date().toISOString() })
  }

  function markAllRead(user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet('Notifications')
    const rows    = SpreadsheetService.getAllRows(sheet).filter(r => r.recipientId === profile.id && !r.read)
    rows.forEach(r => SpreadsheetService.updateRow(sheet, r.id, { read: true, readAt: new Date().toISOString() }))
    return { marked: rows.length }
  }

  return { create, list, markRead, markAllRead }
})()
