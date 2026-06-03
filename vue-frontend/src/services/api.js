// src/services/api.js
// ─────────────────────────────────────────────────────────────────────────────
// DATA-SAVING FIX: gasWrite() now sends true HTTP POST with JSON body.
// Large IPCRF FormEntry fields (efficiencyGuide, qualityGuide, etc.) were
// silently truncated when sent as URL query params (old GET approach).
// Route + token stay in the query string; payload goes in the POST body.
// GAS Code.gs parseBody() reads e.postData.contents — no other change needed.
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from '@/firebase'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

async function getToken() {
  try {
    const user = auth.currentUser
    return user ? await user.getIdToken(false) : null
  } catch (e) {
    console.warn('[PMES] Token error:', e.message)
    return null
  }
}

// ── GET (reads) ──────────────────────────────────────────────────────────────
async function gasGet(route, params = {}) {
  const token = await getToken()
  const qs = new URLSearchParams({
    route,
    token: token || '',
    ...flattenParams(params)
  }).toString()

  const res  = await fetch(`${BASE_URL}?${qs}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.message || 'API error')
  return data.data
}

// ── WRITE (POST with JSON body) ──────────────────────────────────────────────
async function gasWrite(method, route, body = {}) {
  const token = await getToken()
  const qs    = new URLSearchParams({ route, token: token || '' }).toString()

  const res = await fetch(`${BASE_URL}?${qs}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ _method: method, ...body })
  })

  const data = await res.json()
  if (!data.success) throw new Error(data.message || 'API error')
  return data.data
}

// ── Flatten nested objects → dot-notation keys (for gasGet params only) ──────
function flattenParams(obj, prefix = '') {
  const result = {}
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flattenParams(v, key))
    } else {
      result[key] = v ?? ''
    }
  }
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
//  API SURFACE
// ─────────────────────────────────────────────────────────────────────────────

export const authApi = {
  me:        ()                        => gasGet('auth/me'),
  logAction: (action, module, details) => gasGet('auth/log', { action, module, details })
}

export const dashboardApi = {
  summary:         (p = {}) => gasGet('dashboard/summary',   p),
  divisions:       (p = {}) => gasGet('dashboard/divisions', p),
  statusBreakdown: (p = {}) => gasGet('dashboard/status',    p),
  monthlyActivity: (p = {}) => gasGet('dashboard/activity',  p)
}

export const usersApi = {
  list:       (p = {})   => gasGet('users',                    p),
  get:        (id)       => gasGet(`users/${id}`),
  create:     (data)     => gasWrite('POST',  'users',          data),
  update:     (id, data) => gasWrite('PUT',   `users/${id}`,    data),
  activate:   (id)       => gasWrite('PATCH', `users/${id}/activate`),
  deactivate: (id)       => gasWrite('PATCH', `users/${id}/deactivate`)
}

export const kraApi = {
  list:     (p = {})            => gasGet('kras',                              p),
  get:      (id)                => gasGet(`kras/${id}`),
  create:   (data)              => gasWrite('POST',   'kras',                  data),
  update:   (id, data)          => gasWrite('PUT',    `kras/${id}`,            data),
  delete:   (id)                => gasWrite('DELETE', `kras/${id}`),
  listSI:   (kraId)             => gasGet(`kras/${kraId}/indicators`),
  createSI: (kraId, data)       => gasWrite('POST',   `kras/${kraId}/indicators`,          data),
  updateSI: (kraId, siId, data) => gasWrite('PUT',    `kras/${kraId}/indicators/${siId}`,  data),
  deleteSI: (kraId, siId)       => gasWrite('DELETE', `kras/${kraId}/indicators/${siId}`)
}

export const accomplishmentsApi = {
  list:            (p = {})              => gasGet('accomplishments',                           p),
  get:             (id)                  => gasGet(`accomplishments/${id}`),
  create:          (data)                => gasWrite('POST',  'accomplishments',                data),
  update:          (id, data)            => gasWrite('PUT',   `accomplishments/${id}`,          data),
  approve:         (id, remarks)         => gasWrite('PATCH', `accomplishments/${id}/approve`,  { remarks }),
  requestRevision: (id, remarks)         => gasWrite('PATCH', `accomplishments/${id}/revision`, { remarks }),
  updateStatus:    (id, status, remarks) => gasWrite('PATCH', `accomplishments/${id}/status`,   { status, remarks }),
  history:         (id)                  => gasGet(`accomplishments/${id}/history`)
}

