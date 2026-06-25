const FocalAssignmentService = (() => {
  const SHEET_NAME = 'FocalAssignments'
  const TYPES = {
    DIVISION: 'Division Focal',
    BUREAU: 'Bureau Focal'
  }
  const HEADERS = [
    'id', 'assignmentType', 'divisionId', 'divisionName',
    'userId', 'userName', 'userEmail', 'active',
    'assignedBy', 'assignedByName', 'assignedAt', 'updatedAt'
  ]

  function list(params, user) {
    AuthService.requireRole(user, 'System Administrator', 'Bureau Director', 'Assistant Bureau Director')

    const assignments = _activeAssignments()
    const users = _activeUsers()
    const divisions = _activeDivisions()

    return {
      bureauFocal: assignments.find(a => a.assignmentType === TYPES.BUREAU) || null,
      divisionFocals: divisions.map(division => {
        const found = assignments.find(a =>
          a.assignmentType === TYPES.DIVISION &&
          String(a.divisionId || '') === String(division.id || '')
        )
        return {
          divisionId: division.id,
          divisionName: division.name,
          assignmentId: found ? found.id : '',
          userId: found ? found.userId : '',
          userName: found ? found.userName : '',
          userEmail: found ? found.userEmail : ''
        }
      }),
      users: users.map(_safeUser),
      divisions
    }
  }

  function save(body, user) {
    const profile = AuthService.requireRole(user, 'System Administrator')
    const now = new Date().toISOString()
    const sheet = _sheet()
    const usersById = _indexBy(_activeUsers(), 'id')
    const divisionsById = _indexBy(_activeDivisions(), 'id')

    if (body.bureauFocalUserId !== undefined) {
      _replaceAssignment(sheet, {
        assignmentType: TYPES.BUREAU,
        divisionId: '',
        divisionName: '',
        user: usersById[String(body.bureauFocalUserId || '')],
        profile,
        now
      })
    }

    _parseDivisionFocals(body.divisionFocals).forEach(item => {
      const division = divisionsById[String(item.divisionId || '')]
      if (!division) throw HttpError('Division not found: ' + item.divisionId, 404)
      _replaceAssignment(sheet, {
        assignmentType: TYPES.DIVISION,
        divisionId: division.id,
        divisionName: division.name,
        user: usersById[String(item.userId || '')],
        profile,
        now
      })
    })

    AuditService.log(
      'SAVE_FOCAL_ASSIGNMENTS',
      'Administration',
      'Updated division and bureau focal assignments',
      user
    )
    return list({}, user)
  }

  function getDivisionFocal(divisionId) {
    return _activeAssignments().find(a =>
      a.assignmentType === TYPES.DIVISION &&
      String(a.divisionId || '') === String(divisionId || '')
    ) || null
  }

  function getBureauFocal() {
    return _activeAssignments().find(a => a.assignmentType === TYPES.BUREAU) || null
  }

  function isDivisionFocal(profile, divisionId) {
    const focal = getDivisionFocal(divisionId)
    return !!(focal && profile && String(focal.userId) === String(profile.id))
  }

  function isBureauFocal(profile) {
    const focal = getBureauFocal()
    return !!(focal && profile && String(focal.userId) === String(profile.id))
  }

  function _replaceAssignment(sheet, data) {
    _deactivateExisting(sheet, data.assignmentType, data.divisionId, data.now)
    if (!data.user) return

    SpreadsheetService.appendRow(sheet, {
      id: SpreadsheetService.generateId('FOC-'),
      assignmentType: data.assignmentType,
      divisionId: data.divisionId || '',
      divisionName: data.divisionName || '',
      userId: data.user.id,
      userName: _userName(data.user),
      userEmail: data.user.email || '',
      active: true,
      assignedBy: data.profile.id,
      assignedByName: _userName(data.profile),
      assignedAt: data.now,
      updatedAt: data.now
    })
  }

  function _deactivateExisting(sheet, assignmentType, divisionId, now) {
    _allAssignments().forEach(row => {
      const sameType = row.assignmentType === assignmentType
      const sameDivision = String(row.divisionId || '') === String(divisionId || '')
      const isActive = row.active === true || String(row.active).toLowerCase() === 'true'
      if (sameType && sameDivision && isActive) {
        SpreadsheetService.updateRow(sheet, row.id, { active: false, updatedAt: now })
      }
    })
  }

  function _sheet() {
    const spreadsheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'))
    let sheet = spreadsheet.getSheetByName(SHEET_NAME)
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_NAME)
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      return sheet
    }

    const lastCol = Math.max(sheet.getLastColumn(), 1)
    const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].filter(Boolean)
    if (!existing.length) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      return sheet
    }

    const missing = HEADERS.filter(h => !existing.includes(h))
    if (missing.length) {
      sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing])
    }
    return sheet
  }

  function _allAssignments() {
    return SpreadsheetService.getAllRows(_sheet())
  }

  function _activeAssignments() {
    return _allAssignments().filter(row => row.active === true || String(row.active).toLowerCase() === 'true')
  }

  function _activeUsers() {
    return SpreadsheetService
      .getAllRows(SpreadsheetService.getSheet(SHEET.USERS))
      .filter(row => !row.deleted && row.active !== false && String(row.active).toLowerCase() !== 'false')
  }

  function _activeDivisions() {
    return SpreadsheetService
      .getAllRows(SpreadsheetService.getSheet(SHEET.DIVISIONS))
      .filter(row => row.active !== false && String(row.active).toLowerCase() !== 'false')
      .map(row => ({ id: row.id, name: row.name, code: row.code || '' }))
  }

  function _parseDivisionFocals(value) {
    if (!value) return []
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

  function _indexBy(rows, field) {
    return rows.reduce((acc, row) => {
      acc[String(row[field] || '')] = row
      return acc
    }, {})
  }

  function _safeUser(row) {
    return {
      id: row.id,
      fullName: _userName(row),
      email: row.email || '',
      role: row.role || '',
      divisionId: row.divisionId || '',
      divisionName: row.divisionName || '',
      section: row.section || ''
    }
  }

  function _userName(row) {
    return row.fullName || [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || row.email || ''
  }

  return { list, save, getDivisionFocal, getBureauFocal, isDivisionFocal, isBureauFocal }
})()
