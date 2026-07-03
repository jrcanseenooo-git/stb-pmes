// ── Sheet name constants ──
const SHEET = {
  USERS:              'Users',
  DIVISIONS:          'Divisions',
  KRAS:               'KRAs',
  INDICATORS:         'SuccessIndicators',
  ACCOMPLISHMENTS:    'Accomplishments',
  MOV:                'MOVFiles',
  EVALUATIONS:        'Evaluations',
  NOTIFICATIONS:      'Notifications',
  AUDIT:              'AuditLog',
  REPORTS:            'Reports',
  DEADLINES:          'Deadlines',
  REVISIONS:          'Revisions',
  FOCAL_ASSIGNMENTS:  'FocalAssignments',
  REVIEW_COMMENTS:    'ReviewComments',

  // ── Previously missing – now added ──
  IPCRF_FORMS:        'IPCRForms',
  FORM_ENTRIES:       'FormEntries',
  MASTER_KRA_LIBRARY: 'MasterKRALibrary',

  // ── IPAT (Innovations Performance Assessment Tool) ──
  IPAT_RECORDS:      'IPATRecords',
  IPAT_CBC_RATINGS:  'IPATCBCRatings',
  IPAT_JF_RATINGS:   'IPATJFRatings',
  IPAT_EDAP:         'IPATEdap',
  IPAT_ASSIGNMENTS:  'IPATRaterAssignments'
}

// ── Entry point: HTTP GET ──
function doGet(e) {
  return handleRequest(e, 'GET')
}

// ── Entry point: HTTP POST ──
function doPost(e) {
  return handleRequest(e, 'POST')
}

// ── Rate limiter (per authenticated user, using CacheService) ──
// GAS does not expose client IP, so limiting is per user ID rather than per IP.
// Limit: 60 requests per minute per user for general routes.
function checkRateLimit(userId) {
  let count = 0
  try {
    const cache = CacheService.getScriptCache()
    const key   = 'rl_' + userId + '_' + Math.floor(Date.now() / 60000)
    count = parseInt(cache.get(key) || '0', 10) + 1
    cache.put(key, String(count), 90) // TTL 90s so it survives the minute boundary
  } catch (e) {
    // CacheService failure is non-fatal — allow the request through
    Logger.log('Rate limiter cache error: ' + e.message)
    return
  }
  if (count > 60) throw HttpError('Too many requests. Please wait a moment.', 429)
}

// ── Main dispatcher ──
function handleRequest(e, method) {
  try {
    // 1. Authenticate every request
    const user = AuthService.verifyToken(e)
    if (!user) return respond(401, false, null, 'Unauthorized – invalid or missing token')

    // 2. Rate limit per authenticated user
    const route = (e.parameter?.route || '').replace(/^\/|\/$/g, '')
    checkRateLimit(user.uid || user.email)

    // 3. Read _method from query params FIRST (before parseBody strips it)
    //    then parse the rest of the body
    const httpMethod = (e.parameter?._method || method).toUpperCase()
    const body       = parseBody(e)

    // 4. Route
    const result = Router.dispatch(route, httpMethod, e.parameter, body, user)

    return respond(200, true, result)

  } catch (err) {
    Logger.log('PMES Error: ' + err.message + '\n' + err.stack)
    const code = err.statusCode || 500
    const clientMsg = code >= 500
      ? 'An unexpected error occurred. Please try again later.'
      : err.message
    return respond(code, false, null, clientMsg)
  }
}

// ── Helpers ──
function parseBody(e) {
  try {
    // Try JSON POST body first
    if (e.postData && e.postData.contents) return JSON.parse(e.postData.contents)
    // Fall back to query parameters (GET-based writes)
    const reserved = new Set(['route', '_method', 'token'])
    const body = {}
    for (const key in (e.parameter || {})) {
      if (!reserved.has(key)) body[key] = e.parameter[key]
    }
    return body
  } catch (err) {
    return {}
  }
}

function respond(status, success, data, message) {
  const payload = JSON.stringify({ success: success, data: data !== undefined ? data : null, message: message || null })
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON)
}

function HttpError(message, code) {
  const e    = new Error(message)
  e.statusCode = code || 400
  return e
}
