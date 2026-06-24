/**
 * AccomplishmentsService.gs
 * Handles all IPCR / CCEF accomplishment CRUD, status workflow,
 * approval, revision requests, and history tracking.
 */

const AccomplishmentsService = (() => {

  const RATING_FIELDS = [
    'accomplishment', 'movReferences',
    'ratingEfficiency', 'ratingQuality', 'ratingTimeliness', 'ratingAverage'
  ]

  const ALLOWED_TRANSITIONS = {
    'Not Started':  ['Ongoing'],
    'Ongoing':      ['Submitted', 'Delayed'],
    'Submitted':    ['Approved', 'For Revision'],
    'For Revision': ['Submitted', 'Ongoing'],
    'Approved':     ['Completed'],
    'Delayed':      ['Ongoing', 'Submitted'],
    'Completed':    []
  }

  // â”€â”€ LIST (with filters + pagination) â”€â”€
  function list(params, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    _ensureColumns(sheet, RATING_FIELDS)
    let rows      = SpreadsheetService.getAllRows(sheet).filter(r => !r.deleted)

    // Scope by role
    rows = applyRoleScope(rows, profile)

    // Apply query filters
    const filters = {
      divisionId: params.divisionId || '',
      kraId:      params.kraId      || '',
      formId:     params.formId     || ''
    }
    rows = SpreadsheetService.filterRows(rows, filters)

    // Text search
    if (params.search) {
      const q = params.search.toLowerCase()
      rows = rows.filter(r =>
        r.employeeName?.toLowerCase().includes(q) ||
        r.target?.toLowerCase().includes(q) ||
        r.kraTitle?.toLowerCase().includes(q)
      )
    }

    return SpreadsheetService.paginate(rows, params.page, params.pageSize)
  }

  // â”€â”€ GET single â”€â”€
  function get(id, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    _ensureColumns(sheet, RATING_FIELDS)
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Accomplishment not found', 404)
    guardAccess(row, profile)
    return row
  }

  // â”€â”€ CREATE â”€â”€
  function create(body, user) {
    const profile = AuthService.getProfile(user)
    const sheet = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    _ensureColumns(sheet, RATING_FIELDS)

    // Staff can only create for themselves
    if (profile.role === 'Staff' && body.userId && body.userId !== profile.id) {
      throw HttpError('Staff can only create entries for themselves', 403)
    }

    const now  = new Date().toISOString()
    const entry = {
      id:            SpreadsheetService.generateId('ACC-'),
      userId:        body.userId        || profile.id,
      employeeName:  body.employeeName  || profile.fullName,
      divisionId:    body.divisionId    || profile.divisionId,
      division:      body.division      || profile.divisionName,
      formId:        body.formId        || '',
      entryId:       body.entryId       || '',
      kraId:         body.kraId         || '',
      kraTitle:      body.kraTitle      || '',
      siId:          body.siId          || '',
      target:        body.target        || '',
      accomplishment: body.accomplishment || '',
      movReferences: body.movReferences || '',
      ratingEfficiency: body.ratingEfficiency || '',
      ratingQuality: body.ratingQuality || '',
      ratingTimeliness: body.ratingTimeliness || '',
      ratingAverage: body.ratingAverage || '',
      remarks:       '',
      revisions:     0,
      movCount:      0,
      type:          body.type          || 'IPCR',   // IPCR | CCEF
      semester:      body.semester      || '',
      year:          body.year          || new Date().getFullYear(),
      createdBy:     profile.id,
      createdAt:     now,
      updatedAt:     now,
      deleted:       false
    }

    SpreadsheetService.appendRow(sheet, entry)
    AuditService.log('CREATE', 'Accomplishments', `Created entry: ${entry.id}`, user)
    return entry
  }

  // â”€â”€ UPDATE â”€â”€
  function update(id, body, user) {
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    _ensureColumns(sheet, RATING_FIELDS)
    const existing = SpreadsheetService.getRow(sheet, id)
    if (!existing) throw HttpError('Accomplishment not found', 404)
    guardAccess(existing, profile)

    // Only these fields are editable through the generic update endpoint.
    // Status changes must go through updateStatus()/approve()/requestRevision(),
    // which enforce ALLOWED_TRANSITIONS and role checks â€” letting `status` pass
    // through here would let anyone set their own record to "Approved"/"Completed"
    // without real sign-off, which would also have quietly defeated the IPCRF
    // Ratings-readiness check that depends on this status being trustworthy.
    const EDITABLE = [
      'accomplishment', 'remarks', 'targetQty', 'targetUnit',
      'movReferences', 'ratingEfficiency', 'ratingQuality', 'ratingTimeliness', 'ratingAverage'
    ]
    const patch = {}
    EDITABLE.forEach(k => { if (body[k] !== undefined) patch[k] = body[k] })

    if (
      patch.ratingAverage === undefined &&
      (patch.ratingEfficiency !== undefined || patch.ratingQuality !== undefined || patch.ratingTimeliness !== undefined)
    ) {
      patch.ratingAverage = _computeRatingAverage({
        ratingEfficiency: patch.ratingEfficiency !== undefined ? patch.ratingEfficiency : existing.ratingEfficiency,
        ratingQuality: patch.ratingQuality !== undefined ? patch.ratingQuality : existing.ratingQuality,
        ratingTimeliness: patch.ratingTimeliness !== undefined ? patch.ratingTimeliness : existing.ratingTimeliness
      })
    }

    // KRA/target text is only editable here if this record isn't linked to an
    // official IPCRF/CCEF entry â€” once linked, that text belongs to the form.
    if (!existing.formId) {
      ['kraName', 'kraTitle', 'successIndicator', 'target'].forEach(k => {
        if (body[k] !== undefined) patch[k] = body[k]
      })
    }

    const updated = SpreadsheetService.updateRow(sheet, id, {
      ...patch,
      updatedAt: new Date().toISOString()
    })

    _syncLinkedFormEntry(existing, patch)
    AuditService.log('UPDATE', 'Accomplishments', `Updated entry: ${id}`, user)
    return updated
  }

  // â”€â”€ UPDATE STATUS â”€â”€
  function updateStatus(id, body, user) {
    const { status, remarks } = body
    const profile = AuthService.getProfile(user)
    const sheet   = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    const row     = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Not found', 404)
    guardAccess(row, profile)

    const allowed = ALLOWED_TRANSITIONS[row.status] || []
    if (!allowed.includes(status)) {
      throw HttpError(`Cannot transition from "${row.status}" to "${status}"`, 400)
    }

    // Sign-off transitions require an approver role, even through this shared
    // function â€” approve()/requestRevision() are thin wrappers around this, so
    // the check needs to live here too, not just in the wrapper.
    const APPROVER_ROLES = ['System Administrator', 'Bureau Director', 'Assistant Bureau Director', 'Division Chief', 'Section Head']
    if (['Approved', 'For Revision'].includes(status) && !APPROVER_ROLES.includes(profile.role)) {
      throw HttpError('Only an approver can set this status', 403)
    }

    const updated = SpreadsheetService.updateRow(sheet, id, {
      status,
      remarks:   remarks || row.remarks,
      updatedAt: new Date().toISOString(),
      submittedAt: status === 'Submitted' ? new Date().toISOString() : row.submittedAt,
      approvedAt:  status === 'Approved'  ? new Date().toISOString() : row.approvedAt,
      approvedBy:  status === 'Approved'  ? profile.id                : row.approvedBy
    })

    logRevision(id, row.status, status, remarks, profile)
    AuditService.log('STATUS_CHANGE', 'Accomplishments', `${id}: ${row.status} â†’ ${status}`, user)
    NotificationsService.createForStatusChange(updated, status, profile)
    return updated
  }

  // â”€â”€ APPROVE â”€â”€
  function approve(id, body, user) {
    const profile = AuthService.requireRole(user, 'System Administrator', 'Bureau Director', 'Assistant Bureau Director', 'Division Chief', 'Section Head')
    return updateStatus(id, { status: 'Approved', remarks: body.remarks }, user)
  }

  // â”€â”€ REQUEST REVISION â”€â”€
  function requestRevision(id, body, user) {
    AuthService.requireRole(user, 'System Administrator', 'Bureau Director', 'Assistant Bureau Director', 'Division Chief', 'Section Head')
    const sheet = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Not found', 404)

    // Increment revision counter
    SpreadsheetService.updateRow(sheet, id, { revisions: (Number(row.revisions) || 0) + 1 })

    return updateStatus(id, { status: 'For Revision', remarks: body.remarks }, user)
  }

  // â”€â”€ HISTORY â”€â”€
  function history(id, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.REVISIONS)
    return SpreadsheetService.getAllRows(sheet).filter(r => r.accomplishmentId === id)
  }

  // â”€â”€ Internals â”€â”€
  function applyRoleScope(rows, profile) {
    const { role, id: userId, divisionId, section } = profile
    if (role === 'System Administrator' || role === 'Bureau Director') return rows
    if (role === 'Assistant Bureau Director') return rows.filter(r => r.divisionId === 'admin-pool')
    if (role === 'Division Chief') return rows.filter(r => r.divisionId === divisionId)
    if (role === 'Section Head') {
      const sectionMap = _sectionMap()
      return rows.filter(r => r.divisionId === divisionId && sectionMap[r.userId] === section)
    }
    return rows.filter(r => r.userId === userId) // Staff: own only
  }

  function _sectionMap() {
    const usersSheet = SpreadsheetService.getSheet(SHEET.USERS)
    const map = {}
    SpreadsheetService.getAllRows(usersSheet).forEach(u => { if (u.id) map[u.id] = u.section || '' })
    return map
  }

  function guardAccess(row, profile) {
    const { role, id: userId, divisionId, section } = profile
    if (['System Administrator', 'Bureau Director'].includes(role)) return
    if (role === 'Assistant Bureau Director' && row.divisionId === 'admin-pool') return
    if (role === 'Division Chief' && row.divisionId === divisionId) return
    if (role === 'Section Head' && row.divisionId === divisionId && _sectionMap()[row.userId] === section) return
    if (row.userId === userId) return
    throw HttpError('Access denied to this record', 403)
  }

  function _ensureColumns(sheet, headers) {
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim())
    const missing = headers.filter(h => !existingHeaders.includes(h))
    if (!missing.length) return

    const startCol = sheet.getLastColumn() + 1
    missing.forEach((header, idx) => {
      sheet.getRange(1, startCol + idx)
        .setValue(header)
        .setBackground('#0D2137')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold')
        .setFontSize(10)
    })
  }

  function _computeRatingAverage(row) {
    const values = [row.ratingEfficiency, row.ratingQuality, row.ratingTimeliness]
      .filter(v => v !== '' && v !== null && v !== undefined && String(v).toUpperCase() !== 'N/A')
      .map(Number)
      .filter(n => !Number.isNaN(n))
    if (!values.length) return ''
    return Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 100000) / 100000
  }

  function _syncLinkedFormEntry(existing, patch) {
    if (!existing.formId || !existing.entryId) return
    const updates = {}
    RATING_FIELDS.forEach(field => {
      if (patch[field] !== undefined) updates[field] = patch[field]
    })
    if (patch.remarks !== undefined) updates.remarks = patch.remarks
    if (!Object.keys(updates).length) return

    try {
      SpreadsheetService.updateRow(SpreadsheetService.getSheet(SHEET.FORM_ENTRIES), existing.entryId, {
        ...updates,
        updatedAt: new Date().toISOString()
      })
    } catch (e) {
      Logger.log('[Accomplishments] Could not sync linked FormEntries row: ' + e.message)
    }
  }

  function logRevision(accomplishmentId, fromStatus, toStatus, remarks, profile) {
    const sheet = SpreadsheetService.getSheet(SHEET.REVISIONS)
    SpreadsheetService.appendRow(sheet, {
      id:               SpreadsheetService.generateId('REV-'),
      accomplishmentId,
      fromStatus,
      toStatus,
      remarks:          remarks || '',
      changedBy:        profile.id,
      changedByName:    profile.fullName,
      changedAt:        new Date().toISOString()
    })
  }
  // Completeness check for IPCRF/CCEF Ratings generation. Linked rows are ready once they exist.
  function completenessForForm(formId) {
    const sheet = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    const rows  = SpreadsheetService.getAllRows(sheet).filter(r => r.formId === formId && !r.deleted)
    return { total: rows.length, ready: rows.length, isReady: rows.length > 0 }
  }

  // â”€â”€ Called from IPCRFService when an entry is removed from a Targets form â”€â”€
  function softDeleteByEntryId(entryId, user) {
    const sheet = SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS)
    const row   = SpreadsheetService.getAllRows(sheet).find(r => r.entryId === entryId && !r.deleted)
    if (!row) return null
    return SpreadsheetService.updateRow(sheet, row.id, { deleted: true, deletedAt: new Date().toISOString() })
  }

  return { list, get, create, update, updateStatus, approve, requestRevision, history, completenessForForm, softDeleteByEntryId }
})()
