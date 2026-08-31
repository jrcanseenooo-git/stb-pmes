import { auth } from '@/firebase'

function normalizeApiBaseUrl(value, fallback) {
  const raw = String(value || '').trim()
  if (!raw) return fallback
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw
  return `/${raw.replace(/^\/+/, '')}`
}

const BASE_URL = import.meta.env.DEV
  ? normalizeApiBaseUrl(import.meta.env.VITE_API_PROXY_URL, '/gas')
  : normalizeApiBaseUrl(import.meta.env.VITE_API_PROXY_URL, '/api/gas')

// Apps Script is spreadsheet-backed and slows sharply when a screen opens
// several independent reads at once. Two concurrent calls keeps the UI
// responsive without turning a page load into a request burst that times out.
const MAX_IN_FLIGHT = Math.max(1, Math.min(2, Number(import.meta.env.VITE_API_MAX_IN_FLIGHT || 2)))
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 45000)
const LONG_WRITE_TIMEOUT_MS = Number(import.meta.env.VITE_API_LONG_WRITE_TIMEOUT_MS || 90000)
const requestQueue = []
const inFlightReads = new Map()
const responseCache = new Map()
let activeRequests = 0

const DEFAULT_READ_CACHE_TTL_MS = Number(import.meta.env.VITE_API_READ_CACHE_TTL_MS || 20000)
const READ_CACHE_TTL_BY_ROUTE = [
  [/^auth\/backend-info$/, 60000],
  [/^auth\/register-options$/, 60000],
  [/^office-registry\/.*org-options$/, 60000],
  [/^office-registry\/picker$/, 60000],
  [/^assessment-categories/, 60000],
  [/^assessment-content/, 60000],
  [/^assessment-rules/, 60000],
  [/^rater-matrix/, 30000],
  [/^ipat\/themes$/, 60000],
  [/^ipat\/jf-indicators$/, 60000]
]

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function readKey(route, data) {
  // This cache lives in the browser process. Include the Firebase identity so
  // a logout/login in the same tab can never reuse the previous user's data.
  const uid = auth.currentUser?.uid || 'anonymous'
  return `${uid}:${route}:${stableStringify(data || {})}`
}

function cloneApiData(value) {
  if (value === null || value === undefined) return value
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value) } catch (_) { /* fall through */ }
  }
  return JSON.parse(JSON.stringify(value))
}

function readCacheTtl(route) {
  const matched = READ_CACHE_TTL_BY_ROUTE.find(([pattern]) => pattern.test(route))
  return matched ? matched[1] : DEFAULT_READ_CACHE_TTL_MS
}

function requestTimeoutMs(route) {
  // First-time Generate/Backfill may create records and assignments for an
  // entire office. The Vercel proxy permits that write for up to 60 seconds;
  // the browser must wait a little longer or it aborts a healthy request and
  // reports a misleading raw AbortController error.
  return /^ipat-assignments\/generate$/.test(String(route || ''))
    ? LONG_WRITE_TIMEOUT_MS
    : API_TIMEOUT_MS
}

function getCachedRead(key) {
  const entry = responseCache.get(key)
  if (!entry) return null
  if (Date.now() >= entry.expiresAt) {
    responseCache.delete(key)
    return null
  }
  return cloneApiData(entry.data)
}

function setCachedRead(route, key, data) {
  const ttl = readCacheTtl(route)
  if (ttl <= 0) return
  responseCache.set(key, {
    data: cloneApiData(data),
    expiresAt: Date.now() + ttl
  })
}

function clearReadCache() {
  responseCache.clear()
}

function drainQueue() {
  while (activeRequests < MAX_IN_FLIGHT && requestQueue.length) {
    const item = requestQueue.shift()
    activeRequests += 1
    item.run()
      .then(item.resolve, item.reject)
      .finally(() => {
        activeRequests -= 1
        drainQueue()
      })
  }
}

function enqueueRequest(run, { priority = false } = {}) {
  return new Promise((resolve, reject) => {
    const request = { run, resolve, reject }
    // A deliberate save/approval must not wait behind an older burst of
    // dashboard reads. Active requests still complete normally; this only
    // decides which queued request gets the next available browser slot.
    if (priority) requestQueue.unshift(request)
    else requestQueue.push(request)
    drainQueue()
  })
}

// ── Core transport ─────────────────────────────

