const IpcrfService = (() => {

  const STATUS_FLOW = {
    'Draft':     ['Submitted'],
    'Submitted': ['Approved', 'Returned'],
    'Returned':  ['Submitted'],
    'Approved':  ['Rated'],
    'Rated':     ['Finalized'],
    'Finalized': []
  }

  // ─────────────────────────────────────────────
  // IPCRF FORMS CRUD
  // ─────────────────────────────────────────────

  function list(params, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    let rows      = SpreadsheetService.getAllRows(sheet)

    // Scope by role
    if (!['System Administrator', 'Bureau Director', 'Assistant Bureau Director'].includes(profile.role)) {
      if (profile.role === 'Division Chief') {
        rows = rows.filter(r => r.divisionId === profile.divisionId)
      } else {
        rows = rows.filter(r => r.userId === profile.id)
      }
    }

    if (params.userId)     rows = rows.filter(r => r.userId     === params.userId)
    if (params.semester)   rows = rows.filter(r => r.semester   === params.semester)
    if (params.year)       rows = rows.filter(r => String(r.year) === String(params.year))
    if (params.status)     rows = rows.filter(r => r.status     === params.status)
    if (params.divisionId) rows = rows.filter(r => r.divisionId === params.divisionId)
    if (params.type)       rows = rows.filter(r => r.type       === params.type)

    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  function get(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('IPCRF form not found', 404)
    _guardAccess(row, profile)

    // Attach form entries
    row.entries = _getEntries(id)
    return row
  }

  function create(body, user) {
    const profile = AuthService.getProfile(user)
    const now     = new Date().toISOString()

    // Prevent duplicate form per user per semester/year/type
    const sheet    = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const existing = SpreadsheetService.getAllRows(sheet).find(r =>
      r.userId   === (body.userId || profile.id) &&
      r.semester === body.semester &&
      String(r.year) === String(body.year) &&
      r.type === (body.type || 'IPCRF')
    )
    if (existing) throw HttpError(`An ${body.type || 'IPCRF'} form already exists for this period`, 409)

    // ── Derive position level and weights from user's position title ──
    // Never trust frontend input for these — always compute server-side.
    const _level   = PositionHelper.resolveLevel(profile.position || '')
    const _weights = PositionHelper.resolveWeights(profile)

    const form = {
      id:                    SpreadsheetService.generateId('FORM-'),
      type:                  body.type             || 'IPCRF',
      userId:                body.userId           || profile.id,
      employeeName:          body.employeeName     || profile.fullName,
      position:              profile.position      || '',
      positionLevel:         _level,
      divisionId:            profile.divisionId    || '',
      divisionName:          profile.divisionName  || '',
      semester:              body.semester         || '',
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
    const sheet   = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Form not found', 404)
    _guardAccess(row, profile)
    _assertTransition(row.status, 'Submitted')

    const entries = _getEntries(id)
    if (entries.length === 0) throw HttpError('Cannot submit a form with no entries', 400)

    const updated = SpreadsheetService.updateRow(sheet, id, {
      status:      'Submitted',
      submittedAt: new Date().toISOString(),
      updatedAt:   new Date().toISOString()
    })
    AuditService.log('SUBMIT', 'IPCRF', `Submitted form ${id}`, user)
    _notifyReviewers(updated, profile)
    return updated
  }

  function approve(id, body, user) {
    AuthService.requireRole(user,
      'System Administrator', 'Bureau Director',
      'Assistant Bureau Director', 'Division Chief'
    )
    const sheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Form not found', 404)
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
    AuthService.requireRole(user,
      'System Administrator', 'Bureau Director',
      'Assistant Bureau Director', 'Division Chief'
    )
    const sheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Form not found', 404)
    _assertTransition(row.status, 'Returned')

    const updated = SpreadsheetService.updateRow(sheet, id, {
      status:    'Returned',
      updatedAt: new Date().toISOString()
    })
    AuditService.log('RETURN', 'IPCRF', `Returned form ${id}: ${body.remarks || ''}`, user)
    _notifyUser(row.userId, 'revision',
      `Your ${row.type} form was returned for revision. ${body.remarks || ''}`,
      id, 'IPCRF'
    )
    return updated
  }

  function rate(id, body, user) {
    AuthService.requireRole(user,
      'System Administrator', 'Bureau Director',
      'Assistant Bureau Director', 'Division Chief'
    )
    const sheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Form not found', 404)
    _assertTransition(row.status, 'Rated')

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

    const updated = SpreadsheetService.updateRow(sheet, id, {
      status:               'Finalized',
      dateSignedRatee:      body.dateSignedRatee      || '',
      dateSignedSupervisor: body.dateSignedSupervisor || '',
      dateSignedAuthority:  body.dateSignedAuthority  || '',
      finalizedAt:  new Date().toISOString(),
      updatedAt:    new Date().toISOString()
    })
    AuditService.log('FINALIZE', 'IPCRF', `Finalized form ${id}`, user)
    return updated
  }

  // ── Compute Score ──
  function computeScore(id, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const form  = SpreadsheetService.getRow(sheet, id)
    if (!form) throw HttpError('Form not found', 404)

    const entries = _getEntries(id)
    if (entries.length === 0) {
      AuditService.log('COMPUTE_SCORE', 'IPCRF', `Computed score for form ${id}: 0 (Poor)`, user)
      return { score: 0, label: 'Poor', entryCount: 0 }
    }

    // Group entries by function type and compute weighted averages
    const coreEntries    = entries.filter(e => e.functionType === 'Core')
    const supportEntries = entries.filter(e => e.functionType === 'Support')

    const coreWeight    = Number(form.coreFunctionWeight)    || 70
    const supportWeight = Number(form.supportFunctionWeight) || 30

    const avgRating = (list) => {
      const rated = list.filter(e => e.ratingAverage !== '' && e.ratingAverage !== null)
      if (!rated.length) return 0
      return rated.reduce((s, e) => s + Number(e.ratingAverage), 0) / rated.length
    }

    const coreAvg    = avgRating(coreEntries)
    const supportAvg = avgRating(supportEntries)
    const total      = coreEntries.length + supportEntries.length
    const rated      = entries.filter(e => e.ratingAverage !== '' && e.ratingAverage !== null).length

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
    SpreadsheetService.updateRow(sheet, id, {
      finalNumericalRating: score,
      adjectivalRating:     label,
      updatedAt:            new Date().toISOString()
    })

    AuditService.log('COMPUTE_SCORE', 'IPCRF', `Computed score for form ${id}: ${score} (${label})`, user)
    return { score, label, entryCount: total, ratedCount: rated }
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
    const updated = SpreadsheetService.updateRow(sheet, entryId, {
      ...safe,
      updatedAt: new Date().toISOString()
    })
    AuditService.log('UPDATE_ENTRY', 'IPCRF', `Updated entry ${entryId} on form ${formId}`, user)
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

  function _guardAccess(form, profile) {
    const { role, id: userId, divisionId } = profile
    if (['System Administrator', 'Bureau Director'].includes(role)) return
    if (role === 'Assistant Bureau Director' && form.divisionId === 'admin-pool') return
    if (role === 'Division Chief' && form.divisionId === divisionId) return
    if (form.userId === userId) return
    throw HttpError('Access denied to this form', 403)
  }

  function _assertTransition(from, to) {
    const allowed = STATUS_FLOW[from] || []
    if (!allowed.includes(to)) {
      throw HttpError(`Cannot transition form from "${from}" to "${to}"`, 400)
    }
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

  function _notifyReviewers(form, submitterProfile) {
    _notifyUser(
      'division-chief-' + form.divisionId,
      'submission',
      `${form.employeeName} submitted their ${form.type} for ${form.semester} ${form.year}.`,
      form.id,
      'IPCRF'
    )
  }

  return {
    list, get, create, update,
    submit, approve, return_, rate, finalize, computeScore,
    listEntries, addEntry, updateEntry, deleteEntry,
    getFinalRatingForUser
  }
})()