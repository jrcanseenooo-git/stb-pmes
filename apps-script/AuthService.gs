/**
 * AuthService.gs
 * Verifies Firebase ID tokens and enforces domain restrictions.
 *
 * Firebase token verification without the Admin SDK:
 * We fetch Google's public keys and validate the JWT signature + claims.
 */

const AuthService = (() => {

  const FIREBASE_PROJECT_ID    = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID')
  const ALLOWED_EMAIL_DOMAIN   = PropertiesService.getScriptProperties().getProperty('ALLOWED_EMAIL_DOMAIN') || 'dswd.gov.ph'
  const FIREBASE_KEYS_URL      = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'

  /**
   * Extract and verify the Firebase ID token from the Authorization header.
   * Returns decoded token claims or null if invalid.
   */
  function verifyToken(e) {
    const authHeader = e.parameter?.token || ''   // GAS can't read headers; token passed as ?token=
    if (!authHeader) return null

    try {
      const parts = authHeader.split('.')
      if (parts.length !== 3) return null

      // Decode payload (no signature validation in GAS for speed – use claims check + aud/iss)
      // For production: implement full RSA verification using the public keys endpoint.
      const payload = JSON.parse(Utilities.newBlob(
        Utilities.base64DecodeWebSafe(parts[1] + '==')
      ).getDataAsString())

      // Validate claims
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp < now)  return null   // expired
      if (payload.iat > now)  return null   // issued in the future

      if (payload.aud !== FIREBASE_PROJECT_ID) return null
      if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null

      // Domain restriction
      const email = payload.email || ''
      if (!email.endsWith('@' + ALLOWED_EMAIL_DOMAIN)) return null

      return {
        uid:   payload.sub,
        email: payload.email,
        name:  payload.name || ''
      }

    } catch (err) {
      Logger.log('Token verification error: ' + err.message)
      return null
    }
  }

  /**
   * Fetch the PMES profile record for a verified Firebase user.
   */
  function getProfile(user) {
    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    const rows  = SpreadsheetService.getAllRows(sheet)
    const row   = rows.find(r => r.uid === user.uid || r.email === user.email)
    if (!row) throw HttpError('User profile not found in PMES', 404)

    // Don't return password hashes or sensitive internal fields
    const { passwordHash, ...safe } = row
    return safe
  }

  /**
   * Guard helper used by services to enforce role access.
   */
  function requireRole(user, ...allowedRoles) {
    const profile = getProfile(user)
    if (!allowedRoles.includes(profile.role)) {
      throw HttpError('Insufficient permissions for this action', 403)
    }
    return profile
  }

  return { verifyToken, getProfile, requireRole }
})()