// Marker for "this session is no longer valid" - distinct from a transient
// transport hiccup. Callers surface it as a sign-in prompt rather than a generic
// failure, and it is never retried.
const AUTH_EXPIRED = Symbol('authExpired')
const AUTH_REJECTED = Symbol('authRejected')

function authExpiredError() {
  const e = new Error('Your session has expired. Please sign in again.')
  e[AUTH_EXPIRED] = true
  // Announce it once so the app can route to sign-in. A window event rather than
  // a store import keeps this module free of a circular dependency on the auth
  // store, which imports this file.
  try { window.dispatchEvent(new CustomEvent('pmes:auth-expired')) } catch (_) { /* SSR / no DOM */ }
  return e
}

function authRejectedError() {
  const e = new Error('The current session token was rejected.')
  e[AUTH_REJECTED] = true
  return e
}

async function getToken({ forceRefresh = false } = {}) {
  const user = auth.currentUser
  if (!user) throw authExpiredError()
  try {
    return await user.getIdToken(forceRefresh)
  } catch (e) {
    // A 400 from identitytoolkit here means the refresh token was rejected -
    // the session is genuinely dead. Previously this was swallowed and null was
    // returned, so every subsequent call went out with an empty token and came
    // back 401. One expired session became a wall of "Unauthorized" errors with
    // nothing telling the user to sign in again.
    console.warn('[PMES] Token refresh failed:', e?.code || e?.message)
    throw authExpiredError()
  }
}

// Marker for "the response was not JSON at all" - an Apps Script HTML error page
// or a 404 from the googleusercontent echo URL. These are transient and safe to
// retry for reads, unlike a well-formed {success:false} rejection.
const TRANSIENT = Symbol('transient')

function transientError(message) {
  const e = new Error(message)
  e[TRANSIENT] = true
  return e
}

async function parseApiResponse(res) {
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    // Google returned an HTML error page (transient outage, echo-URL 404, etc.)
    throw transientError('The server returned an unexpected response. Please try again.')
  }
  if (!data.success) {
    // Every response is HTTP 200 by Apps Script necessity, so the real code
    // travels in the body. The backend already scrubs >=500 messages to a
    // generic string and writes <500 messages for end users, so data.message is
    // both safe and more specific than anything we can infer here.
    const status = Number(data.status) || res.status || 0
    const message = data.message || userSafeApiMessage(status)
    if (import.meta.env.DEV && status !== 401) console.warn('[PMES] API rejected:', status, message)

    if (status === 401) throw authRejectedError()
    const err = new Error(message)
    err.status = status
    throw err
  }
  return data.data
}

function userSafeApiMessage(status) {
  if (status === 401) return 'Your session expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 404) return 'The requested record could not be found.'
  if (status === 409) return 'This record was already updated. Please refresh and try again.'
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status >= 500) return 'Something went wrong on the server. Please try again.'
  return 'Could not complete the request. Please check your input and try again.'
}

