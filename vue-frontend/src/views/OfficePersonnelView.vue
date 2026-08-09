<template>
  <section class="op-page">
    <div class="op-toolbar">
      <div>
        <p class="op-kicker">Office Administration</p>
        <h1>Office Personnel</h1>
        <p class="op-sub">Maintain the personnel roster used for office assessment assignments.</p>
      </div>
      <button class="op-btn primary" type="button" @click="openCreate">Add Personnel</button>
    </div>

    <div class="op-panel">
      <div class="op-panel-hd">
        <div>
          <h2>Assessment Roster</h2>
          <p>{{ total }} personnel records</p>
        </div>
        <div class="op-search">
          <input v-model="search" type="text" placeholder="Search name, email, role..." @keyup.enter="loadRows" />
          <button class="op-btn" type="button" @click="loadRows">Search</button>
        </div>
      </div>

      <div v-if="loading" class="op-empty">Loading personnel...</div>
      <div v-else-if="error" class="op-error">{{ error }}</div>
      <div v-else-if="!rows.length" class="op-empty">No personnel records yet.</div>
      <div v-else class="op-table-wrap">
        <table class="op-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Unit</th>
              <th>Section</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td>
                <strong>{{ row.fullName }}</strong>
                <span>{{ row.employeeNo || 'No employee no.' }}</span>
              </td>
              <td>{{ row.email }}</td>
              <td><span class="op-pill neutral">{{ row.role || 'Technical Staff' }}</span></td>
              <td>{{ row.divisionName || row.organizationalUnitName || '-' }}</td>
              <td>{{ row.section || '-' }}</td>
              <td><span :class="['op-pill', row.status === 'Active' ? 'good' : 'bad']">{{ row.status }}</span></td>
              <td>
                <div class="op-actions">
                  <button class="op-icon-btn" type="button" @click="openEdit(row)">Edit</button>
                  <button class="op-icon-btn danger" type="button" :disabled="busyId === row.id || row.status !== 'Active'" @click="deactivate(row)">Deactivate</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showModal" class="op-modal-overlay" @click.self="closeModal">
      <form class="op-modal" @submit.prevent="save">
        <div class="op-modal-hd">
          <div>
            <h2>{{ editingId ? 'Edit Personnel' : 'Add Personnel' }}</h2>
            <p>{{ editingId ? 'Update roster details for assessment assignment.' : 'Add a personnel record to this office roster.' }}</p>
          </div>
          <button class="op-close" type="button" @click="closeModal">x</button>
        </div>

        <div class="op-form-grid">
          <label class="wide">
            <span>Full Name</span>
            <input v-model="form.fullName" type="text" required />
          </label>
          <label class="wide">
            <span>Email</span>
            <input v-model="form.email" type="email" :disabled="!!editingId" required />
          </label>
          <label>
            <span>Role</span>
            <select v-model="form.role">
              <option>Technical Staff</option>
              <option>Section Head</option>
              <option>Division Chief</option>
              <option>Assistant Bureau Director</option>
              <option>Bureau Director</option>
            </select>
          </label>
          <label>
            <span>Employee No.</span>
            <input v-model="form.employeeNo" type="text" />
          </label>
          <label>
            <span>Unit / Division</span>
            <input v-model="form.divisionName" type="text" />
          </label>
          <label>
            <span>Section</span>
            <input v-model="form.section" type="text" />
          </label>
          <label class="wide">
            <span>Position / Title</span>
            <input v-model="form.position" type="text" />
          </label>
        </div>

        <div v-if="modalError" class="op-error compact">{{ modalError }}</div>

        <div class="op-modal-actions">
          <button class="op-btn" type="button" @click="closeModal">Cancel</button>
          <button class="op-btn primary" type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Save Personnel' }}</button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { officePersonnelApi } from '@/services/api'

const rows = ref([])
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const busyId = ref('')
const error = ref('')
const modalError = ref('')
const search = ref('')
const showModal = ref(false)
const editingId = ref('')
const form = ref(defaultForm())

onMounted(loadRows)

function defaultForm() {
  return {
    fullName: '',
    email: '',
    role: 'Technical Staff',
    employeeNo: '',
    divisionName: '',
    section: '',
    position: ''
  }
}

