// src/services/api.js
// Google Apps Script does NOT support CORS preflight (OPTIONS).
// Fix: all write operations go as GET with _method param,
// and body data is passed as URL-encoded query params.

import { auth } from "@/firebase";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function getToken() {
  try {
    const user = auth.currentUser;
    return user ? await user.getIdToken(false) : null;
  } catch (e) {
    console.warn("[PMES] Token error:", e.message);
    return null;
  }
}

// GET request (reads)
async function gasGet(route, params = {}) {
  const token = await getToken();
  const qs = new URLSearchParams({
    route,
    token: token || "",
    ...flattenParams(params),
  }).toString();

  const res = await fetch(`${BASE_URL}?${qs}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || "API error");
  return data.data;
}

// All writes sent as GET to avoid CORS preflight
async function gasWrite(method, route, body = {}) {
  const token = await getToken();
  const qs = new URLSearchParams({
    route,
    _method: method,
    token: token || "",
    ...flattenParams(body),
  }).toString();

  const res = await fetch(`${BASE_URL}?${qs}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || "API error");
  return data.data;
}

function flattenParams(obj, prefix = "") {
  const result = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (
      v !== null &&
      v !== undefined &&
      typeof v === "object" &&
      !Array.isArray(v)
    ) {
      Object.assign(result, flattenParams(v, key));
    } else {
      result[key] = v ?? "";
    }
  }
  return result;
}

export const authApi = {
  me: () => gasGet("auth/me"),
  logAction: (action, module, details) =>
    gasGet("auth/log", { action, module, details }),
};

export const dashboardApi = {
  summary: (p = {}) => gasGet("dashboard/summary", p),
  divisions: (p = {}) => gasGet("dashboard/divisions", p),
  statusBreakdown: (p = {}) => gasGet("dashboard/status", p),
  monthlyActivity: (p = {}) => gasGet("dashboard/activity", p),
};

export const usersApi = {
  list: (p = {}) => gasGet("users", p),
  get: (id) => gasGet(`users/${id}`),
  create: (data) => gasWrite("POST", "users", data),
  update: (id, data) => gasWrite("PUT", `users/${id}`, data),
  updateProfile: (id, data) => gasWrite("PUT", `users/${id}/profile`, data),
  activate: (id) => gasWrite("PATCH", `users/${id}/activate`),
  deactivate: (id) => gasWrite("PATCH", `users/${id}/deactivate`),
  resetPassword: (id, tempPassword) =>
    gasWrite("POST", `users/${id}/reset-password`, { tempPassword }),
};

export const kraApi = {
  list: (p = {}) => gasGet("kras", p),
  get: (id) => gasGet(`kras/${id}`),
  create: (data) => gasWrite("POST", "kras", data),
  update: (id, data) => gasWrite("PUT", `kras/${id}`, data),
  delete: (id) => gasWrite("DELETE", `kras/${id}`),
  listSI: (kraId) => gasGet(`kras/${kraId}/indicators`),
  createSI: (kraId, data) => gasWrite("POST", `kras/${kraId}/indicators`, data),
  updateSI: (kraId, siId, data) =>
    gasWrite("PUT", `kras/${kraId}/indicators/${siId}`, data),
  deleteSI: (kraId, siId) =>
    gasWrite("DELETE", `kras/${kraId}/indicators/${siId}`),
};

export const accomplishmentsApi = {
  list: (p = {}) => gasGet("accomplishments", p),
  get: (id) => gasGet(`accomplishments/${id}`),
  create: (data) => gasWrite("POST", "accomplishments", data),
  update: (id, data) => gasWrite("PUT", `accomplishments/${id}`, data),
  approve: (id, remarks) =>
    gasWrite("PATCH", `accomplishments/${id}/approve`, { remarks }),
  requestRevision: (id, remarks) =>
    gasWrite("PATCH", `accomplishments/${id}/revision`, { remarks }),
  updateStatus: (id, status, remarks) =>
    gasWrite("PATCH", `accomplishments/${id}/status`, { status, remarks }),
  history: (id) => gasGet(`accomplishments/${id}/history`),
};

export const movApi = {
  list: (p = {}) => gasGet("mov", p),
  get: (id) => gasGet(`mov/${id}`),
  preview: (id) => gasGet(`mov/${id}/preview`),
  delete: (id) => gasWrite("DELETE", `mov/${id}`),
  upload: async (file, meta = {}) => {
    const base64 = await fileToBase64(file);
    return gasWrite("POST", "mov/upload", {
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      base64,
      ...meta,
    });
  },
};