// Single transport for every call: POST with a JSON body carrying route,
// method, token and payload. The browser talks to a same-origin proxy so Apps
// Script CORS never blocks local or production usage.
async function gasSend(method, route, data = {}) {
  const send = async ({ forceRefresh = false } = {}) => {
    const token = await getToken({ forceRefresh })
    const res = await enqueueRequest(async () => {
      // Start the timer only when this request gets a browser slot. Starting it
      // before queueing meant a write could expire before fetch() even began.
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), requestTimeoutMs(route))
      try {
        return await fetch(BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
          body: JSON.stringify({ route, _method: method, token, ...(data || {}) })
        })
      } catch (error) {
        if (controller.signal.aborted) {
          const timeout = new Error('This operation is taking longer than expected. Please wait before trying again.')
          timeout.status = 504
          throw timeout
        }
        throw error
      } finally {
        clearTimeout(timer)
      }
    }, { priority: method !== 'GET' })
    return parseApiResponse(res)
  }

  if (method === 'GET') {
    const key = readKey(route, data)
    const cached = getCachedRead(key)
    if (cached) return cached
    if (inFlightReads.has(key)) return inFlightReads.get(key)
    // NOTE THE TRAILING () - this must be invoked immediately.
    // Without it, `promise` held the async function itself rather than the
    // promise it returns. The function was then cached and returned, and
    // `await`ing a plain function yields the function, so EVERY GET resolved to
    // a function instead of data: r.items was undefined and every list in the
    // app rendered empty with no error.
    const promise = (async () => {
      try {
        const result = await send()
        setCachedRead(route, key, result)
        return cloneApiData(result)
      } catch (first) {
        if (first?.[AUTH_REJECTED] && auth.currentUser) {
          try {
            const result = await send({ forceRefresh: true })
            setCachedRead(route, key, result)
            return cloneApiData(result)
          } catch (second) {
            if (second?.[AUTH_REJECTED]) throw authExpiredError()
            throw second
          }
        }
        if (first?.[AUTH_REJECTED]) throw authExpiredError()
        throw first
      } finally {
        inFlightReads.delete(key)
      }
    })()
    inFlightReads.set(key, promise)
    return promise
  }

  try {
    const result = await send()
    clearReadCache()
    return result
  } catch (first) {
    // A cached ID token can expire between page load and request. Force one
    // refresh and try again before declaring the session dead - this is safe for
    // any verb because the first attempt was rejected at the auth gate, before
    // the router ran, so nothing was applied.
    if (first?.[AUTH_REJECTED] && auth.currentUser) {
      try {
        const result = await send({ forceRefresh: true })
        clearReadCache()
        return result
      } catch (second) {
        if (second?.[AUTH_REJECTED]) throw authExpiredError()
        throw second
      }
    }
    if (first?.[AUTH_REJECTED]) throw authExpiredError()
    throw first
  }
}

async function gasSendWithRetry(method, route, data = {}) {
  try {
    return await gasSend(method, route, data)
  } catch (err) {
    // Retry ONLY a transport-level hiccup, and ONLY for reads. A GET is
    // idempotent so a second attempt cannot double-write; POST/PUT/PATCH/DELETE
    // are never retried because the first attempt may already have applied.
    // An API rejection and an expired session are real answers, not hiccups,
    // and are rethrown untouched.
    if (err?.[TRANSIENT] && method === 'GET') {
      await new Promise(r => setTimeout(r, 400))
      return gasSend(method, route, data)
    }

    // `whoami` determines whether a signed-in person is allowed to enter the
    // app. Apps Script can briefly return 429/5xx while its spreadsheet cache
    // is warming; that is not an access decision. These are idempotent reads,
    // so retry twice with short backoff before the UI reports a profile-load
    // problem. Other list screens keep their normal, lower retry cost.
    //
    // The assessment questions belong in the same class. They are fetched once
    // when a rater opens a rating task, and a single 429/5xx left the form with
    // no questions at all - reported to the rater as "no active assessment
    // questions are configured", sending them to an administrator over what was
    // really a momentary server hiccup. Both are idempotent GETs.
    const isProfileBootstrap = method === 'GET' && (
      /^auth\/(whoami|me)$/.test(route) ||
      /^assessment-(content|categories)$/.test(route)
    )
    if (isProfileBootstrap && [429, 500, 502, 503, 504].includes(Number(err?.status))) {
      for (const delay of [500, 1200]) {
        await new Promise(resolve => setTimeout(resolve, delay))
        try {
          return await gasSend(method, route, data)
        } catch (retryError) {
          if (![429, 500, 502, 503, 504].includes(Number(retryError?.status))) throw retryError
          err = retryError
        }
      }
    }

    // A rating write that receives 429 from the server did not enter its
    // locked critical section, so it has made no sheet changes. Retrying this
    // one explicit condition is safe and avoids making staff re-enter ratings
    // during a short submission burst. Never retry timeouts or other write
    // failures: those are ambiguous and could otherwise duplicate scores.
    const isRatingSubmission = /^ipat-assignments\/[^/]+\/submit-ratings$/.test(route)
    const isRatingDraftSave = /^ipat\/[^/]+\/(cbc|jf)$/.test(route)
    const isUserApproval = /^users\/[^/]+\/activate$/.test(route)
    if ((method === 'POST' && (isRatingSubmission || isRatingDraftSave)) ||
        (method === 'PATCH' && isUserApproval)) {
      if (err?.status !== 429) throw err

      // Apps Script offers only a SCRIPT-WIDE lock, so every rating submission
      // in the whole cluster serialises through one gate. A single retry was
      // enough for an occasional collision but not for a rating period where a
      // whole office submits within the same few minutes: the second attempt
      // lands in the same queue and the rater is told to try again, having
      // already answered every question.
      //
      // Back off further each time, and jitter each wait. Without jitter every
      // client rejected by the same busy moment returns together and collides
      // again - the retry itself becomes the pile-up.
      //
      // Safe to repeat: a 429 means tryLock() failed, so the request never
      // entered the critical section and wrote nothing. Other write failures
      // stay non-retryable because they are ambiguous about what was applied.
      const backoffMs = [1200, 3000, 6000, 10000]
      let lastError = err
      for (const base of backoffMs) {
        const jittered = base + Math.floor(Math.random() * base * 0.4)
        await new Promise(r => setTimeout(r, jittered))
        try {
          return await gasSend(method, route, data)
        } catch (retryError) {
          if (retryError?.status !== 429) throw retryError
          lastError = retryError
        }
      }
      throw lastError
    }

    throw err
  }
}

