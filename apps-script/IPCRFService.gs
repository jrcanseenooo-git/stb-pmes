const IPCRFService = (() => {

  const FORM_SHEET    = 'IPCRForms'
  const ENTRY_SHEET   = 'FormEntries'
  const LIBRARY_SHEET = 'MasterKRALibrary'

  function listForms(params, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(FORM_SHEET)
    let rows      = SpreadsheetService.getAllRows(sheet)
                      .filter(r => r.status !== 'DELETED')

    rows = applyScope(rows, profile)

    if (params.type)       rows = rows.filter(r => r.type       === params.type)
    if (params.semester)   rows = rows.filter(r => String(r.semester) === String(params.semester))
    if (params.year)       rows = rows.filter(r => String(r.year)     === String(params.year))
    if (params.status)     rows = rows.filter(r => r.status     === params.status)
    if (params.divisionId) rows = rows.filter(r => r.divisionId === params.divisionId)
    if (params.userId)     rows = rows.filter(r => r.userId     === params.userId)

    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  function getForm(formId, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(FORM_SHEET)
    const form    = SpreadsheetService.getRow(sheet, formId)
    if (!form) throw HttpError('Form not found', 404)
    guardFormAccess(form, profile)
    return { ...form, entries: _getEntries(formId) }
  }

  /**
   * createForm
   * The caller passes only: type, semester, year, immediateSupervisor,
   * supervisorPosition, approvingAuthority, authorityPosition.
   *
   * positionLevel, position, coreFunctionWeight, supportFunctionWeight are
   * always resolved from the authenticated user's profile — never from body.
   */
  function createForm(body, user) {
    const profile = AuthService.getProfile(user)
    const now     = new Date().toISOString()

    // ── AUTO-RESOLVE from profile ──────────────────────
    const positionLevel = PositionHelper.resolveLevel(profile.position)
    const weights       = PositionHelper.resolveWeights(profile)
    // ──────────────────────────────────────────────────

    const form = {
      id:                    SpreadsheetService.generateId('FORM-'),
      type:                  body.type                  || 'IPCRF',
      userId:                profile.id,
      employeeName:          profile.fullName,
      position:              profile.position           || '',
      positionLevel,                                       // server-resolved
      divisionId:            profile.divisionId         || '',
      divisionName:          profile.divisionName       || '',
      semester:              body.semester              || '',
      year:                  body.year                  || new Date().getFullYear(),
      status:                'DRAFT',
      coreFunctionWeight:    weights.core,                 // server-resolved
      supportFunctionWeight: weights.support,              // server-resolved
      finalNumericalRating:  '',
      adjectivalRating:      '',
      immediateSupervisor:   body.immediateSupervisor   || '',
      supervisorPosition:    body.supervisorPosition    || '',
      approvingAuthority:    body.approvingAuthority    || '',
      authorityPosition:     body.authorityPosition     || '',
      dateSignedRatee:       '',
      dateSignedSupervisor:  '',
      dateSignedAuthority:   '',
      feedbackStrengths:     '',
      feedbackAreasForImprovement: '',
      feedbackComments:      '',
      feedbackRecommendations: '',
      submittedAt:  '',
      approvedAt:   '',
      ratedAt:      '',
      finalizedAt:  '',
      createdAt:    now,
      updatedAt:    now
    }

    SpreadsheetService.appendRow(SpreadsheetService.getSheet(FORM_SHEET), form)
    AuditService.log(
      'CREATE', 'IPCRF',
      `Created IPCRF form ${form.id} for ${profile.fullName} ` +
      `(level=${positionLevel}, weights=${weights.core}/${weights.support})`,
      user
    )
    return form
  }

  function updateForm(formId, body, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(FORM_SHEET)
    const form    = SpreadsheetService.getRow(sheet, formId)
    if (!form) throw HttpError('Form not found', 404)
    guardFormAccess(form, profile)

    // Strip all server-managed fields so client can never override them
    const {
      id, userId, createdAt, status, submittedAt, approvedAt,
      ratedAt, finalizedAt,
      position, positionLevel,
      coreFunctionWeight, supportFunctionWeight,
      ...safe
    } = body

    const updated = SpreadsheetService.updateRow(sheet, formId, {
      ...safe,
      updatedAt: new Date().toISOString()
    })
    AuditService.log('UPDATE', 'IPCRF', `Updated form ${formId}: ${JSON.stringify(safe)}`, user)
    return updated
  }

  function deleteForm(formId, user) {
    AuthService.requireRole(user, 'System Administrator')
    SpreadsheetService.updateRow(
      SpreadsheetService.getSheet(FORM_SHEET),
      formId,
      { status: 'DELETED', updatedAt: new Date().toISOString() }
    )
    AuditService.log('DELETE', 'IPCRF', `Deleted form ${formId}`, user)
    return { deleted: true }
  }

  // ─────────────────────────────────────────────────────
  //  WORKFLOW ACTIONS
  // ─────────────────────────────────────────────────────

  function submitForm(formId, user) {
    const sheet = SpreadsheetService.getSheet(FORM_SHEET)
    const form  = SpreadsheetService.getRow(sheet, formId)
    if (!form) throw HttpError('Form not found', 404)
    if (!['DRAFT', 'RETURNED'].includes(form.status)) {
      throw HttpError(`Cannot submit a form with status "${form.status}"`, 400)
    }
    const now = new Date().toISOString()
    const updated = SpreadsheetService.updateRow(sheet, formId, {
      status: 'SUBMITTED', submittedAt: now, updatedAt: now
    })
    AuditService.log('SUBMIT', 'IPCRF', `Submitted form ${formId}`, user)
    return updated
  }

  function approveForm(formId, body, user) {
    AuthService.requireRole(user, 'System Administrator', 'Bureau Director',
                                  'Assistant Bureau Director', 'Division Chief')
    const sheet = SpreadsheetService.getSheet(FORM_SHEET)
    const form  = SpreadsheetService.getRow(sheet, formId)
    if (!form) throw HttpError('Form not found', 404)
    if (form.status !== 'SUBMITTED') throw HttpError('Form must be SUBMITTED to approve', 400)
    const now = new Date().toISOString()
    const updated = SpreadsheetService.updateRow(sheet, formId, {
      status: 'APPROVED', approvedAt: now, updatedAt: now,
      feedbackStrengths:           body.feedbackStrengths           || '',
      feedbackAreasForImprovement: body.feedbackAreasForImprovement || '',
      feedbackComments:            body.feedbackComments            || '',
      feedbackRecommendations:     body.feedbackRecommendations     || ''
    })
    AuditService.log('APPROVE', 'IPCRF', `Approved form ${formId}`, user)
    return updated
  }

  function returnForm(formId, body, user) {
    AuthService.requireRole(user, 'System Administrator', 'Bureau Director',
                                  'Assistant Bureau Director', 'Division Chief')
    const sheet = SpreadsheetService.getSheet(FORM_SHEET)
    const form  = SpreadsheetService.getRow(sheet, formId)
    if (!form) throw HttpError('Form not found', 404)
    if (!['SUBMITTED', 'APPROVED'].includes(form.status)) {
      throw HttpError('Form must be SUBMITTED or APPROVED to return', 400)
    }
    const updated = SpreadsheetService.updateRow(sheet, formId, {
      status:                      'RETURNED',
      feedbackComments:            body.feedbackComments            || '',
      feedbackAreasForImprovement: body.feedbackAreasForImprovement || '',
      updatedAt:                   new Date().toISOString()
    })
    AuditService.log('RETURN', 'IPCRF', `Returned form ${formId}`, user)
    return updated
  }

  function finalizeForm(formId, body, user) {
    AuthService.requireRole(user, 'System Administrator', 'Bureau Director')
    const sheet = SpreadsheetService.getSheet(FORM_SHEET)
    const form  = SpreadsheetService.getRow(sheet, formId)
    if (!form) throw HttpError('Form not found', 404)
    if (form.status !== 'APPROVED') throw HttpError('Form must be APPROVED to finalize', 400)
    const now = new Date().toISOString()
    const updated = SpreadsheetService.updateRow(sheet, formId, {
      status:               'FINALIZED',
      finalizedAt:          now,
      ratedAt:              now,
      finalNumericalRating: body.finalNumericalRating || form.finalNumericalRating || '',
      adjectivalRating:     body.adjectivalRating     || form.adjectivalRating     || '',
      dateSignedRatee:      body.dateSignedRatee      || '',
      dateSignedSupervisor: body.dateSignedSupervisor || '',
      dateSignedAuthority:  body.dateSignedAuthority  || '',
      updatedAt:            now
    })
    AuditService.log('FINALIZE', 'IPCRF', `Finalized form ${formId}`, user)
    return updated
  }

  function computeScore(formId, user) {
    const formSheet = SpreadsheetService.getSheet(FORM_SHEET)
    const form      = SpreadsheetService.getRow(formSheet, formId)
    if (!form) throw HttpError('Form not found', 404)

    const entries = _getEntries(formId)
    const coreW   = Number(form.coreFunctionWeight)    / 100 || 0.70
    const suppW   = Number(form.supportFunctionWeight) / 100 || 0.30

    let coreSum = 0, coreCount = 0, suppSum = 0, suppCount = 0
    entries.forEach(e => {
      const avg = Number(e.ratingAverage) || 0
      if (!avg) return
      if ((e.functionType || '').toLowerCase() === 'core') { coreSum += avg; coreCount++ }
      else                                                  { suppSum += avg; suppCount++ }
    })

    const coreAvg = coreCount ? coreSum / coreCount : 0
    const suppAvg = suppCount ? suppSum / suppCount : 0
    const final   = Math.round((coreAvg * coreW + suppAvg * suppW) * 100) / 100
    const label   = _adjectivalLabel(final)

    SpreadsheetService.updateRow(formSheet, formId, {
      finalNumericalRating: final,
      adjectivalRating:     label,
      ratedAt:              new Date().toISOString(),
      updatedAt:            new Date().toISOString()
    })
    AuditService.log('COMPUTE_SCORE', 'IPCRF',
      `Computed score for form ${formId}: ${final} (${label})`, user)
    return { finalNumericalRating: final, adjectivalRating: label }
  }

  // ─────────────────────────────────────────────────────
  //  ENTRY CRUD
  // ─────────────────────────────────────────────────────

  function listEntries(formId, params, user) {
    const profile = AuthService.getProfile(user)
    const form    = SpreadsheetService.getRow(SpreadsheetService.getSheet(FORM_SHEET), formId)
    if (!form) throw HttpError('Form not found', 404)
    guardFormAccess(form, profile)
    return _getEntries(formId)
  }

  /**
   * addEntry
   * If body.masterKRAId is provided, weight is resolved from the library
   * using the form's positionLevel (which was set at form creation from profile).
   * The caller must NOT pass weight — it is always derived server-side.
   */
  function addEntry(formId, body, user) {
    const profile = AuthService.getProfile(user)
    const formSht = SpreadsheetService.getSheet(FORM_SHEET)
    const form    = SpreadsheetService.getRow(formSht, formId)
    if (!form) throw HttpError('Form not found', 404)
    guardFormAccess(form, profile)
    if (!['DRAFT', 'RETURNED'].includes(form.status)) {
      throw HttpError('Entries can only be added to DRAFT or RETURNED forms', 400)
    }

    // ── AUTO-RESOLVE weight from library using form's positionLevel ──
    let resolvedWeight = ''
    if (body.masterKRAId) {
      try {
        const libRow   = SpreadsheetService.getRow(
                           SpreadsheetService.getSheet(LIBRARY_SHEET),
                           body.masterKRAId)
        const posLevel = form.positionLevel || 'III'
        resolvedWeight = PositionHelper.pickEntryWeight(libRow, posLevel)
      } catch (e) {
        Logger.log('addEntry: weight resolution failed – ' + e.message)
      }
    }
    // ────────────────────────────────────────────────────────────────

    const now      = new Date().toISOString()
    const existing = _getEntries(formId)
    const order    = (body.order != null) ? body.order : (existing.length + 1)

    const entry = {
      id:                     SpreadsheetService.generateId('FE-'),
      formId,
      masterKRAId:            body.masterKRAId             || '',
      functionType:           body.functionType            || 'Core',
      kraName:                body.kraName                 || '',
      successIndicator:       body.successIndicator        || '',
      applicableRatingPeriod: body.applicableRatingPeriod  || 'Both semesters',
      weight:                 resolvedWeight,               // always server-resolved
      classification:         body.classification          || '',
      efficiencyGuide:        body.efficiencyGuide         || '',
      qualityGuide:           body.qualityGuide            || '',
      timelinessGuide:        body.timelinessGuide         || '',
      meansOfVerification:    body.meansOfVerification     || '',
      accomplishment:         body.accomplishment          || '',
      ratingEfficiency:       '',
      ratingQuality:          '',
      ratingTimeliness:       '',
      ratingAverage:          '',
      movReferences:          body.movReferences           || '',
      remarks:                body.remarks                 || '',
      isCustom:               body.isCustom ?? (!body.masterKRAId),
      order,
      createdAt: now,
      updatedAt: now
    }

    SpreadsheetService.appendRow(SpreadsheetService.getSheet(ENTRY_SHEET), entry)
    AuditService.log('ADD_ENTRY', 'IPCRF',
      `Added entry ${entry.id} to form ${formId} (weight=${resolvedWeight})`, user)
    return entry
  }

  function updateEntry(formId, entryId, body, user) {
    const profile = AuthService.getProfile(user)
    const form    = SpreadsheetService.getRow(SpreadsheetService.getSheet(FORM_SHEET), formId)
    if (!form) throw HttpError('Form not found', 404)
    guardFormAccess(form, profile)

    const sheet = SpreadsheetService.getSheet(ENTRY_SHEET)
    const entry = SpreadsheetService.getRow(sheet, entryId)
    if (!entry || entry.formId !== formId) throw HttpError('Entry not found', 404)

    // weight is always server-resolved; strip it from body
    const { id, formId: _fid, createdAt, weight, ...safe } = body

    // Re-resolve weight if the masterKRAId is changing
    let updatedWeight = entry.weight
    if (body.masterKRAId && body.masterKRAId !== entry.masterKRAId) {
      try {
        const libRow = SpreadsheetService.getRow(
                         SpreadsheetService.getSheet(LIBRARY_SHEET), body.masterKRAId)
        updatedWeight = PositionHelper.pickEntryWeight(libRow, form.positionLevel || 'III')
      } catch (e) { /* keep existing weight */ }
    }

    const updated = SpreadsheetService.updateRow(sheet, entryId, {
      ...safe,
      weight:    updatedWeight,
      updatedAt: new Date().toISOString()
    })
    AuditService.log('UPDATE_ENTRY', 'IPCRF',
      `Updated entry ${entryId} on form ${formId}`, user)
    return updated
  }

  function deleteEntry(formId, entryId, user) {
    const profile = AuthService.getProfile(user)
    const form    = SpreadsheetService.getRow(SpreadsheetService.getSheet(FORM_SHEET), formId)
    if (!form) throw HttpError('Form not found', 404)
    guardFormAccess(form, profile)
    if (!['DRAFT', 'RETURNED'].includes(form.status)) {
      throw HttpError('Entries can only be deleted from DRAFT or RETURNED forms', 400)
    }

    const sheet = SpreadsheetService.getSheet(ENTRY_SHEET)
    const entry = SpreadsheetService.getRow(sheet, entryId)
    if (!entry || entry.formId !== formId) throw HttpError('Entry not found', 404)

    const data  = sheet.getDataRange().getValues()
    const idIdx = data[0].indexOf('id')
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(entryId)) {
        sheet.deleteRow(i + 1)
        break
      }
    }
    AuditService.log('DELETE_ENTRY', 'IPCRF', `Hard deleted entry ${entryId}`, user)
    return { deleted: true }
  }

  function rateEntry(formId, entryId, body, user) {
    AuthService.requireRole(user, 'System Administrator', 'Bureau Director',
                                  'Assistant Bureau Director', 'Division Chief')
    const sheet = SpreadsheetService.getSheet(ENTRY_SHEET)
    const entry = SpreadsheetService.getRow(sheet, entryId)
    if (!entry || entry.formId !== formId) throw HttpError('Entry not found', 404)

    const e   = Number(body.ratingEfficiency) || 0
    const q   = Number(body.ratingQuality)    || 0
    const t   = Number(body.ratingTimeliness) || 0
    const avg = (e && q && t) ? Math.round(((e + q + t) / 3) * 100) / 100 : ''

    const updated = SpreadsheetService.updateRow(sheet, entryId, {
      ratingEfficiency: body.ratingEfficiency || '',
      ratingQuality:    body.ratingQuality    || '',
      ratingTimeliness: body.ratingTimeliness || '',
      ratingAverage:    avg,
      remarks:          body.remarks          || entry.remarks,
      updatedAt:        new Date().toISOString()
    })
    AuditService.log('RATE_ENTRY', 'IPCRF', `Rated entry ${entryId}: avg=${avg}`, user)
    return updated
  }

  // ─────────────────────────────────────────────────────
  //  INTERNALS
  // ─────────────────────────────────────────────────────

  function _getEntries(formId) {
    return SpreadsheetService.getAllRows(SpreadsheetService.getSheet(ENTRY_SHEET))
      .filter(r => r.formId === formId)
      .sort((a, b) => Number(a.order) - Number(b.order))
  }

  function applyScope(rows, profile) {
    const { role, id: userId, divisionId } = profile
    if (['System Administrator', 'Bureau Director'].includes(role)) return rows
    if (role === 'Assistant Bureau Director') return rows.filter(r => r.divisionId === 'admin-pool')
    if (role === 'Division Chief')            return rows.filter(r => r.divisionId === divisionId)
    return rows.filter(r => r.userId === userId)
  }

  function guardFormAccess(form, profile) {
    const { role, id: userId, divisionId } = profile
    if (['System Administrator', 'Bureau Director'].includes(role)) return
    if (role === 'Assistant Bureau Director' && form.divisionId === 'admin-pool') return
    if (role === 'Division Chief' && form.divisionId === divisionId) return
    if (form.userId === userId) return
    throw HttpError('Access denied to this form', 403)
  }

  function _adjectivalLabel(score) {
    if (score >= 4.5) return 'Outstanding'
    if (score >= 3.5) return 'Very Satisfactory'
    if (score >= 2.5) return 'Satisfactory'
    if (score >= 1.5) return 'Unsatisfactory'
    if (score > 0)    return 'Poor'
    return ''
  }

  return {
    listForms, getForm, createForm, updateForm, deleteForm,
    submitForm, approveForm, returnForm, finalizeForm, computeScore,
    listEntries, addEntry, updateEntry, deleteEntry, rateEntry
  }

})()