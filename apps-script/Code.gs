// ── Sheet name constants ──
const SHEET = {
  USERS:              'Users',
  DIVISIONS:          'Divisions',
  SECTIONS:           'Sections',
  KRAS:               'KRAs',
  INDICATORS:         'SuccessIndicators',
  ACCOMPLISHMENTS:    'Accomplishments',
  EVALUATIONS:        'Evaluations',
  NOTIFICATIONS:      'Notifications',
  AUDIT:              'AuditLog',
  REPORTS:            'Reports',
  DEADLINES:          'Deadlines',
  REVISIONS:          'Revisions',
  FOCAL_ASSIGNMENTS:  'FocalAssignments',
  REVIEW_COMMENTS:    'ReviewComments',

  // ── Previously missing - now added ──
  IPCRF_FORMS:        'IPCRForms',
  FORM_ENTRIES:       'FormEntries',
  MASTER_KRA_LIBRARY: 'MasterKRALibrary',
  SYSTEM_SETTINGS:    'SystemSettings',

  // ── IPAT (Innovations Performance Assessment Tool) ──
  IPAT_RECORDS:      'IPATRecords',
  IPAT_CBC_RATINGS:  'IPATCBCRatings',
  IPAT_JF_RATINGS:   'IPATJFRatings',
  IPAT_ASSIGNMENTS:  'IPATRaterAssignments',

  ASSESSMENT_CONTENT:    'AssessmentContent',
  ASSESSMENT_CATEGORIES: 'AssessmentCategories',
  OFFICE_REGISTRY:       'OfficeRegistry',
  OFFICE_ORG_OPTIONS:    'OfficeOrgOptions'
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
//
// GAS does not expose client IP, so limiting is per user ID rather than per IP.
//
// Two independent budgets per minute, because reads and writes cost very
// different things. A dashboard legitimately fires a burst of reads on load, so
// a single flat budget either throttles normal browsing or is too loose to stop
// a write storm. Writes are the expensive, contended path - they take the
// script lock and mutate sheets - so they get a much tighter budget.
const RATE_LIMIT_READS_PER_MIN  = 120
const RATE_LIMIT_WRITES_PER_MIN = 30
const RATE_LIMIT_AUTH_ADJACENT_PER_MIN = 5

function isAuthAdjacentRoute_(route) {
  const r = String(route || '').toLowerCase()
  return r === 'auth/register' ||
    /^users\/[^/]+\/reset-password$/.test(r)
}

function checkRateLimit(userId, httpMethod, route) {
  const isWrite = String(httpMethod || 'GET').toUpperCase() !== 'GET'
  const authAdjacent = isAuthAdjacentRoute_(route)
  const bucket  = authAdjacent ? 'auth' : (isWrite ? 'w' : 'r')
  const limit   = authAdjacent
    ? RATE_LIMIT_AUTH_ADJACENT_PER_MIN
    : (isWrite ? RATE_LIMIT_WRITES_PER_MIN : RATE_LIMIT_READS_PER_MIN)

  let count = 0
  try {
    const cache = CacheService.getScriptCache()
    const key   = 'rl_' + bucket + '_' + userId + '_' + Math.floor(Date.now() / 60000)
    count = parseInt(cache.get(key) || '0', 10) + 1
    cache.put(key, String(count), 90) // TTL 90s so it survives the minute boundary
  } catch (e) {
    // CacheService failure is non-fatal - allow the request through
    Logger.log('Rate limiter cache error: ' + e.message)
    return
  }
  if (count > limit) {
    throw HttpError(
      authAdjacent
        ? 'Too many account requests in a short time. Please wait a moment and try again.'
        : isWrite
        ? 'Too many save requests in a short time. Please wait a moment and try again.'
        : 'Too many requests. Please wait a moment.',
      429
    )
  }
}

const RESERVED_KEYS = ['route', '_method', 'token']

// ── Request timing ──
//
// Logs route, method, status and duration so a slow screen can be traced to
// the call responsible without guessing. Deliberately records nothing else:
// no payload, no assessment content, no names, no token, no user id - the
// route and the clock answer "which call is slow" on their own, and anything
// more would put personal data into the execution log.
//
// Read these in the Apps Script editor under Executions.
function logTiming_(route, httpMethod, status, startedAt) {
  try {
    Logger.log('[PMES] ' + httpMethod + ' ' + (route || '(none)') +
      ' -> ' + status + ' in ' + (Date.now() - startedAt) + 'ms')
  } catch (err) {
    // Diagnostics must never be the reason a request fails.
  }
}

// ── Main dispatcher ──
function handleRequest(e, method) {
  const startedAt = Date.now()
  let routeForLog = ''
  try {
    // Parse the JSON body first - route, method, token and payload now travel
    // in the POST body so they never land in the URL (logs, history, Referer).
    // Query params are still honored as a fallback for backward compatibility.
    const body   = parseBody(e)
    const q      = e.parameter || {}

    const token      = q.token   || body.token   || ''
    const route      = String(q.route || body.route || '').replace(/^\/|\/$/g, '')
    const httpMethod = String(q._method || body._method || method).toUpperCase()
    routeForLog = route

    // 1. Authenticate every request (signature-verified inside verifyToken)
    const user = AuthService.verifyToken(token)
    if (!user) {
      logTiming_(route, httpMethod, 401, startedAt)
      return respond(401, false, null, 'Unauthorized - invalid or missing token')
    }

    // 2. Rate limit per authenticated user, with separate read/write budgets
    checkRateLimit(user.uid || user.email, httpMethod, route)

    // 3. Build the params/body handed to the router: query + body, minus the
    //    reserved routing keys. Router reads this for both GET filters and writes.
    const params = {}
    Object.keys(q).forEach(k => { params[k] = q[k] })
    Object.keys(body).forEach(k => { params[k] = body[k] })
    RESERVED_KEYS.forEach(k => { delete params[k] })
    // Internal routing flags live in the `__` namespace and are set by the
    // server alone (e.g. the __officeScopeApplied recursion guard in Router).
    // A client that supplied one could skip office scoping entirely and read
    // the central workbook instead of its own. Strip the whole namespace here,
    // at the trust boundary, so future internal flags are covered too.
    Object.keys(params).forEach(k => { if (k.indexOf('__') === 0) delete params[k] })

    // 4. Route
    const result = Router.dispatch(route, httpMethod, params, params, user)
    logTiming_(route, httpMethod, 200, startedAt)
    return respond(200, true, result)

  } catch (err) {
    Logger.log('PMES Error: ' + err.message + '\n' + err.stack)
    const code = err.statusCode || 500
    logTiming_(routeForLog, method, code, startedAt)
    // Every HttpError(message, code) thrown across the services is written
    // specifically for the end user - "An account for this email already
    // exists", "This active question has already been used", and dozens
    // more - so a code under 500 is always a deliberate, curated
    // business-logic message and should reach the user as written. This
    // used to discard err.message unconditionally and substitute a generic,
    // status-code-keyed string regardless of what was actually thrown,
    // which is how a duplicate-email 409 during user creation surfaced as
    // "This record was already updated" instead of the real reason. Only an
    // unexpected 500 falls back to the generic message, since an uncaught
    // exception's message can contain raw internals never meant for users.
    const clientMsg = (code < 500 && err.message) ? err.message : safeClientErrorMessage(code)
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
  // `status` used to be accepted and then thrown away. Every response leaves here
  // as HTTP 200 (an Apps Script constraint), so with no status in the body the
  // client had no way to tell a 401 from a 400 - it fell back to a generic
  // "check your input" message even when the real answer was "sign in again".
  // Carrying the code in the envelope lets the frontend react correctly.
  const payload = JSON.stringify({
    success: success,
    status: status || (success ? 200 : 400),
    data: data !== undefined ? data : null,
    message: message || null
  })
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON)
}

function HttpError(message, code) {
  const e    = new Error(message)
  e.statusCode = code || 400
  return e
}

// ── Serialise duplicate-sensitive writes ──
//
// Several mutations have a check-then-write shape: read the sheet, confirm
// nothing already matches, then append. Apps Script serves concurrent requests
// as separate executions, so two of them - a double-clicked Save, or a client
// that resent - can both pass the check before either appends, and both then
// write. The result is two accounts for one email, two offices for one code,
// or two rating rows for one indicator, and nobody sees an error.
//
// Keep the wait safely below Vercel's 30-second function limit.  The old
// three 15-second waits could leave the browser waiting for ~45 seconds, then
// turn a perfectly valid "busy" result into a proxy timeout.  A failed lock
// acquisition runs no user code, so the caller can safely retry a 429.
//
// Wrap only the check and its write. This is one global script lock, so
// whatever runs inside it blocks every other writer for the duration.
function withWriteLock(work, busyMessage) {
  const LOCK_WAIT_MS = 6000

  const lock = LockService.getScriptLock()
  if (!lock.tryLock(LOCK_WAIT_MS)) {
    throw HttpError(
      busyMessage || 'The system is busy saving other changes. Please try again in a moment.',
      429
    )
  }

  try {
    return work()
  } finally {
    lock.releaseLock()
  }
}