const gasGet       = (route, params = {}) => gasSendWithRetry('GET', route, params)
const gasWrite     = (method, route, body = {}) => gasSendWithRetry(method, route, body)
const gasWriteBody = (method, route, body = {}) => gasSendWithRetry(method, route, body)

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = (e) => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Auth ───────────────────────────────────────

export const authApi = {
  me:        ()                        => gasGet('auth/me'),
  whoami:    ()                        => gasGet('auth/whoami'),
  backendInfo: ()                      => gasGet('auth/backend-info'),
  registerOptions: ()                  => gasGet('auth/register-options'),
  register:  (data)                    => gasWriteBody('POST', 'auth/register', data)
  // logAction removed with the auth/log route it called. It was never invoked,
  // and a client-writable audit endpoint let any signed-in user append entries
  // of their own wording. Audit rows are written server-side by the service
  // performing the action.
}

// ── Dashboard ──────────────────────────────────

// Innovation Cluster Personnel Assessment Portal - server-aggregated summaries.
// These return counters, never rating rows.
export const portalApi = {
  summary:   (p = {}) => gasGet('portal/summary', p),
  myTasks:   (p = {}) => gasGet('portal/my-tasks', p),
  myResults: (p = {}) => gasGet('portal/my-results', p),
  library:   (p = {}) => gasGet('portal/library', p),
  officeSummary: (p = {}) => gasGet('portal/office-summary', p)
}

// testDataApi and the window.__pmesTestData console hook were removed on
// 2026-08-29 along with the backend route. PMES holds real personnel
// performance records; nothing in it should be able to manufacture fabricated
// ones. The hook shipped in the production bundle, so seeding every office
// database was a one-line console call for anyone the server gate accepted -
// and that gate accepted view_cluster_monitoring, the Undersecretary's only
// permission. `test-data/*` now answers 410.

export const dashboardApi = {
  all:             (p = {}) => gasGet('dashboard/all',       p),
  summary:         (p = {}) => gasGet('dashboard/summary',   p),
  divisions:       (p = {}) => gasGet('dashboard/divisions', p),
  statusBreakdown: (p = {}) => gasGet('dashboard/status',    p),
  monthlyActivity: (p = {}) => gasGet('dashboard/activity',  p)
}

// ── Users ──────────────────────────────────────

export const usersApi = {
  list:          (p = {})   => gasGet('users',                              p),
  get:           (id)       => gasGet(`users/${id}`),
  create:        (data)     => gasWrite('POST',  'users',                    data),
  update:        (id, data) => gasWrite('PUT',   `users/${id}`,              data),
  remove:        (id)       => gasWrite('DELETE', `users/${id}`),
  activate:      (id)       => gasWrite('PATCH', `users/${id}/activate`),
  deactivate:    (id)       => gasWrite('PATCH', `users/${id}/deactivate`),
  decline:       (id)       => gasWrite('PATCH', `users/${id}/decline`),
  resetPassword: (id, data) => gasWrite('PATCH', `users/${id}/reset-password`, data)
}

export const focalAssignmentsApi = {
  list: (p = {}) => gasGet('focal-assignments', p),
  save: (data)   => gasWrite('POST', 'focal-assignments', {
    ...data,
    bureauFocals: JSON.stringify(data.bureauFocals || {}),
    divisionFocals: JSON.stringify(data.divisionFocals || [])
  })
}

export const maintenanceApi = {
  previewFreshSchema: () => gasGet('maintenance/fresh-schema'),
  rebuildFreshSchema: (confirmation) => gasWrite('POST', 'maintenance/fresh-schema', { confirmation })
}

