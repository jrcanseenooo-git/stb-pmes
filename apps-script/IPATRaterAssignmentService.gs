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
  const isStaff         = (r) => ['Staff', 'Technical Staff', 'Administrative Staff'].includes(r)
  const isSectionHead   = (r) => r === 'Section Head'
  const isDivisionChief = (r) => r === 'Division Chief'
  const isABD           = (r) => r === 'Assistant Bureau Director'
  const isDirector      = (r) => r === 'Bureau Director'
  const isEvaluatable   = (r) => r !== 'System Administrator' && !!r
  const isObsoleteAssignment = (r) => ['JFPeer', 'JobFitnessPeer'].includes(String(r && r.raterType || ''))
  const activeProtocolAssignments = (rows) => rows.filter(r => !isObsoleteAssignment(r))

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

    // Same-section pool — if ratee has no section set, treat whole division as the section
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

    // Peer — co-Section Head in same division
    const shPeers = allUsers.filter(u => u.id !== ratee.id && isSectionHead(u.role) && (u.divisionId || '') === div)
    const peer = _selectRandom(shPeers, [ratee.id], _prevRaterId(prevAssign, ratee.id, 'Peer'))

    // Subordinate — Technical Staff in same section; fallback to any staff in division
    const subordinates = sec
      ? allUsers.filter(u => isStaff(u.role) && (u.divisionId || '') === div && (u.section || '').trim() === sec)
      : allUsers.filter(u => isStaff(u.role) && (u.divisionId || '') === div)
    const subordinate = _selectRandom(subordinates, [], _prevRaterId(prevAssign, ratee.id, 'Subordinate'))

    // Supervisor — Division Chief of same division
    const supervisor = allUsers.find(u => isDivisionChief(u.role) && u.divisionId === div)

    // Skip Supervisor — any ABD
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

    // Peer — other Division Chiefs
    const dcPeers = allUsers.filter(u => u.id !== ratee.id && isDivisionChief(u.role))
    const peer = _selectRandom(dcPeers, [ratee.id], _prevRaterId(prevAssign, ratee.id, 'Peer'))

    // Subordinate — random Section Head in same division
    const subordinates = allUsers.filter(u => isSectionHead(u.role) && u.divisionId === div)
    const subordinate = _selectRandom(subordinates, [], _prevRaterId(prevAssign, ratee.id, 'Subordinate'))

    // Supervisor — any ABD
    const supervisor = allUsers.find(u => isABD(u.role))

    // Skip Supervisor — Bureau Director
    const skipSupervisor = allUsers.find(u => isDirector(u.role))

    const result = [{ raterId: ratee.id, raterName: ratee.fullName, raterType: 'Self' }]
    if (peer)          result.push({ raterId: peer.id,          raterName: peer.fullName,          raterType: 'Peer' })
    if (subordinate)   result.push({ raterId: subordinate.id,   raterName: subordinate.fullName,   raterType: 'Subordinate' })
    if (supervisor)    result.push({ raterId: supervisor.id,    raterName: supervisor.fullName,    raterType: 'Supervisor' })
    if (skipSupervisor) result.push({ raterId: skipSupervisor.id, raterName: skipSupervisor.fullName, raterType: 'SkipSupervisor' })
    return result
  }

  function _assignForABD(ratee, allUsers, prevAssign) {
    // Peer — other ABDs
    const abdPeers = allUsers.filter(u => u.id !== ratee.id && isABD(u.role))
    const peer = _selectRandom(abdPeers, [ratee.id], _prevRaterId(prevAssign, ratee.id, 'Peer'))

    // Subordinate — random Division Chief
    const subordinates = allUsers.filter(u => isDivisionChief(u.role))
    const subordinate = _selectRandom(subordinates, [], _prevRaterId(prevAssign, ratee.id, 'Subordinate'))

    // Supervisor — Bureau Director
    const supervisor = allUsers.find(u => isDirector(u.role))

    const result = [{ raterId: ratee.id, raterName: ratee.fullName, raterType: 'Self' }]
    if (peer)       result.push({ raterId: peer.id,       raterName: peer.fullName,       raterType: 'Peer' })
    if (subordinate) result.push({ raterId: subordinate.id, raterName: subordinate.fullName, raterType: 'Subordinate' })
    if (supervisor)  result.push({ raterId: supervisor.id,  raterName: supervisor.fullName,  raterType: 'Supervisor' })
    return result
  }

  function _assignForDirector(ratee, allUsers, prevAssign) {
    // Subordinate — random ABD
    const subordinates = allUsers.filter(u => isABD(u.role))
    const subordinate = _selectRandom(subordinates, [], _prevRaterId(prevAssign, ratee.id, 'Subordinate'))

    const result = [{ raterId: ratee.id, raterName: ratee.fullName, raterType: 'Self' }]
    if (subordinate) result.push({ raterId: subordinate.id, raterName: subordinate.fullName, raterType: 'Subordinate' })
    return result
  }

  // ── GENERATE ASSIGNMENTS ─────────────────────────────────────────────────

  function generateAssignments(body, user) {
    const profile = AuthService.getProfile(user)
    if (!AuthService.hasPermission(profile, 'generate_ipat_assignments')) {
      throw HttpError('Only administrators can generate evaluation assignments', 403)
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

    evaluatable.forEach(ratee => {
      const role = ratee.role || ''
      let raterList = []

      if (isStaff(role))         raterList = _assignForStaff(ratee, allUsers, prevAssign)
      else if (isSectionHead(role))   raterList = _assignForSectionHead(ratee, allUsers, prevAssign)
      else if (isDivisionChief(role)) raterList = _assignForDivisionChief(ratee, allUsers, prevAssign)
      else if (isABD(role))           raterList = _assignForABD(ratee, allUsers, prevAssign)
      else if (isDirector(role))      raterList = _assignForDirector(ratee, allUsers, prevAssign)

      if (!raterList.length) return

      // Auto-create IPAT record if not yet existing for this period
      let ipatRecord = _findCanonicalIpatRecord(existingRec, existingAssign, ratee.id, semester, year)

      if (!ipatRecord) {
        const hasSubordinate = isSectionHead(role) || isDivisionChief(role) || isABD(role) || isDirector(role)
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

    return {
      generated:  assignments.length,
      replaced:   replacedAssignments.length,
      ratees:     touchedRateeIds.size,
      recordsCreated: createdRecordIds.size,
      existing:   new Set(existingAssign.map(a => a.rateeId)).size,
      breakdown,
      semester,
      year
    }
  }

  // ── GET MY RATING TASKS (who I am assigned to rate) ──────────────────────

  function getMyRatees(params, user) {
    const profile = AuthService.getProfile(user)
    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)

    let rows = activeProtocolAssignments(SpreadsheetService.getAllRows(assignSheet)).filter(r => String(r.raterId) === String(profile.id))
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
    return rows
  }

  // ── MARK ASSIGNMENT COMPLETED ─────────────────────────────────────────────

  function markCompleted(assignmentId, user) {
    const profile = AuthService.getProfile(user)
    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    const rows = SpreadsheetService.getAllRows(assignSheet)
    const row = rows.find(r => r.id === assignmentId)
    if (!row) throw HttpError('Assignment not found', 404)
    if (isObsoleteAssignment(row)) throw HttpError('This assignment is no longer active under the current protocol', 400)
    if (row.raterId !== profile.id) {
      const isAdmin = AuthService.hasPermission(profile, 'generate_ipat_assignments') ||
                      AuthService.hasPermission(profile, 'view_bureau_monitoring')
      if (!isAdmin) throw HttpError('Unauthorized', 403)
    }
    return completeAssignmentFromRows(assignSheet, assignmentId, row, rows, user)
  }

  function submitAssignmentRatings(assignmentId, body, user) {
    const profile = AuthService.getProfile(user)
    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    const rows = SpreadsheetService.getAllRows(assignSheet)
    const row = rows.find(r => r.id === assignmentId)
    if (!row) throw HttpError('Assignment not found', 404)
    if (isObsoleteAssignment(row)) throw HttpError('This assignment is no longer active under the current protocol', 400)
    if (row.raterId !== profile.id) {
      const isAdmin = AuthService.hasPermission(profile, 'generate_ipat_assignments') ||
                      AuthService.hasPermission(profile, 'view_bureau_monitoring')
      if (!isAdmin) throw HttpError('Unauthorized', 403)
    }
    if (!row.ipatRecordId) throw HttpError('Assignment has no linked assessment record', 400)

    let cbcRatings = body.cbcRatings || []
    let jfRatings  = body.jfRatings  || []
    if (typeof cbcRatings === 'string') { try { cbcRatings = JSON.parse(cbcRatings) } catch(e) { cbcRatings = [] } }
    if (typeof jfRatings  === 'string') { try { jfRatings  = JSON.parse(jfRatings)  } catch(e) { jfRatings  = [] } }
    if (!Array.isArray(cbcRatings)) cbcRatings = []
    if (!Array.isArray(jfRatings))  jfRatings  = []

    if (cbcRatings.length) IPATService.saveCBCRatings(row.ipatRecordId, { ratings: cbcRatings }, user)
    if (jfRatings.length)  IPATService.saveJFRatings(row.ipatRecordId, { ratings: jfRatings }, user)

    const completed = completeAssignmentFromRows(assignSheet, assignmentId, row, rows, user)
    return {
      ...completed,
      savedCBC: cbcRatings.length,
      savedJF: jfRatings.length,
      ipatRecordId: row.ipatRecordId
    }
  }

  // ── GET MY OWN RESULTS (ratee views their final score) ───────────────────
  // Section 2: "The person being rated shall be able to view the final ratings."

  function getMyResults(params, user) {
    const profile     = AuthService.getProfile(user)
    IPATService.ensureRecordSchema()
    const recSheet    = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)

    let rows = SpreadsheetService.getAllRows(recSheet).filter(r => String(r.rateeId) === String(profile.id))
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

      // Auto-compute on first view if all raters are done but scores are missing or incomplete
      const needsCompute = allComplete && (!r.cbcScore || !r.overallScore || (r.cbcScore && !r.jfScore))
      if (needsCompute) {
        try {
          IPATService.computeCBC(r.id, user)
          try { IPATService.computeJF(r.id, user) } catch (je) {
            Logger.log('[PMES] getMyResults computeJF skipped: ' + je.message)
          }
          IPATService.computeOverall(r.id, user)
          const freshRec = SpreadsheetService.getRow(recSheet, r.id)
          if (freshRec) r = freshRec
        } catch (e) {
          Logger.log('[PMES] getMyResults auto-compute failed for ' + r.id + ': ' + e.message)
        }
      }

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

  function deleteForPeriod(semester, year, user) {
    const profile = AuthService.getProfile(user)
    if (!['System Administrator'].includes(profile.role)) throw HttpError('Unauthorized — System Administrator required', 403)

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

    // Collect IPAT record IDs first (needed for EDAP which links via ipatId)
    var recSheet = null
    var periodRecordIds = new Set()
    try {
      recSheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
      SpreadsheetService.getAllRows(recSheet).forEach(function(r) {
        if (String(r.semester) === sem && String(r.year) === yr) periodRecordIds.add(r.id)
      })
    } catch(e) {}

    purgeSheet(SHEET.IPAT_ASSIGNMENTS,  'semester', 'year')
    purgeSheet(SHEET.IPAT_RECORDS,      'semester', 'year')
    purgeSheet(SHEET.IPAT_CBC_RATINGS,  'semester', 'year')
    purgeSheet(SHEET.IPAT_JF_RATINGS,   'semester', 'year')

    // EDAP links via ipatId, not semester/year
    try {
      var edapSheet = SpreadsheetService.getSheet(SHEET.IPAT_EDAP)
      var edapRows  = SpreadsheetService.getAllRows(edapSheet).filter(function(r) { return periodRecordIds.has(r.ipatId) })
      edapRows.forEach(function(r) { try { SpreadsheetService.hardDeleteRow(edapSheet, r.id) } catch(e) {} })
      counts[SHEET.IPAT_EDAP] = edapRows.length
    } catch(e) { counts[SHEET.IPAT_EDAP] = 0 }

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
    deleteForPeriod
  }
})()
