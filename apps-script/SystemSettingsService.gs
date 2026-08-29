const SystemSettingsService = (() => {
  const ACCESS_MODE_KEY = 'systemAccessMode'
  const MODE_EVALUATION_ONLY = 'evaluation_only'
  const MODE_FULL_ACCESS = 'full_access'
  const HEADERS = ['id', 'key', 'value', 'description', 'updatedBy', 'updatedByName', 'updatedAt']

  function ensureSheet_() {
    const ss = SpreadsheetService.getSpreadsheet()
    const name = SHEET.SYSTEM_SETTINGS || 'SystemSettings'
    let sheet = ss.getSheetByName(name)
    if (!sheet) {
      sheet = ss.insertSheet(name)
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      sheet.setFrozenRows(1)
    }

    const lastCol = Math.max(sheet.getLastColumn(), 1)
    const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].filter(Boolean)
    const missing = HEADERS.filter(h => existing.indexOf(h) < 0)
    if (missing.length) {
      sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing])
    }
    seedDefaults_(sheet)
    return sheet
  }

  function seedDefaults_(sheet) {
    const rows = SpreadsheetService.getAllRows(sheet)
    if (rows.some(r => r.key === ACCESS_MODE_KEY)) return
    SpreadsheetService.appendRow(sheet, {
      id: SpreadsheetService.generateId('SET-'),
      key: ACCESS_MODE_KEY,
      value: MODE_EVALUATION_ONLY,
      description: 'Controls whether normal users see only Evaluation or the full PMES modules.',
      updatedBy: 'system',
      updatedByName: 'System Default',
      updatedAt: new Date().toISOString()
    })
  }

  function normaliseAccessMode_(value) {
    return value === MODE_FULL_ACCESS ? MODE_FULL_ACCESS : MODE_EVALUATION_ONLY
  }

  function normaliseOfficeKey_(officeOrProfile) {
    const source = officeOrProfile && typeof officeOrProfile === 'object'
      ? (officeOrProfile.officeId || officeOrProfile.officeCode || officeOrProfile.officeName)
      : officeOrProfile
    const value = String(source || '').trim().toUpperCase()
    if (!value || value === 'SOCIAL TECHNOLOGY BUREAU' || value === 'OFF-STB') return 'STB'
    return value.replace(/[^A-Z0-9_-]/g, '_')
  }

  function modeKey_(officeKey) {
    return ACCESS_MODE_KEY + ':' + officeKey
  }

  function officeOptions_() {
    const options = [{ officeId: 'STB', officeCode: 'STB', officeName: 'Social Technology Bureau' }]
    try {
      if (typeof OfficeRegistryService !== 'undefined') {
        OfficeRegistryService.registrationOptions().forEach(office => {
          if (!office || !office.officeId || String(office.officeId).toUpperCase() === 'STB') return
          options.push({
            officeId: office.officeId,
            officeCode: office.officeCode || office.officeId,
            officeName: office.officeName || office.officeCode || office.officeId
          })
        })
      }
    } catch (e) {
      Logger.log('[SystemSettings] officeOptions fallback: ' + e.message)
    }
    return options.sort((a, b) => String(a.officeName).localeCompare(String(b.officeName)))
  }

  function getAccessMode(officeOrProfile) {
    try {
      const sheet = ensureSheet_()
      const rows = SpreadsheetService.getAllRows(sheet)
      const officeKey = normaliseOfficeKey_(officeOrProfile)
      const scoped = rows.find(r => r.key === modeKey_(officeKey))
      if (scoped) return normaliseAccessMode_(scoped.value)
      if (officeKey === 'STB') {
        const legacy = rows.find(r => r.key === ACCESS_MODE_KEY)
        return normaliseAccessMode_(legacy && legacy.value)
      }
      return MODE_EVALUATION_ONLY
    } catch (e) {
      Logger.log('[SystemSettings] getAccessMode fallback: ' + e.message)
      return MODE_EVALUATION_ONLY
    }
  }

  function list(params, user) {
    AuthService.requirePermission(user, 'manage_users')
    const selectedOfficeId = String((params && params.officeId) || 'STB').trim() || 'STB'
    const offices = officeOptions_()
    const selected = offices.find(o => String(o.officeId).toUpperCase() === selectedOfficeId.toUpperCase()) || offices[0]
    return {
      officeId: selected.officeId,
      officeName: selected.officeName,
      accessMode: getAccessMode(selected.officeId),
      offices: offices.map(office => ({ ...office, accessMode: getAccessMode(office.officeId) })),
      modes: [
        {
          value: MODE_EVALUATION_ONLY,
          label: 'Evaluation only',
          description: 'Converts ordinary personnel in the selected office to Innovation Cluster Portal scope. System/super admin accounts are not changed.'
        },
        {
          value: MODE_FULL_ACCESS,
          label: 'Full module access',
          description: 'Converts ordinary personnel in the selected office to the full PMES scope: STB Full PMES for STB, Office Full PMES for other offices.'
        }
      ]
    }
  }

  function update(body, user) {
    const profile = AuthService.requirePermission(user, 'manage_users')
    const mode = normaliseAccessMode_(body.accessMode)
    const officeKey = normaliseOfficeKey_(body.officeId || 'STB')
    const sheet = ensureSheet_()
    const rows = SpreadsheetService.getAllRows(sheet)
    const key = modeKey_(officeKey)
    const row = rows.find(r => r.key === key)
    const payload = {
      key: key,
      value: mode,
      description: 'Controls module access for office ' + officeKey + '.',
      updatedBy: profile.id,
      updatedByName: profile.fullName || profile.email || '',
      updatedAt: new Date().toISOString()
    }

    if (row) {
      SpreadsheetService.updateRow(sheet, row.id, payload)
    } else {
      SpreadsheetService.appendRow(sheet, {
        id: SpreadsheetService.generateId('SET-'),
        ...payload
      })
    }

    // Keep the legacy key synchronized for older STB clients. It is ignored
    // for non-STB offices and cannot leak the STB mode elsewhere.
    if (officeKey === 'STB') {
      const legacy = rows.find(r => r.key === ACCESS_MODE_KEY)
      const legacyPayload = { ...payload, key: ACCESS_MODE_KEY, description: 'Legacy STB compatibility setting.' }
      if (legacy) SpreadsheetService.updateRow(sheet, legacy.id, legacyPayload)
      else SpreadsheetService.appendRow(sheet, { id: SpreadsheetService.generateId('SET-'), ...legacyPayload })
    }

    const scopeSync = typeof UsersService !== 'undefined'
      ? UsersService.applyOfficeAccessScope(officeKey, mode, user)
      : null

    AuditService.log('UPDATE_SYSTEM_SETTINGS', 'SystemSettings', `Access mode for ${officeKey} changed to ${mode}`, user)
    return {
      ...list({ officeId: officeKey }, user),
      scopeSync
    }
  }

  // ── Nightly forced logout ──
  // Stores the cutoff as a Unix-seconds timestamp (matching a Firebase ID
  // token's `iat` claim, which is what AuthService.verifyToken compares it
  // against). A session whose token was issued before this cutoff is
  // rejected on its next request, forcing re-login - a session that logs in
  // *after* the cutoff is unaffected, since its token's iat is newer.
  const LOGOUT_CUTOFF_KEY = 'globalLogoutCutoffAt'

  function getLogoutCutoffAt() {
    try {
      const sheet = ensureSheet_()
      const row = SpreadsheetService.getAllRows(sheet).find(r => r.key === LOGOUT_CUTOFF_KEY)
      const value = Number(row && row.value)
      return Number.isFinite(value) ? value : 0
    } catch (e) {
      Logger.log('[SystemSettings] getLogoutCutoffAt fallback: ' + e.message)
      return 0
    }
  }

  // Not exposed via list()/update() or any Router route - only the
  // time-driven trigger (MidnightLogoutService.runMidnightLogout) calls
  // this, so there is no path for a regular admin request to force-logout
  // everyone by accident.
  function setLogoutCutoffToNow_() {
    const sheet = ensureSheet_()
    const rows = SpreadsheetService.getAllRows(sheet)
    const row = rows.find(r => r.key === LOGOUT_CUTOFF_KEY)
    const nowSec = Math.floor(Date.now() / 1000)
    const payload = {
      key: LOGOUT_CUTOFF_KEY,
      value: String(nowSec),
      description: 'Unix timestamp (seconds). Sessions with a token issued before this are forced to re-login. Set nightly by the midnight logout trigger.',
      updatedBy: 'system',
      updatedByName: 'Midnight Logout Trigger',
      updatedAt: new Date().toISOString()
    }
    if (row) {
      SpreadsheetService.updateRow(sheet, row.id, payload)
    } else {
      SpreadsheetService.appendRow(sheet, { id: SpreadsheetService.generateId('SET-'), ...payload })
    }
    return nowSec
  }

  return {
    getAccessMode,
    list,
    update,
    getLogoutCutoffAt,
    setLogoutCutoffToNow_
  }
})()