export const officeRegistryApi = {
  list:     (p = {})   => gasGet('office-registry', p),
  picker:   (p = {})   => gasGet('office-registry/picker', p),
  get:      (id)       => gasGet(`office-registry/${id}`),
  spec:     ()         => gasGet('office-registry/spec'),
  monitoring:(p = {})  => gasGet('office-registry/monitoring', p),
  provision:(data)     => gasWrite('POST', 'office-registry', data),
  update:   (id, data) => gasWrite('PUT', `office-registry/${id}`, data),
  orgOptions:(id)      => gasGet(`office-registry/${id}/org-options`),
  saveOrgOptions:(id, data) => gasWrite('PUT', `office-registry/${id}/org-options`, data),
  validate: (id)       => gasWrite('POST', `office-registry/${id}/validate`),
  repair:   (id)       => gasWrite('POST', `office-registry/${id}/repair`),
  activate: (id)       => gasWrite('POST', `office-registry/${id}/activate`)
}

// ── KRAs & Success Indicators ──────────────────

export const systemSettingsApi = {
  get:    (p = {}) => gasGet('system-settings', p),
  update: (data) => gasWrite('PUT', 'system-settings', data)
}

// ── KRA Library (MasterKRALibrary sheet) ───────
// Named alias: import { kraLibrary as kraLibraryApi } from '@/services/api'

export const kraLibraryApi = {
  list:   (p = {})   => gasGet('kra-library',        p),
  get:    (id)       => gasGet(`kra-library/${id}`),
  create: (data)     => gasWrite('POST',   'kra-library',       data),
  update: (id, data) => gasWrite('PUT',    `kra-library/${id}`, data),
  delete: (id)       => gasWrite('DELETE', `kra-library/${id}`)
}

export const assessmentCategoryApi = {
  list:   (p = {})     => gasGet('assessment-categories', p),
  get:    (id)         => gasGet(`assessment-categories/${id}`),
  create: (data)       => gasWrite('POST',   'assessment-categories', data),
  update: (id, data)   => gasWrite('PUT',    `assessment-categories/${id}`, data),
  remove: (id)         => gasWrite('DELETE', `assessment-categories/${id}`),
  seed:   (data = {})  => gasWrite('POST',   'assessment-categories/seed', data)
}

export const assessmentContentApi = {
  list:             (p = {})        => gasGet('assessment-content', p),
  get:              (id)            => gasGet(`assessment-content/${id}`),
  create:           (data)          => gasWrite('POST',  'assessment-content', data),
  update:           (id, data)      => gasWrite('PUT',   `assessment-content/${id}`, data),
  publish:          (id, data = {}) => gasWrite('PATCH', `assessment-content/${id}/publish`, data),
  archive:          (id)            => gasWrite('PATCH', `assessment-content/${id}/archive`),
  duplicateVersion: (id, data = {}) => gasWrite('POST',  `assessment-content/${id}/duplicate-version`, data),
  reorder:          (payload = [])  => gasWrite('POST',  'assessment-content/reorder', {
    rows: JSON.stringify(payload)
  }),
  seed:             (data = {})     => gasWrite('POST',  'assessment-content/seed', data),
  promoteSeedTemplate: (data = {})  => gasWrite('POST',  'assessment-content/seed-template', data)
}

export const assessmentRulesApi = {
  list:         (p = {})      => gasGet('assessment-rules', p),
  update:       (rules = [])  => gasWrite('PUT', 'assessment-rules', { rules }),
  seedDefaults: ()            => gasWrite('POST', 'assessment-rules/seed-defaults')
}

// ── Rater Matrix - who rates whom, per office, per role ──
export const raterMatrixApi = {
  list:         (p = {})      => gasGet('rater-matrix', p),
  coverage:     (p = {})      => gasGet('rater-matrix/coverage', p),
  save:         (items = [])  => gasWrite('PUT', 'rater-matrix', { items }),
  seedDefaults: ()            => gasWrite('POST', 'rater-matrix/seed-defaults')
}

export const diagnosticsApi = {
  officeBoundary: (p = {}) => gasGet('diagnostics/office-boundary', p)
}

// ── Accomplishments ────────────────────────────

