const AuthService = (() => {

  const FIREBASE_PROJECT_ID  = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID')
  const ALLOWED_EMAIL_DOMAIN = PropertiesService.getScriptProperties().getProperty('ALLOWED_EMAIL_DOMAIN') || 'dswd.gov.ph'

  // ─────────────────────────────────────────────────────────────
  // TOKEN VERIFICATION
  // ─────────────────────────────────────────────────────────────
  function verifyToken(e) {
    const raw = (e.parameter?.token || '').trim()
    if (!raw) {
      Logger.log('[Auth] No token in request')
      return null
    }

    try {
      const parts = raw.split('.')
      if (parts.length !== 3) {
        Logger.log('[Auth] Token does not have 3 parts, got: ' + parts.length)
        return null
      }
      
      const b64url  = parts[1]
      const b64std  = b64url.replace(/-/g, '+').replace(/_/g, '/')
      const padLen  = (4 - (b64std.length % 4)) % 4   // 0, 1, 2, or 3
      const padded  = b64std + '='.repeat(padLen)

      const jsonStr = Utilities.newBlob(Utilities.base64Decode(padded)).getDataAsString()
      const payload = JSON.parse(jsonStr)

      Logger.log('[Auth] Token payload decoded. sub=' + payload.sub + ' email=' + payload.email)

      // ── Time checks ──
      const nowSec = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < nowSec) {
        Logger.log('[Auth] Token expired at ' + new Date(payload.exp * 1000).toISOString())
        return null
      }
      if (payload.iat && payload.iat > nowSec + 300) {
        // Allow 5-min clock skew
        Logger.log('[Auth] Token issued too far in the future: iat=' + payload.iat + ' now=' + nowSec)
        return null
      }

      // ── Audience / issuer ──
      if (FIREBASE_PROJECT_ID) {
        if (payload.aud !== FIREBASE_PROJECT_ID) {
          Logger.log('[Auth] Wrong aud: ' + payload.aud + ' expected: ' + FIREBASE_PROJECT_ID)
          return null
        }
        const expectedIss = 'https://securetoken.google.com/' + FIREBASE_PROJECT_ID
        if (payload.iss !== expectedIss) {
          Logger.log('[Auth] Wrong iss: ' + payload.iss)
          return null
        }
      }

      // ── Domain restriction ──
      const email = (payload.email || '').toLowerCase()
      if (ALLOWED_EMAIL_DOMAIN && !email.endsWith('@' + ALLOWED_EMAIL_DOMAIN.toLowerCase())) {
        Logger.log('[Auth] Domain not allowed: ' + email)
        return null
      }

      return {
        uid:   payload.sub   || '',
        email: payload.email || '',
        name:  payload.name  || ''
      }

    } catch (err) {
      Logger.log('[Auth] verifyToken error: ' + err.message + ' | stack: ' + err.stack)
      return null
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PROFILE LOOKUP
  // ─────────────────────────────────────────────────────────────
  function getProfile(user) {
    const sheet = _usersSheet()
    const rows  = SpreadsheetService.getAllRows(sheet)

    Logger.log('[Auth] Looking up profile for uid=' + user.uid + ' email=' + user.email)
    Logger.log('[Auth] Total users in sheet: ' + rows.length)

    const row = rows.find(r => {
      const uidMatch   = user.uid   && String(r.uid   || '').trim() === String(user.uid).trim()
      const emailMatch = user.email && String(r.email || '').trim().toLowerCase() ===
                         String(user.email).trim().toLowerCase()
      return uidMatch || emailMatch
    })

    if (!row) {
      Logger.log('[Auth] Profile NOT found. Available emails: ' + rows.map(r => r.email).join(', '))
      throw HttpError('User profile not found. Contact your administrator.', 404)
    }

    Logger.log('[Auth] Profile found: id=' + row.id + ' role=' + row.role)

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
    return {
      ...safe,
      mustChangePassword: mustChangePassword === true || String(mustChangePassword).toLowerCase() === 'true'
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
    const missing = ['tempPassword', 'tempPasswordHash', 'mustChangePassword'].filter(h => !existing.includes(h))
    if (missing.length) {
      sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing])
    }
    return sheet
  }

  return { verifyToken, getProfile, requireRole, debugDecodeToken }
})()
