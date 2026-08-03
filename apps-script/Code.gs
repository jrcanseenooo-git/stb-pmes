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
  SYSTEM_SETTINGS:    'SystemSettings',

  // ── IPAT (Innovations Performance Assessment Tool) ──
  IPAT_RECORDS:      'IPATRecords',
  IPAT_CBC_RATINGS:  'IPATCBCRatings',
  IPAT_JF_RATINGS:   'IPATJFRatings',
  IPAT_EDAP:         'IPATEdap',
  IPAT_ASSIGNMENTS:  'IPATRaterAssignments',

  ASSESSMENT_CONTENT:    'AssessmentContent',
  ASSESSMENT_CATEGORIES: 'AssessmentCategories'
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

const RESERVED_KEYS = ['route', '_method', 'token']

// ── Main dispatcher ──
function handleRequest(e, method) {
  try {
    // Parse the JSON body first — route, method, token and payload now travel
    // in the POST body so they never land in the URL (logs, history, Referer).
    // Query params are still honored as a fallback for backward compatibility.
    const body   = parseBody(e)
    const q      = e.parameter || {}

    const token      = q.token   || body.token   || ''
    const route      = String(q.route || body.route || '').replace(/^\/|\/$/g, '')
    const httpMethod = String(q._method || body._method || method).toUpperCase()

    // 1. Authenticate every request (signature-verified inside verifyToken)
    const user = AuthService.verifyToken(token)
    if (!user) return respond(401, false, null, 'Unauthorized – invalid or missing token')

    // 2. Rate limit per authenticated user
    checkRateLimit(user.uid || user.email)

    // 3. Build the params/body handed to the router: query + body, minus the
    //    reserved routing keys. Router reads this for both GET filters and writes.
    const params = {}
    Object.keys(q).forEach(k => { params[k] = q[k] })
    Object.keys(body).forEach(k => { params[k] = body[k] })
    RESERVED_KEYS.forEach(k => { delete params[k] })

    // 4. Route
    const result = Router.dispatch(route, httpMethod, params, params, user)
    return respond(200, true, result)

  } catch (err) {
    Logger.log('PMES Error: ' + err.message + '\n' + err.stack)
    const code = err.statusCode || 500
    const clientMsg = safeClientErrorMessage(code)
    return respond(code, false, null, clientMsg)
  }
}

function safeClientErrorMessage(code) {
  if (code === 400) return 'The request could not be processed. Please check your input and try again.'
  if (code === 401) return 'Your session expired. Please sign in again.'
  if (code === 403) return 'You do not have permission to perform this action.'
  if (code === 404) return 'The requested record could not be found.'
  if (code === 409) return 'This record was already updated. Please refresh and try again.'
  if (code === 429) return 'Too many requests. Please wait a moment and try again.'
  return 'An unexpected error occurred. Please try again later.'
}

// ── Helpers ──
function parseBody(e) {
  try {
    // JSON POST body (current transport)
    if (e && e.postData && e.postData.contents) return JSON.parse(e.postData.contents)
    // Fall back to query parameters (legacy GET-based calls)
    const body = {}
    for (const key in (e && e.parameter || {})) {
      if (RESERVED_KEYS.indexOf(key) === -1) body[key] = e.parameter[key]
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
