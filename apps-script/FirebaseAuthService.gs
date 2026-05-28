/**
 * FirebaseAuthService.gs
 * Creates, updates, and manages Firebase Auth users directly from Apps Script
 * using Firebase Auth REST API + Google Identity Platform Admin API.
 *
 * Setup required:
 *   1. Enable "Identity Toolkit API" in Google Cloud Console
 *   2. Set Script Property: FIREBASE_WEB_API_KEY = your Firebase Web API Key
 *   3. Set Script Property: FIREBASE_PROJECT_ID = pmes-1cb6d
 *
 * The Apps Script service account has access to the Firebase project
 * because it runs under the same Google Cloud project.
 */

const FirebaseAuthService = (() => {

  const PROPS          = PropertiesService.getScriptProperties()
  const PROJECT_ID     = PROPS.getProperty('FIREBASE_PROJECT_ID')    || 'pmes-1cb6d'
  const WEB_API_KEY    = PROPS.getProperty('FIREBASE_WEB_API_KEY')   || ''

  // Identity Toolkit v1 endpoint (Admin operations via OAuth2)
  const ADMIN_BASE     = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`
  const PUBLIC_BASE    = `https://identitytoolkit.googleapis.com/v1/accounts`

  // ── Get OAuth2 token for Admin API calls ──
  function getAdminToken() {
    return ScriptApp.getOAuthToken()
  }

  // ── CREATE a new Firebase Auth user ──
  function createUser(email, password, displayName) {
    const token = getAdminToken()
    const url   = `${ADMIN_BASE}/accounts`

    const payload = {
      email:           email,
      password:        password,
      displayName:     displayName || email.split('@')[0],
      emailVerified:   false,
      disabled:        false
    }

    try {
      const response = UrlFetchApp.fetch(url, {
        method:             'POST',
        contentType:        'application/json',
        headers:            { Authorization: 'Bearer ' + token },
        payload:            JSON.stringify(payload),
        muteHttpExceptions: true
      })

      const result = JSON.parse(response.getContentText())
      const code   = response.getResponseCode()

      if (code === 200) {
        Logger.log('✅ Firebase user created: ' + email + ' UID: ' + result.localId)
        return { success: true, uid: result.localId, email: result.email }
      } else if (result.error?.message === 'EMAIL_EXISTS') {
        Logger.log('ℹ️ Firebase user already exists: ' + email)
        // Get existing user's UID
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
    const url   = `${ADMIN_BASE}/accounts`

    const payload = {
      localId:  uid,
      password: newPassword
    }

    try {
      const response = UrlFetchApp.fetch(url + ':update', {
        method:             'POST',
        contentType:        'application/json',
        headers:            { Authorization: 'Bearer ' + token },
        payload:            JSON.stringify(payload),
        muteHttpExceptions: true
      })

      const result = JSON.parse(response.getContentText())
      const code   = response.getResponseCode()

      if (code === 200) {
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
    const url   = `${ADMIN_BASE}/accounts:update`

    const payload = { localId: uid, disableUser: true }

    try {
      const response = UrlFetchApp.fetch(url, {
        method:             'POST',
        contentType:        'application/json',
        headers:            { Authorization: 'Bearer ' + token },
        payload:            JSON.stringify(payload),
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
    const url   = `${ADMIN_BASE}/accounts:update`

    const payload = { localId: uid, disableUser: false }

    try {
      const response = UrlFetchApp.fetch(url, {
        method:             'POST',
        contentType:        'application/json',
        headers:            { Authorization: 'Bearer ' + token },
        payload:            JSON.stringify(payload),
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
    const url   = `${ADMIN_BASE}/accounts:lookup`

    try {
      const response = UrlFetchApp.fetch(url, {
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
    const url   = `${ADMIN_BASE}/accounts:update`

    try {
      const response = UrlFetchApp.fetch(url, {
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

  // ── TEST function — run this to verify setup ──
  function testSetup() {
    Logger.log('Testing Firebase Admin API access...')
    Logger.log('Project ID: ' + PROJECT_ID)

    const token = getAdminToken()
    if (!token) {
      Logger.log('❌ No OAuth token — authorize the script first')
      return
    }
    Logger.log('✅ OAuth token obtained (length: ' + token.length + ')')

    // Try to look up the admin user
    const admin = getUserByEmail('jrbcancino@dswd.gov.ph')
    if (admin) {
      Logger.log('✅ Firebase Admin API working! Found user: ' + admin.email)
      Logger.log('   UID: ' + admin.localId)
      Logger.log('   Disabled: ' + (admin.disabled || false))
    } else {
      Logger.log('❌ Could not find admin user — check API permissions')
      Logger.log('   Make sure "Identity Toolkit API" is enabled in Google Cloud Console')
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