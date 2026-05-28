/**
 * FirebaseAuthService.gs
 * Manages Firebase Auth users from Apps Script using a Service Account JWT.
 * No GCP project linking required — works with any Firebase project.
 *
 * Setup required:
 *   1. Firebase Console → Project Settings → Service Accounts
 *   2. Click "Generate new private key" → download JSON
 *   3. Add these Script Properties:
 *      FIREBASE_PROJECT_ID    = your-project-id  (e.g. pmes-1cb6d)
 *      FIREBASE_CLIENT_EMAIL  = value from "client_email" in the JSON
 *      FIREBASE_PRIVATE_KEY   = value from "private_key" in the JSON
 *                               (paste the full string including -----BEGIN/END-----)
 */

const FirebaseAuthService = (() => {

  const PROPS        = PropertiesService.getScriptProperties()
  const PROJECT_ID   = PROPS.getProperty('FIREBASE_PROJECT_ID')   || 'pmes-1cb6d'
  const CLIENT_EMAIL = PROPS.getProperty('FIREBASE_CLIENT_EMAIL') || ''
  const PRIVATE_KEY  = (PROPS.getProperty('FIREBASE_PRIVATE_KEY') || '').replace(/\\n/g, '\n')

  const ADMIN_BASE   = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`

  // ── Build a signed JWT and exchange it for an access token ──
  function getAdminToken() {
    if (!CLIENT_EMAIL || !PRIVATE_KEY) {
      throw new Error('Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY in Script Properties')
    }

    const now     = Math.floor(Date.now() / 1000)
    const header  = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claim   = Utilities.base64EncodeWebSafe(JSON.stringify({
      iss:   CLIENT_EMAIL,
      sub:   CLIENT_EMAIL,
      aud:   'https://oauth2.googleapis.com/token',
      iat:   now,
      exp:   now + 3600,
      scope: 'https://www.googleapis.com/auth/cloud-platform'
    }))

    const sigInput  = `${header}.${claim}`
    const signature = Utilities.base64EncodeWebSafe(
      Utilities.computeRsaSha256Signature(sigInput, PRIVATE_KEY)
    )
    const jwt = `${sigInput}.${signature}`

    const tokenResponse = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method:             'POST',
      contentType:        'application/x-www-form-urlencoded',
      payload:            `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
      muteHttpExceptions: true
    })

    const tokenResult = JSON.parse(tokenResponse.getContentText())
    if (!tokenResult.access_token) {
      throw new Error('Failed to get access token: ' + JSON.stringify(tokenResult))
    }

    return tokenResult.access_token
  }

  // ── CREATE a new Firebase Auth user ──
  function createUser(email, password, displayName) {
    const token = getAdminToken()
    const url   = `${ADMIN_BASE}/accounts`

    try {
      const response = UrlFetchApp.fetch(url, {
        method:             'POST',
        contentType:        'application/json',
        headers:            { Authorization: 'Bearer ' + token },
        payload:            JSON.stringify({
          email,
          password,
          displayName: displayName || email.split('@')[0],
          emailVerified: false,
          disabled:      false
        }),
        muteHttpExceptions: true
      })

      const result = JSON.parse(response.getContentText())
      const code   = response.getResponseCode()

      if (code === 200) {
        Logger.log('✅ Firebase user created: ' + email + ' UID: ' + result.localId)
        return { success: true, uid: result.localId, email: result.email }
      } else if (result.error?.message === 'EMAIL_EXISTS') {
        Logger.log('ℹ️ Firebase user already exists: ' + email)
        const existing = getUserByEmail(email)
        return { success: true, uid: existing?.localId || '', email, alreadyExisted: true }
      } else {
        Logger.log('❌ Firebase create user error: ' + JSON.stringify(result.error))
        throw new Error(result.error?.message || 'Failed to create Firebase user')
      }
    } catch (e) {
      Logger.log('FirebaseAuthService.createUser error: ' + e.message)
      throw e
    }
  }

  // ── UPDATE password for existing user ──
  function updatePassword(uid, newPassword) {
    const token = getAdminToken()

    try {
      const response = UrlFetchApp.fetch(`${ADMIN_BASE}/accounts:update`, {
        method:             'POST',
        contentType:        'application/json',
        headers:            { Authorization: 'Bearer ' + token },
        payload:            JSON.stringify({ localId: uid, password: newPassword }),
        muteHttpExceptions: true
      })

      const result = JSON.parse(response.getContentText())
      if (response.getResponseCode() === 200) {
        Logger.log('✅ Firebase password updated for UID: ' + uid)
        return { success: true }
      } else {
        throw new Error(result.error?.message || 'Failed to update password')
      }
    } catch (e) {
      Logger.log('FirebaseAuthService.updatePassword error: ' + e.message)
      throw e
    }
  }

  // ── DISABLE a Firebase user ──
  function disableUser(uid) {
    const token = getAdminToken()

    try {
      const response = UrlFetchApp.fetch(`${ADMIN_BASE}/accounts:update`, {
        method:             'POST',
        contentType:        'application/json',
        headers:            { Authorization: 'Bearer ' + token },
        payload:            JSON.stringify({ localId: uid, disableUser: true }),
        muteHttpExceptions: true
      })

      const result = JSON.parse(response.getContentText())
      if (response.getResponseCode() === 200) {
        Logger.log('✅ Firebase user disabled: ' + uid)
        return { success: true }
      } else {
        throw new Error(result.error?.message || 'Failed to disable user')
      }
    } catch (e) {
      Logger.log('FirebaseAuthService.disableUser error: ' + e.message)
      throw e
    }
  }

  // ── ENABLE a Firebase user ──
  function enableUser(uid) {
    const token = getAdminToken()

    try {
      const response = UrlFetchApp.fetch(`${ADMIN_BASE}/accounts:update`, {
        method:             'POST',
        contentType:        'application/json',
        headers:            { Authorization: 'Bearer ' + token },
        payload:            JSON.stringify({ localId: uid, disableUser: false }),
        muteHttpExceptions: true
      })

      const result = JSON.parse(response.getContentText())
      if (response.getResponseCode() === 200) {
        Logger.log('✅ Firebase user enabled: ' + uid)
        return { success: true }
      } else {
        throw new Error(result.error?.message || 'Failed to enable user')
      }
    } catch (e) {
      Logger.log('FirebaseAuthService.enableUser error: ' + e.message)
      throw e
    }
  }

  // ── GET user by email ──
  function getUserByEmail(email) {
    const token = getAdminToken()

    try {
      const response = UrlFetchApp.fetch(`${ADMIN_BASE}/accounts:lookup`, {
        method:             'POST',
        contentType:        'application/json',
        headers:            { Authorization: 'Bearer ' + token },
        payload:            JSON.stringify({ email: [email] }),
        muteHttpExceptions: true
      })

      const result = JSON.parse(response.getContentText())
      if (response.getResponseCode() === 200 && result.users?.length > 0) {
        return result.users[0]
      }
      return null
    } catch (e) {
      Logger.log('FirebaseAuthService.getUserByEmail error: ' + e.message)
      return null
    }
  }

  // ── UPDATE display name ──
  function updateDisplayName(uid, displayName) {
    const token = getAdminToken()

    try {
      const response = UrlFetchApp.fetch(`${ADMIN_BASE}/accounts:update`, {
        method:             'POST',
        contentType:        'application/json',
        headers:            { Authorization: 'Bearer ' + token },
        payload:            JSON.stringify({ localId: uid, displayName }),
        muteHttpExceptions: true
      })

      const result = JSON.parse(response.getContentText())
      return response.getResponseCode() === 200
        ? { success: true }
        : { success: false, error: result.error?.message }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // ── TEST function ──
  function testSetup() {
    Logger.log('Testing Firebase Service Account access...')
    Logger.log('Project ID:    ' + PROJECT_ID)
    Logger.log('Client Email:  ' + (CLIENT_EMAIL || '❌ NOT SET'))
    Logger.log('Private Key:   ' + (PRIVATE_KEY ? '✅ set (' + PRIVATE_KEY.length + ' chars)' : '❌ NOT SET'))

    try {
      const token = getAdminToken()
      Logger.log('✅ Access token obtained (length: ' + token.length + ')')

      const admin = getUserByEmail('jrbcancino@dswd.gov.ph')
      if (admin) {
        Logger.log('✅ Firebase Admin API working! Found user: ' + admin.email)
        Logger.log('   UID: ' + admin.localId)
      } else {
        Logger.log('⚠️ API works but user not found — check the email address')
      }
    } catch (e) {
      Logger.log('❌ Error: ' + e.message)
    }
  }

  return {
    createUser,
    updatePassword,
    disableUser,
    enableUser,
    getUserByEmail,
    updateDisplayName,
    testSetup
  }
})()

// ── Callable wrapper for testing ──
function testFirebaseSetup() {
  FirebaseAuthService.testSetup()
}