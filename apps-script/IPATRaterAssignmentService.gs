/**
 * IPATRaterAssignmentService.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * Automatic rater assignment for IPAT per office hierarchy.
 *
 * Position hierarchy:
 *   Bureau Director > Assistant Bureau Director > Division Chief
 *   > Section Head > Staff/Technical Staff/Administrative Staff
 *
 * Assignment rules by position:
 *   Staff/Technical Staff:
 *     Self + Peer1 (same section) + Peer2 (70% same section / 30% same division)
 *     + Supervisor (Section Head, same section) + SkipSupervisor (Division Chief, same division)
 *
 *   Section Head:
 *     Self + Peer (co-Section Head, same division)
 *     + Subordinate (random Staff from same section) + Supervisor (Division Chief)
 *     + SkipSupervisor (ABD)
 *
 *   Division Chief:
 *     Self + Peer (other Division Chief) + Subordinate (random Section Head in same division)
 *     + Supervisor (ABD) + SkipSupervisor (Bureau Director)
 *
 *   Assistant Bureau Director:
 *     Self + Peer (other ABD) + Subordinate (random Division Chief)
 *     + Supervisor (Bureau Director)
 *
 *   Bureau Director:
 *     Self + Subordinate (random ABD)
 *
 * Rating scale: 1=Never, 2=Rarely, 3=Frequently, 4=Always
 * Anti-repeat: Peer/Subordinate selections avoid the person assigned in the previous cycle.
 */