async function loadRows() {
  loading.value = true
  error.value = ''
  try {
    const data = await officePersonnelApi.list({ search: search.value, pageSize: 200 })
    rows.value = data.items || []
    total.value = data.total || rows.value.length
  } catch (e) {
    error.value = e?.message || 'Could not load office personnel.'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = ''
  form.value = defaultForm()
  modalError.value = ''
  showModal.value = true
}

function openEdit(row) {
  editingId.value = row.id
  form.value = {
    fullName: row.fullName || '',
    email: row.email || '',
    role: row.role || 'Technical Staff',
    employeeNo: row.employeeNo || '',
    divisionName: row.divisionName || row.organizationalUnitName || '',
    section: row.section || '',
    position: row.position || ''
  }
  modalError.value = ''
  showModal.value = true
}

function closeModal() {
  if (saving.value) return
  showModal.value = false
}

async function save() {
  saving.value = true
  modalError.value = ''
  try {
    if (editingId.value) await officePersonnelApi.update(editingId.value, form.value)
    else await officePersonnelApi.create(form.value)
    await loadRows()
    closeModal()
  } catch (e) {
    modalError.value = e?.message || 'Could not save this personnel record.'
  } finally {
    saving.value = false
  }
}

async function deactivate(row) {
  busyId.value = row.id
  error.value = ''
  try {
    await officePersonnelApi.deactivate(row.id)
    await loadRows()
  } catch (e) {
    error.value = e?.message || 'Could not deactivate this personnel record.'
  } finally {
    busyId.value = ''
  }
}
</script>

<style scoped>
.op-page{display:grid;gap:16px;color:#0f172a;}
.op-toolbar,.op-panel{background:#fff;border:1px solid #dbe4f0;border-radius:8px;}
.op-toolbar{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:18px;}
.op-kicker{font-size:11px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:#2563eb;margin:0 0 4px;}
h1,h2,p{margin:0;}
h1{font-size:22px;line-height:1.2;}
h2{font-size:15px;}
.op-sub,.op-panel-hd p,.op-modal-hd p{font-size:12px;color:#64748b;margin-top:4px;}
.op-panel{overflow:hidden;}
.op-panel-hd{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid #e5edf7;}
.op-search{display:flex;gap:8px;align-items:center;}
.op-search input,.op-form-grid input,.op-form-grid select{height:36px;border:1px solid #dbe4f0;border-radius:8px;padding:0 10px;font:inherit;font-size:13px;background:#fff;}
.op-search input{width:280px;}
.op-btn{height:36px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:0 12px;font-weight:700;font-size:12px;cursor:pointer;color:#0f172a;}
.op-btn.primary{border-color:#0b3b75;background:#0b3b75;color:#fff;}
.op-btn:disabled,.op-icon-btn:disabled{opacity:.5;cursor:not-allowed;}
.op-empty,.op-error{padding:18px;text-align:center;color:#64748b;font-size:13px;}
.op-error{color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:12px;text-align:left;}
.op-error.compact{margin:0;}
.op-table-wrap{overflow:auto;}
.op-table{width:100%;border-collapse:collapse;font-size:12px;}
.op-table th{height:34px;text-align:left;background:#f8fafc;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5edf7;padding:0 12px;}
.op-table td{border-bottom:1px solid #eef2f7;padding:11px 12px;vertical-align:middle;}
.op-table td strong{display:block;font-size:13px;color:#0f172a;}
.op-table td span{display:block;color:#64748b;margin-top:2px;}
.op-pill{display:inline-flex!important;align-items:center;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:800;margin:0!important;}
.op-pill.good{background:#ecfdf5;color:#047857;}
.op-pill.bad{background:#fef2f2;color:#b91c1c;}
.op-pill.neutral{background:#f1f5f9;color:#475569;}
.op-actions{display:flex;gap:6px;}
.op-icon-btn{border:1px solid #dbe4f0;background:#fff;border-radius:7px;height:30px;padding:0 9px;font-size:11px;font-weight:700;cursor:pointer;}
.op-icon-btn.danger{color:#b91c1c;border-color:#fecaca;background:#fff7f7;}
.op-modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.42);display:grid;place-items:center;z-index:80;padding:20px;}
.op-modal{width:min(620px,100%);background:#fff;border-radius:10px;border:1px solid #dbe4f0;box-shadow:0 24px 80px rgba(15,23,42,.22);padding:18px;display:grid;gap:16px;}
.op-modal-hd{display:flex;justify-content:space-between;gap:12px;}
.op-close{border:0;background:#f1f5f9;border-radius:8px;width:30px;height:30px;cursor:pointer;font-weight:800;}
.op-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.op-form-grid label{display:grid;gap:6px;font-size:12px;font-weight:700;color:#334155;}
.op-form-grid .wide{grid-column:1 / -1;}
.op-modal-actions{display:flex;justify-content:flex-end;gap:8px;}
@media (max-width:760px){.op-toolbar,.op-panel-hd{display:grid;}.op-search{display:grid;}.op-search input{width:100%;}.op-form-grid{grid-template-columns:1fr;}.op-form-grid .wide{grid-column:auto;}}
</style>