export const movApi = {
  list:    (p = {}) => gasGet('mov',        p),
  get:     (id)     => gasGet(`mov/${id}`),
  preview: (id)     => gasGet(`mov/${id}/preview`),
  delete:  (id)     => gasWrite('DELETE', `mov/${id}`),
  upload: async (file, meta = {}) => {
    const base64 = await fileToBase64(file)
    return gasWrite('POST', 'mov/upload', {
      fileName: file.name,
      mimeType: file.type,
      size:     file.size,
      base64,
      ...meta
    })
  }
}

export const evaluationApi = {
  list:    (p = {})         => gasGet('evaluations',                   p),
  get:     (id)             => gasGet(`evaluations/${id}`),
  compute: (userId, period) => gasWrite('POST', 'evaluations/compute', { userId, period }),
  update:  (id, data)       => gasWrite('PUT',  `evaluations/${id}`,   data),
  history: (userId)         => gasGet(`evaluations/history/${userId}`)
}

export const reportsApi = {
  list:     ()     => gasGet('reports'),
  generate: (data) => gasWrite('POST', 'reports/generate', data),
  download: (id)   => gasGet(`reports/${id}/download`)
}

export const notificationsApi = {
  list:        ()   => gasGet('notifications'),
  markRead:    (id) => gasWrite('PATCH', `notifications/${id}/read`),
  markAllRead: ()   => gasWrite('PATCH', 'notifications/read-all')
}

export const auditApi = {
  list:   (p = {}) => gasGet('audit',        p),
  export: (p = {}) => gasGet('audit/export', p)
}

// ── IPCRF Forms & Entries ────────────────────────────────────────────────────
export const ipcrf = {
  // Forms
  listForms:    (p = {})   => gasGet('ipcrf/forms',                          p),
  getForm:      (id)       => gasGet(`ipcrf/forms/${id}`),
  createForm:   (data)     => gasWrite('POST',   'ipcrf/forms',              data),
  updateForm:   (id, data) => gasWrite('PUT',    `ipcrf/forms/${id}`,        data),
  deleteForm:   (id)       => gasWrite('DELETE', `ipcrf/forms/${id}`),
  submitForm:   (id)       => gasWrite('PATCH',  `ipcrf/forms/${id}/submit`),
  approveForm:  (id, data) => gasWrite('PATCH',  `ipcrf/forms/${id}/approve`,   data),
  returnForm:   (id, data) => gasWrite('PATCH',  `ipcrf/forms/${id}/return`,    data),
  finalizeForm: (id, data) => gasWrite('PATCH',  `ipcrf/forms/${id}/finalize`,  data),
  computeScore: (id)       => gasWrite('PATCH',  `ipcrf/forms/${id}/compute`),
  // Entries
  listEntries:  (formId, p = {})        => gasGet(`ipcrf/forms/${formId}/entries`,                    p),
  addEntry:     (formId, data)          => gasWrite('POST',   `ipcrf/forms/${formId}/entries`,         data),
  updateEntry:  (formId, entId, data)   => gasWrite('PUT',    `ipcrf/forms/${formId}/entries/${entId}`, data),
  deleteEntry:  (formId, entId)         => gasWrite('DELETE', `ipcrf/forms/${formId}/entries/${entId}`),
  rateEntry:    (formId, entId, data)   => gasWrite('PATCH',  `ipcrf/forms/${formId}/entries/${entId}/rate`, data)
}

// ── KRA Master Library ───────────────────────────────────────────────────────
export const kraLibrary = {
  list:   (p = {}) => gasGet('kra-library',       p),
  get:    (id)     => gasGet(`kra-library/${id}`),
  create: (data)   => gasWrite('POST',   'kra-library',       data),
  update: (id, d)  => gasWrite('PUT',    `kra-library/${id}`, d),
  remove: (id)     => gasWrite('DELETE', `kra-library/${id}`)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default {
  authApi, dashboardApi, usersApi, kraApi,
  accomplishmentsApi, movApi, evaluationApi,
  reportsApi, notificationsApi, auditApi,
  ipcrf, kraLibrary
}