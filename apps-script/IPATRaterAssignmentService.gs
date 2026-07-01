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
    const hit = prevAssignments.find(a => a.rateeId === rateeId && a.raterType === raterType)
    return hit ? hit.raterId : null
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

    // Supervisor: Section Head in same section + division; fallback to any SH in division
    let supervisor = sec
      ? allUsers.find(u => isSectionHead(u.role) && (u.divisionId || '') === div && (u.section || '').trim() === sec)
      : null
    if (!supervisor) supervisor = allUsers.find(u => isSectionHead(u.role) && (u.divisionId || '') === div)

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
    if (!['System Administrator', 'Bureau Director', 'Assistant Bureau Director'].includes(profile.role)) {
      throw HttpError('Only administrators can generate evaluation assignments', 403)
    }

    const semester = String(body.semester || '')
    const year     = String(body.year     || '')
    if (!semester || !year) throw HttpError('semester and year are required', 400)

    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    const existing = SpreadsheetService.getAllRows(assignSheet).filter(r =>
      String(r.semester) === semester && String(r.year) === year
    )
    if (existing.length) {
      throw HttpError(
        `Assignments already exist for Semester ${semester}, ${year}. Delete them first to regenerate.`,
        409
      )
    }

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
      r.semester === prevSem && String(r.year) === prevYear
    )

    const ipatSheet   = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const existingRec = SpreadsheetService.getAllRows(ipatSheet)
    const now = new Date().toISOString()

    const assignments = []
    const evaluatable = allUsers.filter(u => isEvaluatable(u.role))

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
      let ipatRecord = existingRec.find(r =>
        r.rateeId === ratee.id && r.semester === semester && String(r.year) === year
      )

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
          cbcScore: '', fpoScore: '', jfScore: '', overallScore: '', descriptor: '',
          ipcrfFormId: '',
          createdAt: now,
          updatedAt: now
        }
        SpreadsheetService.appendRow(ipatSheet, newRec)
        existingRec.push(newRec)
        ipatRecord = newRec
      }

      // Store each rater assignment
      raterList.forEach(a => {
        assignments.push({
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
        })
      })
    })

    assignments.forEach(a => SpreadsheetService.appendRow(assignSheet, a))

    AuditService.log('GENERATE_ASSIGNMENTS', 'IPAT',
      `Generated ${assignments.length} rater assignments for Semester ${semester} ${year}`, user)

    const breakdown = {}
    assignments.forEach(a => { breakdown[a.raterType] = (breakdown[a.raterType] || 0) + 1 })

    return {
      generated:  assignments.length,
      ratees:     evaluatable.length,
      breakdown,
      semester,
      year
    }
  }

  // ── GET MY RATING TASKS (who I am assigned to rate) ──────────────────────

  function getMyRatees(params, user) {
    const profile = AuthService.getProfile(user)
    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)

    let rows = SpreadsheetService.getAllRows(assignSheet).filter(r => r.raterId === profile.id)
    if (params.semester) rows = rows.filter(r => String(r.semester) === String(params.semester))
    if (params.year)     rows = rows.filter(r => String(r.year) === String(params.year))
    if (params.status)   rows = rows.filter(r => r.status === params.status)

    // Attach IPAT record scores for context
    const ipatSheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    return rows.map(a => {
      const rec = a.ipatRecordId
        ? SpreadsheetService.getAllRows(ipatSheet).find(r => r.id === a.ipatRecordId)
        : null
      return {
        ...a,
        ipatStatus:   rec?.status || 'Draft',
        overallScore: rec?.overallScore || null
      }
    })
  }

  // ── GET ASSIGNMENTS FOR A RATEE ───────────────────────────────────────────

  function getRateeAssignments(rateeId, params, user) {
    const profile = AuthService.getProfile(user)
    const isAdmin = ['System Administrator', 'Bureau Director', 'Assistant Bureau Director', 'Division Chief'].includes(profile.role)
    if (!isAdmin && profile.id !== rateeId) throw HttpError('Unauthorized', 403)

    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    let rows = SpreadsheetService.getAllRows(assignSheet).filter(r => r.rateeId === rateeId)
    if (params.semester) rows = rows.filter(r => String(r.semester) === String(params.semester))
    if (params.year)     rows = rows.filter(r => String(r.year) === String(params.year))
    return rows
  }

  // ── LIST ALL ASSIGNMENTS (admin) ──────────────────────────────────────────

  function list(params, user) {
    const profile = AuthService.getProfile(user)
    const isAdmin = ['System Administrator', 'Bureau Director', 'Assistant Bureau Director', 'Division Chief'].includes(profile.role)
    if (!isAdmin) throw HttpError('Unauthorized', 403)

    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    let rows = SpreadsheetService.getAllRows(assignSheet)
    if (params.semester) rows = rows.filter(r => String(r.semester) === String(params.semester))
    if (params.year)     rows = rows.filter(r => String(r.year) === String(params.year))
    if (params.rateeId)  rows = rows.filter(r => r.rateeId === params.rateeId)
    return rows
  }

  // ── MARK ASSIGNMENT COMPLETED ─────────────────────────────────────────────

  function markCompleted(assignmentId, user) {
    const profile = AuthService.getProfile(user)
    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    const row = SpreadsheetService.getAllRows(assignSheet).find(r => r.id === assignmentId)
    if (!row) throw HttpError('Assignment not found', 404)
    if (row.raterId !== profile.id) {
      const isAdmin = ['System Administrator', 'Bureau Director', 'Assistant Bureau Director'].includes(profile.role)
      if (!isAdmin) throw HttpError('Unauthorized', 403)
    }
    SpreadsheetService.updateRow(assignSheet, assignmentId, { status: 'Completed', updatedAt: new Date().toISOString() })

    // Auto-compute scores when every rater for this IPAT record has submitted
    const ipatRecordId = row.ipatRecordId
    if (ipatRecordId) {
      const allForRecord = SpreadsheetService.getAllRows(assignSheet).filter(r => r.ipatRecordId === ipatRecordId)
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

  // ── GET MY OWN RESULTS (ratee views their final score) ───────────────────
  // Section 2: "The person being rated shall be able to view the final ratings."

  function getMyResults(params, user) {
    const profile     = AuthService.getProfile(user)
    const recSheet    = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)

    let rows = SpreadsheetService.getAllRows(recSheet).filter(r => r.rateeId === profile.id)
    if (params.semester) rows = rows.filter(r => String(r.semester) === String(params.semester))
    if (params.year)     rows = rows.filter(r => String(r.year)     === String(params.year))

    const allAssignments = SpreadsheetService.getAllRows(assignSheet)

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

      return {
        id:             r.id,
        semester:       r.semester,
        year:           r.year,
        rateeName:      r.rateeName,
        divisionName:   r.divisionName,
        positionLevel:  r.positionLevel,
        cbcScore:       r.cbcScore     || null,
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

    const assignSheet = SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS)
    const toDelete = SpreadsheetService.getAllRows(assignSheet).filter(r =>
      String(r.semester) === String(semester) && String(r.year) === String(year)
    )
    toDelete.forEach(r => SpreadsheetService.hardDeleteRow(assignSheet, r.id))

    AuditService.log('DELETE_ASSIGNMENTS', 'IPAT',
      `Deleted ${toDelete.length} assignments for Semester ${semester} ${year}`, user)
    return { deleted: toDelete.length }
  }

  return {
    generateAssignments,
    getMyRatees,
    getMyResults,
    getRateeAssignments,
    list,
    markCompleted,
    deleteForPeriod
  }
})()
