const AuthService = (() => {

  const FIREBASE_PROJECT_ID  = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID')
  const ALLOWED_EMAIL_DOMAIN = PropertiesService.getScriptProperties().getProperty('ALLOWED_EMAIL_DOMAIN') || 'dswd.gov.ph'
  const ROLE_GROUPS = {
    'System Administrator': ['system-admin'],
    'Bureau Director': ['bureau-monitor', 'library-manager', 'evaluation-manager'],
    'Assistant Bureau Director': ['bureau-monitor', 'library-manager', 'evaluation-manager'],
    'Division Chief': ['division-monitor'],
    'Section Head': [],
    'Staff': []
  }
  const GROUP_PERMISSIONS = {
    'system-admin': [
      'manage_users',
      'manage_focal_assignments',
      'manage_libraries',
      'manage_assessment_content',
      'generate_ipat_assignments',
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
    'evaluation-manager': [
      'generate_ipat_assignments',
      'view_bureau_monitoring',
      'view_division_monitoring'
    ],
    'database-manager': [
      'manage_database'
    ]
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
      if (FIREBASE_PROJECT_ID) {
        if (payload.aud !== FIREBASE_PROJECT_ID) return null
        if (payload.iss !== 'https://securetoken.google.com/' + FIREBASE_PROJECT_ID) return null
      }
      const claimEmail = (payload.email || '').toLowerCase()
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
      const email = (verified.email || '').toLowerCase()
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
  function getProfile(user) {
    const sheet = _usersSheet()
    const rows  = SpreadsheetService.getAllRows(sheet)

    const loginEmail = String(user.email || '').trim().toLowerCase()
    const loginUid   = String(user.uid || '').trim()

    // Prefer the verified email row. During testing/imports, Firebase UIDs can
    // become stale or manually copied, and an OR lookup may return a different
    // person's row before reaching the correct email.
    let row = rows.find(r =>
      loginEmail &&
      String(r.email || '').trim().toLowerCase() === loginEmail
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

    // Stamp lastLoginAt (best-effort, non-blocking)
    try {
      SpreadsheetService.updateRow(sheet, row.id, { lastLoginAt: new Date().toISOString() })
    } catch(e) {
      Logger.log('[Auth] Could not update lastLoginAt: ' + e.message)
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
    const { passwordHash, tempPassword, tempPasswordHash, mustChangePassword, ...safe } = row
    const effective = getEffectiveAccess(row)
    const systemAccessMode = typeof SystemSettingsService !== 'undefined'
      ? SystemSettingsService.getAccessMode()
      : 'evaluation_only'
    return {
      ...safe,
      permissionGroups: effective.groups,
      permissions: effective.permissions,
      systemAccessMode: systemAccessMode,
      mustChangePassword: mustChangePassword === true || String(mustChangePassword).toLowerCase() === 'true'
    }
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
    try {
      divisions = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.DIVISIONS))
        .filter(d => d.active !== false && String(d.active).toLowerCase() !== 'false')
        .map(d => ({ id: d.id, name: d.name }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    } catch (e) {
      Logger.log('[Auth] registrationOptions divisions error: ' + e.message)
    }
    return {
      divisions: divisions,
      employmentTypes: ['Regular', 'Contract of Service (COS)', 'Casual', 'Job Order'],
      requestedRoles: ['Staff', 'Section Head', 'Division Chief', 'Assistant Bureau Director', 'Bureau Director']
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
    const roleGroups = ROLE_GROUPS[profile.role] || []
    const explicitGroups = _splitList(profile.permissionGroups)
    const groups = _unique(roleGroups.concat(explicitGroups))
    const permissions = _unique(
      groups
        .map(group => GROUP_PERMISSIONS[group] || [])
        .reduce((all, items) => all.concat(items), [])
        .concat(_splitList(profile.permissions))
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
    const missing = ['tempPassword', 'tempPasswordHash', 'mustChangePassword', 'permissionGroups', 'permissions'].filter(h => !existing.includes(h))
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
    requireRole,
    getEffectiveAccess,
    hasPermission,
    requirePermission,
    debugDecodeToken
  }
})()
