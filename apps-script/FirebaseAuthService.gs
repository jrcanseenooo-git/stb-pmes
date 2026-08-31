/**
 * FirebaseAuthService.gs
 * Manages Firebase Auth users from Apps Script using a Service Account JWT.
 * No GCP project linking required - works with any Firebase project.
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

  // One fetch of the whole property store rather than a getProperty() call per
  // constant. Module load runs on every request in Apps Script, so these were
  // four separate round trips to the properties service before any handler
  // started. The resolved values are identical; nothing below changes.
  const PROPS = (() => {
    try { return PropertiesService.getScriptProperties().getProperties() || {} }
    catch (e) { return {} }
  })()

  const PROJECT_ID   = PROPS.FIREBASE_PROJECT_ID   || 'pmes-1cb6d'
  const CLIENT_EMAIL = PROPS.FIREBASE_CLIENT_EMAIL || ''
  const PRIVATE_KEY  = (PROPS.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  // Public Firebase Web API key (NOT a secret - it is already shipped in the
  // frontend bundle). Prefer a Script Property; fall back to the known value so
  // token verification cannot silently fail-open if the property is unset.
  const WEB_API_KEY  = PROPS.FIREBASE_WEB_API_KEY || 'AIzaSyDf-fc_WBHb45Env4XJ5Gsw6lRfHORptnQ'

  const ADMIN_BASE   = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`

  // ── VERIFY a Firebase ID token authoritatively (checks Google's signature) ──
  // accounts:lookup with an idToken makes Google validate the token's RS256
  // signature, expiry, and issuer. A forged or expired token returns non-200.
  // Returns { uid, email, name, emailVerified, disabled } or null when invalid.
  function verifyIdToken(idToken) {
    if (!idToken) return null
    try {
      const response = UrlFetchApp.fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_API_KEY}`,
        {
          method:             'post',
          contentType:        'application/json',
          payload:            JSON.stringify({ idToken }),
          muteHttpExceptions: true
        }
      )
      if (response.getResponseCode() !== 200) {
        Logger.log('[Auth] ID token rejected by Identity Toolkit: ' + response.getResponseCode())
        return null
      }
      const data = JSON.parse(response.getContentText())
      const u = data.users && data.users[0]
      if (!u || !u.localId) return null
      return {
        uid:           u.localId,
        email:         u.email || '',
        name:          u.displayName || '',
        emailVerified: u.emailVerified === true,
        disabled:      u.disabled === true
      }
    } catch (e) {
      Logger.log('[Auth] verifyIdToken error: ' + e.message)
      return null
    }
  }

  // ── Build a signed JWT and exchange it for an access token ──
  // Service-account access tokens are valid for an hour, but this signed a fresh
  // RSA-SHA256 JWT and did a full OAuth exchange on EVERY call - two extra
  // network round trips plus a signing operation before the real request could
  // start. That is the bulk of the wait when approving a user. Cache it in
  // CacheService (shared across executions) and re-use it until it nearly
  // expires. A cache failure just falls through to minting a new one.
  const ADMIN_TOKEN_CACHE_KEY = 'fb_admin_token'

  function getAdminToken() {
    if (!CLIENT_EMAIL || !PRIVATE_KEY) {
      throw new Error('Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY in Script Properties')
    }

    try {
      const cached = CacheService.getScriptCache().get(ADMIN_TOKEN_CACHE_KEY)
      if (cached) return cached
    } catch (e) { /* cache unavailable - mint a fresh token below */ }

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

    // Cache for slightly less than the token's own lifetime so it is never
    // served past expiry. Google returns expires_in (typically 3600s); hold it
    // for that minus a 5-minute safety margin, capped at CacheService's 6h max.
    try {
      const ttl = Math.max(60, Math.min(21600, (Number(tokenResult.expires_in) || 3600) - 300))
      CacheService.getScriptCache().put(ADMIN_TOKEN_CACHE_KEY, tokenResult.access_token, ttl)
    } catch (e) { /* non-fatal: the token still works, it just won't be re-used */ }

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
        // A Firebase Auth account for this email already existed - common for
        // dswd.gov.ph addresses that ever touched Google Sign-In, or a retried
        // creation. This branch used to just report success without touching
        // the account, so the temp password shown in the creation modal was
        // never actually set on the real credential: the account kept
        // whatever password it already had (often none), first login failed,
        // and the admin had to use Reset Password - which calls
        // updatePassword() on the existing uid - to make the account usable.
        // Setting the password here means the temp password from creation
        // works the first time, matching what the admin was told happened.
        Logger.log('ℹ️ Firebase user already exists: ' + email)
        const existing = getUserByEmail(email)
        if (existing?.localId) {
          try {
            updatePassword(existing.localId, password)
          } catch (pwErr) {
            Logger.log('⚠️ Could not set password on existing Firebase user ' + email + ': ' + pwErr.message)
          }
        }
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

  // ── DELETE a Firebase user (irreversible - unlike disableUser) ──
  // Used only by UsersService.remove(), which hard-deletes the PMES account
  // row. Deleting rather than disabling frees the email address so a
  // corrected re-creation isn't blocked by a stale, disabled account still
  // holding it.
  function deleteUser(uid) {
    const token = getAdminToken()

    try {
      const response = UrlFetchApp.fetch(`${ADMIN_BASE}/accounts:delete`, {
        method:             'POST',
        contentType:        'application/json',
        headers:            { Authorization: 'Bearer ' + token },
        payload:            JSON.stringify({ localId: uid }),
        muteHttpExceptions: true
      })

      if (response.getResponseCode() === 200) {
        Logger.log('✅ Firebase user deleted: ' + uid)
        return { success: true }
      }
      const result = JSON.parse(response.getContentText())
      throw new Error(result.error?.message || 'Failed to delete user')
    } catch (e) {
      Logger.log('FirebaseAuthService.deleteUser error: ' + e.message)
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
    const testEmail = PROPS.FIREBASE_TEST_EMAIL
    Logger.log('Client Email:  ' + (CLIENT_EMAIL || '❌ NOT SET'))
    Logger.log('Private Key:   ' + (PRIVATE_KEY ? '✅ set (' + PRIVATE_KEY.length + ' chars)' : '❌ NOT SET'))

    try {
      const token = getAdminToken()
      Logger.log('✅ Access token obtained (length: ' + token.length + ')')

      if (!testEmail) {
        Logger.log('Set FIREBASE_TEST_EMAIL to test account lookup.')
        return
      }

      const admin = getUserByEmail(testEmail)
      if (admin) {
        Logger.log('✅ Firebase Admin API working! Found user: ' + admin.email)
        Logger.log('   UID: ' + admin.localId)
      } else {
        Logger.log('⚠️ API works but user not found - check the email address')
      }
    } catch (e) {
      Logger.log('❌ Error: ' + e.message)
    }
  }

  return {
    verifyIdToken,
    createUser,
    updatePassword,
    disableUser,
    enableUser,
    deleteUser,
    getUserByEmail,
    updateDisplayName,
    testSetup
  }
})()

// ── Callable wrapper for testing ──
function testFirebaseSetup() {
  FirebaseAuthService.testSetup()
}