const IPATRaterAssignmentService = (() => {

  // ── Position level helpers ────────────────────────────────────────────────
  const roleOf          = (r) => typeof RoleLabelService !== 'undefined' ? RoleLabelService.canonicalRole(r) : String(r || '').trim()
  const isStaff         = (r) => ['Technical Staff', 'Administrative Staff'].includes(roleOf(r))
  const isSectionHead   = (r) => roleOf(r) === 'Section Head'
  const isDivisionChief = (r) => roleOf(r) === 'Division Chief'
  const isABD           = (r) => roleOf(r) === 'Assistant Bureau Director'
  const isDirector      = (r) => roleOf(r) === 'Bureau Director'
  // Administrative access and assessment eligibility are separate. Only the
  // actual STB/central System Administrator is excluded; a person in an office
  // who also administers that office remains rateable according to their
  // assessment role and rater matrix.
  const isCentralSystemAdministrator = (r) => {
    if (roleOf(r) !== 'System Administrator') return false
    const officeKey = String(r && (r.officeId || r.officeCode) || '').trim().toUpperCase()
    const scope = String(r && r.systemScope || '').trim().toUpperCase()
    const isStb = !officeKey || officeKey === 'STB' || officeKey === 'OFF-STB' || officeKey === 'SOCIAL TECHNOLOGY BUREAU'
    return isStb && ['STB_FULL', 'CLUSTER_ADMIN'].indexOf(scope) >= 0
  }
  const isEvaluatable   = (r) => !!roleOf(r) && !isCentralSystemAdministrator(r)
  const isObsoleteAssignment = (r) => ['JFPeer', 'JobFitnessPeer'].includes(String(r && r.raterType || ''))
  const activeProtocolAssignments = (rows) => rows.filter(r => !isObsoleteAssignment(r))

  function normalizeEmail_(value) {
    return String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase()
  }

  // The cheap half of the identity: what the profile already tells us, with no
  // sheet read at all. This is enough for the overwhelming majority of users,
  // because assignment and record rows carry the same user id the profile does.
  function profileIdentityFast_(profile) {
    const ids = {}
    const emails = {}
    const addId = (value) => {
      const key = String(value || '').trim()
      if (key) ids[key] = true
    }
    addId(profile && profile.id)
    addId(profile && profile.personnelId)
    addId(profile && profile.officePersonnelId)
    const email = normalizeEmail_(profile && profile.email)
    if (email) emails[email] = true
    return { ids: Object.keys(ids), emails: Object.keys(emails) }
  }

  // The full version additionally scans the roster to map a central account onto
  // an office Personnel row that was created with a DIFFERENT id. That scan is a
  // whole-sheet read, and it was previously paid on every single call to
  // getMyRatees and getMyResults - including the common case where the profile's
  // own id already matched and the extra ids changed nothing.
  //
  // Callers now start with profileIdentityFast_ and only fall back to this when
  // the fast identity found nothing, so the read happens for the accounts that
  // actually need it rather than for everyone.
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
      // STB/full PMES does not always have the office Personnel tab. The user id
      // and email collected above remain the canonical fallback.
      Logger.log('[IPAT Assignments] Personnel identity lookup skipped: ' + e.message)
    }

    return {
      ids: Object.keys(ids),
      emails: Object.keys(emails)
    }
  }

  function rowBelongsToProfile_(row, identity) {
    const raterId = String(row && row.raterId || '').trim()
    const rateeId = String(row && row.rateeId || '').trim()
    const raterEmail = normalizeEmail_(row && row.raterEmail)
    const rateeEmail = normalizeEmail_(row && row.rateeEmail)
    return {
      rater: (raterId && identity.ids.indexOf(raterId) >= 0) ||
        (raterEmail && identity.emails.indexOf(raterEmail) >= 0),
      ratee: (rateeId && identity.ids.indexOf(rateeId) >= 0) ||
        (rateeEmail && identity.emails.indexOf(rateeEmail) >= 0)
    }
  }

  // Rating writes serialize on the script lock so two raters cannot recompute
  // the same assessment record concurrently and interleave their score writes.
  //
  // Apps Script only offers a script-wide lock (there is no per-record lock), so
  // A submission must not wait longer than the 30-second proxy limit.  If the
  // lock is busy, no rating write has started; return a clear 429 quickly so
  // the client can safely retry rather than showing a misleading timeout.
  const LOCK_WAIT_MS = 6000

  function withRatingWriteLock(work) {
    const lock = LockService.getScriptLock()
    if (!lock.tryLock(LOCK_WAIT_MS)) {
      throw HttpError('The rating system is busy saving other submissions. Please try again in a moment.', 429)
    }

    try {
      return work()
    } finally {
      lock.releaseLock()
    }
  }

  // ── Random selection with anti-repeat ────────────────────────────────────
  function _selectRandom(pool, excludeIds, prevId) {
    const eligible = pool.filter(u => !excludeIds.includes(u.id))
    if (!eligible.length) return null
    const withoutPrev = eligible.filter(u => u.id !== prevId)
    const candidates  = withoutPrev.length ? withoutPrev : eligible
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  // ── Lookup previous cycle's rater id for a given ratee + raterType ────────
  function _prevRaterId(prevAssignments, rateeId, raterType) {
    const hit = prevAssignments.find(a => String(a.rateeId) === String(rateeId) && a.raterType === raterType)
    return hit ? hit.raterId : null
  }

  function _samePeriod(row, semester, year) {
    return String(row.semester) === String(semester) && String(row.year) === String(year)
  }

  function _canReplacePendingRater(existingAssignment, nextAssignment) {
    if (!existingAssignment || !nextAssignment) return false
    if (String(existingAssignment.raterId || '') === String(nextAssignment.raterId || '')) return false
    return String(existingAssignment.status || 'Pending') !== 'Completed'
  }

  function _recordScore(record, assignments) {
    const linked = assignments.filter(a => String(a.ipatRecordId) === String(record.id))
    const completed = linked.filter(a => a.status === 'Completed').length
    const hasScore = record.overallScore || record.cbcScore || record.jfScore || record.fpoScore ? 1 : 0
    const created = record.createdAt ? new Date(record.createdAt).getTime() : 0
    return (linked.length * 1000) + (completed * 100) + (hasScore * 10) - (created || 0) / 10000000000000
  }

  function writeAssignmentCompleted(assignSheet, assignmentId, allRows) {
    const values = assignSheet.getDataRange().getValues()
    const headers = values[0] || []
    const idIdx = headers.indexOf('id')
    const statusIdx = headers.indexOf('status')
    const updatedAtIdx = headers.indexOf('updatedAt')
    const now = new Date().toISOString()

    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idIdx]) === String(assignmentId)) {
        if (statusIdx >= 0) values[i][statusIdx] = 'Completed'
        if (updatedAtIdx >= 0) values[i][updatedAtIdx] = now
        assignSheet.getRange(i + 1, 1, 1, headers.length).setValues([values[i]])
        SpreadsheetService.invalidateSheet(assignSheet)
        const row = allRows.find(r => String(r.id) === String(assignmentId))
        if (row) {
          row.status = 'Completed'
          row.updatedAt = now
        }
        return row
      }
    }

    throw HttpError('Assignment not found', 404)
  }

  function completeAssignmentFromRows(assignSheet, assignmentId, row, allRows, user) {
    writeAssignmentCompleted(assignSheet, assignmentId, allRows)

    const ipatRecordId = row.ipatRecordId
    if (ipatRecordId) {
      const allForRecord = activeProtocolAssignments(allRows.filter(r => String(r.ipatRecordId) === String(ipatRecordId)))
      const allDone = allForRecord.every(r => r.status === 'Completed' || r.id === assignmentId)
      if (allDone) {
        try {
          IPATService.computeCBC(ipatRecordId, user)
          try { IPATService.computeJF(ipatRecordId, user) } catch (je) {
            Logger.log('[PMES] computeJF skipped (no JF ratings yet): ' + je.message)
          }
          IPATService.computeOverall(ipatRecordId, user)
        } catch (e) {
          Logger.log('[PMES] Auto-compute failed for ' + ipatRecordId + ': ' + e.message)
        }
      }
    }

    return { updated: true }
  }

  function _findCanonicalIpatRecord(records, assignments, rateeId, semester, year) {
    const matches = records.filter(r =>
      String(r.rateeId) === String(rateeId) && _samePeriod(r, semester, year)
    )
    if (!matches.length) return null
    return matches.sort((a, b) => _recordScore(b, assignments) - _recordScore(a, assignments))[0]
  }

  // ── Position-specific assignment builders ────────────────────────────────

  function _assignForStaff(ratee, allUsers, prevAssign) {
    const div = ratee.divisionId || ''
    const sec = (ratee.section  || '').trim()

    // All technical staff co-workers in same division (excluding ratee)
    const divStaff = allUsers.filter(u =>
      u.id !== ratee.id && isStaff(u.role) && (u.divisionId || '') === div
    )

    // Same-section pool - if ratee has no section set, treat whole division as the section
    const sectionPeers = sec
      ? divStaff.filter(u => (u.section || '').trim() === sec)
      : divStaff

    // Peer1: from same section (or division when no section data exists)
    const peer1 = _selectRandom(sectionPeers, [ratee.id], _prevRaterId(prevAssign, ratee.id, 'Peer1'))

    // Peer2: 70% same section, 30% whole division; must differ from peer1
    const excludePeer2      = [ratee.id, peer1?.id].filter(Boolean)
    const peer2SectionPool  = sectionPeers.filter(u => u.id !== peer1?.id)
    const peer2DivPool      = divStaff.filter(u => u.id !== peer1?.id)

    let peer2 = null
    if (Math.random() < 0.70 && peer2SectionPool.length) {
      peer2 = _selectRandom(peer2SectionPool, excludePeer2, _prevRaterId(prevAssign, ratee.id, 'Peer2'))
    }
    if (!peer2 && peer2DivPool.length) {
      peer2 = _selectRandom(peer2DivPool, excludePeer2, _prevRaterId(prevAssign, ratee.id, 'Peer2'))
    }

    // Supervisor: Section Head in the same section + division. When section data
    // is missing, use any Section Head in the division as the safest fallback.
    const supervisor = sec
      ? allUsers.find(u => isSectionHead(u.role) && (u.divisionId || '') === div && (u.section || '').trim() === sec)
      : allUsers.find(u => isSectionHead(u.role) && (u.divisionId || '') === div)

    // Skip Supervisor: Division Chief of same division
    const skipSupervisor = allUsers.find(u => isDivisionChief(u.role) && (u.divisionId || '') === div)

    const result = [{ raterId: ratee.id, raterName: ratee.fullName, raterType: 'Self' }]
    if (peer1)          result.push({ raterId: peer1.id,          raterName: peer1.fullName,          raterType: 'Peer1' })
    if (peer2)          result.push({ raterId: peer2.id,          raterName: peer2.fullName,          raterType: 'Peer2' })
    if (supervisor)     result.push({ raterId: supervisor.id,     raterName: supervisor.fullName,     raterType: 'Supervisor' })
    if (skipSupervisor) result.push({ raterId: skipSupervisor.id, raterName: skipSupervisor.fullName, raterType: 'SkipSupervisor' })
    return result
  }

  function _assignForSectionHead(ratee, allUsers, prevAssign) {
    const div = ratee.divisionId || ''
    const sec = (ratee.section  || '').trim()

    // Peer - co-Section Head in same division
    const shPeers = allUsers.filter(u => u.id !== ratee.id && isSectionHead(u.role) && (u.divisionId || '') === div)
    const peer = _selectRandom(shPeers, [ratee.id], _prevRaterId(prevAssign, ratee.id, 'Peer'))

    // Subordinate - Technical Staff in same section; fallback to any staff in division
    const subordinates = sec
      ? allUsers.filter(u => isStaff(u.role) && (u.divisionId || '') === div && (u.section || '').trim() === sec)
      : allUsers.filter(u => isStaff(u.role) && (u.divisionId || '') === div)
    const subordinate = _selectRandom(subordinates, [], _prevRaterId(prevAssign, ratee.id, 'Subordinate'))

    // Supervisor - Division Chief of same division
    const supervisor = allUsers.find(u => isDivisionChief(u.role) && u.divisionId === div)

    // Skip Supervisor - any ABD
    const skipSupervisor = allUsers.find(u => isABD(u.role))

    const result = [{ raterId: ratee.id, raterName: ratee.fullName, raterType: 'Self' }]
    if (peer)          result.push({ raterId: peer.id,          raterName: peer.fullName,          raterType: 'Peer' })
    if (subordinate)   result.push({ raterId: subordinate.id,   raterName: subordinate.fullName,   raterType: 'Subordinate' })
    if (supervisor)    result.push({ raterId: supervisor.id,    raterName: supervisor.fullName,    raterType: 'Supervisor' })
    if (skipSupervisor) result.push({ raterId: skipSupervisor.id, raterName: skipSupervisor.fullName, raterType: 'SkipSupervisor' })
    return result
  }

  function _assignForDivisionChief(ratee, allUsers, prevAssign) {
    const div = ratee.divisionId || ''

    // Peer - other Division Chiefs
    const dcPeers = allUsers.filter(u => u.id !== ratee.id && isDivisionChief(u.role))
    const peer = _selectRandom(dcPeers, [ratee.id], _prevRaterId(prevAssign, ratee.id, 'Peer'))

    // Subordinate - random Section Head in same division
    const subordinates = allUsers.filter(u => isSectionHead(u.role) && u.divisionId === div)
    const subordinate = _selectRandom(subordinates, [], _prevRaterId(prevAssign, ratee.id, 'Subordinate'))

    // Supervisor - any ABD
    const supervisor = allUsers.find(u => isABD(u.role))

    // Skip Supervisor - Bureau Director
    const skipSupervisor = allUsers.find(u => isDirector(u.role))

    const result = [{ raterId: ratee.id, raterName: ratee.fullName, raterType: 'Self' }]
    if (peer)          result.push({ raterId: peer.id,          raterName: peer.fullName,          raterType: 'Peer' })
    if (subordinate)   result.push({ raterId: subordinate.id,   raterName: subordinate.fullName,   raterType: 'Subordinate' })
    if (supervisor)    result.push({ raterId: supervisor.id,    raterName: supervisor.fullName,    raterType: 'Supervisor' })
    if (skipSupervisor) result.push({ raterId: skipSupervisor.id, raterName: skipSupervisor.fullName, raterType: 'SkipSupervisor' })
    return result
  }

  function _assignForABD(ratee, allUsers, prevAssign) {
    // Peer - other ABDs
    const abdPeers = allUsers.filter(u => u.id !== ratee.id && isABD(u.role))
    const peer = _selectRandom(abdPeers, [ratee.id], _prevRaterId(prevAssign, ratee.id, 'Peer'))

    // Subordinate - random Division Chief
    const subordinates = allUsers.filter(u => isDivisionChief(u.role))
    const subordinate = _selectRandom(subordinates, [], _prevRaterId(prevAssign, ratee.id, 'Subordinate'))

    // Supervisor - Bureau Director
    const supervisor = allUsers.find(u => isDirector(u.role))

    const result = [{ raterId: ratee.id, raterName: ratee.fullName, raterType: 'Self' }]
    if (peer)       result.push({ raterId: peer.id,       raterName: peer.fullName,       raterType: 'Peer' })
    if (subordinate) result.push({ raterId: subordinate.id, raterName: subordinate.fullName, raterType: 'Subordinate' })
    if (supervisor)  result.push({ raterId: supervisor.id,  raterName: supervisor.fullName,  raterType: 'Supervisor' })
    return result
  }

  function _assignForDirector(ratee, allUsers, prevAssign) {
    // Subordinate - random ABD
    const subordinates = allUsers.filter(u => isABD(u.role))
    const subordinate = _selectRandom(subordinates, [], _prevRaterId(prevAssign, ratee.id, 'Subordinate'))

    const result = [{ raterId: ratee.id, raterName: ratee.fullName, raterType: 'Self' }]
    if (subordinate) result.push({ raterId: subordinate.id, raterName: subordinate.fullName, raterType: 'Subordinate' })
    return result
  }

  // Loads the office's rater matrix, seeding the STB hierarchy on first use.
  //
  // Auto-seeding matters for backwards compatibility: STB and the already
  // provisioned offices have no RaterMatrix rows yet, and without this the very
  // first generation after deploy would report every role as unmapped. The seed
  // is a transcription of the five functions this replaced, so a freshly seeded
  // office behaves exactly as it did before.
  function _loadMatrixRows(body, user) {
    let result = RaterMatrixService.list({ officeId: body.officeId || '' }, user)
    if (!result.items.length) {
      result = RaterMatrixService.seedDefaults({ officeId: body.officeId || '' }, user)
    }
    return result.items
  }

  function _isStbOffice_(officeId) {
    const key = String(officeId || '').trim().toUpperCase()
    return !key || key === 'STB' || key === 'OFF-STB' || key === 'SOCIAL TECHNOLOGY BUREAU'
  }

  // STB stores both its own accounts and every participating office account in
  // the central Users tab.  A generation request made by the STB administrator
  // must therefore filter that central roster explicitly.  Participating
  // offices already run inside their own Personnel workbook, whose roster is
  // inherently office-scoped.
  function _isStbUser_(user) {
    const key = String(user && (user.officeId || user.officeCode || user.office) || 'STB').trim().toUpperCase()
    return !key || key === 'STB' || key === 'OFF-STB' || key === 'SOCIAL TECHNOLOGY BUREAU'
  }

  function _generationScope_(profile, body) {
    const requestedOffice = String(body && (body.officeId || body.officeCode) || '').trim()
    const assignedOffice = String(profile.officeId || profile.officeCode || 'STB').trim() || 'STB'
    const systemScope = String(profile.systemScope || 'STB_FULL').trim().toUpperCase()
    // Bootstrap/central administrators use CLUSTER_ADMIN, but their assigned
    // office remains STB. They retain STB generation only; a non-STB office
    // administrator can never become central merely by sharing the same role.
    const isStbScope = _isStbOffice_(assignedOffice) &&
      (systemScope === 'STB_FULL' || systemScope === 'CLUSTER_ADMIN')

    if (isStbScope) {
      if (String(profile.role || '') !== 'System Administrator') {
        throw HttpError('Only the STB System Administrator can generate STB evaluation assignments.', 403)
      }
      if (requestedOffice && !_isStbOffice_(requestedOffice)) {
        throw HttpError('STB assignment generation is limited to the Social Technology Bureau.', 403)
      }
      return { officeId: 'STB', label: 'Social Technology Bureau', isStb: true }
    }

    const isOfficeAssignmentManager = String(profile.officeRole || '') === 'OFFICE_ADMIN' ||
      AuthService.hasPermission(profile, 'manage_office_users') ||
      AuthService.hasPermission(profile, 'manage_office_rater_matrix')
    if (!isOfficeAssignmentManager || _isStbOffice_(assignedOffice)) {
      throw HttpError('Only an assigned office administrator or rater tagging focal can generate assignments for an office.', 403)
    }
    if (requestedOffice && String(requestedOffice).toUpperCase() !== String(assignedOffice).toUpperCase()) {
      throw HttpError('Assignment generation is limited to your assigned office.', 403)
    }
    return {
      officeId: assignedOffice,
      label: String(profile.officeName || assignedOffice),
      isStb: false
    }
  }

  // ── GENERATE ASSIGNMENTS ─────────────────────────────────────────────────

  function generateAssignmentsUnlocked(body, user) {
    const profile = AuthService.getProfile(user)
    const generationScope = _generationScope_(profile, body)

    const semester = String(body.semester || '')
    const year     = String(body.year     || '')
    if (!semester || !year) throw HttpError('semester and year are required', 400)

    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    const existingAssign = SpreadsheetService.getAllRows(assignSheet).filter(r =>
      _samePeriod(r, semester, year)
    )

    // All active users
    const usersSheet = SpreadsheetService.getSheet(SHEET.USERS)
    const activeUsers = SpreadsheetService.getAllRows(usersSheet).filter(u => {
      const active = u.active
      return active === true || active === 'true' || active === 1 || active === '1'
    })
    const allUsers = generationScope.isStb
      ? activeUsers.filter(_isStbUser_)
      : activeUsers

    // Previous cycle for anti-repeat
    const prevSem  = semester === '1' ? '2' : '1'
    const prevYear = semester === '1' ? String(Number(year) - 1) : year
    const prevAssign = SpreadsheetService.getAllRows(assignSheet).filter(r =>
      _samePeriod(r, prevSem, prevYear)
    )

    IPATService.ensureRecordSchema()
    const ipatSheet   = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const existingRec = SpreadsheetService.getAllRows(ipatSheet)
    const now = new Date().toISOString()

    const assignments = []
    const recordsToCreate = []
    const evaluatable = allUsers.filter(u => isEvaluatable(u.role))
    const touchedRateeIds = new Set()
    const createdRecordIds = new Set()
    const assignmentIdsToRemove = new Set()
    const responseTypesByIpat = {}
    let replacedAssignments = 0
    let removedAssignments = 0
    let removedResponses = 0
    let recomputedRecords = 0
    const existingAssignmentsByRatee = {}
    // Track assignment coverage by rater type. When a person is approved
    // after a period was generated, all existing slots can be valid yet the
    // new rater would otherwise remain on Self only forever. Backfill uses
    // this count to give zero-task eligible raters one pending slot without
    // touching completed ratings or broadly reshuffling pending work.
    const raterCountsByType = {}
    const countRater = (raterType, raterId, delta) => {
      const type = String(raterType || '')
      const id = String(raterId || '')
      if (!type || !id) return
      if (!raterCountsByType[type]) raterCountsByType[type] = {}
      raterCountsByType[type][id] = Math.max(0, Number(raterCountsByType[type][id] || 0) + delta)
    }
    activeProtocolAssignments(existingAssign).forEach(assignment => {
      countRater(assignment.raterType, assignment.raterId, 1)
    })
    existingAssign.forEach(assignment => {
      const key = String(assignment.rateeId || '')
      if (!key) return
      if (!existingAssignmentsByRatee[key]) existingAssignmentsByRatee[key] = []
      existingAssignmentsByRatee[key].push(assignment)
    })

    // Rater rules now come from the per-office RaterMatrix rather than the five
    // hardcoded STB role branches this replaced. An office using its own role
    // names no longer falls through to an empty list and a silent skip.
    const matrixRows = _loadMatrixRows({ officeId: generationScope.officeId }, user)
    const matrixHelpers = { selectRandom: _selectRandom, prevRaterId: _prevRaterId }

    // Exceptions are collected and returned rather than swallowed. A role with
    // no matrix entry, or a configured rater who does not exist on the roster,
    // used to vanish without trace; both are now reported to the administrator.
    const unmappedRoles = {}
    const incompleteRatees = []

    evaluatable.forEach(ratee => {
      const role = roleOf(ratee.role)
      const resolution = RaterMatrixService.resolveRatersFor(
        ratee, allUsers, prevAssign, matrixRows, matrixHelpers
      )

      if (resolution.unmappedRole) {
        const role = roleOf(ratee.role) || '(no role)'
        unmappedRoles[role] = (unmappedRoles[role] || 0) + 1
        if (!(existingAssignmentsByRatee[String(ratee.id)] || []).length) return
      }

      const raterList = resolution.raters
      if (!raterList.length) {
        incompleteRatees.push({ rateeName: ratee.fullName, role: role, missing: resolution.missing })
        return
      }
      if (resolution.missing.length) {
        incompleteRatees.push({ rateeName: ratee.fullName, role: role, missing: resolution.missing })
      }

      // Auto-create IPAT record if not yet existing for this period
      let ipatRecord = _findCanonicalIpatRecord(existingRec, existingAssign, ratee.id, semester, year)

      if (!ipatRecord && raterList.length) {
        // Derived from the matrix, not from the STB role names. This flag drives
        // the CBC weight split - with a subordinate the weights are Self/Peer/
        // Subordinate 15 each; without one the subordinate's 15% moves to a
        // second peer. Reading it from the resolved rater set means an office
        // with its own hierarchy gets the correct split automatically.
        const hasSubordinate = raterList.some(r => r.raterType === 'Subordinate')
        const newId = SpreadsheetService.generateId('IPAT-')
        const newRec = {
          id:            newId,
          officeId:      generationScope.officeId,
          rateeId:       ratee.id,
          rateeName:     ratee.fullName,
          divisionId:    ratee.divisionId   || '',
          divisionName:  ratee.divisionName || '',
          position:      ratee.position     || '',
          positionLevel: role,
          semester,
          year,
          hasSubordinate,
          status:        'Draft',
          cbcBaseScore: '',
          cbcScore: '',
          cbcNteLevel: 'none',
          cbcNteDeductionPct: '',
          cbcOffenseLevel: 'none',
          cbcOffenseDeduction: '',
          cbcDeductionNote: '',
          cbcDeductionBy: '',
          cbcDeductionByName: '',
          cbcDeductionAt: '',
          fpoScore: '',
          jfScore: '',
          overallScore: '',
          descriptor: '',
          ipcrfFormId: '',
          createdAt: now,
          updatedAt: now
        }
        recordsToCreate.push(newRec)
        existingRec.push(newRec)
        ipatRecord = newRec
        createdRecordIds.add(newRec.id)
      }

      const existingForRatee = existingAssignmentsByRatee[String(ratee.id)] || []
      const existingByRole = {}
      existingForRatee.forEach(a => {
        const key = String(a.raterType || '')
        if (!existingByRole[key]) existingByRole[key] = []
        existingByRole[key].push(a)
      })

      if (ipatRecord) {
        const hasSubordinate = raterList.some(r => r.raterType === 'Subordinate')
        const metadataChanged = String(ipatRecord.rateeName || '') !== String(ratee.fullName || '') ||
          String(ipatRecord.divisionId || '') !== String(ratee.divisionId || '') ||
          String(ipatRecord.positionLevel || '') !== String(role || '') ||
          String(ipatRecord.hasSubordinate) !== String(hasSubordinate)
        if (metadataChanged && !createdRecordIds.has(ipatRecord.id)) {
          SpreadsheetService.updateRow(ipatSheet, ipatRecord.id, {
            rateeName: ratee.fullName || '', divisionId: ratee.divisionId || '',
            divisionName: ratee.divisionName || '', position: ratee.position || '',
            positionLevel: role, hasSubordinate, updatedAt: now
          })
        }
      }

      // Store only missing rater roles. Existing assignments and submitted
      // ratings are preserved, so admins can safely backfill late accounts.
      raterList.forEach(a => {
        let selectedRater = a
        const sameType = existingByRole[a.raterType] || []
        const validExisting = sameType.length === 1 && RaterMatrixService.isAssignmentValid(ratee, sameType[0], allUsers, matrixRows)
        if (validExisting) {
          const current = sameType[0]
          const eligible = typeof RaterMatrixService.eligibleRatersFor === 'function'
            ? RaterMatrixService.eligibleRatersFor(ratee, allUsers, matrixRows, a.raterType)
            : []
          const counts = raterCountsByType[a.raterType] || {}
          const uncovered = eligible.find(person =>
            String(person.id || '') !== String(current.raterId || '') &&
            Number(counts[String(person.id || '')] || 0) === 0
          )
          if (uncovered && String(current.status || 'Pending') !== 'Completed') {
            assignmentIdsToRemove.add(String(current.id))
            countRater(a.raterType, current.raterId, -1)
            countRater(a.raterType, uncovered.id, 1)
            replacedAssignments += 1
            selectedRater = {
              raterId: uncovered.id,
              raterName: uncovered.fullName,
              raterType: a.raterType
            }
          } else {
          // Generate / Backfill creates only missing work.  Replacing a pending
          // assignment on every run both changes an administrator's existing
          // rater decision and turns an otherwise read-mostly backfill into
          // hundreds of slow per-row spreadsheet writes.  Completed ratings
          // were already preserved; pending assignments must be preserved too.
            return
          }
        }
        if (sameType.length && selectedRater === a) {
          sameType.forEach(item => assignmentIdsToRemove.add(String(item.id)))
          if (ipatRecord) {
            if (!responseTypesByIpat[ipatRecord.id]) responseTypesByIpat[ipatRecord.id] = new Set()
            responseTypesByIpat[ipatRecord.id].add(a.raterType)
          }
          replacedAssignments += 1
        }
        const newAssignment = {
          id:             SpreadsheetService.generateId('RASN-'),
          officeId:       generationScope.officeId,
          semester,
          year,
          rateeId:        ratee.id,
          rateeName:      ratee.fullName,
          rateeDivisionId: ratee.divisionId || '',
          rateeRole:      role,
          rateeSection:   ratee.section     || '',
          raterId:        selectedRater.raterId,
          raterName:      selectedRater.raterName,
          raterType:      selectedRater.raterType,
          ipatRecordId:   ipatRecord.id,
          status:         'Pending',
          createdAt:      now,
          updatedAt:      now
        }
        assignments.push(newAssignment)
        existingByRole[a.raterType] = [newAssignment]
        if (!(validExisting && selectedRater !== a)) countRater(a.raterType, selectedRater.raterId, 1)
        touchedRateeIds.add(ratee.id)
      })

      const resolvedTypes = new Set(raterList.map(item => String(item.raterType || '')))
      existingForRatee.forEach(item => {
        if (resolvedTypes.has(String(item.raterType || ''))) return
        assignmentIdsToRemove.add(String(item.id))
        if (ipatRecord) {
          if (!responseTypesByIpat[ipatRecord.id]) responseTypesByIpat[ipatRecord.id] = new Set()
          responseTypesByIpat[ipatRecord.id].add(String(item.raterType || ''))
        }
      })
    })

    if (assignmentIdsToRemove.size) {
      const values = assignSheet.getDataRange().getValues()
      const headers = values[0] || []
      const idIdx = headers.indexOf('id')
      const rowNumbers = []
      for (let i = 1; i < values.length; i++) {
        if (assignmentIdsToRemove.has(String(values[i][idIdx] || ''))) rowNumbers.push(i + 1)
      }
      const groups = []
      rowNumbers.sort((a, b) => a - b).forEach(rowNumber => {
        const last = groups[groups.length - 1]
        if (last && last.start + last.count === rowNumber) last.count += 1
        else groups.push({ start: rowNumber, count: 1 })
      })
      groups.sort((a, b) => b.start - a.start).forEach(group => assignSheet.deleteRows(group.start, group.count))
      removedAssignments = rowNumbers.length
      if (rowNumbers.length) SpreadsheetService.invalidateSheet(assignSheet)
    }
    Object.keys(responseTypesByIpat).forEach(ipatId => {
      const result = IPATService.removeRatingsAndRecomputeUnlocked(ipatId, Array.from(responseTypesByIpat[ipatId]), user)
      removedResponses += Number(result.removedCBC || 0) + Number(result.removedJF || 0)
      recomputedRecords += result.recomputed ? 1 : 0
    })
    SpreadsheetService.appendRows(ipatSheet, recordsToCreate)
    SpreadsheetService.appendRows(assignSheet, assignments)

    AuditService.log('GENERATE_ASSIGNMENTS', 'IPAT',
      `Generated/backfilled ${assignments.length}, removed ${removedAssignments} invalid tasks and ${removedResponses} active response rows for ${generationScope.label}, Semester ${semester} ${year}`, user)

    const breakdown = {}
    assignments.forEach(a => { breakdown[a.raterType] = (breakdown[a.raterType] || 0) + 1 })

    const unmappedList = Object.keys(unmappedRoles).map(role => ({
      role: role,
      personnel: unmappedRoles[role]
    }))

    if (unmappedList.length) {
      AuditService.log('ASSIGNMENT_EXCEPTIONS', 'IPAT',
        `${unmappedList.length} role(s) had no rater matrix entry and were skipped: ` +
        unmappedList.map(u => `${u.role} (${u.personnel})`).join(', '), user)
    }

    return {
      generated:  assignments.length,
      replaced:   replacedAssignments,
      removedAssignments,
      removedResponses,
      recomputedRecords,
      ratees:     touchedRateeIds.size,
      recordsCreated: createdRecordIds.size,
      existing:   new Set(existingAssign.map(a => a.rateeId)).size,
      breakdown,
      officeId: generationScope.officeId,
      scopeLabel: generationScope.label,
      semester,
      year,
      // Exceptions the previous implementation discarded silently. `unmapped`
      // means the role has no matrix entry at all - nobody in it will be rated.
      // `incomplete` means the role is mapped but a configured rater could not
      // be found on the roster, so that person is rated by fewer raters than
      // intended.
      unmapped: unmappedList,
      unmappedPersonnel: unmappedList.reduce((s, u) => s + u.personnel, 0),
      incomplete: incompleteRatees
    }
  }

  // ── GET MY RATING TASKS (who I am assigned to rate) ──────────────────────

  function getMyRatees(params, user) {
    const profile = AuthService.getProfile(user)
    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)

    // One rater's own tasks - a handful of rows out of every assignment the
    // office has ever generated. Same shape as getMyResults: ask for the rows
    // that match, and only fall back to the roster scan and a full read when the
    // profile's own ids matched nothing. Assignment rows carry no raterEmail
    // column, so ids are the only thing that can match and the targeted lookup
    // misses nothing.
    let identity = profileIdentityFast_(profile)
    let rows = activeProtocolAssignments(
      SpreadsheetService.findRowsByColumn(assignSheet, 'raterId', identity.ids)
    )
    if (!rows.length) {
      identity = profileRosterIdentity_(profile)
      rows = activeProtocolAssignments(SpreadsheetService.getAllRows(assignSheet)).filter(r =>
        rowBelongsToProfile_(r, identity).rater
      )
    }
    if (params.semester) rows = rows.filter(r => String(r.semester) === String(params.semester))
    if (params.year)     rows = rows.filter(r => String(r.year) === String(params.year))
    if (params.status)   rows = rows.filter(r => r.status === params.status)
    if (!rows.length) return []

    // Record scores for context. Only the records these tasks point at, rather
    // than every record in the office.
    const ipatSheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const recordsById = {}
    const wantedRecordIds = rows.map(a => String(a.ipatRecordId || '')).filter(Boolean)
    SpreadsheetService.findRowsByColumn(ipatSheet, 'id', wantedRecordIds).forEach(r => {
      recordsById[String(r.id)] = r
    })

    return rows.map(a => {
      const rec = a.ipatRecordId
        ? recordsById[String(a.ipatRecordId)]
        : null
      const ntePct = Number(rec?.cbcNteDeductionPct || 0)
      const offenseDeduction = Number(rec?.cbcOffenseDeduction || 0)
      const hasCbcDeduction = Boolean(ntePct || offenseDeduction)

      return {
        ...a,
        ipatStatus:   rec?.status || 'Draft',
        overallScore: rec?.overallScore || null,
        cbcDeductionHasDeduction: hasCbcDeduction
      }
    })
  }

  // ── GET ASSIGNMENTS FOR A RATEE ───────────────────────────────────────────

  function getRateeAssignments(rateeId, params, user) {
    const profile = AuthService.getProfile(user)
    const isAdmin = AuthService.hasPermission(profile, 'generate_ipat_assignments') ||
                    AuthService.hasPermission(profile, 'view_bureau_monitoring') ||
                    AuthService.hasPermission(profile, 'view_division_monitoring')
    if (!isAdmin && profile.id !== rateeId) throw HttpError('Unauthorized', 403)

    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    let rows = activeProtocolAssignments(SpreadsheetService.getAllRows(assignSheet)).filter(r => String(r.rateeId) === String(rateeId))
    if (params.semester) rows = rows.filter(r => String(r.semester) === String(params.semester))
    if (params.year)     rows = rows.filter(r => String(r.year) === String(params.year))
    if (!AuthService.hasPermission(profile, 'view_bureau_monitoring') && AuthService.hasPermission(profile, 'view_division_monitoring')) {
      rows = rows.filter(r => r.rateeDivisionId === profile.divisionId)
    }
    return rows
  }

  // ── LIST ALL ASSIGNMENTS (admin) ──────────────────────────────────────────

  function list(params, user) {
    const profile = AuthService.getProfile(user)
    const isAdmin = AuthService.hasPermission(profile, 'generate_ipat_assignments') ||
                    AuthService.hasPermission(profile, 'view_bureau_monitoring') ||
                    AuthService.hasPermission(profile, 'view_division_monitoring')
    if (!isAdmin) throw HttpError('Unauthorized', 403)

    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    let rows = activeProtocolAssignments(SpreadsheetService.getAllRows(assignSheet))
    if (params.semester) rows = rows.filter(r => String(r.semester) === String(params.semester))
    if (params.year)     rows = rows.filter(r => String(r.year) === String(params.year))
    if (params.rateeId)  rows = rows.filter(r => String(r.rateeId) === String(params.rateeId))
    if (!AuthService.hasPermission(profile, 'view_bureau_monitoring') && AuthService.hasPermission(profile, 'view_division_monitoring')) {
      rows = rows.filter(r => r.rateeDivisionId === profile.divisionId)
    }
    // Sibling list() endpoints (Accomplishments, IPCRF, Users) all paginate;
    // this one returned the full, unbounded array. IPATRaterAssignments grows
    // every semester x every ratee x every rater, forever, with no natural
    // ceiling the way a per-office personnel roster has. No caller passes
    // page/pageSize today, so this has no live effect yet - it only stops the
    // response from becoming unbounded if this route is ever wired up.
    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  // ── MARK ASSIGNMENT COMPLETED ─────────────────────────────────────────────

  function markCompletedUnlocked(assignmentId, user) {
    const profile = AuthService.getProfile(user)
    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    const rows = SpreadsheetService.getAllRows(assignSheet)
    const row = rows.find(r => r.id === assignmentId)
    if (!row) throw HttpError('Assignment not found', 404)
    if (isObsoleteAssignment(row)) throw HttpError('This assignment is no longer active under the current protocol', 400)
    const identity = profileRosterIdentity_(profile)
    if (!rowBelongsToProfile_(row, identity).rater) {
      throw HttpError('Only the assigned rater can complete this assignment.', 403)
    }
    return completeAssignmentFromRows(assignSheet, assignmentId, row, rows, user)
  }

  function generateAssignments(body, user) {
    return withRatingWriteLock(() => generateAssignmentsUnlocked(body, user))
  }

  function markCompleted(assignmentId, user) {
    return withRatingWriteLock(() => markCompletedUnlocked(assignmentId, user))
  }

  function submitAssignmentRatingsUnlocked(assignmentId, body, user) {
    const profile = AuthService.getProfile(user)
    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    const rows = SpreadsheetService.getAllRows(assignSheet)
    const row = rows.find(r => r.id === assignmentId)
    if (!row) throw HttpError('Assignment not found', 404)
    if (isObsoleteAssignment(row)) throw HttpError('This assignment is no longer active under the current protocol', 400)
    const identity = profileRosterIdentity_(profile)
    if (!rowBelongsToProfile_(row, identity).rater) {
      throw HttpError('Only the assigned rater can submit ratings for this assignment.', 403)
    }
    if (!row.ipatRecordId) throw HttpError('Assignment has no linked assessment record', 400)
    if (String(row.status || 'Pending') === 'Completed') {
      return { updated: false, alreadyCompleted: true, savedCBC: 0, savedJF: 0, ipatRecordId: row.ipatRecordId }
    }

    let cbcRatings = body.cbcRatings || []
    let jfRatings  = body.jfRatings  || []
    if (typeof cbcRatings === 'string') { try { cbcRatings = JSON.parse(cbcRatings) } catch(e) { cbcRatings = [] } }
    if (typeof jfRatings  === 'string') { try { jfRatings  = JSON.parse(jfRatings)  } catch(e) { jfRatings  = [] } }
    if (!Array.isArray(cbcRatings)) cbcRatings = []
    if (!Array.isArray(jfRatings))  jfRatings  = []

    const requirements = AssessmentContentService.requirementsForAssignment(row, user)
    if (requirements.cbcCount > 0 && cbcRatings.length < requirements.cbcCount) throw HttpError(`Complete all ${requirements.cbcCount} required CBC questions before submitting.`, 400)
    if (requirements.jfCount > 0 && jfRatings.length < requirements.jfCount) throw HttpError(`Complete all ${requirements.jfCount} required Job Fitness questions before submitting.`, 400)
    if (requirements.cbcCount === 0 && requirements.jfCount === 0) throw HttpError('No active assessment questions are configured for this assignment. Ask your administrator to check the assessment form.', 409)
    cbcRatings = cbcRatings.map(item => ({ ...item, raterType: row.raterType }))
    jfRatings = jfRatings.map(item => ({ ...item, raterType: ['Self', 'Supervisor'].includes(String(row.raterType || '')) ? row.raterType : '' })).filter(item => item.raterType)

    // The unlocked variants: this runs inside withRatingWriteLock already, and
    // the locking entry points would try to take the same script lock a second
    // time in one execution. Keeping the whole submission - both rating sets
    // and the assignment row below - under the single outer lock is also what
    // stops a submission from half-applying.
    if (cbcRatings.length) IPATService.saveCBCRatingsUnlocked(row.ipatRecordId, { ratings: cbcRatings }, user, { skipRaterGuard: true })
    if (jfRatings.length)  IPATService.saveJFRatingsUnlocked(row.ipatRecordId, { ratings: jfRatings }, user, { skipRaterGuard: true })

    const completed = completeAssignmentFromRows(assignSheet, assignmentId, row, rows, user)
    return {
      ...completed,
      savedCBC: cbcRatings.length,
      savedJF: jfRatings.length,
      ipatRecordId: row.ipatRecordId
    }
  }

  function submitAssignmentRatings(assignmentId, body, user) {
    return withRatingWriteLock(() => submitAssignmentRatingsUnlocked(assignmentId, body, user))
  }

  // ── GET MY OWN RESULTS (ratee views their final score) ───────────────────
  // Section 2: "The person being rated shall be able to view the final ratings."

  function getMyResults(params, user) {
    const profile     = AuthService.getProfile(user)
    IPATService.ensureRecordSchema()
    const recSheet    = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)

    // A ratee is reading their OWN results - one or two rows out of every
    // assessment record the office holds. Ask Sheets for those rows instead of
    // transferring the whole table and discarding all but two, and start from
    // the identity that needs no sheet read at all.
    //
    // The roster scan only runs when the fast identity matched nothing, which is
    // the case it exists for: a central account whose office Personnel row was
    // created under a different id. Records carry no rateeEmail column, so ids
    // are the only thing that can match here and a targeted lookup is complete.
    let identity = profileIdentityFast_(profile)
    let rows = SpreadsheetService.findRowsByColumn(recSheet, 'rateeId', identity.ids)
    if (!rows.length) {
      identity = profileRosterIdentity_(profile)
      rows = SpreadsheetService.getAllRows(recSheet).filter(r =>
        rowBelongsToProfile_(r, identity).ratee
      )
    }
    if (params.semester) rows = rows.filter(r => String(r.semester) === String(params.semester))
    if (params.year)     rows = rows.filter(r => String(r.year)     === String(params.year))
    if (!rows.length) return []

    // Only the assignments attached to this person's own records, rather than
    // every assignment in the office. They drive the progress counters below and
    // break ties between duplicate records, so nothing wider is needed.
    const allAssignments = activeProtocolAssignments(
      SpreadsheetService.findRowsByColumn(assignSheet, 'ipatRecordId', rows.map(r => r.id))
    )
    const grouped = {}
    rows.forEach(r => {
      const key = [r.rateeId, r.semester, r.year].map(String).join('|')
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(r)
    })
    rows = Object.keys(grouped).map(key =>
      _findCanonicalIpatRecord(grouped[key], allAssignments, grouped[key][0].rateeId, grouped[key][0].semester, grouped[key][0].year)
    ).filter(Boolean)

    return rows.map(r => {
      const assignments     = allAssignments.filter(a => a.ipatRecordId === r.id)
      const totalRaters     = assignments.length
      const completedRaters = assignments.filter(a => a.status === 'Completed').length
      const pendingRaters   = assignments.filter(a => a.status !== 'Completed').map(a => a.raterType)
      const allComplete     = totalRaters > 0 && completedRaters === totalRaters

      // Reads must stay read-only under load. Final scores are computed by the
      // locked submit/complete path when the last assignment is completed, not by
      // every ratee opening the Results tab at the same time.

      const ntePct = Number(r.cbcNteDeductionPct || 0)
      const offenseDeduction = Number(r.cbcOffenseDeduction || 0)
      const hasCbcDeduction = Boolean(ntePct || offenseDeduction)
      const cbcRaw = Number(r.cbcScore || 0)
      const cbcWeightedScore = cbcRaw > 0
        ? cbcRaw * 0.30
        : null

      return {
        id:             r.id,
        semester:       r.semester,
        year:           r.year,
        rateeName:      r.rateeName,
        divisionName:   r.divisionName,
        positionLevel:  r.positionLevel,
        cbcScore:       r.cbcScore     || null,
        cbcBaseScore:   r.cbcBaseScore || null,
        cbcNteLevel:    r.cbcNteLevel || 'none',
        cbcNteDeductionPct: ntePct || null,
        cbcOffenseLevel: r.cbcOffenseLevel || 'none',
        cbcOffenseDeduction: offenseDeduction || null,
        cbcDeductionHasDeduction: hasCbcDeduction,
        cbcDeductionVisible: hasCbcDeduction,
        cbcDeductionSummary: {
          hasDeduction: hasCbcDeduction,
          nteLevel: r.cbcNteLevel || 'none',
          ntePct,
          offenseLevel: r.cbcOffenseLevel || 'none',
          offenseDeduction,
          finalOverallDeduction: offenseDeduction,
          baseScore: r.cbcBaseScore || r.cbcScore || null,
          adjustedScore: r.cbcScore || null,
          cbcWeightedScore: cbcWeightedScore !== null ? Math.round(cbcWeightedScore * 100) / 100 : null
        },
        fpoScore:       r.fpoScore     || null,
        jfScore:        r.jfScore      || null,
        overallScore:   r.overallScore || null,
        descriptor:     r.descriptor   || null,
        status:         r.status,
        totalRaters,
        completedRaters,
        pendingRaters,
        allComplete
      }
    })
  }

  // ── DELETE ALL ASSIGNMENTS FOR A PERIOD (admin, to regenerate) ────────────

  // Dry run for deleteForPeriod. Destructive maintenance routes follow a
  // GET-preview-then-POST-confirm pattern (see DatabaseMaintenanceService), so an
  // administrator can see exactly what a reset would remove before running it.
  function previewDeleteForPeriod(params, user) {
    const profile = AuthService.getProfile(user)
    if (profile.role !== 'System Administrator') {
      throw HttpError('Unauthorized - System Administrator required', 403)
    }

    const sem = String(params.semester || '')
    const yr  = String(params.year || '')
    if (!sem || !yr) throw HttpError('semester and year are required', 400)

    const counts = {}
    const countIn = (sheetName, filter) => {
      try {
        counts[sheetName] = SpreadsheetService
          .getAllRows(SpreadsheetService.getSheet(sheetName))
          .filter(filter).length
      } catch (e) { counts[sheetName] = 0 }
    }

    const inPeriod = r => String(r.semester) === sem && String(r.year) === yr
    countIn(SHEET.IPAT_ASSIGNMENTS, inPeriod)
    countIn(SHEET.IPAT_RECORDS,     inPeriod)
    countIn(SHEET.IPAT_CBC_RATINGS, inPeriod)
    countIn(SHEET.IPAT_JF_RATINGS,  inPeriod)


    const total = Object.keys(counts).reduce((s, k) => s + counts[k], 0)
    return {
      semester: sem,
      year: yr,
      counts,
      total,
      destructive: true,
      confirmationRequired: 'RESET ' + sem + ' ' + yr,
      warning: 'This permanently removes every IPAT assignment, record, rating and ' +
               'development plan for the period. Submitted ratings are NOT recoverable ' +
               'from the application. Take a spreadsheet backup first.'
    }
  }

  function deleteForPeriod(semester, year, user) {
    const profile = AuthService.getProfile(user)
    if (!['System Administrator'].includes(profile.role)) throw HttpError('Unauthorized - System Administrator required', 403)

    const sem = String(semester)
    const yr  = String(year)
    const counts = {}

    function purgeSheet(sheetName, semField, yearField) {
      try {
        const sheet = SpreadsheetService.getSheet(sheetName)
        const rows  = SpreadsheetService.getAllRows(sheet).filter(r =>
          String(r[semField]) === sem && String(r[yearField]) === yr
        )
        rows.forEach(r => { try { SpreadsheetService.hardDeleteRow(sheet, r.id) } catch(e) {} })
        counts[sheetName] = rows.length
      } catch(e) { counts[sheetName] = 0 }
    }

    purgeSheet(SHEET.IPAT_ASSIGNMENTS,  'semester', 'year')
    purgeSheet(SHEET.IPAT_RECORDS,      'semester', 'year')
    purgeSheet(SHEET.IPAT_CBC_RATINGS,  'semester', 'year')
    purgeSheet(SHEET.IPAT_JF_RATINGS,   'semester', 'year')

    const total = Object.values(counts).reduce((s, n) => s + n, 0)
    AuditService.log('RESET_PERIOD', 'IPAT',
      `Reset all IPAT data for Semester ${sem} ${yr}: ${JSON.stringify(counts)} (${total} rows total)`, user)
    return { deleted: total, counts }
  }

  return {
    generateAssignments,
    getMyRatees,
    getMyResults,
    getRateeAssignments,
    list,
    markCompleted,
    submitAssignmentRatings,
    previewDeleteForPeriod,
    deleteForPeriod
  }
})()
