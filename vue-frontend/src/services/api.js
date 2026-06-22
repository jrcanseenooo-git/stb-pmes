import { auth } from '@/firebase'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

// ── Core transport ─────────────────────────────

async function getToken() {
  try {
    const user = auth.currentUser
    return user ? await user.getIdToken(false) : null
  } catch (e) {
    console.warn('[PMES] Token error:', e.message)
    return null
  }
}

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

async function gasWrite(method, route, body = {}) {
  const token = await getToken()
  const qs = new URLSearchParams({
    route,
    _method: method,
    token:   token || '',
    ...flattenParams(body)
  }).toString()
  const res  = await fetch(`${BASE_URL}?${qs}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.message || 'API error')
  return data.data
}

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
  logAction: (action, module, details) => gasGet('auth/log', { action, module, details })
}

// ── Dashboard ──────────────────────────────────

export const dashboardApi = {
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
  activate:      (id)       => gasWrite('PATCH', `users/${id}/activate`),
  deactivate:    (id)       => gasWrite('PATCH', `users/${id}/deactivate`),
  resetPassword: (id, data) => gasWrite('PATCH', `users/${id}/reset-password`, data)
}

// ── KRAs & Success Indicators ──────────────────

export const kraApi = {
  list:        (p = {})            => gasGet('kras',                                        p),
  get:         (id)                => gasGet(`kras/${id}`),
  create:      (data)              => gasWrite('POST',   'kras',                             data),
  update:      (id, data)          => gasWrite('PUT',    `kras/${id}`,                       data),
  delete:      (id)                => gasWrite('DELETE', `kras/${id}`),
  listSI:      (kraId)             => gasGet(`kras/${kraId}/indicators`),
  createSI:    (kraId, data)       => gasWrite('POST',   `kras/${kraId}/indicators`,         data),
  updateSI:    (kraId, siId, data) => gasWrite('PUT',    `kras/${kraId}/indicators/${siId}`, data),
  deleteSI:    (kraId, siId)       => gasWrite('DELETE', `kras/${kraId}/indicators/${siId}`)
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

// ── Accomplishments ────────────────────────────

export const accomplishmentsApi = {
  list:            (p = {})              => gasGet('accomplishments',                          p),
  get:             (id)                  => gasGet(`accomplishments/${id}`),
  create:          (data)                => gasWrite('POST',  'accomplishments',                data),
  update:          (id, data)            => gasWrite('PUT',   `accomplishments/${id}`,          data),
  approve:         (id, remarks)         => gasWrite('PATCH', `accomplishments/${id}/approve`,  { remarks }),
  requestRevision: (id, remarks)         => gasWrite('PATCH', `accomplishments/${id}/revision`, { remarks }),
  updateStatus:    (id, status, remarks) => gasWrite('PATCH', `accomplishments/${id}/status`,   { status, remarks }),
  history:         (id)                  => gasGet(`accomplishments/${id}/history`)
}

// ── MOV Files ──────────────────────────────────

export const movApi = {
  list:    (p = {}) => gasGet('mov',              p),
  get:     (id)     => gasGet(`mov/${id}`),
  preview: (id)     => gasGet(`mov/${id}/preview`),
  delete:  (id)     => gasWrite('DELETE', `mov/${id}`),
  upload: async (file, meta = {}) => {
    const base64 = await fileToBase64(file)
    return gasWrite('POST', 'mov/upload', {
      fileName: file.name, mimeType: file.type, size: file.size, base64, ...meta
    })
  }
}

// ── Evaluations ────────────────────────────────

export const evaluationApi = {
  list:    (p = {})         => gasGet('evaluations',                    p),
  get:     (id)             => gasGet(`evaluations/${id}`),
  compute: (userId, period) => gasWrite('POST', 'evaluations/compute', { userId, period }),
  update:  (id, data)       => gasWrite('PUT',  `evaluations/${id}`,    data),
  history: (userId)         => gasGet(`evaluations/history/${userId}`)
}


// ── IPAT ────────────────────────────────────────
// Innovations Performance Assessment Tool

export const ipatApi = {
  // Records
  list:         (p = {})       => gasGet('ipat', p),
  get:          (id)            => gasGet(`ipat/${id}`),
  create:       (data)          => gasWrite('POST',  'ipat', data),
  updateStatus: (id, status)    => gasWrite('PATCH', `ipat/${id}/status`, { status }),

  // Functional Performance Output — pulled from the ratee's own IPCRF/CCEF
  syncFPO:      (id)            => gasWrite('POST',  `ipat/${id}/sync-fpo`),

  // Core Behavioral Competencies
  saveCBCRatings: (id, ratings) => gasWrite('POST',  `ipat/${id}/cbc`,         { ratings: JSON.stringify(ratings) }),
  computeCBC:     (id)          => gasWrite('POST',  `ipat/${id}/cbc/compute`),

  // Job Fitness
  saveJFRatings:  (id, ratings) => gasWrite('POST',  `ipat/${id}/jf`,          { ratings: JSON.stringify(ratings) }),
  computeJF:      (id)          => gasWrite('POST',  `ipat/${id}/jf/compute`),

  // Overall
  computeOverall: (id)          => gasWrite('POST',  `ipat/${id}/compute`),

  // Meta
  getThemes:        ()          => gasGet('ipat/themes'),
  getJFIndicators:  ()          => gasGet('ipat/jf-indicators')
}

// ── Reports ────────────────────────────────────

export const reportsApi = {
  list:     ()     => gasGet('reports'),
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

// ── Deadlines ──────────────────────────────────

export const deadlinesApi = {
  list:   (p = {})   => gasGet('deadlines',          p),
  get:    (id)       => gasGet(`deadlines/${id}`),
  create: (data)     => gasWrite('POST',   'deadlines',       data),
  update: (id, data) => gasWrite('PUT',    `deadlines/${id}`, data),
  delete: (id)       => gasWrite('DELETE', `deadlines/${id}`)
}

// ── IPCRF / CCEF Forms ─────────────────────────
// Named alias: import { ipcrf as ipcrfApi } from '@/services/api'

export const ipcrfApi = {
  list:         (p = {})               => gasGet('ipcrf',                             p),
  get:          (id)                   => gasGet(`ipcrf/${id}`),
  create:       (data)                 => gasWrite('POST',  'ipcrf',                   data),
  update:       (id, data)             => gasWrite('PUT',   `ipcrf/${id}`,             data),
  submit:       (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/submit`,      data),
  approve:      (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/approve`,     data),
  return:       (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/return`,      data),
  rate:         (id, data)             => gasWrite('PATCH', `ipcrf/${id}/rate`,        data),
  finalize:     (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/finalize`,    data),
  computeScore: (id)                   => gasWrite('POST',  `ipcrf/${id}/compute-score`),
  listEntries:  (formId)               => gasGet(`ipcrf/${formId}/entries`),
  addEntry:     (formId, data)         => gasWrite('POST',   `ipcrf/${formId}/entries`,            data),
  updateEntry:  (formId, entryId, data)=> gasWrite('PUT',    `ipcrf/${formId}/entries/${entryId}`, data),
  deleteEntry:  (formId, entryId)      => gasWrite('DELETE', `ipcrf/${formId}/entries/${entryId}`),
  listJrbRatings: (formId)             => gasGet(`ipcrf/${formId}/jrb`),
  saveJrbRatings: (formId, data)       => gasWrite('POST',  `ipcrf/${formId}/jrb`,    data),

  // ── Aliases for views that use alternate method names ──
  listForms:    (p = {})               => gasGet('ipcrf',                             p),
  createForm:   (data)                 => gasWrite('POST',  'ipcrf',                   data),
  getForm:      (id)                   => gasGet(`ipcrf/${id}`),
  updateForm:   (id, data)             => gasWrite('PUT',   `ipcrf/${id}`,             data),
  submitForm:   (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/submit`,      data),
  approveForm:  (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/approve`,     data),
  returnForm:   (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/return`,      data),
  rateForm:     (id, data)             => gasWrite('PATCH', `ipcrf/${id}/rate`,        data),
  finalizeForm: (id, data = {})        => gasWrite('PATCH', `ipcrf/${id}/finalize`,    data),
}

