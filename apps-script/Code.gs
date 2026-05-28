/**
 * PMES – Google Apps Script API Entry Point  (Fixed)
 * =====================================================
 * All requests: GET or POST to the Web App URL
 * Token passed as: ?token=FIREBASE_ID_TOKEN
 * Route passed as: ?route=resource/sub
 * HTTP method override: body._method or ?_method= (PUT, PATCH, DELETE)
 */

const SHEET = {
  USERS:           'Users',
  DIVISIONS:       'Divisions',
  KRAS:            'KRAs',
  INDICATORS:      'SuccessIndicators',
  ACCOMPLISHMENTS: 'Accomplishments',
  MOV:             'MOVFiles',
  EVALUATIONS:     'Evaluations',
  NOTIFICATIONS:   'Notifications',
  AUDIT:           'AuditLog',
  REPORTS:         'Reports',
  DEADLINES:       'Deadlines',
  REVISIONS:       'Revisions'
}

// ── GET handler ──
function doGet(e) {
  return handleRequest(e, 'GET')
}

// ── POST handler ──
function doPost(e) {
  return handleRequest(e, 'POST')
}

// ── Main dispatcher ──
function handleRequest(e, httpMethod) {
  // Add CORS headers
  try {
    // 1. Verify Firebase token
    const user = AuthService.verifyToken(e)
    if (!user) {
      return respond(401, false, null, 'Unauthorized – invalid or missing token')
    }

    // 2. Parse body
    const body = parseBody(e)

    // 3. Method override (GAS only does GET/POST natively)
    const method = body?._method?.toUpperCase() ||
                   e.parameter?._method?.toUpperCase() ||
                   httpMethod

    // 4. Get route
    const route = (e.parameter?.route || '').replace(/^\/|\/$/g, '')

    // 5. Special case: auth/me — get profile and update last login
    if (route === 'auth/me') {
      const profile = AuthService.getProfile(user)
      AuthService.updateLastLogin(profile.id)
      AuditService.log('LOGIN', 'Auth', 'User logged in via Firebase', user)
      return respond(200, true, profile)
    }

    // 6. auth/log
    if (route === 'auth/log') {
      return respond(200, true, AuditService.log(body.action, body.module, body.details, user))
    }

    // 7. Dispatch to router
    const result = Router.dispatch(route, method, e.parameter, body, user)
    return respond(200, true, result)

  } catch (err) {
    Logger.log('PMES Error: ' + err.message + '\n' + (err.stack || ''))
    const code = err.statusCode || 500
    return respond(code, false, null, err.message || 'Internal server error')
  }
}

// ── Helpers ──
function parseBody(e) {
  try {
    if (e.postData?.contents) return JSON.parse(e.postData.contents)
  } catch (err) {
    Logger.log('Body parse error: ' + err.message)
  }
  return {}
}

function respond(status, success, data, message) {
  const payload = JSON.stringify({
    success: success,
    data:    data    ?? null,
    message: message ?? null,
    status:  status
  })

  const output = ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON)

  return output
}

function HttpError(message, code) {
  const e      = new Error(message)
  e.statusCode = code || 400
  return e
}