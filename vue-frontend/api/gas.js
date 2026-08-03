const SCRIPT_URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/

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

  const targetUrl = process.env.GAS_WEB_APP_URL || process.env.VITE_API_BASE_URL
  if (!targetUrl || !SCRIPT_URL_RE.test(targetUrl)) {
    console.error('[PMES API] Missing or invalid GAS_WEB_APP_URL.')
    return res.status(500).json({
      success: false,
      data: null,
      message: 'The service is not configured yet. Please contact the system administrator.'
    })
  }

  try {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
    let routeForLog = ''
    try {
      routeForLog = JSON.parse(body || '{}').route || ''
    } catch {
      routeForLog = ''
    }

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    })

    const text = await upstream.text()
    if (!upstream.ok) {
      console.error('[PMES API] Apps Script returned status', upstream.status, 'for route', routeForLog || '(unknown)')
    }
    res.status(upstream.ok ? 200 : upstream.status)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.send(text)
  } catch (error) {
    console.error('[PMES API] Apps Script proxy failed:', error)
    return res.status(502).json({
      success: false,
      data: null,
      message: 'The service is temporarily unavailable. Please try again.'
    })
  }
}