export const accomplishmentsApi = {
  list:            (p = {})              => gasGet('accomplishments',                          p),
  get:             (id)                  => gasGet(`accomplishments/${id}`),
  create:          (data)                => gasWriteBody('POST', 'accomplishments',             data),
  update:          (id, data)            => gasWriteBody('PUT',  `accomplishments/${id}`,       data),
  approve:         (id, remarks)         => gasWrite('PATCH', `accomplishments/${id}/approve`,  { remarks }),
  requestRevision: (id, remarks)         => gasWrite('PATCH', `accomplishments/${id}/revision`, { remarks }),
  updateStatus:    (id, status, remarks) => gasWrite('PATCH', `accomplishments/${id}/status`,   { status, remarks }),
  history:         (id)                  => gasGet(`accomplishments/${id}/history`)
}

// ── IPAT ────────────────────────────────────────
// Innovations Performance Assessment Tool

export const ipatApi = {
  // Records
  list:         (p = {})       => gasGet('ipat', p),
  get:          (id)            => gasGet(`ipat/${id}`),
  create:       (data)          => gasWrite('POST',  'ipat', data),
  updateStatus: (id, status)    => gasWrite('PATCH', `ipat/${id}/status`, { status }),

  // Functional Performance Output - pulled from the ratee's own IPCRF/CCEF
  syncFPO:      (id)            => gasWrite('POST',  `ipat/${id}/sync-fpo`),
  setFPO:       (id, fpoScore)  => gasWrite('POST',  `ipat/${id}/set-fpo`, { fpoScore }),

  // Core Behavioral Competencies
  saveCBCRatings: (id, ratings) => gasWrite('POST',  `ipat/${id}/cbc`,         { ratings: JSON.stringify(ratings) }),
  computeCBC:     (id)          => gasWrite('POST',  `ipat/${id}/cbc/compute`),
  setCbcDeduction:(id, data)     => gasWrite('POST',  `ipat/${id}/cbc-deduction`, data),

  // Job Fitness
  saveJFRatings:  (id, ratings) => gasWrite('POST',  `ipat/${id}/jf`,          { ratings: JSON.stringify(ratings) }),
  computeJF:      (id)          => gasWrite('POST',  `ipat/${id}/jf/compute`),

  // Overall
  computeOverall: (id)          => gasWrite('POST',  `ipat/${id}/compute`),

  // Meta
  getThemes:        ()          => gasGet('ipat/themes'),
  getJFIndicators:  ()          => gasGet('ipat/jf-indicators')
}

// ── IPAT Rater Assignments ─────────────────────────────────────────────────

export const ipatAssignmentsApi = {
  list:           (p = {})          => gasGet('ipat-assignments', p),
  generate:       (data)            => gasWrite('POST',   'ipat-assignments/generate', data),
  getMyRatees:    (p = {})          => gasGet('ipat-assignments/my-ratees',  p),
  getMyResults:   (p = {})          => gasGet('ipat-assignments/my-results', p),
  getRateeAssign: (rateeId, p = {}) => gasGet(`ipat-assignments/${rateeId}/ratee-assignments`, p),
  submitRatings:  (id, data)        => gasWrite('POST',   `ipat-assignments/${id}/submit-ratings`, {
    cbcRatings: JSON.stringify(data?.cbcRatings || []),
    jfRatings:  JSON.stringify(data?.jfRatings  || [])
  }),
  markCompleted:  (id)              => gasWrite('POST',   `ipat-assignments/${id}/complete`)
}

// ── Reports ────────────────────────────────────

export const reportsApi = {
  list:     ()     => gasGet('reports'),
  options:  ()     => gasGet('reports/options'),
  preview:  (data) => gasWrite('POST', 'reports/preview', data),
  generate: (data) => gasWrite('POST', 'reports/generate', data),
  download: (id)   => gasGet(`reports/${id}/download`)
}

// ── Notifications ──────────────────────────────

export const notificationsApi = {
  list:        ()   => gasGet('notifications'),
  markRead:    (id) => gasWrite('PATCH', `notifications/${id}/read`),
  markAllRead: ()   => gasWrite('PATCH', 'notifications/read-all')
}

// ── Audit ──────────────────────────────────────

export const auditApi = {
  list:   (p = {}) => gasGet('audit',        p),
  export: (p = {}) => gasGet('audit/export', p)
}

// ── IPCRF / CCEF Forms ─────────────────────────
// Named alias: import { ipcrf as ipcrfApi } from '@/services/api'

