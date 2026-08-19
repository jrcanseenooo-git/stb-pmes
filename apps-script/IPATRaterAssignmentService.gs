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
  const isEvaluatable   = (r) => roleOf(r) !== 'System Administrator' && !!roleOf(r)
  const isObsoleteAssignment = (r) => ['JFPeer', 'JobFitnessPeer'].includes(String(r && r.raterType || ''))
  const activeProtocolAssignments = (rows) => rows.filter(r => !isObsoleteAssignment(r))

  function normalizeEmail_(value) {
    return String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase()
  }

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
  // every submission cluster-wide queues here. That is acceptable because the
  // critical section is short, but it means a submission burst - a deadline
  // afternoon, say - can pile up.
  //
  // Two things make that survivable:
  //   1. A longer total wait, taken in staggered attempts rather than one block.
  //      Jitter spreads the retry storm out instead of having every waiter wake
  //      up and collide at the same instant.
  //   2. Even when the wait is exhausted the caller gets a 429, which the client
  //      surfaces as "try again" - never a partial write.
  const LOCK_ATTEMPTS   = 3
  const LOCK_WAIT_MS    = 15000   // per attempt; ~45s total worst case
  const LOCK_JITTER_MS  = 400

  function withRatingWriteLock(work) {
    const lock = LockService.getScriptLock()
    let acquired = false

    for (let attempt = 0; attempt < LOCK_ATTEMPTS && !acquired; attempt++) {
      acquired = lock.tryLock(LOCK_WAIT_MS)
      if (!acquired && attempt < LOCK_ATTEMPTS - 1) {
        // Randomised pause so simultaneous waiters do not retry in lockstep.
        Utilities.sleep(Math.floor(Math.random() * LOCK_JITTER_MS))
      }
    }

    if (!acquired) {
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

  // ── GENERATE ASSIGNMENTS ─────────────────────────────────────────────────

  function generateAssignments(body, user) {
    const profile = AuthService.getProfile(user)
    if (profile.role !== 'System Administrator') {
      throw HttpError('Only the System Administrator can generate evaluation assignments', 403)
    }

    const semester = String(body.semester || '')
    const year     = String(body.year     || '')
    if (!semester || !year) throw HttpError('semester and year are required', 400)

    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    const existingAssign = SpreadsheetService.getAllRows(assignSheet).filter(r =>
      _samePeriod(r, semester, year)
    )

    // All active users
    const usersSheet = SpreadsheetService.getSheet(SHEET.USERS)
    const allUsers = SpreadsheetService.getAllRows(usersSheet).filter(u => {
      const active = u.active
      return active === true || active === 'true' || active === 1 || active === '1'
    })

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
    const replacedAssignments = []
    const evaluatable = allUsers.filter(u => isEvaluatable(u.role))
    const touchedRateeIds = new Set()
    const createdRecordIds = new Set()

    // Rater rules now come from the per-office RaterMatrix rather than the five
    // hardcoded STB role branches this replaced. An office using its own role
    // names no longer falls through to an empty list and a silent skip.
    const matrixRows = _loadMatrixRows(body, user)
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
        return
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

      if (!ipatRecord) {
        // Derived from the matrix, not from the STB role names. This flag drives
        // the CBC weight split - with a subordinate the weights are Self/Peer/
        // Subordinate 15 each; without one the subordinate's 15% moves to a
        // second peer. Reading it from the resolved rater set means an office
        // with its own hierarchy gets the correct split automatically.
        const hasSubordinate = raterList.some(r => r.raterType === 'Subordinate')
        const newId = SpreadsheetService.generateId('IPAT-')
        const newRec = {
          id:            newId,
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
        SpreadsheetService.appendRow(ipatSheet, newRec)
        existingRec.push(newRec)
        ipatRecord = newRec
        createdRecordIds.add(newRec.id)
      }

      const existingForRatee = existingAssign.filter(a => String(a.rateeId) === String(ratee.id))
      const existingByRole = {}
      existingForRatee.forEach(a => {
        if (!existingByRole[a.raterType]) existingByRole[a.raterType] = a
      })

      // Store only missing rater roles. Existing assignments and submitted
      // ratings are preserved, so admins can safely backfill late accounts.
      raterList.forEach(a => {
        const existingAssignment = existingByRole[a.raterType]
        if (existingAssignment) {
          if (_canReplacePendingRater(existingAssignment, a)) {
            SpreadsheetService.updateRow(assignSheet, existingAssignment.id, {
              raterId: a.raterId,
              raterName: a.raterName,
              updatedAt: now
            })
            existingAssignment.raterId = a.raterId
            existingAssignment.raterName = a.raterName
            existingAssignment.updatedAt = now
            replacedAssignments.push(existingAssignment)
            touchedRateeIds.add(ratee.id)
          }
          return
        }
        const newAssignment = {
          id:             SpreadsheetService.generateId('RASN-'),
          semester,
          year,
          rateeId:        ratee.id,
          rateeName:      ratee.fullName,
          rateeDivisionId: ratee.divisionId || '',
          rateeRole:      role,
          rateeSection:   ratee.section     || '',
          raterId:        a.raterId,
          raterName:      a.raterName,
          raterType:      a.raterType,
          ipatRecordId:   ipatRecord.id,
          status:         'Pending',
          createdAt:      now,
          updatedAt:      now
        }
        assignments.push(newAssignment)
        existingByRole[a.raterType] = newAssignment
        touchedRateeIds.add(ratee.id)
      })
    })

    assignments.forEach(a => SpreadsheetService.appendRow(assignSheet, a))

    AuditService.log('GENERATE_ASSIGNMENTS', 'IPAT',
      `Generated/backfilled ${assignments.length} rater assignments for Semester ${semester} ${year}`, user)

    const breakdown = {}
    assignments.forEach(a => { breakdown[a.raterType] = (breakdown[a.raterType] || 0) + 1 })
    replacedAssignments.forEach(a => { breakdown[a.raterType] = (breakdown[a.raterType] || 0) + 1 })

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
      replaced:   replacedAssignments.length,
      ratees:     touchedRateeIds.size,
      recordsCreated: createdRecordIds.size,
      existing:   new Set(existingAssign.map(a => a.rateeId)).size,
      breakdown,
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
    const identity = profileRosterIdentity_(profile)
    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)

    let rows = activeProtocolAssignments(SpreadsheetService.getAllRows(assignSheet)).filter(r =>
      rowBelongsToProfile_(r, identity).rater
    )
    if (params.semester) rows = rows.filter(r => String(r.semester) === String(params.semester))
    if (params.year)     rows = rows.filter(r => String(r.year) === String(params.year))
    if (params.status)   rows = rows.filter(r => r.status === params.status)

    // Attach IPAT record scores for context without re-reading the sheet per task.
    const ipatSheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const recordsById = {}
    SpreadsheetService.getAllRows(ipatSheet).forEach(r => {
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
      const isAdmin = AuthService.hasPermission(profile, 'generate_ipat_assignments') ||
                      AuthService.hasPermission(profile, 'view_bureau_monitoring')
      if (!isAdmin) throw HttpError('Unauthorized', 403)
    }
    return completeAssignmentFromRows(assignSheet, assignmentId, row, rows, user)
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
      const isAdmin = AuthService.hasPermission(profile, 'generate_ipat_assignments') ||
                      AuthService.hasPermission(profile, 'view_bureau_monitoring')
      if (!isAdmin) throw HttpError('Unauthorized', 403)
    }
    if (!row.ipatRecordId) throw HttpError('Assignment has no linked assessment record', 400)
    if (String(row.status || 'Pending') === 'Completed') {
      throw HttpError('This rating assignment has already been submitted.', 409)
    }

    let cbcRatings = body.cbcRatings || []
    let jfRatings  = body.jfRatings  || []
    if (typeof cbcRatings === 'string') { try { cbcRatings = JSON.parse(cbcRatings) } catch(e) { cbcRatings = [] } }
    if (typeof jfRatings  === 'string') { try { jfRatings  = JSON.parse(jfRatings)  } catch(e) { jfRatings  = [] } }
    if (!Array.isArray(cbcRatings)) cbcRatings = []
    if (!Array.isArray(jfRatings))  jfRatings  = []

    // The unlocked variants: this runs inside withRatingWriteLock already, and
    // the locking entry points would try to take the same script lock a second
    // time in one execution. Keeping the whole submission - both rating sets
    // and the assignment row below - under the single outer lock is also what
    // stops a submission from half-applying.
    if (cbcRatings.length) IPATService.saveCBCRatingsUnlocked(row.ipatRecordId, { ratings: cbcRatings }, user)
    if (jfRatings.length)  IPATService.saveJFRatingsUnlocked(row.ipatRecordId, { ratings: jfRatings }, user)

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
    const identity    = profileRosterIdentity_(profile)
    IPATService.ensureRecordSchema()
    const recSheet    = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)

    let rows = SpreadsheetService.getAllRows(recSheet).filter(r =>
      rowBelongsToProfile_(r, identity).ratee
    )
    if (params.semester) rows = rows.filter(r => String(r.semester) === String(params.semester))
    if (params.year)     rows = rows.filter(r => String(r.year)     === String(params.year))

    const allAssignments = activeProtocolAssignments(SpreadsheetService.getAllRows(assignSheet))
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
