const AuthService = (() => {

  const PROPS      = PropertiesService.getScriptProperties()
  const PROJECT_ID = PROPS.getProperty('FIREBASE_PROJECT_ID') || 'pmes-1cb6d'

  // ── Verify Firebase ID token sent in e.parameter.token ──
  function verifyToken(e) {
    const idToken = (e.parameter && e.parameter.token) || ''
    if (!idToken) return null

    try {
      // Call Firebase REST API to verify the token
      const url      = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${PROPS.getProperty('FIREBASE_API_KEY') || ''}`
      const response = UrlFetchApp.fetch(url, {
        method:             'POST',
        contentType:        'application/json',
        payload:            JSON.stringify({ idToken }),
        muteHttpExceptions: true
      })

      const result = JSON.parse(response.getContentText())
      if (response.getResponseCode() !== 200 || !result.users || !result.users[0]) {
        Logger.log('Token verification failed: ' + response.getContentText())
        return null
      }

      const firebaseUser = result.users[0]
      return {
        uid:   firebaseUser.localId,
        email: firebaseUser.email,
        name:  firebaseUser.displayName || firebaseUser.email
      }
    } catch (err) {
      Logger.log('verifyToken error: ' + err.message)
      return null
    }
  }

  // ── Load PMES profile from Sheets by Firebase UID or email ──
  function getProfile(user) {
    if (!user) throw HttpError('No authenticated user', 401)

    const sheet = SpreadsheetService.getSheet(SHEET.USERS)
    const rows  = SpreadsheetService.getAllRows(sheet)

    // Match by uid first, then fall back to email
    let profile = rows.find(r => r.uid === user.uid)
    if (!profile) profile = rows.find(r => r.email === user.email)

    if (!profile) {
      // Return a minimal profile so the app doesn't crash — admin can register this user
      Logger.log('Profile not found for: ' + user.email + ' — returning guest profile')
      return {
        id:          '',
        uid:         user.uid,
        email:       user.email,
        fullName:    user.name || user.email,
        role:        'Staff',
        divisionId:  '',
        divisionName:'',
        position:    '',
        type:        'Regular',
        active:      true
      }
    }

    if (profile.active === false || profile.active === 'false') {
      throw HttpError('Your account has been deactivated. Contact your administrator.', 403)
    }

    return profile
  }

  // ── Role guard helper ──
  function requireRole(user, ...roles) {
    const profile = getProfile(user)
    if (!roles.includes(profile.role)) {
      throw HttpError(`Access denied. Required role: ${roles.join(' or ')}`, 403)
    }
    return profile
  }

  return { verifyToken, getProfile, requireRole }
})()