export const ipcrfApi = {
  list:         (p = {})               => gasGet('ipcrf',                             p),
  get:          (id)                   => gasGet(`ipcrf/${id}`),
  create:       (data)                 => gasWrite('POST',  'ipcrf',                   data),
  update:       (id, data)             => gasWrite('PUT',   `ipcrf/${id}`,             data),
  deleteForm:   (id)                   => gasWrite('DELETE', `ipcrf/${id}`),
  submit:       (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/submit`,      data),
  reviewQueue:  (p = {})               => gasGet('ipcrf/review-queue',                 p),
  route:        (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/route`,       data),
  approve:      (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/approve`,     data),
  return:       (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/return`,      data),
  rate:         (id, data)             => gasWrite('PATCH', `ipcrf/${id}/rate`,        data),
  finalize:     (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/finalize`,    data),
  computeScore: (id)                   => gasWrite('POST',  `ipcrf/${id}/compute-score`),
  assignableUsers: (formId, search = '') => gasGet(`ipcrf/${formId}/assignable-users`, { search }),
  reviewComments: (formId, reviewType) => gasGet(`ipcrf/${formId}/review-comments`, { reviewType }),
  saveReviewComments: (formId, data)   => gasWriteBody('POST', `ipcrf/${formId}/review-comments`, {
    ...data,
    comments: JSON.stringify(data.comments || [])
  }),
  listEntries:  (formId)               => gasGet(`ipcrf/${formId}/entries`),
  addEntry:     (formId, data)         => gasWrite('POST',   `ipcrf/${formId}/entries`,            data),
  updateEntry:  (formId, entryId, data)=> gasWriteBody('PUT', `ipcrf/${formId}/entries/${entryId}`, data),
  deleteEntry:  (formId, entryId)      => gasWrite('DELETE', `ipcrf/${formId}/entries/${entryId}`),
  listJrbRatings: (formId)             => gasGet(`ipcrf/${formId}/jrb`),
  saveJrbRatings: (formId, data)       => gasWrite('POST',  `ipcrf/${formId}/jrb`,    data),

  // ── Aliases for views that use alternate method names ──
  listForms:    (p = {})               => gasGet('ipcrf',                             p),
  createForm:   (data)                 => gasWrite('POST',  'ipcrf',                   data),
  getForm:      (id)                   => gasGet(`ipcrf/${id}`),
  updateForm:   (id, data)             => gasWrite('PUT',   `ipcrf/${id}`,             data),
  submitForm:   (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/submit`,      data),
  routeForm:    (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/route`,       data),
  approveForm:  (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/approve`,     data),
  returnForm:   (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/return`,      data),
  rateForm:     (id, data)             => gasWrite('PATCH', `ipcrf/${id}/rate`,        data),
  submitRatings:(id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/submit-ratings`, data),
  finalizeForm: (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/finalize`,    data),
  periodStatus: (year)                  => gasGet(`ipcrf/period-status`, { year }),
}

// ── Document Generation (official IPCRF/CCEF Targets & Ratings forms) ──

export const docGenApi = {
  generateTargets: (formId)  => gasWrite('POST', `ipcrf/${formId}/generate-targets`),
  generateRatings: (formId, semester) => gasWrite('POST', `ipcrf/${formId}/generate-ratings`, { semester }),
  printPdf:        (fileId, tab)  => gasGet(`docgen/${fileId}/print`, { tab })
}

// ── Named aliases for views that import with aliases ──
// e.g. import { ipcrf as ipcrfApi, kraLibrary as kraLibraryApi } from '@/services/api'
export { ipcrfApi as ipcrf }
export { kraLibraryApi as kraLibrary }
export { assessmentContentApi as assessmentContent }
export { assessmentCategoryApi as assessmentCategory }
export { assessmentRulesApi as assessmentRules }

// ── Default export ─────────────────────────────

export default {
  authApi,
  dashboardApi,
  usersApi,
  focalAssignmentsApi,
  maintenanceApi,
  officeRegistryApi,
  kraLibraryApi,
  assessmentCategoryApi,
  assessmentContentApi,
  assessmentRulesApi,
  raterMatrixApi,
  accomplishmentsApi,
  reportsApi,
  notificationsApi,
  auditApi,
  ipcrfApi,
  docGenApi
}
