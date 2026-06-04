const AuthService = (() => {

  const FIREBASE_PROJECT_ID  = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID')
  const ALLOWED_EMAIL_DOMAIN = PropertiesService.getScriptProperties().getProperty('ALLOWED_EMAIL_DOMAIN') || 'dswd.gov.ph'

  // ── Token verification ──────────────────────────────────────────────────
  function verifyToken(e) {
    const token = (e.parameter?.token || '').trim()
    if (!token) {
      Logger.log('[Auth] No token provided')
      return null
    }

    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        Logger.log('[Auth] Malformed token (parts: ' + parts.length + ')')
        return null
      }

      // Pad base64url segment to a multiple of 4 before decoding
      const padded  = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const padding = (4 - (padded.length % 4)) % 4
      const b64     = padded + '='.repeat(padding)

      const payload = JSON.parse(
        Utilities.newBlob(Utilities.base64Decode(b64)).getDataAsString()
      )

      // ── Time checks ──
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < now) {
        Logger.log('[Auth] Token expired (exp: ' + payload.exp + ', now: ' + now + ')')
        return null
      }
      if (payload.iat && payload.iat > now + 60) {
        Logger.log('[Auth] Token issued in future')
        return null
      }

      // ── Audience / issuer checks ──
      if (FIREBASE_PROJECT_ID) {
        if (payload.aud !== FIREBASE_PROJECT_ID) {
          Logger.log('[Auth] Wrong audience: ' + payload.aud)
          return null
        }
        if (payload.iss !== 'https://securetoken.google.com/' + FIREBASE_PROJECT_ID) {
          Logger.log('[Auth] Wrong issuer: ' + payload.iss)
          return null
        }
      }

      // ── Domain check ──
      const email = payload.email || ''
      if (ALLOWED_EMAIL_DOMAIN && !email.endsWith('@' + ALLOWED_EMAIL_DOMAIN)) {
        Logger.log('[Auth] Domain not allowed: ' + email)
        return null
      }

      return {
        uid:   payload.sub  || '',
        email: payload.email || '',
        name:  payload.name  || ''
      }

    } catch (err) {
      Logger.log('[Auth] Token decode error: ' + err.message)
      return null
    }
  }

  // ── Profile lookup ──────────────────────────────────────────────────────
  function getProfile(user) {
    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    const rows  = SpreadsheetService.getAllRows(sheet)

    // Match by uid first, fall back to email (covers legacy rows without uid)
    const row = rows.find(r =>
      (user.uid  && String(r.uid).trim()   === String(user.uid).trim())  ||
      (user.email && String(r.email).trim().toLowerCase() === String(user.email).trim().toLowerCase())
    )

    if (!row) {
      Logger.log('[Auth] Profile not found for uid=' + user.uid + ' email=' + user.email)
      Logger.log('[Auth] Available users: ' + rows.map(r => r.email).join(', '))
      throw HttpError('User profile not found in PMES. Please contact your administrator.', 404)
    }

    // Return all fields except the password hash
    const { passwordHash, tempPassword, mustChangePassword, ...safe } = row
    return safe
  }

  // ── Role guard ─────────────────────────────────────────────────────────
  function requireRole(user, ...allowedRoles) {
    const profile = getProfile(user)
    if (!allowedRoles.includes(profile.role)) {
      throw HttpError(
        'Insufficient permissions. Required: ' + allowedRoles.join(' / ') +
        '. Your role: ' + profile.role,
        403
      )
    }
    return profile
  }

  return { verifyToken, getProfile, requireRole }
})()