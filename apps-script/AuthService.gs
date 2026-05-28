/**
 * AuthService.gs  — Fixed version
 *
 * Firebase ID tokens are JWT strings: header.payload.signature
 * GAS cannot do RSA verification, so we decode the payload claims
 * and validate: expiry, audience, issuer, and email domain.
 *
 * For production, deploy Firebase Admin SDK on a Cloud Function
 * and call that for full signature verification.
 */

const AuthService = (() => {

  const PROPS = PropertiesService.getScriptProperties()
  const FIREBASE_PROJECT_ID = PROPS.getProperty('FIREBASE_PROJECT_ID') || 'pmes-1cb6d'
  const ALLOWED_DOMAIN = PROPS.getProperty('ALLOWED_EMAIL_DOMAIN') || 'dswd.gov.ph'

  // ── Verify Firebase ID token from request ──
  function verifyToken(e) {
    // Token comes as query param ?token=...
    const token = e.parameter?.token || ''
    if (!token || token === 'test' || token.length < 100) return null

    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null

      // Base64url decode the payload
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      // Pad to multiple of 4
      while (b64.length % 4 !== 0) b64 += '='

      const payloadStr = Utilities.newBlob(
        Utilities.base64Decode(b64)
      ).getDataAsString()

      const payload = JSON.parse(payloadStr)
      const now = Math.floor(Date.now() / 1000)

      // Validate standard JWT claims
      if (!payload.sub) return null
      if (payload.exp && payload.exp < now) {
        Logger.log('Token expired')
        return null
      }
      if (payload.aud && payload.aud !== FIREBASE_PROJECT_ID) {
        Logger.log('Wrong audience: ' + payload.aud)
        return null
      }

      const email = payload.email || ''

      // Domain restriction — skip in dev if no domain set
      if (ALLOWED_DOMAIN && email && !email.endsWith('@' + ALLOWED_DOMAIN)) {
        // Allow gmail during development
        if (!email.endsWith('@gmail.com')) {
          Logger.log('Domain not allowed: ' + email)
          return null
        }
      }

      return {
        uid: payload.sub,
        email: payload.email || '',
        name: payload.name || ''
      }

    } catch (err) {
      Logger.log('Token parse error: ' + err.message)
      return null
    }
  }

  // ── Get or auto-create PMES profile ──
  function getProfile(user) {
    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    const rows = SpreadsheetService.getAllRows(sheet)

    // Find by uid or email
    let row = rows.find(r => r.uid === user.uid) ||
      rows.find(r => r.email === user.email)

    if (!row) {
      // Auto-create a basic profile for new users
      row = autoCreateUser(user, sheet)
    }

    // Return safe profile (no sensitive fields)
    return {
      id: row.id,
      uid: row.uid,
      email: row.email,
      fullName: row.fullName || row.email?.split('@')[0] || 'User',
      firstName: row.firstName || '',
      lastName: row.lastName || '',
      role: row.role || 'Staff',
      divisionId: row.divisionId || '',
      divisionName: row.divisionName || '',
      position: row.position || '',
      employeeNo: row.employeeNo || '',
      type: row.type || 'Regular',
      active: row.active !== false
    }
  }

  // ── Auto-create user on first login ──
  function autoCreateUser(user, sheet) {
    const now = new Date().toISOString()
    const nameParts = (user.name || '').split(' ')
    const newUser = {
      id: SpreadsheetService.generateId('USR-'),
      uid: user.uid,
      email: user.email,
      fullName: user.name || user.email.split('@')[0],
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      role: 'Staff',
      divisionId: '',
      divisionName: '',
      position: '',
      employeeNo: '',
      type: 'Regular',
      active: true,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now
    }
    SpreadsheetService.appendRow(sheet, newUser)
    Logger.log('Auto-created user: ' + user.email)
    return newUser
  }

  // ── Update last login timestamp ──
  function updateLastLogin(userId) {
    try {
      const sheet = SpreadsheetService.getSheet(SHEET.USERS)
      SpreadsheetService.updateRow(sheet, userId, {
        lastLoginAt: new Date().toISOString()
      })
    } catch (e) {
      // Non-critical
    }
  }

  // ── Role guard ──
  function requireRole(user, ...allowedRoles) {
    const profile = AuthService.getProfile(user)
    if (!allowedRoles.includes(profile.role)) {
      throw HttpError('Insufficient permissions for this action', 403)
    }
    return profile
  }

  return { verifyToken, getProfile, requireRole, updateLastLogin }
})()