export const evaluationApi = {
  list: (p = {}) => gasGet("evaluations", p),
  get: (id) => gasGet(`evaluations/${id}`),
  compute: (userId, period) =>
    gasWrite("POST", "evaluations/compute", { userId, period }),
  update: (id, data) => gasWrite("PUT", `evaluations/${id}`, data),
  history: (userId) => gasGet(`evaluations/history/${userId}`),
};

export const reportsApi = {
  list: () => gasGet("reports"),
  generate: (data) => gasWrite("POST", "reports/generate", data),
  download: (id) => gasGet(`reports/${id}/download`),
};

export const notificationsApi = {
  list: () => gasGet("notifications"),
  markRead: (id) => gasWrite("PATCH", `notifications/${id}/read`),
  markAllRead: () => gasWrite("PATCH", "notifications/read-all"),
};

export const auditApi = {
  list: (p = {}) => gasGet("audit", p),
  export: (p = {}) => gasGet("audit/export", p),
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ipcrf = {
  list: (p = {}) => gasGet("ipcrf", p),
  get: (id) => gasGet(`ipcrf/${id}`),
  create: (data) => gasWrite("POST", "ipcrf", data),
  update: (id, data) => gasWrite("PUT", `ipcrf/${id}`, data),
  submit: (id) => gasWrite("POST", `ipcrf/${id}/submit`),
  approve: (id, data) => gasWrite("POST", `ipcrf/${id}/approve`, data || {}),
  submitForRating: (id) => gasWrite("POST", `ipcrf/${id}/for-rating`),
  computeScore: (id) => gasWrite("POST", `ipcrf/${id}/compute`),

  getEntries: (formId) => gasGet(`ipcrf/${formId}/entries`),
  addEntry: (formId, d) => gasWrite("POST", `ipcrf/${formId}/entries`, d),
  updateEntry: (id, data) => gasWrite("PUT", `form-entries/${id}`, data),
  deleteEntry: (id) => gasWrite("DELETE", `form-entries/${id}`),
  rateEntry: (id, data) => gasWrite("POST", `form-entries/${id}/rate`, data),
};

export const kraLibrary = {
  list: (p = {}) => gasGet("kra-library", p),
};

export const jrb = {
  items: () => gasGet("jrb/items"),
  submitRating: (data) => gasWrite("POST", "jrb", data),
  getFormRatings: (formId) => gasGet(`jrb/${formId}/ratings`),
  assignPeers: (userId, d) => gasWrite("POST", `jrb/${userId}/assign-peers`, d),
  getAssignment: (userId, p) => gasGet(`jrb/${userId}/assignment`, p),
  myPeerForms: (p = {}) => gasGet("jrb/my-peer-forms", p),
};

export const attendance = {
  list: (p = {}) => gasGet("attendance", p),
  logRecord: (data) => gasWrite("POST", "attendance", data),
  computeRating: (uid, d) =>
    gasWrite("POST", `attendance/${uid}/compute-rating`, d),
  getRating: (uid, p) => gasGet(`attendance/${uid}/rating`, p),
  getDivisionStaff: (p = {}) => gasGet("attendance/staff", p),
};

export const ipcrf = {
  // Forms
  listForms:   (p = {})      => gasGet('ipcrf/forms', p),
  getForm:     (id)          => gasGet(`ipcrf/forms/${id}`),
  createForm:  (data)        => gasWrite('POST',  'ipcrf/forms', data),
  updateForm:  (id, data)    => gasWrite('PUT',   `ipcrf/forms/${id}`, data),
  submitForm:  (id)          => gasWrite('PATCH', `ipcrf/forms/${id}/submit`),
  approveForm: (id, data={}) => gasWrite('PATCH', `ipcrf/forms/${id}/approve`, data),
  returnForm:  (id, data={}) => gasWrite('PATCH', `ipcrf/forms/${id}/return`,  data),
  computeScore:(id)          => gasWrite('PATCH', `ipcrf/forms/${id}/score`),
  // Entries
  getEntries:  (formId)            => gasGet(`ipcrf/forms/${formId}/entries`),
  addEntry:    (formId, data)      => gasWrite('POST',   `ipcrf/forms/${formId}/entries`, data),
  updateEntry: (entryId, data)     => gasWrite('PUT',    `ipcrf/entries/${entryId}`,      data),
  deleteEntry: (entryId)           => gasWrite('DELETE', `ipcrf/entries/${entryId}`)
}
 
export const kraLibrary = {
  list: (p = {}) => gasGet('ipcrf/library', p)
}

export default {
  authApi,
  dashboardApi,
  usersApi,
  kraApi,
  accomplishmentsApi,
  movApi,
  evaluationApi,
  reportsApi,
  notificationsApi,
  auditApi,
};
