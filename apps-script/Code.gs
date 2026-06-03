// ── Sheet name constants ──
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

// ── Entry point: HTTP GET ──
function doGet(e) {
  return handleRequest(e, 'GET')
}

// ── Entry point: HTTP POST ──
function doPost(e) {
  return handleRequest(e, 'POST')
}

// ── Main dispatcher ──
function handleRequest(e, method) {
  try {
    // 1. Authenticate every request (reads token from e.parameter.token)
    const user = AuthService.verifyToken(e)
    if (!user) return respond(401, false, null, 'Unauthorized – invalid or missing token')

    // 2. Parse body: for POST requests this is e.postData.contents (JSON).
    //    We merge it with e.parameter so the dispatcher always sees a flat body.
    const body       = parseBody(e)
    const httpMethod = (body._method || '').toUpperCase() || method

    // 3. Route
    const route  = (e.parameter?.route || '').replace(/^\/|\/$/g, '')
    const result = Router.dispatch(route, httpMethod, e.parameter, body, user)

    return respond(200, true, result)

  } catch (err) {
    Logger.log('PMES Error: ' + err.message + '\n' + err.stack)
    const code = err.statusCode || 500
    return respond(code, false, null, err.message)
  }
}

// ── Helpers ──

/**
 * parseBody – returns the merged request body.
 *
 * For POST requests the frontend sends a JSON string in e.postData.contents.
 * We parse that and return it.  For GET requests (reads) e.postData is absent,
 * so we fall back to an empty object.
 *
 * NOTE: We do NOT merge e.parameter into the body here because e.parameter
 * is already available separately in the dispatcher and mixing them can cause
 * the _method key to come from both places.
 */
function parseBody(e) {
  try {
    const raw = e.postData?.contents
    if (raw) return JSON.parse(raw)
  } catch (err) {
    Logger.log('PMES parseBody error: ' + err.message)
  }
  return {}
}

function respond(status, success, data, message) {
  const payload = JSON.stringify({ success, data: data ?? null, message: message ?? null })
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON)
}

function HttpError(message, code) {
  const e    = new Error(message)
  e.statusCode = code || 400
  return e
}