const AuthService = (() => {

  const FIREBASE_PROJECT_ID  = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID')
  const ALLOWED_EMAIL_DOMAIN = PropertiesService.getScriptProperties().getProperty('ALLOWED_EMAIL_DOMAIN') || 'dswd.gov.ph'
  const BOOTSTRAP_ADMIN_EMAILS = (PropertiesService.getScriptProperties().getProperty('BOOTSTRAP_ADMIN_EMAILS') || 'systemadmin@dswd.gov.ph')
    .split(/[,\n|]+/)
    .map(normalizeEmail_)
    .filter(Boolean)
  const DEFAULT_STB_OFFICE = {
    officeId: 'STB',
    officeCode: 'STB',
    officeName: 'Social Technology Bureau',
    systemScope: 'STB_FULL',
    officeRole: 'STB_PERSONNEL'
  }
  const ROLE_GROUPS = {
    'System Administrator': ['system-admin'],
    'Bureau Director': ['bureau-monitor', 'library-manager', 'evaluation-manager'],
    'Assistant Bureau Director': ['bureau-monitor', 'library-manager', 'evaluation-manager'],
    'Division Chief': ['division-monitor'],
    'Section Head': [],
    'Staff': [],
    'Technical Staff': []
  }
  const GROUP_PERMISSIONS = {
    'system-admin': [
      'manage_users',
      'manage_focal_assignments',
      'manage_libraries',
      'manage_assessment_content',
      'generate_ipat_assignments',
      'manage_ipat_scores',
      'view_bureau_monitoring',
      'view_division_monitoring',
      'view_audit',
      'manage_database'
    ],
    'bureau-monitor': [
      'view_bureau_monitoring',
      'view_division_monitoring',
      'view_audit'
    ],
    'division-monitor': [
      'view_division_monitoring'
    ],
    'library-manager': [
      'manage_libraries',
      'manage_assessment_content'
    ],
    'user-manager': [
      'manage_users',
      'manage_focal_assignments'
    ],
    // Generating rater assignments is reserved to the System Administrator.
    // `generate_ipat_assignments` was previously granted here and was doing double
    // duty as "is an evaluation administrator" — it also gated manual FPO encoding
    // and the entire All Assessments view. Removing it alone would have stripped
    // those from the Bureau Director and Assistant Bureau Director, so the
    // administer-scores capability is now its own permission.
    'evaluation-manager': [
      'manage_ipat_scores',
      'view_bureau_monitoring',
      'view_division_monitoring'
    ],
    'database-manager': [
      'manage_database'
    ],
    'cluster-system-admin': [
      'manage_office_registry',
      'provision_office_spreadsheets',
      'validate_office_spreadsheets',
      'view_cluster_monitoring',
      'manage_cluster_office_admins'
    ],
    'cluster-technical-admin': [
      'manage_office_registry',
      'provision_office_spreadsheets',
      'validate_office_spreadsheets'
    ],
    'cluster-assessment-admin': [
      'manage_assessment_content',
      'view_cluster_monitoring'
    ],
    'cluster-monitoring-admin': [
      'view_cluster_monitoring'
    ],
    'office-assessment-admin': [
      'manage_office_users',
      'generate_ipat_assignments',
      'manage_ipat_scores',
      'view_bureau_monitoring',
      'view_division_monitoring'
    ]
  }

  function normalizeEmail_(value) {
    return String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase()
  }

  function canonicalRole_(value) {
    const raw = String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
    const key = raw.toLowerCase().replace(/[\s_-]+/g, ' ')
    const aliases = {
      'system admin': 'System Administrator',
      'system administrator': 'System Administrator',
      'admin': 'System Administrator',
      'administrator': 'System Administrator',
      'bureau director': 'Bureau Director',
      'assistant bureau director': 'Assistant Bureau Director',
      'asst bureau director': 'Assistant Bureau Director',
      'division chief': 'Division Chief',
      'section head': 'Section Head',
      'staff': 'Technical Staff',
      'technical staff': 'Technical Staff'
    }
    return aliases[key] || raw
  }

  function normalizeProfileRow_(row, verifiedEmail) {
    const normalized = { ...row, role: canonicalRole_(row && row.role) }
    const email = normalizeEmail_(verifiedEmail || normalized.email)
    normalized.officeId = String(normalized.officeId || DEFAULT_STB_OFFICE.officeId).trim()
    normalized.officeCode = String(normalized.officeCode || normalized.officeId || DEFAULT_STB_OFFICE.officeCode).trim()
    normalized.officeName = String(normalized.officeName || DEFAULT_STB_OFFICE.officeName).trim()
    normalized.systemScope = String(normalized.systemScope || DEFAULT_STB_OFFICE.systemScope).trim()
    normalized.officeRole = String(normalized.officeRole || DEFAULT_STB_OFFICE.officeRole).trim()
    normalized.centralRoles = _splitList(normalized.centralRoles).join(',')
    if (BOOTSTRAP_ADMIN_EMAILS.indexOf(email) >= 0) {
      normalized.role = 'System Administrator'
      normalized.permissionGroups = _unique(_splitList(normalized.permissionGroups).concat(['system-admin', 'cluster-system-admin'])).join(',')
      normalized.systemScope = 'CLUSTER_ADMIN'
    }
    return normalized
  }

  // ─────────────────────────────────────────────────────────────
  // TOKEN VERIFICATION
  // ─────────────────────────────────────────────────────────────
  function verifyToken(e) {
    // Accept either the request event (token in query/body param) or a raw string.
    const raw = (typeof e === 'string' ? e : (e?.parameter?.token || '')).trim()
    if (!raw) return null

    try {
      const parts = raw.split('.')
      if (parts.length !== 3) return null

      const b64url  = parts[1]
      const b64std  = b64url.replace(/-/g, '+').replace(/_/g, '/')
      const padLen  = (4 - (b64std.length % 4)) % 4   // 0, 1, 2, or 3
      const padded  = b64std + '='.repeat(padLen)

      const jsonStr = Utilities.newBlob(Utilities.base64Decode(padded)).getDataAsString()
      const payload = JSON.parse(jsonStr)

      // ── Cheap structural pre-checks (reject obvious junk before any network) ──
      const nowSec = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < nowSec) return null
      if (payload.iat && payload.iat > nowSec + 300) return null   // 5-min skew
      // Nightly forced logout: a token issued before the last midnight
      // cutoff is treated as expired, even though Firebase itself still
      // considers it valid — this is what actually logs out a session left
      // open overnight. Signing in again issues a fresh token with a newer
      // iat, so this never affects someone logging in after the cutoff.
      if (payload.iat && typeof SystemSettingsService !== 'undefined') {
        const cutoff = SystemSettingsService.getLogoutCutoffAt()
        if (cutoff && payload.iat < cutoff) return null
      }
      if (FIREBASE_PROJECT_ID) {
        if (payload.aud !== FIREBASE_PROJECT_ID) return null
        if (payload.iss !== 'https://securetoken.google.com/' + FIREBASE_PROJECT_ID) return null
      }
      const claimEmail = normalizeEmail_(payload.email)
      if (ALLOWED_EMAIL_DOMAIN && !claimEmail.endsWith('@' + ALLOWED_EMAIL_DOMAIN.toLowerCase())) return null

      // ── Authoritative signature verification (the security-critical step) ──
      // The payload above is attacker-controllable; nothing is trusted until
      // Google confirms the RS256 signature. Cache the verified result briefly
      // so the network round-trip is paid at most once per token per 5 minutes.
      const cache    = _safeCache()
      const cacheKey = 'idtok_' + _tokenHash(raw)
      if (cache) {
        const hit = cache.get(cacheKey)
        if (hit) return JSON.parse(hit)
      }

      const verified = FirebaseAuthService.verifyIdToken(raw)
      if (!verified || verified.disabled) return null

      // Re-check the domain against Google's authoritative email, not the claim.
      const email = normalizeEmail_(verified.email)
      if (ALLOWED_EMAIL_DOMAIN && !email.endsWith('@' + ALLOWED_EMAIL_DOMAIN.toLowerCase())) return null

      const result = { uid: verified.uid, email: verified.email, name: verified.name }
      if (cache) cache.put(cacheKey, JSON.stringify(result), 300)   // 5 minutes
      return result

    } catch (err) {
      Logger.log('[Auth] verifyToken error: ' + err.message)
      return null
    }
  }

  function _safeCache() {
    try { return CacheService.getScriptCache() } catch (e) { return null }
  }

  function _tokenHash(token) {
    // Short digest so the cache key is bounded and the raw token never becomes a key.
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8)
    return bytes.map(b => ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2)).join('').slice(0, 32)
  }

  // ─────────────────────────────────────────────────────────────
  // PROFILE LOOKUP
  // ─────────────────────────────────────────────────────────────
  // Per-execution profile cache. A single request calls getProfile several times
  // (the service method, then AuditService.log, then any nested compute), and
  // each call re-read the whole Users sheet. Apps Script gives every request a
  // fresh script context, so this map lives exactly as long as one request —
  // there is no cross-user or stale-read risk.
  const _profileCache = {}

  function getProfile(user, opts) {
    const options   = opts || {}
    const cacheKey  = String((user && (user.uid || user.email)) || '')

    // touchLogin callers must not read a cached copy, since they write to the row.
    if (cacheKey && !options.touchLogin && _profileCache[cacheKey]) {
      return _profileCache[cacheKey]
    }

    const sheet = _usersSheet()
    const rows  = SpreadsheetService.getAllRows(sheet)

    const loginEmail = normalizeEmail_(user.email)
    const loginUid   = String(user.uid || '').trim()

    // Prefer the verified email row. During testing/imports, Firebase UIDs can
    // become stale or manually copied, and an OR lookup may return a different
    // person's row before reaching the correct email.
    let row = rows.find(r =>
      loginEmail &&
      normalizeEmail_(r.email) === loginEmail
    )

    if (!row) {
      row = rows.find(r =>
        loginUid &&
        String(r.uid || '').trim() === loginUid
      )
    }

    if (!row) {
      Logger.log('[Auth] Profile not found for uid=' + user.uid)
      throw HttpError('User profile not found. Contact your administrator.', 404)
    }

    // Stamp lastLoginAt ONLY when the caller is the sign-in path (auth/me).
    // This used to run on every getProfile call, which means every authenticated
    // request performed a sheet write before doing any of its real work — a
    // round trip added to every single API call, for a field that only needs to
    // change at sign-in.
    //
    // This write is unlocked and bypasses the read cache — updateRow() re-reads
    // the whole sheet itself rather than going through
    // SpreadsheetService.getAllRows(), so it's a full sheet round trip on the
    // Apps Script side for every login, synchronously, before the profile is
    // returned. Firebase Authentication itself scales fine under concurrent
    // sign-ins; this is the layer that doesn't — Apps Script has a real ceiling
    // on simultaneous executions, so a login burst (everyone signing in at
    // once) queues here, not at Google's auth servers.
    //
    // lastLoginAt is low-value audit data, not anything scoring or business
    // logic reads, so skip the write when it was already stamped within the
    // last few minutes. This is the common case of someone reloading the page
    // or reopening a tab rather than a fresh sign-in, and it's exactly the
    // write volume a login burst multiplies — cutting it here helps the actual
    // concurrent-login scenario, not just casual refreshes.
    const LOGIN_STAMP_MIN_INTERVAL_MS = 5 * 60 * 1000
    const previousLoginAt = row.lastLoginAt ? new Date(row.lastLoginAt).getTime() : 0
    const stampedRecently = previousLoginAt > 0 && (Date.now() - previousLoginAt) < LOGIN_STAMP_MIN_INTERVAL_MS

    if (options.touchLogin && !stampedRecently) {
      try {
        const stampedAt = new Date().toISOString()
        SpreadsheetService.updateRow(sheet, row.id, { lastLoginAt: stampedAt })
        row.lastLoginAt = stampedAt
      } catch(e) {
        Logger.log('[Auth] Could not update lastLoginAt: ' + e.message)
      }
    }

    // Auto-resolve divisionId from divisionName if missing
    if (!row.divisionId && row.divisionName) {
      try {
        const divSheet = SpreadsheetService.getSheet(SHEET.DIVISIONS)
        const divRows  = SpreadsheetService.getAllRows(divSheet)
        const div = divRows.find(d =>
          (d.name || '').toLowerCase().trim() === (row.divisionName || '').toLowerCase().trim()
        )
        if (div) {
          row.divisionId = div.id
          // Persist so we don't have to look it up every time
          SpreadsheetService.updateRow(sheet, row.id, { divisionId: div.id })
          Logger.log('[Auth] Auto-resolved divisionId=' + div.id + ' for ' + row.email)
        }
      } catch(e) {
        Logger.log('[Auth] Could not resolve divisionId: ' + e.message)
      }
    }

    // Return all fields except the actual temporary password. The flag is
    // intentionally returned so the frontend can force the user to replace it.
    const normalizedRow = normalizeProfileRow_(row, loginEmail)
    const { passwordHash, tempPassword, tempPasswordHash, mustChangePassword, ...safe } = normalizedRow
    const effective = getEffectiveAccess(normalizedRow)
    const systemAccessMode = typeof SystemSettingsService !== 'undefined'
      ? SystemSettingsService.getAccessMode()
      : 'evaluation_only'
    const profile = {
      ...safe,
      permissionGroups: effective.groups,
      permissions: effective.permissions,
      centralRoles: _splitList(normalizedRow.centralRoles),
      systemAccessMode: systemAccessMode,
      mustChangePassword: mustChangePassword === true || String(mustChangePassword).toLowerCase() === 'true'
    }
    if (cacheKey) _profileCache[cacheKey] = profile
    return profile
  }

  // ─────────────────────────────────────────────────────────────
  // ONBOARDING STATE — never throws for the unregistered case, so the
  // frontend can route a signed-in-but-unprovisioned user to registration
  // instead of silently granting a fallback Staff profile.
  //   registered=false        → no PMES account yet (show registration)
  //   registered=true, pending→ self-registered, awaiting admin approval
  //   registered=true, active → normal access
  // ─────────────────────────────────────────────────────────────
  function whoami(user) {
    try {
      const profile = getProfile(user)
      const active  = profile.active !== false && String(profile.active).toLowerCase() !== 'false'
      const pending = profile.pendingActivation === true || String(profile.pendingActivation).toLowerCase() === 'true'
      return { registered: true, active: active && !pending, pending: pending, profile: profile }
    } catch (e) {
      if (e && e.statusCode === 404) {
        return {
          registered: false, active: false, pending: false, profile: null,
          identity: { email: user.email || '', uid: user.uid || '', name: user.name || '' }
        }
      }
      throw e
    }
  }

  // Reference data for the self-registration form. Read-only and profile-free
  // (the caller only needs a valid domain token), so an unprovisioned user can
  // still populate the division dropdown before they have a PMES account.
  function registrationOptions() {
    let divisions = []
    // divisionsError distinguishes "the sheet has no active divisions" from
    // "reading the sheet failed". Both used to surface as an empty list, so a
    // transport or permission failure looked identical to an empty database and
    // the form told the user divisions were simply unavailable.
    let divisionsError = ''
    try {
      divisions = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.DIVISIONS))
        .filter(d => d.active !== false && String(d.active).toLowerCase() !== 'false')
        .map(d => ({ id: d.id, name: d.name }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    } catch (e) {
      divisionsError = String(e && e.message || e)
      Logger.log('[Auth] registrationOptions divisions error: ' + divisionsError)
    }
    // Sections are returned with their divisionId so the form can filter the
    // dropdown to the division the registrant picked. Free-text entry produced
    // 8-9 spellings of the same section and broke exact-string rater matching.
    let sections = []
    try {
      sections = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.SECTIONS))
        .filter(s => s.active !== false && String(s.active).toLowerCase() !== 'false')
        .map(s => ({ id: s.id, divisionId: s.divisionId, name: s.name, code: s.code }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    } catch (e) {
      // Sheet may not exist until initializeSheets() has been re-run; an empty
      // list lets the form fall back rather than blocking registration.
      Logger.log('[Auth] registrationOptions sections error: ' + (e && e.message))
    }
    if (!sections.some(s => s.divisionId === 'admin-pool' && s.name === 'Office Admin Personnel')) {
      sections.unshift({ id: 'SEC-admin-office', divisionId: 'admin-pool', name: 'Office Admin Personnel', code: 'OAP' })
    }

    return {
      divisions: divisions,
      divisionsError: divisionsError,
      sections: sections,
      offices: typeof OfficeRegistryService !== 'undefined'
        ? OfficeRegistryService.registrationOptions()
        : [{
          officeId: 'STB',
          officeCode: 'STB',
          officeName: 'Social Technology Bureau',
          officeShortName: 'STB',
          systemScope: 'STB_FULL',
          portalScope: 'STB_FULL'
        }],
      officeOptions: typeof OfficeRegistryService !== 'undefined'
        ? OfficeRegistryService.registrationOrgOptions()
        : {},
      employmentTypes: ['Regular', 'Contract of Service (COS)', 'Casual', 'Job Order'],
      requestedRoles: ['Technical Staff', 'Section Head', 'Division Chief', 'Assistant Bureau Director', 'Bureau Director']
    }
  }

  function backendInfo(user) {
    const spreadsheet = SpreadsheetService.getSpreadsheet()
    const email = normalizeEmail_(user.email)
    let userRow = null
    try {
      userRow = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.USERS)).find(r =>
        normalizeEmail_(r.email) === email ||
        (user.uid && String(r.uid || '').trim() === String(user.uid).trim())
      ) || null
    } catch (e) {
      Logger.log('[Auth] backendInfo user lookup error: ' + e.message)
    }
    let profile = null
    if (userRow) {
      const normalizedRow = normalizeProfileRow_(userRow, email)
      const { passwordHash, tempPassword, tempPasswordHash, ...safe } = normalizedRow
      const effective = getEffectiveAccess(normalizedRow)
      const systemAccessMode = typeof SystemSettingsService !== 'undefined'
        ? SystemSettingsService.getAccessMode()
        : 'evaluation_only'
      profile = {
        ...safe,
        permissionGroups: effective.groups,
        permissions: effective.permissions,
        centralRoles: _splitList(normalizedRow.centralRoles),
        systemAccessMode,
        mustChangePassword: userRow.mustChangePassword === true || String(userRow.mustChangePassword).toLowerCase() === 'true'
      }
    }
    return {
      spreadsheetName: spreadsheet.getName(),
      spreadsheetConfigured: !!SpreadsheetService.getSpreadsheetId(),
      signedInEmail: user.email || '',
      signedInUid: user.uid || '',
      userFound: !!userRow,
      userActive: userRow ? (userRow.active !== false && String(userRow.active).toLowerCase() !== 'false') : false,
      userPendingActivation: userRow ? (userRow.pendingActivation === true || String(userRow.pendingActivation).toLowerCase() === 'true') : false,
      userDivisionId: userRow ? (userRow.divisionId || '') : '',
      profile
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ROLE GUARD
  // ─────────────────────────────────────────────────────────────
  function requireRole(user, ...allowedRoles) {
    const profile = getProfile(user)
    if (!allowedRoles.includes(profile.role)) {
      throw HttpError(
        'Access denied. Required: ' + allowedRoles.join(' or ') + '. Your role: ' + profile.role,
        403
      )
    }
    return profile
  }

  function getEffectiveAccess(profile) {
    const normalizedProfile = normalizeProfileRow_(profile || {}, profile && profile.email)
    const roleGroups = ROLE_GROUPS[normalizedProfile.role] || []
    const explicitGroups = _splitList(normalizedProfile.permissionGroups)
    const scopeGroups = []
    if (
      String(normalizedProfile.systemScope || '') === 'OFFICE_ADMIN' ||
      String(normalizedProfile.officeRole || '') === 'OFFICE_ADMIN'
    ) {
      scopeGroups.push('office-assessment-admin')
    }
    const groups = _unique(roleGroups.concat(explicitGroups).concat(scopeGroups))
    const permissions = _unique(
      groups
        .map(group => GROUP_PERMISSIONS[group] || [])
        .reduce((all, items) => all.concat(items), [])
        .concat(_splitList(normalizedProfile.permissions))
    )
    return { groups, permissions }
  }

  function hasPermission(profileOrUser, permission) {
    if (!profileOrUser) return false
    const profile = profileOrUser.email && profileOrUser.role
      ? profileOrUser
      : getProfile(profileOrUser)
    return getEffectiveAccess(profile).permissions.indexOf(permission) >= 0
  }

  function requirePermission(user, permission) {
    const profile = getProfile(user)
    if (!hasPermission(profile, permission)) {
      throw HttpError('Access denied. Required permission: ' + permission, 403)
    }
    return profile
  }

  function _splitList(value) {
    if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean)
    return String(value || '')
      .split(/[,|]/)
      .map(s => s.trim())
      .filter(Boolean)
  }

  function _unique(items) {
    return Array.from(new Set(items.filter(Boolean)))
  }

  // ─────────────────────────────────────────────────────────────
  // DIAGNOSTIC — run manually from Apps Script editor to test
  // token decoding without a live request
  // ─────────────────────────────────────────────────────────────
  function debugDecodeToken(tokenString) {
    try {
      const parts  = tokenString.trim().split('.')
      const b64url = parts[1]
      const b64std = b64url.replace(/-/g, '+').replace(/_/g, '/')
      const padLen = (4 - (b64std.length % 4)) % 4
      const padded = b64std + '='.repeat(padLen)
      const json   = Utilities.newBlob(Utilities.base64Decode(padded)).getDataAsString()
      const p      = JSON.parse(json)
      Logger.log('✅ Token decoded successfully:')
      Logger.log('  sub   : ' + p.sub)
      Logger.log('  email : ' + p.email)
      Logger.log('  aud   : ' + p.aud)
      Logger.log('  iss   : ' + p.iss)
      Logger.log('  exp   : ' + new Date(p.exp * 1000).toISOString())
      Logger.log('  iat   : ' + new Date(p.iat * 1000).toISOString())
      return p
    } catch(e) {
      Logger.log('❌ Token decode failed: ' + e.message)
      return null
    }
  }

  function _usersSheet() {
    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    const lastCol = Math.max(sheet.getLastColumn(), 1)
    const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].filter(Boolean)
    const missing = [
      'tempPassword', 'tempPasswordHash', 'mustChangePassword',
      'permissionGroups', 'permissions',
      'officeId', 'officeCode', 'officeName', 'systemScope', 'officeRole', 'centralRoles'
    ].filter(h => !existing.includes(h))
    if (missing.length) {
      sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing])
    }
    return sheet
  }

  return {
    verifyToken,
    getProfile,
    whoami,
    registrationOptions,
    backendInfo,
    requireRole,
    getEffectiveAccess,
    hasPermission,
    requirePermission,
    debugDecodeToken
  }
})()