// ── Document Generation (official IPCRF/CCEF Targets & Ratings forms) ──

export const docGenApi = {
  generateTargets: (formId)  => gasWrite('POST', `ipcrf/${formId}/generate-targets`),
  generateRatings: (formId)  => gasWrite('POST', `ipcrf/${formId}/generate-ratings`),
  printPdf:        (fileId)  => gasGet(`docgen/${fileId}/print`)
}

// ── Attendance ─────────────────────────────────

export const attendanceApi = {
  list:          (p = {})   => gasGet('attendance',                          p),
  get:           (id)       => gasGet(`attendance/${id}`),
  record:        (data)     => gasWrite('POST', 'attendance',                 data),
  update:        (id, data) => gasWrite('PUT',  `attendance/${id}`,           data),
  computeRating: (data)     => gasWrite('POST', 'attendance/compute-rating',  data),
  listRatings:   (p = {})   => gasGet('attendance/ratings',                  p)
}

// ── Peer Assignments ───────────────────────────

export const peerAssignmentsApi = {
  list:         (p = {})        => gasGet('peer-assignments',                          p),
  get:          (id)            => gasGet(`peer-assignments/${id}`),
  assign:       (data)          => gasWrite('POST',  'peer-assignments',                data),
  markComplete: (id, data = {}) => gasWrite('PATCH', `peer-assignments/${id}/complete`, data)
}

// ── Named aliases for views that import with aliases ──
// e.g. import { ipcrf as ipcrfApi, kraLibrary as kraLibraryApi } from '@/services/api'
export { ipcrfApi as ipcrf }
export { kraLibraryApi as kraLibrary }

// ── Default export ─────────────────────────────

export default {
  authApi,
  dashboardApi,
  usersApi,
  kraApi,
  kraLibraryApi,
  accomplishmentsApi,
  movApi,
  evaluationApi,
  reportsApi,
  notificationsApi,
  auditApi,
  deadlinesApi,
  ipcrfApi,
  docGenApi,
  attendanceApi,
  peerAssignmentsApi
}