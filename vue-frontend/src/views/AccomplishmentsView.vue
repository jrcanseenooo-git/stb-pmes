<template>
  <div class="acc-page">

    <div class="content-card">

    <div class="page-hd">
      <div>
        <h2 class="page-title">Accomplishments</h2>
        <p class="page-sub">Individual Performance Commitment and Review Entries</p>
      </div>
      <button class="btn btn-primary" @click="openAddModal">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        New Entry
      </button>
    </div>

    <!-- Linked-from-IPCRF banner -->
    <div v-if="linkedFormId" class="link-banner">
      <span>Showing accomplishments for your IPCRF/CCEF form — get these to <strong>Approved</strong> before generating the Ratings document.</span>
      <button class="btn btn-sm" @click="router.push('/ipcrf')">← Back to IPCRF/CCEF Forms</button>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <div class="status-tabs">
        <button v-for="t in statusTabs" :key="t.value"
          :class="['status-tab', activeStatus === t.value && 'active']"
          @click="activeStatus = t.value">
          {{ t.label }}
          <span v-if="t.value !== 'All' && countByStatus(t.value)" class="tab-badge">{{ countByStatus(t.value) }}</span>
        </button>
      </div>
      <div class="srch-wrap">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="srch-icon">
          <circle cx="5" cy="5" r="4" stroke="#94A3B8" stroke-width="1.2"/>
          <path d="M8.5 8.5l2 2" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
        <input v-model="search" type="text" class="srch-inp" placeholder="Search KRA, target, employee…"/>
      </div>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="acc-table">
      <div class="table-hd">
        <div class="th th-emp">Employee</div>
        <div class="th th-kra">KRA</div>
        <div class="th th-target">Target / SI</div>
        <div class="th th-prog">Progress</div>
        <div class="th th-status">Status</div>
        <div class="th th-dl">Deadline</div>
        <div class="th th-act">Actions</div>
      </div>
      <div v-for="i in 5" :key="i" class="table-row">
        <div class="td td-emp"><div class="sk-line" style="width:80%"></div></div>
        <div class="td td-kra"><div class="sk-line" style="width:70%"></div></div>
        <div class="td td-target"><div class="sk-line" style="width:90%"></div></div>
        <div class="td td-prog"><div class="sk-line" style="width:50px"></div></div>
        <div class="td td-status"><div class="sk-line" style="width:70px"></div></div>
        <div class="td td-dl"><div class="sk-line" style="width:60px"></div></div>
        <div class="td td-act"><div class="sk-line" style="width:50px"></div></div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="!filteredRows.length" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="6" width="32" height="36" rx="3" stroke="#E2E8F0" stroke-width="2"/>
        <path d="M16 16h16M16 22h16M16 28h10" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <p class="empty-title">{{ rows.length === 0 ? 'No entries yet' : 'No matching entries' }}</p>
      <p class="empty-sub">{{ rows.length === 0 ? 'Click New Entry to add your first accomplishment.' : 'Try adjusting your filters.' }}</p>
    </div>

    <!-- Table -->
    <div v-else class="acc-table">
      <div class="table-hd">
        <div class="th th-emp">Employee</div>
        <div class="th th-kra">KRA</div>
        <div class="th th-target">Target / SI</div>
        <div class="th th-prog">Progress</div>
        <div class="th th-status">Status</div>
        <div class="th th-dl">Deadline</div>
        <div class="th th-act">Actions</div>
      </div>
      <div v-for="row in filteredRows" :key="row.id" class="table-row" @click="openViewModal(row)">
        <div class="td td-emp">
          <div class="emp-cell">
            <div class="av" :style="{ background: avatarColor(row.employeeName) }">{{ initials(row.employeeName) }}</div>
            <div class="emp-meta">
              <div class="emp-name">{{ row.employeeName }}</div>
              <div class="emp-div">{{ row.divisionName || '—' }}</div>
            </div>
          </div>
        </div>
        <div class="td td-kra text-muted">{{ row.kraName || '—' }}</div>
        <div class="td td-target">{{ row.successIndicator || row.target || '—' }}</div>
        <div class="td td-prog">
          <div class="prog-wrap">
            <div class="prog-track"><div class="prog-fill" :style="{ width: (row.progressPct || 0) + '%', background: progColor(row.progressPct) }"></div></div>
            <span class="prog-label">{{ row.progressPct || 0 }}%</span>
          </div>
        </div>
        <div class="td td-status">
          <span :class="['status-badge', statusClass(row.status)]">{{ row.status }}</span>
        </div>
        <div class="td td-dl" :class="isOverdue(row.deadline) ? 'overdue' : 'text-muted'">
          {{ fmtDate(row.deadline) }}{{ isOverdue(row.deadline) ? ' ⚠' : '' }}
        </div>
        <div class="td td-act" @click.stop>
          <button v-if="canApprove && row.status === 'Submitted'" class="btn btn-xs btn-success" @click="doApprove(row)">Approve</button>
          <button v-if="canApprove && row.status === 'Submitted'" class="btn btn-xs btn-warn" @click="openRevisionModal(row)">Revise</button>
          <button class="btn btn-xs" @click="openEditModal(row)">Edit</button>
        </div>
      </div>
    </div>

    </div>
    <!-- /Content card -->

    <!-- VIEW MODAL -->
    <teleport to="body">
      <div v-if="showViewModal" class="modal-overlay" @click.self="showViewModal = false">
        <div class="modal modal-view">
          <div class="modal-hd">
            <div>
              <div style="display:flex;gap:6px;margin-bottom:6px">
                <span :class="['status-badge', statusClass(viewItem?.status)]">{{ viewItem?.status }}</span>
              </div>
              <h3 class="modal-title">{{ viewItem?.kraName }}</h3>
              <p class="modal-sub">{{ viewItem?.employeeName }} · {{ viewItem?.divisionName }}</p>
            </div>
            <button class="modal-close" @click="showViewModal = false">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="modal-body" v-if="viewItem">
            <div class="view-section"><div class="view-label">Target / Success Indicator</div><div class="view-text">{{ viewItem.successIndicator || '—' }}</div></div>
            <div class="view-section"><div class="view-label">Accomplishment</div><div class="view-text">{{ viewItem.accomplishment || '—' }}</div></div>
            <div class="view-2col">
              <div class="view-section"><div class="view-label">Progress</div><div class="view-text">{{ viewItem.progressPct || 0 }}%</div></div>
              <div class="view-section"><div class="view-label">Deadline</div><div class="view-text">{{ fmtDate(viewItem.deadline) || '—' }}</div></div>
            </div>
            <div v-if="viewItem.remarks" class="view-section"><div class="view-label">Remarks</div><div class="view-text">{{ viewItem.remarks }}</div></div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showViewModal = false">Close</button>
            <button class="btn btn-primary" @click="openEditModal(viewItem); showViewModal = false">Edit</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ADD / EDIT MODAL -->
    <teleport to="body">
      <div v-if="showFormModal" class="modal-overlay" @click.self="closeFormModal">
        <div class="modal modal-form">
          <div class="modal-hd">
            <div class="modal-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M6 7h6M6 10h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            </div>
            <div>
              <h3 class="modal-title">{{ editingItem ? 'Edit Entry' : 'New Accomplishment Entry' }}</h3>
              <p class="modal-sub">Performance tracker</p>
            </div>
            <button class="modal-close" @click="closeFormModal">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field full">
                <label class="field-label">KRA Name <span class="req">*</span></label>
                <input v-model="form.kraName" type="text" class="field-input" placeholder="e.g. Research & Documentation" :readonly="!!editingItem?.formId" :class="editingItem?.formId && 'readonly-input'"/>
              </div>
              <div class="field full">
                <label class="field-label">Success Indicator / Target <span class="req">*</span></label>
                <textarea v-model="form.successIndicator" class="field-input" rows="2" placeholder="Specific target or output…" :readonly="!!editingItem?.formId" :class="editingItem?.formId && 'readonly-input'"></textarea>
              </div>
              <p v-if="editingItem?.formId" class="linked-note">Linked to your IPCRF/CCEF form — KRA and indicator text come from there and can't be edited here.</p>
              <div class="field full"><label class="field-label">Accomplishment</label><textarea v-model="form.accomplishment" class="field-input" rows="2" placeholder="What was actually accomplished…"></textarea></div>
              <div class="field"><label class="field-label">Progress (%)</label><input v-model.number="form.progressPct" type="number" class="field-input" min="0" max="100"/></div>
              <div class="field"><label class="field-label">Deadline</label><input v-model="form.deadline" type="date" class="field-input"/></div>
              <div class="field"><label class="field-label">Status</label>
                <select v-model="form.status" class="field-input">
                  <option value="Not Started">Not Started</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Submitted">Submitted (for DC review)</option>
                  <option v-if="canApprove" value="For Revision">For Revision</option>
                  <option v-if="canApprove" value="Approved">Approved</option>
                  <option value="Completed">Completed</option>
                  <option value="Delayed">Delayed</option>
                </select>
              </div>
              <div class="field full"><label class="field-label">Remarks</label><input v-model="form.remarks" type="text" class="field-input" placeholder="Optional notes…"/></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="closeFormModal">Cancel</button>
            <button class="btn btn-primary" :disabled="saving" @click="saveEntry">
              <span v-if="saving" class="spinner-sm"></span>
              {{ saving ? 'Saving…' : (editingItem ? 'Save Changes' : 'Add Entry') }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- REVISION MODAL -->
    <teleport to="body">
      <div v-if="showRevisionModal" class="modal-overlay" @click.self="showRevisionModal = false">
        <div class="modal" style="max-width:420px">
          <div class="modal-hd">
            <div><h3 class="modal-title">Request Revision</h3><p class="modal-sub">{{ revisionItem?.kraName }}</p></div>
            <button class="modal-close" @click="showRevisionModal = false"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
          </div>
          <div class="modal-body">
            <div class="field"><label class="field-label">Remarks / Reason <span class="req">*</span></label><textarea v-model="revisionRemarks" class="field-input" rows="3" placeholder="Explain what needs to be revised…"></textarea></div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showRevisionModal = false">Cancel</button>
            <button class="btn btn-warn" :disabled="saving" @click="doRevision">
              {{ saving ? 'Sending…' : 'Request Revision' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Toast -->
    <teleport to="body">
      <transition name="toast-slide">
        <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">{{ toast.msg }}</div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { accomplishmentsApi } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const route     = useRoute()
const router    = useRouter()
const linkedFormId = computed(() => route.query.formId || '')

const rows         = ref([])
const loading      = ref(false)
const saving       = ref(false)
const search       = ref('')
const activeStatus = ref('All')
const showViewModal     = ref(false)
const showFormModal     = ref(false)
const showRevisionModal = ref(false)
const viewItem     = ref(null)
const editingItem  = ref(null)
const revisionItem = ref(null)
const revisionRemarks = ref('')
const toast = ref({ show: false, msg: '', type: 'success' })

const form = ref({
  kraName: '', successIndicator: '', accomplishment: '',
  progressPct: 0, deadline: '', status: 'Not Started', remarks: ''
})

const statusTabs = [
  { label: 'All',          value: 'All'          },
  { label: 'Not Started',  value: 'Not Started'  },
  { label: 'Ongoing',      value: 'Ongoing'      },
  { label: 'Submitted',    value: 'Submitted'    },
  { label: 'For Revision', value: 'For Revision' },
  { label: 'Approved',     value: 'Approved'     },
  { label: 'Completed',    value: 'Completed'    },
  { label: 'Delayed',      value: 'Delayed'      }
]

const canApprove = computed(() =>
  ['System Administrator', 'Bureau Director', 'Assistant Bureau Director', 'Division Chief'].includes(authStore.role)
)

const filteredRows = computed(() => {
  let r = rows.value
  if (activeStatus.value !== 'All') r = r.filter(x => x.status === activeStatus.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    r = r.filter(x =>
      (x.kraName || '').toLowerCase().includes(q) ||
      (x.successIndicator || '').toLowerCase().includes(q) ||
      (x.employeeName || '').toLowerCase().includes(q)
    )
  }
  return r
})

function countByStatus(s) { return rows.value.filter(r => r.status === s).length }
function initials(name) { return (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }
function avatarColor(name) { const colors = ['#2F80ED','#27AE60','#E9A840','#9B59B6','#EB5757','#1A56B0']; return colors[name?.length % colors.length] || '#2F80ED' }
function progColor(pct) { if (pct >= 100) return '#27AE60'; if (pct >= 60) return '#2F80ED'; if (pct >= 30) return '#E9A840'; return '#EB5757' }
function isOverdue(d) { return d && new Date(d) < new Date() }
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '' }
function showToast(msg, type = 'success') { toast.value = { show: true, msg, type }; setTimeout(() => { toast.value.show = false }, 3500) }

function statusClass(s) {
  const m = { 'Completed': 'st-green', 'Ongoing': 'st-blue', 'Submitted': 'st-orange', 'Delayed': 'st-red', 'Approved': 'st-green', 'For Revision': 'st-orange' }
  return m[s] || 'st-gray'
}

function openAddModal() { editingItem.value = null; form.value = { kraName: '', successIndicator: '', accomplishment: '', progressPct: 0, deadline: '', status: 'Not Started', remarks: '' }; showFormModal.value = true }
function openEditModal(item) { editingItem.value = item; form.value = { kraName: item.kraName || '', successIndicator: item.successIndicator || '', accomplishment: item.accomplishment || '', progressPct: Number(item.progressPct) || 0, deadline: item.deadline ? item.deadline.split('T')[0] : '', status: item.status || 'Not Started', remarks: item.remarks || '' }; showFormModal.value = true }
function openViewModal(item) { viewItem.value = item; showViewModal.value = true }
function openRevisionModal(item) { revisionItem.value = item; revisionRemarks.value = ''; showRevisionModal.value = true }
function closeFormModal() { showFormModal.value = false; editingItem.value = null }

onMounted(loadRows)

async function loadRows() {
  loading.value = true
  try {
    const r = await accomplishmentsApi.list(linkedFormId.value ? { formId: linkedFormId.value } : {})
    rows.value = r?.items || (Array.isArray(r) ? r : [])
  } catch (e) { showToast(`Could not load: ${e.message}`, 'error') }
  finally { loading.value = false }
}

async function saveEntry() {
  if (!form.value.kraName || !form.value.successIndicator) { showToast('KRA name and target are required', 'error'); return }
  saving.value = true
  try {
    if (editingItem.value) {
      let u = await accomplishmentsApi.update(editingItem.value.id, form.value)
      if (form.value.status !== editingItem.value.status) {
        try {
          u = await accomplishmentsApi.updateStatus(editingItem.value.id, form.value.status, form.value.remarks)
        } catch (e) {
          showToast(`Saved, but status change failed: ${e.message}`, 'error')
        }
      }
      const i = rows.value.findIndex(r => r.id === editingItem.value.id)
      if (i !== -1) rows.value[i] = { ...rows.value[i], ...u }
      showToast('Entry updated')
    } else {
      const created = await accomplishmentsApi.create(form.value)
      rows.value.unshift(created)
      showToast('Entry added')
    }
    closeFormModal()
  } catch (e) { showToast(e.message, 'error') }
  finally { saving.value = false }
}

async function doApprove(row) {
  try {
    const u = await accomplishmentsApi.approve(row.id, '')
    const i = rows.value.findIndex(r => r.id === row.id)
    if (i !== -1) rows.value[i] = { ...rows.value[i], ...u }
    showToast('Entry approved')
  } catch (e) { showToast(e.message, 'error') }
}

async function doRevision() {
  if (!revisionRemarks.value) { showToast('Please enter revision remarks', 'error'); return }
  saving.value = true
  try {
    const u = await accomplishmentsApi.requestRevision(revisionItem.value.id, revisionRemarks.value)
    const i = rows.value.findIndex(r => r.id === revisionItem.value.id)
    if (i !== -1) rows.value[i] = { ...rows.value[i], ...u }
    showRevisionModal.value = false
    showToast('Revision requested')
  } catch (e) { showToast(e.message, 'error') }
  finally { saving.value = false }
}
</script>

<style>
.acc-page { padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif; font-size: 13px; color: #1A2332; min-height: 100%; }
.content-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; padding: 20px; }
.page-hd { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; color: #0F172A; margin: 0 0 3px; letter-spacing: -.3px; }
.page-sub { font-size: 12px; color: #94A3B8; margin: 0; }
.filter-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }

/* Linked-from-IPCRF banner */
.link-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; margin-bottom: 14px; background: #F5F9FF; border: 1px solid #DCE9FB; border-radius: 9px; font-size: 12px; color: #1A56B0; flex-wrap: wrap; }
.readonly-input { background: #F8FAFC; color: #64748B; cursor: not-allowed; }
.linked-note { font-size: 11px; color: #94A3B8; grid-column: span 2; margin: -4px 0 4px; }
.status-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.status-tab { padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; border: 1px solid #E2E8F0; background: #fff; color: #64748B; cursor: pointer; transition: all .15s; font-family: inherit; }
.status-tab:hover { border-color: #CBD5E1; }
.status-tab.active { background: #0D2137; color: #fff; border-color: #0D2137; }
.tab-badge { background: #3B82F6; color: #fff; border-radius: 10px; font-size: 10px; padding: 1px 5px; margin-left: 3px; }
.srch-wrap { position: relative; }
.srch-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); pointer-events: none; }
.srch-inp { padding: 7px 11px 7px 28px; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 12px; font-family: inherit; color: #0F172A; outline: none; width: 240px; background: #fff; }
.srch-inp:focus { border-color: #3B82F6; }
.acc-table { border: 1px solid #E2E8F0; border-radius: 12px; overflow-x: auto; }
.table-hd, .table-row {
  display: grid;
  grid-template-columns: minmax(140px, 1.3fr) minmax(90px, 0.8fr) minmax(140px, 1.4fr) minmax(80px, 0.7fr) minmax(80px, 0.7fr) minmax(70px, 0.6fr) minmax(120px, 0.9fr);
  align-items: center;
  column-gap: 10px;
}
.table-hd { padding: 10px 14px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; }
.th { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .06em; }
.table-row { padding: 10px 14px; border-bottom: 1px solid #F1F5F9; cursor: pointer; transition: background .12s; }
.table-row:last-child { border-bottom: none; }
.table-row:hover { background: #F8FBFF; }
.td { font-size: 12px; color: #374151; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-emp { overflow: visible; white-space: normal; }
.td-act { display: flex; gap: 4px; flex-wrap: wrap; }
.emp-cell { display: flex; align-items: center; gap: 8px; min-width: 0; }
.emp-meta { min-width: 0; }
.av { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0; }
.emp-name { font-size: 12px; font-weight: 600; color: #0F172A; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.emp-div { font-size: 10px; color: #94A3B8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.text-muted { color: #94A3B8; font-size: 11px; }
.overdue { color: #EB5757; font-weight: 500; font-size: 11px; }
.prog-wrap { display: flex; align-items: center; gap: 6px; }
.prog-track { flex: 1; height: 5px; background: #F1F5F9; border-radius: 4px; overflow: hidden; }
.prog-fill { height: 100%; border-radius: 4px; transition: width .5s; }
.prog-label { font-size: 10px; color: #64748B; flex-shrink: 0; }
.status-badge { display: inline-flex; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 500; }
.st-green  { background: #F0FDF4; color: #15803D; }
.st-blue   { background: #EBF4FF; color: #1A56B0; }
.st-orange { background: #FEF3E2; color: #B45309; }
.st-red    { background: #FEF2F2; color: #B91C1C; }
.st-gray   { background: #F8FAFC; color: #64748B; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 64px 0; gap: 8px; }
.empty-title { font-size: 15px; font-weight: 600; color: #374151; margin: 4px 0 0; }
.empty-sub { font-size: 13px; color: #94A3B8; margin: 0 0 8px; }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
.sk-line { background: linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%); background-size: 200%; animation: shimmer 1.4s infinite; border-radius: 4px; height: 12px; display: block; }
.btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; border-radius: 8px; font-size: 12px; cursor: pointer; border: 1px solid #E2E8F0; background: #fff; color: #374151; transition: all .15s; font-family: inherit; font-weight: 500; }
.btn:hover { border-color: #CBD5E1; background: #F8FAFC; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-primary { background: #0D2137; color: #fff; border-color: #0D2137; }
.btn-primary:hover:not(:disabled) { background: #1e3f61; }
.btn-success { background: #F0FDF4; color: #15803D; border-color: #BBF7D0; font-size: 11px; padding: 4px 9px; }
.btn-warn { background: #FEF3E2; color: #B45309; border-color: #FDE68A; font-size: 11px; padding: 4px 9px; }
.btn-xs { padding: 4px 9px; font-size: 11px; }
.req { color: #EF4444; font-size: 11px; }
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 16px; backdrop-filter: blur(4px); }
.modal { background: #fff; border-radius: 16px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 24px 64px rgba(0,0,0,.2); overflow: hidden; }
.modal-view { max-width: 560px; }
.modal-form { max-width: 560px; }
.modal-hd { display: flex; align-items: flex-start; gap: 12px; padding: 20px 24px 16px; border-bottom: 1px solid #F1F5F9; background: #FAFBFF; flex-shrink: 0; }
.modal-icon { width: 36px; height: 36px; border-radius: 10px; background: #EBF4FF; color: #2F80ED; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.modal-title { font-size: 15px; font-weight: 700; color: #0F172A; margin: 0 0 2px; }
.modal-sub { font-size: 12px; color: #94A3B8; margin: 0; }
.modal-close { margin-left: auto; background: none; border: none; cursor: pointer; padding: 6px; border-radius: 8px; color: #94A3B8; }
.modal-close:hover { background: #F1F5F9; color: #374151; }
.modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 24px; border-top: 1px solid #F1F5F9; background: #F8FAFC; flex-shrink: 0; }
.view-section { margin-bottom: 16px; }
.view-label { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 5px; }
.view-text { font-size: 13px; color: #1A2332; line-height: 1.6; }
.view-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.full { grid-column: span 2; }
.field-label { font-size: 11px; font-weight: 600; color: #374151; }
.field-input { padding: 9px 12px; border: 1.5px solid #E2E8F0; border-radius: 9px; font-size: 13px; font-family: inherit; color: #0F172A; background: #fff; outline: none; transition: border-color .15s; resize: vertical; }
.field-input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
.spinner-sm { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }
.toast { position: fixed; bottom: 24px; right: 24px; background: #0F172A; color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,.2); z-index: 9999; pointer-events: none; }
.toast-error { background: #EB5757; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all .25s; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateY(8px); }
</style>