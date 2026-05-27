/**
 * IPCRFService.gs
 * Handles IPCRF and CCEF form lifecycle:
 *   - Create / read / update forms
 *   - Manage form entries (KRA + SI rows)
 *   - Rating submission
 *   - Computation of final scores
 */

const IPCRFService = (() => {

  // ────────────────────────────────────────────────────
  // FORMS
  // ────────────────────────────────────────────────────

  function listForms(params, user) {
    const profile = AuthService.getProfile(user)
    let rows = SpreadsheetService.getAllRows(SpreadsheetService.getSheet('IPCRForms'))

    // Filter by role
    if (['Staff','Contractor'].includes(profile.role)) {
      rows = rows.filter(r => r.userId === profile.id)
    } else if (profile.role === 'Division Chief') {
      rows = rows.filter(r => r.divisionId === profile.divisionId)
    }
    // BD/ABD/Admin see all

    // Optional filters
    if (params.semester) rows = rows.filter(r => String(r.semester) === String(params.semester))
    if (params.year)     rows = rows.filter(r => String(r.year)     === String(params.year))
    if (params.type)     rows = rows.filter(r => r.type === params.type)
    if (params.userId)   rows = rows.filter(r => r.userId === params.userId)
    if (params.divisionId) rows = rows.filter(r => r.divisionId === params.divisionId)

    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  function getForm(id, user) {
    const sheet = SpreadsheetService.getSheet('IPCRForms')
    const form  = SpreadsheetService.getRow(sheet, id)
    if (!form) throw HttpError('Form not found', 404)
    // Attach entries
    form.entries = getEntries(id, user)
    return form
  }

  function createForm(body, user) {
    const profile = AuthService.getProfile(user)
    const now     = new Date().toISOString()
    const sheet   = SpreadsheetService.getSheet('IPCRForms')

    // Determine employment type → form type
    const empType = profile.type || 'Regular'
    const formType = (empType === 'CoS' || empType === 'Contractor') ? 'CCEF' : 'IPCRF'

    const form = {
      id:                   SpreadsheetService.generateId('FORM-'),
      type:                 body.type || formType,
      userId:               profile.id,
      employeeName:         profile.fullName,
      position:             profile.position || '',
      positionLevel:        resolvePositionLevel(profile.position),
      divisionId:           profile.divisionId || body.divisionId || '',
      divisionName:         profile.divisionName || body.divisionName || '',
      semester:             body.semester || 1,
      year:                 body.year || new Date().getFullYear(),
      status:               'DRAFT',
      coreFunctionWeight:   70,
      supportFunctionWeight: 30,
      finalNumericalRating: '',
      adjectivalRating:     '',
      immediateSupervisor:  body.immediateSupervisor || '',
      supervisorPosition:   body.supervisorPosition  || '',
      approvingAuthority:   body.approvingAuthority  || 'Helen Y. Suzara',
      authorityPosition:    body.authorityPosition   || 'Bureau Director',
      dateSignedRatee:      '',
      dateSignedSupervisor: '',
      dateSignedAuthority:  '',
      feedbackStrengths:    '',
      feedbackAreasForImprovement: '',
      feedbackComments:     '',
      feedbackRecommendations: '',
      submittedAt:          '',
      approvedAt:           '',
      ratedAt:              '',
      finalizedAt:          '',
      createdAt:            now,
      updatedAt:            now
    }

    SpreadsheetService.appendRow(sheet, form)
    AuditService.log('CREATE', 'IPCRF', `Created ${form.type} form ${form.id}`, user)
    return form
  }

  function updateForm(id, body, user) {
    const sheet = SpreadsheetService.getSheet('IPCRForms')
    const form  = SpreadsheetService.getRow(sheet, id)
    if (!form) throw HttpError('Form not found', 404)

    const allowed = ['DRAFT','SUBMITTED']
    if (!allowed.includes(form.status) && body.status !== 'APPROVED') {
      const profile = AuthService.getProfile(user)
      if (!['Division Chief','Bureau Director','Assistant Bureau Director','System Administrator'].includes(profile.role)) {
        throw HttpError('Cannot edit a form that is already ' + form.status, 403)
      }
    }

    const updated = SpreadsheetService.updateRow(sheet, id, {
      ...body,
      updatedAt: new Date().toISOString()
    })
    AuditService.log('UPDATE', 'IPCRF', `Updated form ${id}: ${JSON.stringify(body).substring(0,100)}`, user)
    return updated
  }

  function submitForm(id, user) {
    const sheet = SpreadsheetService.getSheet('IPCRForms')
    const form  = SpreadsheetService.getRow(sheet, id)
    if (!form) throw HttpError('Form not found', 404)
    if (form.status !== 'DRAFT') throw HttpError('Only DRAFT forms can be submitted', 400)

    const entries = getEntries(id, user)
    if (!entries || entries.length === 0) throw HttpError('Cannot submit a form with no entries', 400)

    const updated = SpreadsheetService.updateRow(sheet, id, {
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    AuditService.log('SUBMIT', 'IPCRF', `Submitted form ${id}`, user)

    // Notify supervisor
    NotificationsService.create(
      form.userId,
      'FORM_SUBMITTED',
      `Your ${form.type} form for ${form.semester === 1 ? '1st' : '2nd'} Semester ${form.year} has been submitted.`,
      id, 'IPCRF'
    )
    return updated
  }

  function approveForm(id, body, user) {
    const profile = AuthService.getProfile(user)
    if (!['Division Chief','Bureau Director','Assistant Bureau Director','System Administrator'].includes(profile.role)) {
      throw HttpError('Only Division Chiefs and above can approve forms', 403)
    }

    const sheet = SpreadsheetService.getSheet('IPCRForms')
    const updated = SpreadsheetService.updateRow(sheet, id, {
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    AuditService.log('APPROVE', 'IPCRF', `Approved form ${id}`, user)
    return updated
  }

  function submitForRating(id, user) {
    const sheet = SpreadsheetService.getSheet('IPCRForms')
    const form  = SpreadsheetService.getRow(sheet, id)
    if (!form) throw HttpError('Form not found', 404)

    const updated = SpreadsheetService.updateRow(sheet, id, {
      status: 'FOR_RATING',
      updatedAt: new Date().toISOString()
    })
    AuditService.log('SUBMIT_RATING', 'IPCRF', `Submitted form ${id} for rating`, user)
    return updated
  }

  // ────────────────────────────────────────────────────
  // FORM ENTRIES (KRA + SI rows)
  // ────────────────────────────────────────────────────

  function getEntries(formId, user) {
    const sheet = SpreadsheetService.getSheet('FormEntries')
    const rows  = SpreadsheetService.getAllRows(sheet)
    return rows
      .filter(r => r.formId === formId)
      .sort((a, b) => Number(a.order) - Number(b.order))
  }

  function addEntry(formId, body, user) {
    const sheet   = SpreadsheetService.getSheet('IPCRForms')
    const form    = SpreadsheetService.getRow(sheet, formId)
    if (!form) throw HttpError('Form not found', 404)
    if (!['DRAFT'].includes(form.status)) {
      const profile = AuthService.getProfile(user)
      if (!['System Administrator'].includes(profile.role)) {
        throw HttpError('Can only add entries to DRAFT forms', 400)
      }
    }

    // Get position level for weight auto-selection
    const posLevel = form.positionLevel || 'III'
    let weight = body.weight

    // Auto-fill weight from MasterKRALibrary if masterKRAId provided
    if (body.masterKRAId && !weight) {
      const libSheet = SpreadsheetService.getSheet('MasterKRALibrary')
      const libRow   = SpreadsheetService.getRow(libSheet, body.masterKRAId)
      if (libRow) {
        weight = posLevel === 'II'  ? libRow.weightII  :
                 posLevel === 'IV'  ? libRow.weightIV  :
                                     libRow.weightIII
      }
    }

    const entrySheet = SpreadsheetService.getSheet('FormEntries')
    const existing   = getEntries(formId, user)
    const now        = new Date().toISOString()

    const entry = {
      id:                   SpreadsheetService.generateId('FE-'),
      formId,
      masterKRAId:          body.masterKRAId        || '',
      functionType:         body.functionType        || 'Core',
      kraName:              body.kraName             || '',
      successIndicator:     body.successIndicator    || '',
      applicableRatingPeriod: body.applicableRatingPeriod || 'Both semesters',
      weight:               weight                   || body.weight || '',
      classification:       body.classification      || '',
      efficiencyGuide:      body.efficiencyGuide     || '',
      qualityGuide:         body.qualityGuide        || '',
      timelinessGuide:      body.timelinessGuide     || '',
      meansOfVerification:  body.meansOfVerification || '',
      accomplishment:       body.accomplishment      || '',
      ratingEfficiency:     '',
      ratingQuality:        '',
      ratingTimeliness:     '',
      ratingAverage:        '',
      movReferences:        body.movReferences       || '',
      remarks:              body.remarks             || '',
      isCustom:             body.isCustom            || false,
      order:                existing.length + 1,
      createdAt:            now,
      updatedAt:            now
    }

    SpreadsheetService.appendRow(entrySheet, entry)
    AuditService.log('ADD_ENTRY', 'IPCRF', `Added entry ${entry.id} to form ${formId}`, user)
    return entry
  }

  function updateEntry(entryId, body, user) {
    const sheet = SpreadsheetService.getSheet('FormEntries')
    const updated = SpreadsheetService.updateRow(sheet, entryId, {
      ...body,
      updatedAt: new Date().toISOString()
    })
    return updated
  }

  function deleteEntry(entryId, user) {
    const sheet = SpreadsheetService.getSheet('FormEntries')
    SpreadsheetService.updateRow(sheet, entryId, {
      kraName: '[DELETED]',
      successIndicator: '[DELETED]',
      updatedAt: new Date().toISOString()
    })
    AuditService.log('DELETE_ENTRY', 'IPCRF', `Deleted entry ${entryId}`, user)
    return { success: true }
  }

  // ────────────────────────────────────────────────────
  // RATING (DC rates each entry)
  // ────────────────────────────────────────────────────

  function rateEntry(entryId, body, user) {
    const profile = AuthService.getProfile(user)
    if (!['Division Chief','Bureau Director','Assistant Bureau Director','System Administrator'].includes(profile.role)) {
      throw HttpError('Only Division Chiefs and above can rate entries', 403)
    }

    const sheet = SpreadsheetService.getSheet('FormEntries')
    const entry = SpreadsheetService.getRow(sheet, entryId)
    if (!entry) throw HttpError('Entry not found', 404)

    const e = parseFloat(body.ratingEfficiency)  || null
    const q = parseFloat(body.ratingQuality)     || null
    const t = parseFloat(body.ratingTimeliness)  || null

    // Average = sum of non-null ratings / count of non-null
    const vals = [e, q, t].filter(v => v !== null && !isNaN(v))
    const avg  = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null

    const updated = SpreadsheetService.updateRow(sheet, entryId, {
      ratingEfficiency:  e !== null ? e : 'N/A',
      ratingQuality:     q !== null ? q : 'N/A',
      ratingTimeliness:  t !== null ? t : 'N/A',
      ratingAverage:     avg !== null ? avg.toFixed(5) : '',
      accomplishment:    body.accomplishment || entry.accomplishment,
      movReferences:     body.movReferences || entry.movReferences,
      remarks:           body.remarks || entry.remarks,
      updatedAt:         new Date().toISOString()
    })

    AuditService.log('RATE_ENTRY', 'IPCRF', `Rated entry ${entryId} E:${e} Q:${q} T:${t} Avg:${avg}`, user)
    return updated
  }

  // ────────────────────────────────────────────────────
  // COMPUTE FINAL SCORE
  // ────────────────────────────────────────────────────

  function computeFormScore(formId, user) {
    const profile = AuthService.getProfile(user)
    if (!['Division Chief','Bureau Director','Assistant Bureau Director','System Administrator'].includes(profile.role)) {
      throw HttpError('Insufficient permissions', 403)
    }

    const entries = getEntries(formId, user)
    if (!entries.length) throw HttpError('No entries found for this form', 400)

    const coreEntries    = entries.filter(e => e.functionType === 'Core' || e.functionType === 'Strategic')
    const supportEntries = entries.filter(e => e.functionType === 'Support')

    function computeSectionScore(sectionEntries) {
      let totalWeight = 0
      let weightedSum = 0
      sectionEntries.forEach(e => {
        const avg = parseFloat(e.ratingAverage)
        const w   = parseFloat(e.weight)
        if (!isNaN(avg) && !isNaN(w) && w > 0) {
          totalWeight += w
          weightedSum += avg * w
        }
      })
      if (totalWeight === 0) return 0
      return weightedSum / totalWeight
    }

    const coreScore    = computeSectionScore(coreEntries)
    const supportScore = computeSectionScore(supportEntries)

    // SPMS Score = 70% core + 30% support (both already on 1-5 scale)
    const spmsScore = (coreScore * 0.70) + (supportScore * 0.30)

    const adjectival = getAdjectivalRating(spmsScore)

    // Update the form
    const formSheet = SpreadsheetService.getSheet('IPCRForms')
    SpreadsheetService.updateRow(formSheet, formId, {
      finalNumericalRating: spmsScore.toFixed(5),
      adjectivalRating:     adjectival,
      status:               'RATED',
      ratedAt:              new Date().toISOString(),
      updatedAt:            new Date().toISOString()
    })

    AuditService.log('COMPUTE_SCORE', 'IPCRF', `Computed score for form ${formId}: ${spmsScore.toFixed(5)} - ${adjectival}`, user)

    return {
      coreScore:    coreScore.toFixed(5),
      supportScore: supportScore.toFixed(5),
      spmsScore:    spmsScore.toFixed(5),
      adjectivalRating: adjectival
    }
  }

  // ────────────────────────────────────────────────────
  // MASTER KRA LIBRARY
  // ────────────────────────────────────────────────────

  function listMasterKRAs(params, user) {
    const sheet = SpreadsheetService.getSheet('MasterKRALibrary')
    let rows = SpreadsheetService.getAllRows(sheet).filter(r => r.active !== false && r.active !== 'false')

    if (params.phase)        rows = rows.filter(r => r.phase === params.phase)
    if (params.functionType) rows = rows.filter(r => r.functionType === params.functionType)
    if (params.classification) rows = rows.filter(r => r.classification === params.classification)
    if (params.search) {
      const q = params.search.toLowerCase()
      rows = rows.filter(r =>
        r.kraName.toLowerCase().includes(q) ||
        r.performanceIndicator.toLowerCase().includes(q)
      )
    }

    return rows
  }

  // ────────────────────────────────────────────────────
  // HELPERS
  // ────────────────────────────────────────────────────

  function resolvePositionLevel(position) {
    if (!position) return 'III'
    const p = position.toLowerCase()
    if (p.includes(' ii') || p.match(/\bii\b/))  return 'II'
    if (p.includes(' iv') || p.match(/\biv\b/))  return 'IV'
    return 'III'  // Default: SWO III, PDO III, ITO I
  }

  function getAdjectivalRating(score) {
    if (score >= 4.500) return 'Outstanding'
    if (score >= 3.500) return 'Very Satisfactory'
    if (score >= 2.500) return 'Satisfactory'
    if (score >= 1.500) return 'Unsatisfactory'
    return 'Poor'
  }

  return {
    listForms, getForm, createForm, updateForm,
    submitForm, approveForm, submitForRating,
    getEntries, addEntry, updateEntry, deleteEntry,
    rateEntry, computeFormScore,
    listMasterKRAs
  }
})()
