const SCRIPT_URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/
const CANONICAL_GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzxh0LikZfR2unxODM3cQ1VVppwSHdRfHUrPSz9zGS_qSUR3FfNnWTc3jgD1OVoy2OR7A/exec'

function configuredScriptUrls() {
  const raw = (
    process.env.GAS_WEB_APP_URL ||
    process.env.VITE_API_BASE_URL ||
    CANONICAL_GAS_WEB_APP_URL
  )
  return raw
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
}

function hashString(value) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function orderedTargets(urls, bodyJson) {
  if (urls.length <= 1) return urls
  const route = String(bodyJson.route || '')
  if (route === 'auth/whoami' || route === 'auth/me' || route.startsWith('auth/')) {
    return urls
  }
  const stickyKey = String(bodyJson.token || bodyJson.route || '')
  const start = hashString(stickyKey) % urls.length
  return urls.slice(start).concat(urls.slice(0, start))
}

async function postAppsScript(url, body) {
  const headers = {
    'Content-Type': 'text/plain;charset=utf-8'
  }
  const first = await fetch(url, {
    method: 'POST',
    headers,
    body,
    redirect: 'manual'
  })

  if (first.status !== 301 && first.status !== 302 && first.status !== 303 && first.status !== 307 && first.status !== 308) {
    return first
  }

  const location = first.headers.get('location')
  if (!location) return first

  return fetch(location, { method: 'GET', redirect: 'manual' })
}

async function readRequestBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  if (chunks.length) return Buffer.concat(chunks).toString('utf8')

  try {
    if (typeof req.body === 'string') return req.body
    if (req.body && typeof req.body === 'object') return JSON.stringify(req.body)
  } catch {
    return ''
  }
  return ''
}

function getAllowedOrigins(req) {
  const configured = (
    process.env.PMES_ALLOWED_ORIGINS ||
    process.env.ALLOWED_ORIGINS ||
    ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  const ownOrigin = req.headers.host
    ? `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`
    : ''

  const vercelOrigin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : ''

  return new Set([...configured, ownOrigin, vercelOrigin].filter(Boolean))
}

function setCors(req, res) {
  const origin = req.headers.origin || ''
  const allowedOrigins = getAllowedOrigins(req)

  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (!origin) return true
  if (!allowedOrigins.has(origin)) return false

  res.setHeader('Access-Control-Allow-Origin', origin)
  return true
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')

  if (!setCors(req, res)) {
    return res.status(403).json({
      success: false,
      data: null,
      message: 'This request is not allowed. Please refresh and try again.'
    })
  }

  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      data: null,
      message: 'Unsupported request. Please refresh and try again.'
    })
  }

  const targetUrls = configuredScriptUrls()
  if (!targetUrls.length || targetUrls.some((url) => !SCRIPT_URL_RE.test(url))) {
    console.error('[PMES API] Missing or invalid GAS_WEB_APP_URL(S).')
    return res.status(500).json({
      success: false,
      data: null,
      message: 'The service is not configured yet. Please contact the system administrator.'
    })
  }

  try {
    const body = await readRequestBody(req)
    let bodyJson = {}
    let routeForLog = ''
    let bodyMethod = 'POST'
    try {
      bodyJson = JSON.parse(body || '{}')
      routeForLog = bodyJson.route || ''
      bodyMethod = String(bodyJson._method || 'POST').toUpperCase()
    } catch {
      routeForLog = ''
    }

    const targets = orderedTargets(targetUrls, bodyJson)
    const canRetry = bodyMethod === 'GET'

    // Apps Script answers /exec with a 302 to
    // script.googleusercontent.com/macros/echo?user_content_key=...
    // That echo URL is short-lived and single-use, and intermittently answers
    // 404 with a Google HTML page. 404 was missing from the retryable set, so a
    // failed fetch was forwarded verbatim - HTML body, status 404, labelled
    // Content-Type: application/json. The browser then reported
    // "POST /api/gas 404" and the client threw "unexpected response".
    // Apps Script serialises executions, so retries add queueing pressure as well
    // as latency. Two attempts recovers the common single-shot echo-URL 404
    // without letting a burst of concurrent calls pile up into timeouts - three
    // attempts with backoff pushed 12 concurrent requests past 25s.
    // 404 only ever shows up on the post-redirect echo-URL fetch, which means
    // the /exec call itself already ran on Apps Script's side - retrying that
    // for a write risks double-applying a mutation, so it's excluded there.
    // The other codes mean Apps Script refused or failed to execute the
    // request at all (rate limit, cold start, transient outage), which is
    // safe to retry regardless of whether the call is a read or a write.
    const RETRYABLE_GET   = [404, 429, 500, 502, 503, 504]
    const RETRYABLE_WRITE = [429, 500, 502, 503, 504]
    const ATTEMPTS_PER_TARGET = 2
    const looksJson = (t) => {
      const s = String(t || '').trim()
      return s.startsWith('{') || s.startsWith('[')
    }

    let lastStatus = 502
    let lastText = ''

    for (let i = 0; i < targets.length; i += 1) {
      for (let attempt = 1; attempt <= ATTEMPTS_PER_TARGET; attempt += 1) {
        const upstream = await postAppsScript(targets[i], body)

        const text = await upstream.text()
        lastStatus = upstream.status
        lastText = text

        // A 200 carrying HTML is the same failure wearing a different status,
        // so treat the body - not just the code - as the success signal.
        const ok = upstream.ok && looksJson(text)
        if (ok) {
          res.status(200)
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          return res.send(text)
        }

        const retryable = canRetry
          ? (RETRYABLE_GET.includes(upstream.status) || !looksJson(text))
          : RETRYABLE_WRITE.includes(upstream.status)
        if (!retryable) break

        console.warn(
          '[PMES API] Apps Script transient failure (status', upstream.status,
          ') attempt', attempt, 'route', routeForLog || '(unknown)'
        )
        if (attempt < ATTEMPTS_PER_TARGET) {
          await new Promise((r) => setTimeout(r, 120))
        }
      }
    }

    console.error('[PMES API] All Apps Script attempts failed for route', routeForLog || '(unknown)', 'last status', lastStatus)

    // Never forward an HTML error page as JSON - the client cannot parse it and
    // reports a confusing generic error. Return a real envelope instead.
    if (looksJson(lastText)) {
      res.status(200)
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      return res.send(lastText)
    }
    return res.status(200).json({
      success: false,
      status: 503,
      data: null,
      message: 'The service is busy right now. Please try again in a moment.'
    })
  } catch (error) {
    console.error('[PMES API] Apps Script proxy failed:', error)
    return res.status(502).json({
      success: false,
      data: null,
      message: 'The service is temporarily unavailable. Please try again.'
    })
  }
}
