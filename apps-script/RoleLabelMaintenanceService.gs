const RoleLabelMaintenanceService = (() => {
  const EXACT_ROLE_COLUMNS = [
    'role', 'requestedRole', 'rateeRole', 'positionLevel', 'roleEquivalent', 'reportsToLevel'
  ]
  const ROLE_LIST_COLUMNS = [
    'sourceRoles', 'applicableLevels', 'applicableTo'
  ]

  function preview(user) {
    return run_(user, false)
  }

  function normalizeStaffRoles(body, user) {
    const confirmation = String((body && body.confirmation) || '').trim()
    if (confirmation !== 'NORMALIZE_STAFF_TO_TECHNICAL_STAFF') {
      throw HttpError('Type NORMALIZE_STAFF_TO_TECHNICAL_STAFF to normalize Staff role labels.', 400)
    }
    return run_(user, true)
  }

  function run_(user, apply) {
    requireCentralAdmin_(user)
    return SpreadsheetService.withCentralSpreadsheet(() => {
      const targets = [{ label: 'PMES Database', officeId: 'STB', spreadsheetId: SpreadsheetService.getSpreadsheetId(), central: true }]
        .concat(officeSpreadsheetTargets_())

      const workbooks = targets.map(target => {
        try {
          const result = target.central
            ? migrateCurrentSpreadsheet_(apply)
            : SpreadsheetService.withSpreadsheetId(target.spreadsheetId, () => migrateCurrentSpreadsheet_(apply))
          return { ...target, ok: true, ...result }
        } catch (e) {
          return { ...target, ok: false, error: String(e && e.message || e), changedCells: 0, sheets: [] }
        }
      })

      const changedCells = workbooks.reduce((sum, item) => sum + Number(item.changedCells || 0), 0)
      if (apply) {
        try {
          AuditService.log(
            'NORMALIZE_STAFF_ROLE_LABEL',
            'Maintenance',
            `Normalized exact Staff role labels to Technical Staff across ${workbooks.length} workbook(s); ${changedCells} cell(s) changed.`,
            user
          )
        } catch (e) {
          Logger.log('[RoleLabelMaintenance] audit skipped: ' + (e && e.message || e))
        }
      }

      return {
        applied: apply,
        canonicalRole: RoleLabelService.STAFF_CANONICAL,
        changedCells,
        workbooks
      }
    })
  }

  function migrateCurrentSpreadsheet_(apply) {
    const ss = SpreadsheetService.getSpreadsheet()
    const sheets = ss.getSheets().map(sheet => migrateSheet_(sheet, apply)).filter(item => item.changedCells > 0)
    return {
      spreadsheetName: ss.getName(),
      changedCells: sheets.reduce((sum, item) => sum + item.changedCells, 0),
      sheets
    }
  }

  function migrateSheet_(sheet, apply) {
    const lastRow = sheet.getLastRow()
    const lastCol = sheet.getLastColumn()
    if (lastRow < 2 || lastCol < 1) return { name: sheet.getName(), changedCells: 0, columns: [] }

    const values = sheet.getRange(1, 1, lastRow, lastCol).getValues()
    const headers = values[0].map(h => String(h || '').trim())
    const columns = []
    headers.forEach((header, index) => {
      if (EXACT_ROLE_COLUMNS.indexOf(header) >= 0) columns.push({ index, header, mode: 'exact' })
      if (ROLE_LIST_COLUMNS.indexOf(header) >= 0) columns.push({ index, header, mode: 'list' })
    })
    if (!columns.length) return { name: sheet.getName(), changedCells: 0, columns: [] }

    const touchedColumns = {}
    let changedCells = 0
    for (let r = 1; r < values.length; r++) {
      columns.forEach(col => {
        const current = values[r][col.index]
        const next = col.mode === 'list'
          ? canonicalRoleListCell_(current)
          : canonicalRoleCell_(current)
        if (String(next) !== String(current || '')) {
          values[r][col.index] = next
          changedCells += 1
          touchedColumns[col.header] = true
        }
      })
    }

    // OfficeOrgOptions stores roles as option rows; only normalize `name` when
    // optionType is role so division/section names are never interpreted as roles.
    const optionTypeIdx = headers.indexOf('optionType')
    const nameIdx = headers.indexOf('name')
    if (optionTypeIdx >= 0 && nameIdx >= 0) {
      for (let r = 1; r < values.length; r++) {
        if (String(values[r][optionTypeIdx] || '').trim().toLowerCase() !== 'role') continue
        const current = values[r][nameIdx]
        const next = canonicalRoleCell_(current)
        if (String(next) !== String(current || '')) {
          values[r][nameIdx] = next
          changedCells += 1
          touchedColumns.name = true
        }
      }
    }

    if (apply && changedCells) {
      sheet.getRange(1, 1, lastRow, lastCol).setValues(values)
      try {
        if (typeof DataCacheService !== 'undefined') {
          DataCacheService.invalidate(sheet.getParent().getId(), sheet.getName())
        }
      } catch (e) {
        Logger.log('[RoleLabelMaintenance] cache invalidation failed: ' + (e && e.message || e))
      }
    }

    return {
      name: sheet.getName(),
      changedCells,
      columns: Object.keys(touchedColumns).sort()
    }
  }

  function canonicalRoleCell_(value) {
    const text = String(value || '').trim()
    if (!text) return ''
    return RoleLabelService.canonicalRole(text)
  }

  function canonicalRoleListCell_(value) {
    const text = String(value || '').trim()
    if (!text) return ''
    const delimiter = text.indexOf('|') >= 0 && text.indexOf(',') < 0 ? '|' : ','
    const seen = {}
    const parts = text.split(/[,|]/)
    let changed = false
    const roles = []
    parts.forEach(part => {
      const raw = String(part || '').trim()
      const role = RoleLabelService.canonicalRole(raw)
      if (role !== raw) changed = true
      if (!role || seen[role]) {
        if (role) changed = true
        return
      }
      seen[role] = true
      roles.push(role)
    })
    return changed ? roles.join(delimiter) : text
  }

  function officeSpreadsheetTargets_() {
    try {
      const rows = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.OFFICE_REGISTRY))
      return rows
        .filter(row => String(row.officeStatus || '').toUpperCase() === 'ACTIVE')
        .filter(row => String(row.spreadsheetStatus || '').toUpperCase() === 'ACTIVE')
        .filter(row => String(row.spreadsheetId || '').trim())
        .map(row => ({
          label: row.officeCode || row.officeShortName || row.officeName || row.officeId,
          officeId: row.officeId || row.officeCode || '',
          spreadsheetId: row.spreadsheetId,
          central: false
        }))
    } catch (e) {
      Logger.log('[RoleLabelMaintenance] office target lookup failed: ' + (e && e.message || e))
      return []
    }
  }

  function requireCentralAdmin_(user) {
    const profile = AuthService.getProfile(user)
    const ok = AuthService.hasPermission(profile, 'manage_database') ||
      AuthService.hasPermission(profile, 'manage_office_registry') ||
      AuthService.hasPermission(profile, 'validate_office_spreadsheets')
    if (!ok) throw HttpError('Access denied. Central administrator permission required.', 403)
    return profile
  }

  return {
    preview,
    normalizeStaffRoles
  }
})()

function previewStaffRoleLabelNormalization() {
  return RoleLabelMaintenanceService.preview({ email: 'systemadmin@dswd.gov.ph', uid: 'manual-maintenance' })
}

function normalizeStaffRoleLabelsAcrossDatabases() {
  return RoleLabelMaintenanceService.normalizeStaffRoles(
    { confirmation: 'NORMALIZE_STAFF_TO_TECHNICAL_STAFF' },
    { email: 'systemadmin@dswd.gov.ph', uid: 'manual-maintenance' }
  )
}
