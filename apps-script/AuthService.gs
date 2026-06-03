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
  REVISIONS:       'Revisions',
  IPCRF_FORMS:     'IPCRForms',
  FORM_ENTRIES:    'FormEntries',
  MASTER_KRAS:     'MasterKRALibrary'
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
    const user = AuthService.verifyToken(e)
    if (!user) return respond(401, false, null, 'Unauthorized – invalid or missing token')

    const body       = parseBody(e)
    const httpMethod = (body._method || '').toUpperCase() || method

    const route  = (e.parameter?.route || '').replace(/^\/|\/$/g, '')
    const result = Router.dispatch(route, httpMethod, e.parameter, body, user)

    return respond(200, true, result)

  } catch (err) {
    Logger.log('PMES Error: ' + err.message + '\n' + err.stack)
    const code = err.statusCode || 500
    return respond(code, false, null, err.message)
  }
}

// ── parseBody: reads JSON from POST body; falls back to empty object ──
function parseBody(e) {
  try {
    const raw = e.postData?.contents
    if (raw) return JSON.parse(raw)
  } catch (err) {
    Logger.log('parseBody error: ' + err.message)
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