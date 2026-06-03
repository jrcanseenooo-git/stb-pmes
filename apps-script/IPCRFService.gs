const IPCRFService = (() => {

  /** List all forms visible to the requester */
  function listForms(params, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    let rows      = SpreadsheetService.getAllRows(sheet)

    // Scope by role
    if (profile.role === 'Staff / Employee') {
      rows = rows.filter(r => r.userId === profile.id)
    } else if (profile.role === 'Division Chief') {
      rows = rows.filter(r => r.divisionId === profile.divisionId)
    }
    // System Admin / Bureau Director / ABD see all

    // Filters
    if (params.type)     rows = rows.filter(r => r.type     === params.type)
    if (params.semester) rows = rows.filter(r => String(r.semester) === String(params.semester))
    if (params.year)     rows = rows.filter(r => String(r.year)     === String(params.year))
    if (params.status)   rows = rows.filter(r => r.status   === params.status)
    if (params.userId)   rows = rows.filter(r => r.userId   === params.userId)

    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  /** Get a single form by id */
  function getForm(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Form not found', 404)
    _guardFormAccess(row, profile)
    return row
  }

  /** Create a new IPCRF/CCEF form (DRAFT) */
  function createForm(body, user) {
    const profile = AuthService.getProfile(user)
    const now     = new Date().toISOString()
    const year    = body.year || new Date().getFullYear()
    const semester = body.semester || (new Date().getMonth() < 6 ? 1 : 2)

    const form = {
      id:                     SpreadsheetService.generateId('FORM-'),
      type:                   body.type || 'IPCRF',
      userId:                 profile.id,
      employeeName:           profile.fullName,
      position:               profile.position        || '',
      positionLevel:          profile.positionLevel   || 'III',
      divisionId:             profile.divisionId      || '',
      divisionName:           profile.divisionName    || '',
      semester:               semester,
      year:                   year,
      status:                 'DRAFT',
      coreFunctionWeight:     body.coreFunctionWeight     || 70,
      supportFunctionWeight:  body.supportFunctionWeight  || 30,
      finalNumericalRating:   '',
      adjectivalRating:       '',
      immediateSupervisor:    body.immediateSupervisor    || '',
      supervisorPosition:     body.supervisorPosition     || '',
      approvingAuthority:     body.approvingAuthority     || '',
      authorityPosition:      body.authorityPosition      || '',
      dateSignedRatee:        '',
      dateSignedSupervisor:   '',
      dateSignedAuthority:    '',
      feedbackStrengths:      '',
      feedbackAreasForImprovement: '',
      feedbackComments:       '',
      feedbackRecommendations:'',
      submittedAt:            '',
      approvedAt:             '',
      ratedAt:                '',
      finalizedAt:            '',
      createdAt:              now,
      updatedAt:              now
    }

    SpreadsheetService.appendRow(SpreadsheetService.getSheet(SHEET.IPCRF_FORMS), form)
    AuditService.log('CREATE', 'IPCRF', `Created ${form.type} form ${form.id}`, user)
    return form
  }

  /** Update form metadata (supervisor, weights, etc.) */
  function updateForm(id, body, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const form    = SpreadsheetService.getRow(sheet, id)
    if (!form) throw HttpError('Form not found', 404)
    _guardFormAccess(form, profile)
    if (['APPROVED', 'FINALIZED'].includes(form.status)) {
      throw HttpError('Cannot edit a finalized or approved form', 400)
    }

    const ALLOWED = [
      'immediateSupervisor','supervisorPosition','approvingAuthority','authorityPosition',
      'coreFunctionWeight','supportFunctionWeight','feedbackStrengths',
      'feedbackAreasForImprovement','feedbackComments','feedbackRecommendations'
    ]
    const updates = { updatedAt: new Date().toISOString() }
    ALLOWED.forEach(f => { if (body[f] !== undefined) updates[f] = body[f] })

    const updated = SpreadsheetService.updateRow(sheet, id, updates)
    AuditService.log('UPDATE', 'IPCRF', `Updated form ${id}: ${JSON.stringify(updates)}`, user)
    return updated
  }

  /** Submit form for DC review */
  function submitForm(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const form    = SpreadsheetService.getRow(sheet, id)
    if (!form) throw HttpError('Form not found', 404)
    _guardFormAccess(form, profile)
    if (form.status !== 'DRAFT') throw HttpError('Only DRAFT forms can be submitted', 400)

    const entries = _getFormEntries(id)
    if (entries.length === 0) throw HttpError('Cannot submit a form with no entries', 400)

    const updated = SpreadsheetService.updateRow(sheet, id, {
      status:      'SUBMITTED',
      submittedAt: new Date().toISOString(),
      updatedAt:   new Date().toISOString()
    })
    AuditService.log('SUBMIT', 'IPCRF', `Submitted form ${id}`, user)
    return updated
  }

  /** Approve form (Division Chief / Admin) */
  function approveForm(id, body, user) {
    AuthService.requireRole(user,
      'System Administrator', 'Bureau Director',
      'Assistant Bureau Director', 'Division Chief'
    )
    const sheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const form  = SpreadsheetService.getRow(sheet, id)
    if (!form) throw HttpError('Form not found', 404)
    if (!['SUBMITTED', 'RETURNED'].includes(form.status)) {
      throw HttpError('Only SUBMITTED or RETURNED forms can be approved', 400)
    }

    const updated = SpreadsheetService.updateRow(sheet, id, {
      status:     'APPROVED',
      approvedAt: new Date().toISOString(),
      updatedAt:  new Date().toISOString(),
      feedbackStrengths:           body.feedbackStrengths           || form.feedbackStrengths,
      feedbackAreasForImprovement: body.feedbackAreasForImprovement || form.feedbackAreasForImprovement,
      feedbackComments:            body.feedbackComments            || form.feedbackComments,
      feedbackRecommendations:     body.feedbackRecommendations     || form.feedbackRecommendations
    })
    AuditService.log('APPROVE', 'IPCRF', `Approved form ${id}`, user)
    return updated
  }

  /** Return form to staff for correction */
  function returnForm(id, body, user) {
    AuthService.requireRole(user,
      'System Administrator', 'Bureau Director',
      'Assistant Bureau Director', 'Division Chief'
    )
    const sheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const form  = SpreadsheetService.getRow(sheet, id)
    if (!form) throw HttpError('Form not found', 404)
    if (form.status !== 'SUBMITTED') throw HttpError('Only SUBMITTED forms can be returned', 400)

    const updated = SpreadsheetService.updateRow(sheet, id, {
      status:    'RETURNED',
      updatedAt: new Date().toISOString(),
      feedbackComments: body.remarks || ''
    })
    AuditService.log('RETURN', 'IPCRF', `Returned form ${id}: ${body.remarks || ''}`, user)
    return updated
  }

  /** Compute and save the final rating for a form */
  function computeScore(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const form    = SpreadsheetService.getRow(sheet, id)
    if (!form) throw HttpError('Form not found', 404)
    _guardFormAccess(form, profile)

    const entries = _getFormEntries(id).filter(e => e.ratingAverage)

    const coreEntries    = entries.filter(e => e.functionType === 'Core')
    const supportEntries = entries.filter(e => e.functionType === 'Support')

    const coreAvg    = coreEntries.length    ? _weightedAvg(coreEntries)    : 0
    const supportAvg = supportEntries.length ? _weightedAvg(supportEntries) : 0

    const coreWeight    = (Number(form.coreFunctionWeight)    || 70) / 100
    const supportWeight = (Number(form.supportFunctionWeight) || 30) / 100

    const finalRating = _round(coreAvg * coreWeight + supportAvg * supportWeight, 3)
    const adjectival  = _adjectivalRating(finalRating)

    const updated = SpreadsheetService.updateRow(sheet, id, {
      finalNumericalRating: finalRating,
      adjectivalRating:     adjectival,
      ratedAt:              new Date().toISOString(),
      updatedAt:            new Date().toISOString()
    })
    AuditService.log('COMPUTE_SCORE', 'IPCRF', `Computed score for form ${id}: ${finalRating} (${adjectival})`, user)
    return updated
  }

  // ─────────────────────────────────────────────
  // ENTRY CRUD
  // ─────────────────────────────────────────────

  /** Get all entries for a form (excludes hard-deleted rows) */
  function getEntries(formId, user) {
    const profile = AuthService.getProfile(user)
    const form    = SpreadsheetService.getRow(SpreadsheetService.getSheet(SHEET.IPCRF_FORMS), formId)
    if (!form) throw HttpError('Form not found', 404)
    _guardFormAccess(form, profile)
    return _getFormEntries(formId)
  }

  /** Add an entry to a form (from library or custom) */
  function addEntry(formId, body, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const form    = SpreadsheetService.getRow(sheet, formId)
    if (!form) throw HttpError('Form not found', 404)
    _guardFormAccess(form, profile)
    if (['APPROVED', 'FINALIZED'].includes(form.status)) {
      throw HttpError('Cannot add entries to an approved/finalized form', 400)
    }

    const now = new Date().toISOString()
    const existing = _getFormEntries(formId)
    const nextOrder = existing.length + 1

    const entry = {
      id:                     SpreadsheetService.generateId('FE-'),
      formId:                 formId,
      masterKRAId:            body.masterKRAId            || '',
      functionType:           body.functionType           || 'Core',
      kraName:                body.kraName                || '',
      successIndicator:       body.successIndicator       || '',
      applicableRatingPeriod: body.applicableRatingPeriod || 'Both semesters',
      weight:                 body.weight                 || 0,
      classification:         body.classification         || '',
      efficiencyGuide:        body.efficiencyGuide        || '',
      qualityGuide:           body.qualityGuide           || '',
      timelinessGuide:        body.timelinessGuide        || '',
      meansOfVerification:    body.meansOfVerification    || '',
      accomplishment:         '',
      ratingEfficiency:       '',
      ratingQuality:          '',
      ratingTimeliness:       '',
      ratingAverage:          '',
      movReferences:          '',
      remarks:                '',
      isCustom:               body.isCustom || false,
      order:                  body.order    || nextOrder,
      createdAt:              now,
      updatedAt:              now
    }

    SpreadsheetService.appendRow(SpreadsheetService.getSheet(SHEET.FORM_ENTRIES), entry)
    AuditService.log('ADD_ENTRY', 'IPCRF', `Added entry ${entry.id} to form ${formId}`, user)

    // Update form's updatedAt
    SpreadsheetService.updateRow(sheet, formId, { updatedAt: now })

    return entry
  }

  /** Update an entry (accomplishment, ratings, remarks, etc.) */
  function updateEntry(entryId, body, user) {
    const profile      = AuthService.getProfile(user)
    const entrySheet   = SpreadsheetService.getSheet(SHEET.FORM_ENTRIES)
    const entry        = SpreadsheetService.getRow(entrySheet, entryId)
    if (!entry) throw HttpError('Entry not found', 404)

    const formSheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const form      = SpreadsheetService.getRow(formSheet, entry.formId)
    if (!form) throw HttpError('Parent form not found', 404)
    _guardFormAccess(form, profile)

    if (['APPROVED', 'FINALIZED'].includes(form.status)) {
      throw HttpError('Cannot edit entries on an approved/finalized form', 400)
    }

    // Whitelist of fields that may be updated
    const ALLOWED = [
      'accomplishment',
      'ratingEfficiency', 'ratingQuality', 'ratingTimeliness', 'ratingAverage',
      'movReferences', 'remarks',
      'kraName', 'successIndicator', 'weight', 'functionType',
      'applicableRatingPeriod', 'classification',
      'efficiencyGuide', 'qualityGuide', 'timelinessGuide', 'meansOfVerification',
      'order'
    ]

    const updates = { updatedAt: new Date().toISOString() }
    ALLOWED.forEach(f => {
      if (Object.prototype.hasOwnProperty.call(body, f)) updates[f] = body[f]
    })

    // Auto-compute ratingAverage if individual ratings provided
    const e  = Number(updates.ratingEfficiency  ?? entry.ratingEfficiency)
    const q  = Number(updates.ratingQuality     ?? entry.ratingQuality)
    const t  = Number(updates.ratingTimeliness  ?? entry.ratingTimeliness)
    if (e && q && t) {
      updates.ratingAverage = _round((e + q + t) / 3, 2)
    }

    const updated = SpreadsheetService.updateRow(entrySheet, entryId, updates)
    AuditService.log('UPDATE_ENTRY', 'IPCRF', `Updated entry ${entryId}`, user)
    return updated
  }

  /** Hard-delete an entry (physically removes the row) */
  function deleteEntry(entryId, user) {
    const profile    = AuthService.getProfile(user)
    const entrySheet = SpreadsheetService.getSheet(SHEET.FORM_ENTRIES)
    const entry      = SpreadsheetService.getRow(entrySheet, entryId)
    if (!entry) throw HttpError('Entry not found', 404)

    const formSheet = SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)
    const form      = SpreadsheetService.getRow(formSheet, entry.formId)
    if (!form) throw HttpError('Parent form not found', 404)
    _guardFormAccess(form, profile)

    if (['APPROVED', 'FINALIZED'].includes(form.status)) {
      throw HttpError('Cannot delete entries from an approved/finalized form', 400)
    }

    SpreadsheetService.hardDeleteRow(entrySheet, entryId)
    AuditService.log('DELETE_ENTRY', 'IPCRF', `Deleted entry ${entryId}`, user)

    // Update form's updatedAt
    SpreadsheetService.updateRow(formSheet, entry.formId, { updatedAt: new Date().toISOString() })

    return { deleted: true, id: entryId }
  }

  // ─────────────────────────────────────────────
  // KRA LIBRARY
  // ─────────────────────────────────────────────

  /** Get all master KRAs with optional filters */
  function getLibrary(params, user) {
    AuthService.getProfile(user) // must be authenticated
    const sheet = SpreadsheetService.getSheet(SHEET.MASTER_KRA_LIBRARY)
    let rows    = SpreadsheetService.getAllRows(sheet).filter(r => r.isActive !== false && r.isActive !== 'FALSE')

    if (params.functionType)    rows = rows.filter(r => r.functionType    === params.functionType)
    if (params.phase)           rows = rows.filter(r => r.phase           === params.phase)
    if (params.classification)  rows = rows.filter(r => r.classification  === params.classification)
    if (params.search) {
      const q = params.search.toLowerCase()
      rows = rows.filter(r =>
        r.kraName?.toLowerCase().includes(q) ||
        r.successIndicator?.toLowerCase().includes(q)
      )
    }
    return rows
  }

  // ─────────────────────────────────────────────
  // INTERNALS
  // ─────────────────────────────────────────────

  function _getFormEntries(formId) {
    const sheet = SpreadsheetService.getSheet(SHEET.FORM_ENTRIES)
    return SpreadsheetService.getAllRows(sheet)
      .filter(r => r.formId === formId)
      .sort((a, b) => Number(a.order) - Number(b.order))
  }

  function _guardFormAccess(form, profile) {
    const { role, id: userId, divisionId } = profile
    if (['System Administrator', 'Bureau Director'].includes(role)) return
    if (role === 'Assistant Bureau Director') return
    if (role === 'Division Chief' && form.divisionId === divisionId) return
    if (form.userId === userId) return
    throw HttpError('Access denied to this form', 403)
  }

  function _weightedAvg(entries) {
    const totalWeight = entries.reduce((s, e) => s + (Number(e.weight) || 0), 0)
    if (!totalWeight) {
      const sum = entries.reduce((s, e) => s + (Number(e.ratingAverage) || 0), 0)
      return entries.length ? sum / entries.length : 0
    }
    const weighted = entries.reduce((s, e) => s + (Number(e.ratingAverage) || 0) * (Number(e.weight) || 0), 0)
    return weighted / totalWeight
  }

  function _adjectivalRating(score) {
    if (score >= 4.500) return 'Outstanding'
    if (score >= 3.500) return 'Very Satisfactory'
    if (score >= 2.500) return 'Satisfactory'
    if (score >= 1.500) return 'Unsatisfactory'
    return 'Poor'
  }

  function _round(val, decimals) {
    return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals)
  }

  return {
    listForms, getForm, createForm, updateForm,
    submitForm, approveForm, returnForm, computeScore,
    getEntries, addEntry, updateEntry, deleteEntry,
    getLibrary
  }
})()