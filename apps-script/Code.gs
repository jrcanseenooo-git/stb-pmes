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
  IPAT_RECORDS:     'IPATRecords',
  IPAT_CBC_RATINGS: 'IPATCBCRatings',
  IPAT_JF_RATINGS:  'IPATJFRatings',
  IPAT_EDAP:        'IPATEdap'
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
    // 1. Authenticate every request
    const user = AuthService.verifyToken(e)
    if (!user) return respond(401, false, null, 'Unauthorized – invalid or missing token')

    // 2. Read _method from query params FIRST (before parseBody strips it)
    //    then parse the rest of the body
    const httpMethod = (e.parameter?._method || method).toUpperCase()
    const body       = parseBody(e)

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
