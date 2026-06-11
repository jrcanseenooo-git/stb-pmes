const KraLibraryService = (() => {

  const SHEET_NAME = 'MasterKRALibrary'

  // ── LIST – returns all active KRAs, optional filters ──
  function list(params, user) {
    // Everyone can read the library
    const sheet = _getSheet()
    let rows    = SpreadsheetService.getAllRows(sheet)
                    .filter(r => r.active !== false && r.active !== 'false')

    if (params.functionType) rows = rows.filter(r => r.functionType === params.functionType)
    if (params.kraName)      rows = rows.filter(r => r.kraName      === params.kraName)
    if (params.divisionId)   rows = rows.filter(r => !r.divisionId || r.divisionId === params.divisionId)
    if (params.search) {
      const q = params.search.toLowerCase()
      rows = rows.filter(r =>
        r.kraName?.toLowerCase().includes(q) ||
        r.successIndicator?.toLowerCase().includes(q)
      )
    }

    return SpreadsheetService.paginate(rows, params.page, params.pageSize || 200)
  }

  // ── GET single entry ──
  function get(id, user) {
    const row = SpreadsheetService.getRow(_getSheet(), id)
    if (!row) throw HttpError('KRA library entry not found', 404)
    return row
  }

  // ── CREATE (admin only) ──
  function create(body, user) {
    AuthService.requireRole(user, 'System Administrator', 'Bureau Director', 'Division Chief')
    const now = new Date().toISOString()
    const entry = {
      id:                     SpreadsheetService.generateId('MKL-'),
      functionType:           body.functionType           || 'Core',
      kraName:                body.kraName                || '',
      successIndicator:       body.successIndicator       || '',
      applicableRatingPeriod: body.applicableRatingPeriod || 'Both semesters',
      weight:                 body.weight                 || '',
      classification:         body.classification         || '',
      efficiencyGuide:        body.efficiencyGuide        || '',
      qualityGuide:           body.qualityGuide           || '',
      timelinessGuide:        body.timelinessGuide        || '',
      meansOfVerification:    body.meansOfVerification    || '',
      divisionId:             body.divisionId             || '',
      active:                 true,
      createdAt:              now,
      updatedAt:              now
    }
    SpreadsheetService.appendRow(_getSheet(), entry)
    AuditService.log('CREATE', 'KraLibrary', `Created library entry: ${entry.id}`, user)
    return entry
  }

  // ── UPDATE (admin / bureau director / division chief) ──
  function update(id, body, user) {
    AuthService.requireRole(user, 'System Administrator', 'Bureau Director', 'Division Chief')
    const sheet = _getSheet()
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('KRA library entry not found', 404)

    const { id: _id, createdAt, ...safe } = body
    const updated = SpreadsheetService.updateRow(sheet, id, { ...safe, updatedAt: new Date().toISOString() })
    AuditService.log('UPDATE', 'KraLibrary', `Updated library entry: ${id}`, user)
    return updated
  }

  // ── SOFT-DELETE (admin only) ──
  function remove(id, user) {
    AuthService.requireRole(user, 'System Administrator')
    const sheet = _getSheet()
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('KRA library entry not found', 404)
    SpreadsheetService.updateRow(sheet, id, { active: false, updatedAt: new Date().toISOString() })
    AuditService.log('DELETE', 'KraLibrary', `Deactivated library entry: ${id}`, user)
    return { deleted: true }
  }

  // ── Internal ──
  function _getSheet() {
    try {
      return SpreadsheetService.getSheet(SHEET_NAME)
    } catch (e) {
      // Sheet may not exist yet; return empty-ish wrapper so reads degrade gracefully
      throw HttpError(`Sheet "${SHEET_NAME}" not found – run InitSheets to create it`, 500)
    }
  }

  return { list, get, create, update, remove }

})()