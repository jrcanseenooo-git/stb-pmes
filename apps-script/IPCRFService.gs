const IpcrfService = (() => {

  const STATUS_FLOW = {
    'Draft':     ['Submitted'],
    'Submitted': ['Approved', 'Returned'],
    'Returned':  ['Submitted'],
    'Approved':  ['Rated', 'Returned'],
    'Rated':     ['Finalized', 'Returned'],
    'Finalized': []
  }

  // ─────────────────────────────────────────────
  // IPCRF FORMS CRUD
  // ─────────────────────────────────────────────

  function list(params, user) {
    const profile   = AuthService.getProfile(user)
    const sheet     = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    let rows        = SpreadsheetService.getAllRows(sheet)

    // Build userId → section lookup from Users sheet (for backfill of existing rows)
    const usersSheet  = SpreadsheetService.getSheet(SHEET.USERS)
    const usersRows   = SpreadsheetService.getAllRows(usersSheet)
    const sectionMap  = {}
    usersRows.forEach(u => { if (u.id) sectionMap[u.id] = u.section || '' })

    // Scope by role and focal assignment
    if (!['System Administrator', 'Bureau Director', 'Assistant Bureau Director'].includes(profile.role)) {
      if (FocalAssignmentService.isBureauFocal(profile)) {
        rows = rows.filter(r => r.status !== 'Draft' || r.userId === profile.id)
      } else if (profile.role === 'Division Chief' || _isDivisionFocalForProfile(profile)) {
        rows = rows.filter(r => r.divisionId === profile.divisionId)
      } else if (profile.role === 'Section Head') {
        rows = rows.filter(r => r.divisionId === profile.divisionId &&
          (r.sectionName || sectionMap[r.userId] || '') === profile.section)
      } else {
        rows = rows.filter(r => r.userId === profile.id)
      }
    }

    if (params.userId)     rows = rows.filter(r => r.userId     === params.userId)
    if (params.year)       rows = rows.filter(r => String(r.year) === String(params.year))
    if (params.status)     rows = rows.filter(r => r.status     === params.status)
    if (params.divisionId) rows = rows.filter(r => r.divisionId === params.divisionId)
    if (params.type)       rows = rows.filter(r => r.type       === params.type)

    // Attach sectionName — prefer stored value, fall back to live user lookup
    rows = rows.map(r => ({
      ...r,
      sectionName: r.sectionName || sectionMap[r.userId] || '',
      canReview: _canReviewForm(r, profile)
    }))

    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  function get(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('IPCRF form not found', 404)
    _guardAccess(row, profile)

    // Backfill sectionName from Users sheet if not stored on the row
    if (!row.sectionName) {
      const usersSheet = SpreadsheetService.getSheet(SHEET.USERS)
      const owner      = SpreadsheetService.getAllRows(usersSheet).find(u => u.id === row.userId)
      row.sectionName  = owner ? (owner.section || '') : ''
    }

    // Attach form entries
    row.entries = _getEntries(id)
    return row
  }

  function reviewQueue(params, user) {
    const profile = AuthService.getProfile(user)
    const sheet = _ipcrfFormsSheet()
    const usersSheet = SpreadsheetService.getSheet(SHEET.USERS)
    const usersRows = SpreadsheetService.getAllRows(usersSheet)
    const sectionMap = {}
    usersRows.forEach(u => { if (u.id) sectionMap[u.id] = u.section || '' })

    let rows = SpreadsheetService.getAllRows(sheet)
      .map(r => ({
        ...r,
        sectionName: r.sectionName || sectionMap[r.userId] || '',
        canReview: _canReviewForm(r, profile)
      }))
      .filter(r => r.canReview)

    if (params.reviewType === 'targets') rows = rows.filter(r => r.status === 'Submitted')
    else if (params.reviewType === 'ratings') rows = rows.filter(r => ['Approved', 'Rated'].includes(r.status))
    else if (params.status) rows = rows.filter(r => r.status === params.status)
    else rows = rows.filter(r => ['Submitted', 'Approved', 'Rated'].includes(r.status))
    if (params.semester) rows = rows.filter(r => String(r.semester) === String(params.semester))
    if (params.year) rows = rows.filter(r => String(r.year) === String(params.year))
    if (params.type) rows = rows.filter(r => r.type === params.type)
    if (params.reviewType === 'targets' || params.reviewType === 'ratings') {
      rows = rows.filter(r => _isRoutedToReviewer(r, params.reviewType, profile))
    }

    rows.sort((a, b) => new Date(b.submittedAt || b.updatedAt || b.createdAt) - new Date(a.submittedAt || a.updatedAt || a.createdAt))
    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  function listReviewComments(formId, params, user) {
    const profile = AuthService.getProfile(user)
    const form = _getForm(formId)
    _guardAccess(form, profile)
    const reviewType = params.reviewType || _reviewTypeForForm(form)
    return SpreadsheetService.getAllRows(_reviewCommentsSheet())
      .filter(r => r.formId === formId && (!reviewType || r.reviewType === reviewType))
  }

  function saveReviewComments(formId, body, user) {
    const profile = AuthService.getProfile(user)
    const form = _getForm(formId)
    _assertApproverScope(form, profile)
    const reviewType = body.reviewType || _reviewTypeForForm(form)
    const comments = _parseComments(body.comments)
    const sheet = _reviewCommentsSheet()
    const now = new Date().toISOString()

    comments.forEach(item => {
      const entryId = item.entryId || ''
      if (!entryId) return
      const existing = SpreadsheetService.getAllRows(sheet).find(r =>
        r.formId === formId &&
        r.entryId === entryId &&
        r.reviewType === reviewType &&
        r.reviewerId === profile.id
      )
      const patch = {
        formId,
        entryId,
        reviewType,
        comment: item.comment || '',
        reviewerId: profile.id,
        reviewerName: profile.fullName || profile.email || '',
        updatedAt: now
      }
      if (existing) {
        SpreadsheetService.updateRow(sheet, existing.id, patch)
      } else {
        SpreadsheetService.appendRow(sheet, {
          id: SpreadsheetService.generateId('REVCOM-'),
          ...patch,
          createdAt: now
        })
      }
    })

    AuditService.log('SAVE_REVIEW_COMMENTS', 'IPCRF', `Saved review comments for ${formId}`, user)
    return listReviewComments(formId, { reviewType }, user)
  }

  function listAssignableReviewers(formId, params, user) {
    const profile = AuthService.getProfile(user)
    const form = _getForm(formId)
    _assertApproverScope(form, profile)

    const q = String(params.search || '').toLowerCase().trim()
    const rows = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.USERS))
      .filter(u => u.id && u.id !== form.userId)
      .filter(u => u.active !== false && String(u.active).toLowerCase() !== 'false')
      .filter(u => _canReviewForm(form, u))
      .map(u => ({
        id: u.id,
        fullName: _profileEmployeeName(u),
        email: u.email || '',
        role: u.role || '',
        divisionId: u.divisionId || '',
        divisionName: u.divisionName || '',
        tag: _reviewerTag(u, form)
      }))
      .filter(u => !q ||
        String(u.fullName || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.role || '').toLowerCase().includes(q) ||
        String(u.divisionName || '').toLowerCase().includes(q) ||
        String(u.tag || '').toLowerCase().includes(q)
      )
      .sort((a, b) => String(a.tag || a.role).localeCompare(String(b.tag || b.role)) || String(a.fullName).localeCompare(String(b.fullName)))

    return { items: rows.slice(0, 25), total: rows.length }
  }

  function create(body, user) {
    const profile = AuthService.getProfile(user)
    const now     = new Date().toISOString()

    // Prevent duplicate form per user per year/type
    const sheet    = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const _type = _formTypeForProfile(profile)
    const existing = SpreadsheetService.getAllRows(sheet).find(r =>
      r.userId   === (body.userId || profile.id) &&
      String(r.year) === String(body.year) &&
      r.type === _type
    )
    if (existing) throw HttpError(`An ${_type} form already exists for ${body.year}`, 409)

    // ── Derive position level and weights from user's position title ──
    // Never trust frontend input for these — always compute server-side.
    const _level   = PositionHelper.resolveLevel(profile.position || '')
    const _weights = PositionHelper.resolveWeights(profile)

    const form = {
      id:                    SpreadsheetService.generateId('FORM-'),
      type:                  _type,
      userId:                body.userId           || profile.id,
      employeeName:          body.employeeName     || _profileEmployeeName(profile),
      position:              profile.position      || '',
      positionLevel:         _level,
      divisionId:            profile.divisionId    || '',
      divisionName:          profile.divisionName  || '',
      sectionName:           profile.section       || '',
      year:                  body.year             || new Date().getFullYear(),
      status:                'Draft',
      coreFunctionWeight:    _weights.core,
      supportFunctionWeight: _weights.support,
      finalNumericalRating:  '',
      adjectivalRating:      '',
      immediateSupervisor:   body.immediateSupervisor  || '',
      supervisorPosition:    body.supervisorPosition   || '',
      approvingAuthority:    body.approvingAuthority   || '',
      authorityPosition:     body.authorityPosition    || '',
      dateSignedRatee:       '',
      dateSignedSupervisor:  '',
      dateSignedAuthority:   '',
      feedbackStrengths:           '',
      feedbackAreasForImprovement: '',
      feedbackComments:            '',
      feedbackRecommendations:     '',
      submittedAt:  '',
      approvedAt:   '',
      ratedAt:      '',
      finalizedAt:  '',
      createdAt:    now,
      updatedAt:    now
    }

    SpreadsheetService.appendRow(sheet, form)
    AuditService.log('CREATE', 'IPCRF', `Created IPCRF form ${form.id}`, user)
    return form
  }

  function update(id, body, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Form not found', 404)
    _guardAccess(row, profile)

    // Only allow editing Draft or Returned forms
    if (!['Draft', 'Returned'].includes(row.status)) {
      throw HttpError(`Cannot edit a form with status "${row.status}"`, 400)
    }

    // Strip protected fields
    const { id: _id, userId: _uid, status: _s, createdAt: _c, ...safe } = body
    const updated = SpreadsheetService.updateRow(sheet, id, { ...safe, updatedAt: new Date().toISOString() })
    AuditService.log('UPDATE', 'IPCRF', `Updated form ${id}: ${JSON.stringify(safe)}`, user)
    return updated
  }

  // ── Status transitions ──

  function submit(id, body, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = _ipcrfFormsSheet()
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Form not found', 404)
    _guardAccess(row, profile)
    if (row.userId !== profile.id) {
      throw HttpError('Only the form owner can submit it for review', 403)
    }
    _assertTransition(row.status, 'Submitted')

    const entries = _getEntries(id)
    if (entries.length === 0) throw HttpError('Cannot submit a form with no entries', 400)

    const route = _routeTargetForStage(row, 'targets', 'Division Focal')
    const updated = SpreadsheetService.updateRow(sheet, id, {
      status:      'Submitted',
      targetReviewStage: 'Division Focal',
      targetRoutedToUserId: route.userId,
      targetRoutedToName: route.userName,
      targetRoutedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      updatedAt:   new Date().toISOString()
    })
    AuditService.log('SUBMIT', 'IPCRF', `Submitted form ${id}`, user)
    // Clear any stale "assigned/routed to you" notifications from a prior review
    // cycle before notifying the division focal fresh — the form is back at the
    // start of the chain, so earlier reviewers are no longer the current holder.
    _obsoleteRouteNotifications(id)
    _notifyReviewers(updated, profile)
    return updated
  }

  function route(id, body, user) {
    const profile = AuthService.getProfile(user)
    const sheet = _ipcrfFormsSheet()
    const row = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Form not found', 404)
    _assertApproverScope(row, profile)

    const reviewType = body.reviewType || _reviewTypeForForm(row)
    const action = body.action || 'forward'
    const now = new Date().toISOString()

    if (action === 'return') return return_(id, body, user)
    if (action === 'assign') return _assignReviewRoute(sheet, row, body, profile, user, now)
    if (action === 'complete') return _completeReviewRoute(sheet, row, reviewType, profile, user, now)

    if (reviewType === 'targets') {
      if (row.status !== 'Submitted') throw HttpError('Only submitted targets can be routed.', 400)
      const stage = _routeStage(row, 'targets')
      _assertCurrentRouteReviewer(row, 'targets', profile)

      if (stage === 'Division Focal') {
        const next = _routeTargetForStage(row, 'targets', 'Bureau Focal')
        const updated = SpreadsheetService.updateRow(sheet, id, {
          targetReviewStage: 'Bureau Focal',
          targetRoutedToUserId: next.userId,
          targetRoutedToName: next.userName,
          targetRoutedAt: now,
          updatedAt: now
        })
        _notifyRouteRecipient(next.userId, `${row.employeeName}'s ${row.type} targets were routed to you for bureau review.`, id)
        AuditService.log('ROUTE_TARGETS', 'IPCRF', `Routed form ${id} targets to Bureau Focal`, user)
        return updated
      }

      const updated = SpreadsheetService.updateRow(sheet, id, {
        status: 'Approved',
        targetReviewStage: 'Completed',
        targetCompletedAt: now,
        approvedAt: now,
        updatedAt: now
      })
      _notifyUser(row.userId, 'approval', `Your ${row.type} targets were approved. You may prepare accomplishments and ratings for the rating period.`, id, 'IPCRF')
      AuditService.log('APPROVE_TARGETS_ROUTE', 'IPCRF', `Completed targets routing for ${id}`, user)
      return updated
    }

    if (!['Approved', 'Rated'].includes(row.status)) throw HttpError('Ratings review is available after targets are approved.', 400)
    const stage = _routeStage(row, 'ratings')
    _assertCurrentRouteReviewer(row, 'ratings', profile)

    if (stage === 'Division Focal') {
      const next = _routeTargetForStage(row, 'ratings', 'Bureau Focal')
      const updated = SpreadsheetService.updateRow(sheet, id, {
        ratingReviewStage: 'Bureau Focal',
        ratingRoutedToUserId: next.userId,
        ratingRoutedToName: next.userName,
        ratingRoutedAt: now,
        updatedAt: now
      })
      _notifyRouteRecipient(next.userId, `${row.employeeName}'s ${row.type} ratings were routed to you for bureau review.`, id)
      AuditService.log('ROUTE_RATINGS', 'IPCRF', `Routed form ${id} ratings to Bureau Focal`, user)
      return updated
    }

    if (stage === 'Bureau Focal') {
      const next = _routeTargetForStage(row, 'ratings', 'Division Chief')
      const updated = SpreadsheetService.updateRow(sheet, id, {
        ratingReviewStage: 'Division Chief',
        ratingRoutedToUserId: next.userId,
        ratingRoutedToName: next.userName,
        ratingRoutedAt: now,
        updatedAt: now
      })
      _notifyRouteRecipient(next.userId, `${row.employeeName}'s ${row.type} ratings are ready for Part II feedback and proposed intervention.`, id)
      AuditService.log('ROUTE_RATINGS', 'IPCRF', `Routed form ${id} ratings to Division Chief`, user)
      return updated
    }

    const updated = SpreadsheetService.updateRow(sheet, id, {
      status: 'Rated',
      ratingReviewStage: 'Completed',
      ratingCompletedAt: now,
      ratedAt: row.ratedAt || now,
      updatedAt: now
    })
    _notifyUser(row.userId, 'approval', `Your ${row.type} ratings review is complete. Please coordinate for printing, signing, and physical submission.`, id, 'IPCRF')
    AuditService.log('COMPLETE_RATINGS_ROUTE', 'IPCRF', `Completed ratings routing for ${id}`, user)
    return updated
  }

  function approve(id, body, user) {
    const profile = AuthService.getProfile(user)
    const sheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Form not found', 404)
    _assertApproverScope(row, profile)
    _assertTransition(row.status, 'Approved')

    const updated = SpreadsheetService.updateRow(sheet, id, {
      status:     'Approved',
      approvedAt: new Date().toISOString(),
      updatedAt:  new Date().toISOString()
    })
    AuditService.log('APPROVE', 'IPCRF', `Approved form ${id}`, user)
    return updated
  }

  function return_(id, body, user) {
    const profile = AuthService.getProfile(user)
    const sheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Form not found', 404)
    _assertApproverScope(row, profile)
    _assertTransition(row.status, 'Returned')

    _ensureColumns(sheet, ['returnRemarks', 'returnedBy', 'returnedAt'])
    const updated = SpreadsheetService.updateRow(sheet, id, {
      status:        'Returned',
      returnRemarks: body.remarks || '',
      returnedBy:    profile.fullName,
      returnedAt:    new Date().toISOString(),
      updatedAt:     new Date().toISOString()
    })
    AuditService.log('RETURN', 'IPCRF', `Returned form ${id}: ${body.remarks || ''}`, user)
    // The form has left the review chain — clear reviewers' now-stale routing
    // notifications so they don't see it "assigned" with an empty queue.
    _obsoleteRouteNotifications(id)
    _notifyUser(row.userId, 'revision',
      `Your ${row.type} form was returned for revision. ${body.remarks || ''}`,
      id, 'IPCRF'
    )
    return updated
  }

  function submitRatings(id, body, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Form not found', 404)
    if (row.userId !== profile.id) throw HttpError('Only the form owner can submit ratings for review.', 403)
    if (row.status === 'Rated') return row  // idempotent — already submitted
    _assertTransition(row.status, 'Rated')

    const updated = SpreadsheetService.updateRow(sheet, id, {
      status:    'Rated',
      ratedAt:   new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    AuditService.log('SUBMIT_RATINGS', 'IPCRF', 'Owner submitted ratings for form ' + id, user)
    _notifyRouteRecipient(
      row.ratingRoutedToUserId,
      row.employeeName + ' has submitted ' + row.type + ' ratings — ready for Division Chief review.',
      id
    )
    return updated
  }

  function rate(id, body, user) {
    const profile = AuthService.requireRole(user,
      'System Administrator', 'Bureau Director',
      'Assistant Bureau Director', 'Division Chief', 'Section Head'
    )
    const sheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Form not found', 404)
    _assertApproverScope(row, profile)
    if (!['Approved', 'Rated'].includes(row.status)) {
      throw HttpError('Cannot rate a form with status "' + row.status + '". Must be Approved or Rated.', 400)
    }

    const updated = SpreadsheetService.updateRow(sheet, id, {
      status:               'Rated',
      finalNumericalRating: body.finalNumericalRating || '',
      adjectivalRating:     body.adjectivalRating     || '',
      feedbackStrengths:           body.feedbackStrengths           || '',
      feedbackAreasForImprovement: body.feedbackAreasForImprovement || '',
      feedbackComments:            body.feedbackComments            || '',
      feedbackRecommendations:     body.feedbackRecommendations     || '',
      ratedAt:   new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    AuditService.log('RATE', 'IPCRF', `Rated form ${id}: ${body.finalNumericalRating} (${body.adjectivalRating})`, user)
    _autoRegenDoc(id, user)
    _notifyUser(row.userId, 'approval',
      `Your ${row.type} has been rated: ${body.finalNumericalRating} – ${body.adjectivalRating}`,
      id, 'IPCRF'
    )
    return updated
  }

  function finalize(id, body, user) {
    AuthService.requireRole(user,
      'System Administrator', 'Bureau Director', 'Assistant Bureau Director'
    )
    const sheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Form not found', 404)
    _assertTransition(row.status, 'Finalized')
    if (!row.finalNumericalRating) throw HttpError('Form has not been rated yet. A numerical rating must be recorded before finalizing.', 400)

    const updated = SpreadsheetService.updateRow(sheet, id, {
      status:               'Finalized',
      dateSignedRatee:      body.dateSignedRatee      || '',
      dateSignedSupervisor: body.dateSignedSupervisor || '',
      dateSignedAuthority:  body.dateSignedAuthority  || '',
      finalizedAt:  new Date().toISOString(),
      updatedAt:    new Date().toISOString()
    })
    AuditService.log('FINALIZE', 'IPCRF', `Finalized form ${id}`, user)
    _autoRegenDoc(id, user)
    return updated
  }

  // ── Compute Score ──
  function computeScore(id, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const form  = SpreadsheetService.getRow(sheet, id)
    if (!form) throw HttpError('Form not found', 404)

    const entries = _getEntries(id)
    if (entries.length === 0) {
      const updated = SpreadsheetService.updateRow(sheet, id, {
        finalNumericalRating: 0,
        adjectivalRating:     'Poor',
        updatedAt:            new Date().toISOString()
      })
      AuditService.log('COMPUTE_SCORE', 'IPCRF', `Computed score for form ${id}: 0 (Poor)`, user)
      return { ...updated, entryCount: 0, ratedCount: 0 }
    }

    // Group entries by function type and compute weighted averages
    const coreEntries    = entries.filter(e => e.functionType === 'Core')
    const supportEntries = entries.filter(e => e.functionType === 'Support')

    const coreWeight    = Number(form.coreFunctionWeight)    || 70
    const supportWeight = Number(form.supportFunctionWeight) || 30

    const avgRating = (list) => {
      const rated = list.filter(e => _entryAverage(e) !== null)
      if (!rated.length) return 0
      return rated.reduce((s, e) => s + Number(_entryAverage(e)), 0) / rated.length
    }

    const coreAvg    = avgRating(coreEntries)
    const supportAvg = avgRating(supportEntries)
    const total      = coreEntries.length + supportEntries.length
    const rated      = entries.filter(e => _entryAverage(e) !== null).length

    let score = 0
    if (coreEntries.length > 0 && supportEntries.length > 0) {
      score = (coreAvg * coreWeight + supportAvg * supportWeight) / 100
    } else if (coreEntries.length > 0) {
      score = coreAvg
    } else {
      score = supportAvg
    }
    score = Math.round(score * 100) / 100

    const label = _ratingLabel(score)

    // Persist computed score back to the form
    const updated = SpreadsheetService.updateRow(sheet, id, {
      finalNumericalRating: score,
      adjectivalRating:     label,
      updatedAt:            new Date().toISOString()
    })

    AuditService.log('COMPUTE_SCORE', 'IPCRF', `Computed score for form ${id}: ${score} (${label})`, user)
    _autoRegenDoc(id, user)
    return { ...updated, entryCount: total, ratedCount: rated }
  }

  // ─────────────────────────────────────────────
  // FORM ENTRIES (KRA rows)
  // ─────────────────────────────────────────────

  function listEntries(formId, user) {
    const profile = AuthService.getProfile(user)
    const form    = _getForm(formId)
    _guardAccess(form, profile)
    return _getEntries(formId)
  }

  function addEntry(formId, body, user) {
    const profile = AuthService.getProfile(user)
    const form    = _getForm(formId)
    _guardAccess(form, profile)

    if (!['Draft', 'Returned'].includes(form.status)) {
      throw HttpError('Cannot add entries to a submitted or finalized form', 400)
    }

    const now   = new Date().toISOString()
    const sheet = SpreadsheetService.getSheet(SHEET.FORM_ENTRIES)
    const entry = {
      id:                     SpreadsheetService.generateId('FE-'),
      formId,
      masterKRAId:            body.masterKRAId            || '',
      functionType:           body.functionType           || 'Core',
      kraName:                body.kraName                || '',
      successIndicator:       body.successIndicator       || '',
      applicableRatingPeriod: body.applicableRatingPeriod || '',
      weight:                 body.weight                 || '',
      classification:         body.classification         || '',
      efficiencyGuide:        body.efficiencyGuide        || '',
      qualityGuide:           body.qualityGuide           || '',
      timelinessGuide:        body.timelinessGuide        || '',
      meansOfVerification:    body.meansOfVerification    || '',
      accomplishment:         body.accomplishment         || '',
      ratingEfficiency:       body.ratingEfficiency       || '',
      ratingQuality:          body.ratingQuality          || '',
      ratingTimeliness:       body.ratingTimeliness       || '',
      ratingAverage:          body.ratingAverage          || '',
      movReferences:          body.movReferences          || '',
      remarks:                body.remarks                || '',
      isCustom:               body.isCustom !== undefined ? body.isCustom : false,
      order:                  body.order                  || 0,
      createdAt:              now,
      updatedAt:              now
    }

    SpreadsheetService.appendRow(sheet, entry)
    AuditService.log('ADD_ENTRY', 'IPCRF', `Added entry ${entry.id} to form ${formId}`, user)

    // Auto-create the linked Accomplishments record so the staff member has a place
    // to log their narrative + MOV for this exact indicator. Best-effort: a failure
    // here shouldn't block the entry itself from being added.
    try {
      AccomplishmentsService.create({
        formId, entryId: entry.id,
        type: form.type, semester: form.semester, year: form.year,
        userId: form.userId, employeeName: form.employeeName,
        divisionId: form.divisionId, division: form.divisionName,
        functionType: entry.functionType || '',
        kraTitle: entry.kraName, target: entry.successIndicator
      }, user)
    } catch (e) {
      Logger.log('[IPCRF] Could not auto-create linked Accomplishments record: ' + e.message)
    }

    return entry
  }

  function updateEntry(formId, entryId, body, user) {
    const profile = AuthService.getProfile(user)
    const form    = _getForm(formId)
    _guardAccess(form, profile)

    const sheet = SpreadsheetService.getSheet(SHEET.FORM_ENTRIES)
    const row   = SpreadsheetService.getRow(sheet, entryId)
    if (!row || row.formId !== formId) throw HttpError('Entry not found', 404)

    const { id: _id, formId: _fid, createdAt: _c, ...safe } = body
    const autoAverage = _entryAverage({ ...row, ...safe })
    if (autoAverage !== null) safe.ratingAverage = autoAverage
    const updated = SpreadsheetService.updateRow(sheet, entryId, {
      ...safe,
      updatedAt: new Date().toISOString()
    })
    AuditService.log('UPDATE_ENTRY', 'IPCRF', `Updated entry ${entryId} on form ${formId}`, user)
    _autoRegenDoc(formId, user)
    return updated
  }

  function deleteEntry(formId, entryId, user) {
    const profile = AuthService.getProfile(user)
    const form    = _getForm(formId)
    _guardAccess(form, profile)

    if (!['Draft', 'Returned'].includes(form.status)) {
      throw HttpError('Cannot delete entries from a submitted or finalized form', 400)
    }

    const sheet = SpreadsheetService.getSheet(SHEET.FORM_ENTRIES)
    const row   = SpreadsheetService.getRow(sheet, entryId)
    if (!row || row.formId !== formId) throw HttpError('Entry not found', 404)

    // Hard-delete the row
    const data    = sheet.getDataRange().getValues()
    const headers = data[0]
    const idIdx   = headers.indexOf('id')
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(entryId)) {
        sheet.deleteRow(i + 1)
        break
      }
    }
    AuditService.log('DELETE_ENTRY', 'IPCRF', `Deleted entry ${entryId}`, user)
    try { AccomplishmentsService.softDeleteByEntryId(entryId, user) } catch (e) { Logger.log('[IPCRF] Linked Accomplishments cleanup skipped: ' + e.message) }
    return { deleted: true }
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  // ─────────────────────────────────────────────
  // CROSS-MODULE LOOKUP — used by IPATService (Evaluation/FPO domain)
  // Finds the IPCRF or CCEF form whose Final Numerical Rating should
  // feed the Functional Performance Output (FPO) score for a given
  // ratee/period. Only forms that have actually been rated carry a
  // finalNumericalRating, so unrated/draft forms never qualify.
  // ─────────────────────────────────────────────

  function getFinalRatingForUser(userId, semester, year) {
    const sheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const rows  = SpreadsheetService.getAllRows(sheet).filter(r =>
      r.userId   === userId &&
      String(r.semester) === String(semester) &&
      String(r.year)     === String(year) &&
      ['Rated', 'Finalized'].includes(r.status) &&
      r.finalNumericalRating !== '' && r.finalNumericalRating !== null && r.finalNumericalRating !== undefined
    )
    if (!rows.length) return null

    // Prefer a Finalized form over a merely Rated one; among ties, prefer the
    // most recently rated/finalized record (covers the IPCRF vs CCEF case).
    rows.sort((a, b) => {
      const rank = s => s === 'Finalized' ? 1 : 0
      if (rank(b.status) !== rank(a.status)) return rank(b.status) - rank(a.status)
      const aTime = new Date(a.finalizedAt || a.ratedAt || a.updatedAt || 0)
      const bTime = new Date(b.finalizedAt || b.ratedAt || b.updatedAt || 0)
      return bTime - aTime
    })

    return rows[0]
  }

  function _getForm(id) {
    const sheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('IPCRF form not found', 404)
    return row
  }

  function _getEntries(formId) {
    const sheet = SpreadsheetService.getSheet(SHEET.FORM_ENTRIES)
    return SpreadsheetService.getAllRows(sheet)
      .filter(r => r.formId === formId)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
  }

  function _entryAverage(entry) {
    const e = Number(entry.ratingEfficiency)
    const q = Number(entry.ratingQuality)
    const t = Number(entry.ratingTimeliness)
    if ([e, q, t].every(v => isFinite(v) && v > 0)) {
      return Math.round(((e + q + t) / 3) * 100) / 100
    }

    const saved = Number(entry.ratingAverage)
    if (isFinite(saved) && saved > 0) return Math.round(saved * 100) / 100
    return null
  }

  function _guardAccess(form, profile) {
    const { role, id: userId, divisionId, section } = profile
    if (['System Administrator', 'Bureau Director'].includes(role)) return
    if (role === 'Assistant Bureau Director' && form.divisionId === 'admin-pool') return
    if (FocalAssignmentService.isBureauFocal(profile)) return
    if (FocalAssignmentService.isDivisionFocal(profile, form.divisionId)) return
    if (role === 'Division Chief' && form.divisionId === divisionId) return
    if (role === 'Section Head') {
      const ownerSection = form.sectionName || _ownerSection(form.userId)
      if (form.divisionId === divisionId && ownerSection === section) return
    }
    if (form.userId === userId) return
    throw HttpError('Access denied to this form', 403)
  }

  function _assertTransition(from, to) {
    const allowed = STATUS_FLOW[from] || []
    if (!allowed.includes(to)) {
      throw HttpError(`Cannot transition form from "${from}" to "${to}"`, 400)
    }
  }

  // Enforces that an approver's role-level access (checked by requireRole) also
  // matches the specific form's division/section. Previously Division Chief had
  // no such check here at all — any Division Chief could approve/rate/return any
  // division's form via direct API call, not just their own. Section Head needs
  // this even more, since its whole point is a narrower scope than Division Chief.
  function _assertApproverScope(row, profile) {
    if (_canReviewForm(row, profile)) return
    throw HttpError('You do not have approval rights over this form', 403)
  }

  function _canReviewForm(row, profile) {
    if (!row || !profile || row.userId === profile.id) return false
    const { role, divisionId, section } = profile
    if (['System Administrator', 'Bureau Director', 'Assistant Bureau Director'].includes(role)) return true
    if (FocalAssignmentService.isBureauFocal(profile)) return true
    if (FocalAssignmentService.isDivisionFocal(profile, row.divisionId)) return true
    if (role === 'Division Chief' && row.divisionId === divisionId) return true
    if (role === 'Section Head') {
      const ownerSection = row.sectionName || _ownerSection(row.userId)
      return row.divisionId === divisionId && ownerSection === section
    }
    return false
  }

  function _ownerSection(userId) {
    const usersSheet = SpreadsheetService.getSheet(SHEET.USERS)
    const owner = SpreadsheetService.getRow(usersSheet, userId)
    return owner ? (owner.section || '') : ''
  }

  function _isDivisionFocalForProfile(profile) {
    return !!(profile && FocalAssignmentService.isDivisionFocal(profile, profile.divisionId))
  }

  function _formTypeForProfile(profile) {
    const employmentType = String(profile.type || '').toLowerCase()
    return employmentType.includes('contract') || employmentType.includes('cos')
      ? 'CCEF'
      : 'IPCRF'
  }

  function _profileEmployeeName(profile) {
    const fullName = String(profile.fullName || '').trim()
    if (fullName && !_sameText(fullName, profile.position)) return fullName

    return fullName || ''
  }

  function _sameText(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
  }

  function _ratingLabel(score) {
    if (score >= 4.500) return 'Outstanding'
    if (score >= 3.500) return 'Very Satisfactory'
    if (score >= 2.500) return 'Satisfactory'
    if (score >= 1.500) return 'Unsatisfactory'
    return 'Poor'
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

  // When a form re-enters (or leaves) the review chain, any earlier "routed/
  // assigned to you" notifications for it are stale — a reviewer would see the
  // notification but find nothing in their queue because the form has moved on.
  // Mark those unread routing notifications (type 'submission') as read.
  function _obsoleteRouteNotifications(formId) {
    try {
      const sheet = SpreadsheetService.getSheet(SHEET.NOTIFICATIONS)
      SpreadsheetService.getAllRows(sheet)
        .filter(n =>
          String(n.relatedId) === String(formId) &&
          n.type === 'submission' &&
          !(n.read === true || String(n.read).toLowerCase() === 'true')
        )
        .forEach(n => SpreadsheetService.updateRow(sheet, n.id, { read: true, readAt: new Date().toISOString() }))
    } catch (e) {
      Logger.log('[IPCRF] Could not obsolete route notifications for ' + formId + ': ' + e.message)
    }
  }

  function _notifyReviewers(form, submitterProfile) {
    const divisionFocal = FocalAssignmentService.getDivisionFocal(form.divisionId)
    const recipientId = divisionFocal ? divisionFocal.userId : ''
    if (!recipientId) {
      Logger.log('No division focal assigned for divisionId=' + form.divisionId + '. Submission notification was not routed.')
      return
    }
    _notifyUser(
      recipientId,
      'submission',
      `${form.employeeName} submitted their ${form.type} for ${form.year}.`,
      form.id,
      'IPCRF'
    )
  }

  function _notifyRouteRecipient(recipientId, message, formId) {
    if (!recipientId) return
    _notifyUser(recipientId, 'submission', message, formId, 'IPCRF')
  }

  function _assignReviewRoute(sheet, row, body, profile, user, now) {
    const reviewType = body.reviewType || _reviewTypeForForm(row)
    _assertCurrentRouteReviewer(row, reviewType, profile)
    const assignee = SpreadsheetService.getRow(SpreadsheetService.getSheet(SHEET.USERS), body.assignToUserId || '')
    if (!assignee) throw HttpError('Assignee not found', 404)
    if (!_canReviewForm(row, assignee)) throw HttpError('Selected user cannot review this form', 403)

    const stage = _reviewerTag(assignee, row)
    const updates = reviewType === 'targets'
      ? {
          targetReviewStage: stage,
          targetRoutedToUserId: assignee.id,
          targetRoutedToName: _profileEmployeeName(assignee),
          targetRoutedAt: now,
          updatedAt: now
        }
      : {
          ratingReviewStage: stage,
          ratingRoutedToUserId: assignee.id,
          ratingRoutedToName: _profileEmployeeName(assignee),
          ratingRoutedAt: now,
          updatedAt: now
        }

    const updated = SpreadsheetService.updateRow(sheet, row.id, updates)
    _notifyRouteRecipient(assignee.id, `${row.employeeName}'s ${row.type} ${reviewType} review was assigned to you.`, row.id)
    AuditService.log('ASSIGN_REVIEW', 'IPCRF', `Assigned ${reviewType} review for ${row.id} to ${_profileEmployeeName(assignee)}`, user)
    return updated
  }

  function _completeReviewRoute(sheet, row, reviewType, profile, user, now) {
    _assertCurrentRouteReviewer(row, reviewType, profile)
    if (reviewType === 'targets') {
      if (row.status !== 'Submitted') throw HttpError('Only submitted targets can be completed.', 400)
      const updated = SpreadsheetService.updateRow(sheet, row.id, {
        status: 'Approved',
        targetReviewStage: 'Completed',
        targetCompletedAt: now,
        approvedAt: now,
        updatedAt: now
      })
      _notifyUser(row.userId, 'approval', `Your ${row.type} targets were approved. You may prepare accomplishments and ratings for the rating period.`, row.id, 'IPCRF')
      AuditService.log('COMPLETE_TARGET_REVIEW', 'IPCRF', `Completed targets review for ${row.id}`, user)
      return updated
    }

    if (!['Approved', 'Rated'].includes(row.status)) throw HttpError('Ratings review is available after targets are approved.', 400)
    const updated = SpreadsheetService.updateRow(sheet, row.id, {
      status: 'Rated',
      ratingReviewStage: 'Completed',
      ratingCompletedAt: now,
      ratedAt: row.ratedAt || now,
      updatedAt: now
    })
    _notifyUser(row.userId, 'approval', `Your ${row.type} ratings review is complete. Please coordinate for printing, signing, and physical submission.`, row.id, 'IPCRF')
    AuditService.log('COMPLETE_RATING_REVIEW', 'IPCRF', `Completed ratings review for ${row.id}`, user)
    return updated
  }

  function _routeStage(row, reviewType) {
    if (reviewType === 'targets') return row.targetReviewStage || 'Division Focal'
    return row.ratingReviewStage || 'Division Focal'
  }

  function _isRoutedToReviewer(row, reviewType, profile) {
    if (['System Administrator', 'Bureau Director', 'Assistant Bureau Director'].includes(profile.role)) return true
    const routedTo = reviewType === 'targets' ? row.targetRoutedToUserId : row.ratingRoutedToUserId
    if (routedTo && String(routedTo) === String(profile.id)) return true
    const stage = _routeStage(row, reviewType)
    if (stage === 'Completed') return false
    if (stage === 'Division Focal') return FocalAssignmentService.isDivisionFocal(profile, row.divisionId)
    if (stage === 'Bureau Focal') return FocalAssignmentService.isBureauFocal(profile)
    if (stage === 'Division Chief') return profile.role === 'Division Chief' && String(profile.divisionId || '') === String(row.divisionId || '')
    return false
  }

  function _assertCurrentRouteReviewer(row, reviewType, profile) {
    if (_isRoutedToReviewer(row, reviewType, profile)) return
    throw HttpError('This form is not currently routed to you.', 403)
  }

  function _routeTargetForStage(row, reviewType, stage) {
    if (stage === 'Division Focal') {
      const focal = FocalAssignmentService.getDivisionFocal(row.divisionId)
      if (!focal) throw HttpError('No Division Focal assigned for ' + (row.divisionName || row.divisionId) + '. Set up Focal Assignments first.', 400)
      return { userId: focal.userId, userName: focal.userName }
    }
    if (stage === 'Bureau Focal') {
      const focal = FocalAssignmentService.getBureauFocal()
      if (!focal) throw HttpError('No Bureau Focal assigned. Set up Focal Assignments first.', 400)
      return { userId: focal.userId, userName: focal.userName }
    }
    if (stage === 'Division Chief') {
      const chief = _divisionChief(row.divisionId)
      if (!chief) throw HttpError('No Division Chief found for ' + (row.divisionName || row.divisionId) + '. Ensure a Division Chief user exists.', 400)
      return { userId: chief.id, userName: _profileEmployeeName(chief) }
    }
    return { userId: '', userName: stage || '' }
  }

  function _divisionChief(divisionId) {
    return SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.USERS)).find(u =>
      u.role === 'Division Chief' &&
      String(u.divisionId || '') === String(divisionId || '') &&
      u.active !== false &&
      String(u.active).toLowerCase() !== 'false'
    ) || null
  }

  function _reviewerTag(profile, row) {
    if (FocalAssignmentService.isDivisionFocal(profile, row.divisionId)) return 'Division Focal'
    if (FocalAssignmentService.isBureauFocal(profile)) return 'Bureau Focal'
    if (profile.role === 'Division Chief') return 'Division Chief'
    return profile.role || 'Reviewer'
  }

  function _ipcrfFormsSheet() {
    const sheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    _ensureColumns(sheet, [
      'targetReviewStage', 'targetRoutedToUserId', 'targetRoutedToName',
      'targetRoutedAt', 'targetCompletedAt',
      'ratingReviewStage', 'ratingRoutedToUserId', 'ratingRoutedToName',
      'ratingRoutedAt', 'ratingCompletedAt'
    ])
    return sheet
  }

  function _ensureColumns(sheet, headers) {
    const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].filter(Boolean)
    const missing = headers.filter(h => !existing.includes(h))
    if (missing.length) sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing])
  }

  // ── Period status check (self-service Generate Targets/Ratings entry point) ──
  // Derives IPCRF vs CCEF from the caller's own Employment Type, finds their own
  // form for the given semester/year, and — for Ratings — whether every linked
  // Accomplishments record has been approved yet.
  function getPeriodStatus(params, user) {
    const profile = AuthService.getProfile(user)
    const type    = _formTypeForProfile(profile)

    const sheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const form  = SpreadsheetService.getAllRows(sheet).find(r =>
      r.userId === profile.id &&
      String(r.year) === String(params.year) &&
      r.type === type
    )

    if (!form) {
      return {
        type, hasForm: false, formId: null, formStatus: null, ratingsReady: false,
        totalEntries: 0, readyEntries: 0,
        docFileId: null, docFileUrl: null, hasTargetsDoc: false, hasRatingsDoc: false
      }
    }

    const completeness = AccomplishmentsService.completenessForForm(form.id)
    const hasTargetsDoc  = !!form.targetsGeneratedAt
    const hasS1RatingsDoc = !!form.s1RatingsGeneratedAt
    const hasS2RatingsDoc = !!form.s2RatingsGeneratedAt
    const doc = _docAvailability(form.docFileId)
    return {
      type, hasForm: true, formId: form.id, formStatus: form.status,
      ratingsReady: completeness.isReady,
      totalEntries: completeness.total, readyEntries: completeness.ready,
      docFileId:       form.docFileId || null,
      docFileUrl:      doc.exists ? `https://docs.google.com/spreadsheets/d/${form.docFileId}/edit` : null,
      hasTargetsDoc,
      hasS1RatingsDoc,
      hasS2RatingsDoc,
      hasRatingsDoc:   hasS1RatingsDoc || hasS2RatingsDoc,
      docMissing:      (hasTargetsDoc || hasS1RatingsDoc || hasS2RatingsDoc) && !!form.docFileId && !doc.exists
    }
  }

  function _docAvailability(fileId) {
    if (!fileId) return { exists: false }
    try {
      const file = DriveApp.getFileById(fileId)
      return { exists: !file.isTrashed() }
    } catch (e) {
      Logger.log('[IPCRF] Stored docFileId no longer available: ' + fileId + ' :: ' + e.message)
      return { exists: false }
    }
  }

  function _reviewTypeForForm(form) {
    return form.status === 'Submitted' ? 'targets' : 'ratings'
  }

  function _parseComments(value) {
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : []
      } catch (e) {
        return []
      }
    }
    return []
  }

  function _reviewCommentsSheet() {
    const spreadsheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'))
    let sheet = spreadsheet.getSheetByName(SHEET.REVIEW_COMMENTS || 'ReviewComments')
    const headers = ['id', 'formId', 'entryId', 'reviewType', 'comment', 'reviewerId', 'reviewerName', 'createdAt', 'updatedAt']
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET.REVIEW_COMMENTS || 'ReviewComments')
      sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      return sheet
    }
    const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].filter(Boolean)
    if (!existing.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    } else {
      const missing = headers.filter(h => !existing.includes(h))
      if (missing.length) sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing])
    }
    return sheet
  }

  function _autoRegenDoc(formId, user) {
    try {
      const form = _getForm(formId)
      if (!form || !form.docFileId) return
      if (form.targetsGeneratedAt) {
        PmesDocGenService.generateTargetsDoc(formId, user)
      }
      if (form.s1RatingsGeneratedAt) {
        PmesDocGenService.generateRatingsDoc(formId, user, '1')
      }
      if (form.s2RatingsGeneratedAt) {
        PmesDocGenService.generateRatingsDoc(formId, user, '2')
      }
    } catch (e) {
      Logger.log('[IPCRF] Auto-regen doc skipped for ' + formId + ': ' + e.message)
    }
  }

  return {
    list, reviewQueue, get, create, update,
    submit, route, approve, return_, rate, submitRatings, finalize, computeScore,
    listEntries, addEntry, updateEntry, deleteEntry,
    getFinalRatingForUser, getPeriodStatus,
    listReviewComments, saveReviewComments, listAssignableReviewers
  }
})()
