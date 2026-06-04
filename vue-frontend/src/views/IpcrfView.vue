<template>
  <div class="content">

    <!-- Header -->
    <div class="page-hd">
      <div>
        <h2 class="page-title">IPCRF / CCEF Forms</h2>
        <p class="page-sub">Individual Performance Commitment and Review Forms</p>
      </div>
      <button class="btn btn-primary" @click="openNewForm">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        New Form
      </button>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <!-- Status tabs -->
      <div class="status-tabs">
        <button
          v-for="s in statusOptions" :key="s"
          :class="['status-tab', activeStatus === s && 'active']"
          @click="activeStatus = s"
        >{{ s }}</button>
      </div>
      <!-- Type + Semester dropdowns -->
      <div class="filter-selects">
        <select v-model="filterType" class="filter-select">
          <option value="">All Types</option>
          <option value="IPCRF">IPCRF</option>
          <option value="CCEF">CCEF</option>
        </select>
        <select v-model="filterSemester" class="filter-select">
          <option value="">All Semesters</option>
          <option value="S1">Semester 1</option>
          <option value="S2">Semester 2</option>
        </select>
      </div>
    </div>

    <!-- ── Skeleton loading ── -->
    <div v-if="loading" class="forms-grid">
      <div v-for="i in 4" :key="'sk'+i" class="form-card sk-card">
        <div class="sk-hd">
          <div class="sk-badge"></div>
          <div class="sk-line" style="width:60px"></div>
        </div>
        <div class="sk-line" style="width:80%;margin-bottom:8px"></div>
        <div class="sk-line" style="width:55%"></div>
        <div class="sk-footer">
          <div class="sk-line" style="width:90px;height:10px"></div>
          <div class="sk-btn"></div>
        </div>
      </div>
    </div>

    <!-- ── Empty state ── -->
    <div v-else-if="!filteredForms.length" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="6" width="32" height="36" rx="3" stroke="#E2E8F0" stroke-width="2"/>
        <path d="M16 16h16M16 22h16M16 28h10" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <p class="empty-title">No forms yet</p>
      <p class="empty-sub">Create your first IPCRF or CCEF form.</p>
      <button class="btn btn-primary" @click="openNewForm">Create New Form</button>
    </div>

    <!-- ── Forms grid ── -->
    <div v-else class="forms-grid">
      <div v-for="form in filteredForms" :key="form.id" class="form-card" @click="openForm(form)">
        <div class="form-card-hd">
          <span :class="['type-badge', form.type === 'IPCRF' ? 'type-ipcrf' : 'type-ccef']">
            {{ form.type }}
          </span>
          <span :class="['status-badge', statusClass(form.status)]">{{ form.status }}</span>
        </div>
        <div class="form-name">{{ form.employeeName }}</div>
        <div class="form-meta">
          <span>{{ form.divisionName || '—' }}</span>
          <span class="dot">·</span>
          <span>{{ form.semester }} {{ form.year }}</span>
        </div>
        <div v-if="form.finalNumericalRating" class="form-rating">
          <span class="rating-val">{{ form.finalNumericalRating }}</span>
          <span class="rating-label">{{ form.adjectivalRating }}</span>
        </div>
        <div class="form-card-ft">
          <span class="form-date">{{ formatDate(form.updatedAt || form.createdAt) }}</span>
          <div class="form-actions" @click.stop>
            <button v-if="canSubmit(form)" class="btn btn-xs btn-outline" @click.stop="submitForm(form)">Submit</button>
            <button v-if="canApprove(form)" class="btn btn-xs btn-success" @click.stop="approveForm(form)">Approve</button>
            <button v-if="canReturn(form)" class="btn btn-xs btn-warn" @click.stop="returnForm(form)">Return</button>
            <button class="btn btn-xs" @click.stop="openForm(form)">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M1 9.5L7.5 3l1.5 1.5L2.5 11H1V9.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
              Open
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── New Form Modal ── -->
    <transition name="modal-fade">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal">
          <div class="modal-hd">
            <div class="modal-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/>
                <path d="M6 7h6M6 10h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                <path d="M13 1v4M15 3h-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <h3 class="modal-title">Create New Form</h3>
              <p class="modal-sub">Start a new performance commitment form</p>
            </div>
            <button class="modal-close" @click="showModal = false">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field full">
                <label class="field-label">Form Type <span class="req">*</span></label>
                <div class="type-toggle">
                  <button :class="['type-opt', newForm.type === 'IPCRF' && 'active']" @click="newForm.type = 'IPCRF'">
                    <strong>IPCRF</strong>
                    <span>Individual Performance Commitment &amp; Review</span>
                  </button>
                  <button :class="['type-opt', newForm.type === 'CCEF' && 'active']" @click="newForm.type = 'CCEF'">
                    <strong>CCEF</strong>
                    <span>Core Competency Evaluation Form</span>
                  </button>
                </div>
              </div>
              <div class="field">
                <label class="field-label">Semester <span class="req">*</span></label>
                <select v-model="newForm.semester" class="field-input">
                  <option value="">Select…</option>
                  <option value="S1">Semester 1 (Jan–Jun)</option>
                  <option value="S2">Semester 2 (Jul–Dec)</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Year <span class="req">*</span></label>
                <select v-model="newForm.year" class="field-input">
                  <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showModal = false">Cancel</button>
            <button class="btn btn-primary" :disabled="saving || !newForm.type || !newForm.semester" @click="createForm">
              <span v-if="saving" class="spinner-sm"></span>
              {{ saving ? 'Creating…' : 'Create Form' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Toast -->
    <transition name="toast-slide">
      <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">{{ toast.msg }}</div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ipcrfApi } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const router    = useRouter()
const authStore = useAuthStore()

const loading   = ref(false)
const saving    = ref(false)
const showModal = ref(false)
const forms     = ref([])
const toast     = ref({ show: false, msg: '', type: 'success' })

const activeStatus   = ref('All')
const filterType     = ref('')
const filterSemester = ref('')

const statusOptions = ['All', 'Draft', 'Submitted', 'Approved', 'Rated', 'Finalized']

const now         = new Date()
const yearOptions = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() + 1]

const newForm = ref({
  type:     'IPCRF',
  semester: now.getMonth() < 6 ? 'S1' : 'S2',
  year:     now.getFullYear()
})

// ── Load forms ──
onMounted(async () => {
  loading.value = true
  try {
    const result = await ipcrfApi.listForms()
    forms.value  = result?.items ?? result ?? []
  } catch (e) {
    console.warn('[IPCRF]', e.message)
    showToast('Could not load forms: ' + e.message, 'error')
  } finally {
    loading.value = false
  }
})

// ── Filter ──
const filteredForms = computed(() => {
  let rows = forms.value
  if (activeStatus.value !== 'All') rows = rows.filter(f => f.status === activeStatus.value)
  if (filterType.value)     rows = rows.filter(f => f.type     === filterType.value)
  if (filterSemester.value) rows = rows.filter(f => f.semester === filterSemester.value)
  return rows.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
})

// ── Create ──
function openNewForm() { showModal.value = true }

async function createForm() {
  if (!newForm.value.type || !newForm.value.semester) return
  saving.value = true
  try {
    const created = await ipcrfApi.createForm({
      type:        newForm.value.type,
      semester:    newForm.value.semester,
      year:        newForm.value.year,
      userId:      authStore.profileId,
      employeeName: authStore.fullName,
      position:    authStore.position !== '—' ? authStore.position : '',
      divisionId:  authStore.divisionId,
      divisionName: authStore.divisionName !== '—' ? authStore.divisionName : ''
    })
    forms.value.unshift(created)
    showModal.value = false
    showToast('Form created successfully.')
  } catch (e) {
    showToast('Failed to create form: ' + e.message, 'error')
  } finally {
    saving.value = false
  }
}

// ── Actions ──
function openForm(form) {
  // Navigate to detail view when it exists
  // router.push(`/ipcrf/${form.id}`)
  showToast(`Opening ${form.type} form for ${form.employeeName}`)
}

async function submitForm(form) {
  try {
    const updated = await ipcrfApi.submitForm(form.id)
    updateLocal(form.id, updated)
    showToast('Form submitted for review.')
  } catch (e) { showToast(e.message, 'error') }
}

async function approveForm(form) {
  try {
    const updated = await ipcrfApi.approveForm(form.id)
    updateLocal(form.id, updated)
    showToast('Form approved.')
  } catch (e) { showToast(e.message, 'error') }
}

async function returnForm(form) {
  try {
    const updated = await ipcrfApi.returnForm(form.id)
    updateLocal(form.id, updated)
    showToast('Form returned for revision.')
  } catch (e) { showToast(e.message, 'error') }
}

function updateLocal(id, updated) {
  const idx = forms.value.findIndex(f => f.id === id)
  if (idx !== -1) forms.value[idx] = { ...forms.value[idx], ...updated }
}

// ── Role-based action visibility ──
const role = computed(() => authStore.role)
function canSubmit(form)  { return form.status === 'Draft' && (form.userId === authStore.profileId || role.value === 'System Administrator') }
function canApprove(form) { return form.status === 'Submitted' && ['System Administrator','Bureau Director','Assistant Bureau Director','Division Chief'].includes(role.value) }
function canReturn(form)  { return form.status === 'Submitted' && ['System Administrator','Bureau Director','Assistant Bureau Director','Division Chief'].includes(role.value) }

// ── Helpers ──
function statusClass(status) {
  const map = {
    Draft:     'st-draft',
    Submitted: 'st-submitted',
    Returned:  'st-returned',
    Approved:  'st-approved',
    Rated:     'st-rated',
    Finalized: 'st-finalized'
  }
  return map[status] || 'st-draft'
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '' }
}

function showToast(msg, type = 'success') {
  toast.value = { show: true, msg, type }
  setTimeout(() => { toast.value.show = false }, 3500)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;}
.content{padding:20px 24px 24px;font-family:'DM Sans',sans-serif;font-size:13px;color:#1A2332;background:#EEF2F7;min-height:100%;}

/* Header */
.page-hd{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;}
.page-title{font-size:20px;font-weight:700;color:#0F172A;margin-bottom:3px;}
.page-sub{font-size:12px;color:#94A3B8;}

/* Filter bar */
.filter-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;flex-wrap:wrap;}
.status-tabs{display:flex;gap:4px;}
.status-tab{padding:5px 14px;border-radius:20px;font-size:12px;font-weight:500;border:1px solid #E2E8F0;background:#fff;color:#64748B;cursor:pointer;transition:all .15s;}
.status-tab:hover{border-color:#CBD5E1;}
.status-tab.active{background:#0D2137;color:#fff;border-color:#0D2137;}
.filter-selects{display:flex;gap:8px;}
.filter-select{padding:6px 10px;border:1px solid #E2E8F0;border-radius:7px;font-size:12px;font-family:'DM Sans',sans-serif;color:#374151;background:#fff;outline:none;cursor:pointer;}
.filter-select:focus{border-color:#3B82F6;}

/* Forms grid */
.forms-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;}

/* Form card */
.form-card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;cursor:pointer;transition:all .15s;box-shadow:0 1px 3px rgba(0,0,0,.04);}
.form-card:hover{border-color:#CBD5E1;box-shadow:0 4px 12px rgba(0,0,0,.08);transform:translateY(-1px);}
.form-card-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}

/* Type badge */
.type-badge{display:inline-flex;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:.3px;}
.type-ipcrf{background:#EBF4FF;color:#1A56B0;}
.type-ccef{background:#F3EEFF;color:#6B3FA0;}

/* Status badge */
.status-badge{display:inline-flex;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500;}
.st-draft{background:#F8FAFC;color:#64748B;border:1px solid #E2E8F0;}
.st-submitted{background:#FEF3E2;color:#B45309;}
.st-returned{background:#FEF2F2;color:#B91C1C;}
.st-approved{background:#EBF4FF;color:#1A56B0;}
.st-rated{background:#F3EEFF;color:#6B3FA0;}
.st-finalized{background:#F0FDF4;color:#15803D;}

.form-name{font-size:14px;font-weight:600;color:#0F172A;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.form-meta{font-size:11px;color:#94A3B8;margin-bottom:8px;display:flex;gap:4px;align-items:center;}
.dot{color:#CBD5E1;}
.form-rating{display:flex;align-items:center;gap:6px;margin-bottom:10px;padding:6px 10px;background:#F8FAFC;border-radius:7px;}
.rating-val{font-size:18px;font-weight:700;color:#0F172A;}
.rating-label{font-size:11px;color:#64748B;}
.form-card-ft{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:10px;border-top:1px solid #F1F5F9;}
.form-date{font-size:10px;color:#94A3B8;}
.form-actions{display:flex;gap:4px;}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:8px;font-size:12px;cursor:pointer;border:1px solid #E2E8F0;background:#fff;color:#374151;transition:all .15s;font-family:'DM Sans',sans-serif;font-weight:500;}
.btn:hover{border-color:#CBD5E1;background:#F8FAFC;}
.btn:disabled{opacity:.55;cursor:not-allowed;}
.btn-primary{background:#0D2137;color:#fff;border-color:#0D2137;}
.btn-primary:hover{background:#1e3f61;border-color:#1e3f61;}
.btn-xs{padding:4px 10px;font-size:11px;border-radius:6px;}
.btn-outline{border-color:#CBD5E1;}
.btn-success{background:#F0FDF4;color:#15803D;border-color:#BBF7D0;}
.btn-success:hover{background:#DCFCE7;}
.btn-warn{background:#FEF3E2;color:#B45309;border-color:#FDE68A;}
.btn-warn:hover{background:#FEF9C3;}

/* Empty state */
.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px 20px;gap:8px;color:#94A3B8;}
.empty-title{font-size:15px;font-weight:600;color:#374151;margin-top:4px;}
.empty-sub{font-size:13px;margin-bottom:8px;}

/* ── Skeleton ── */
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.sk-line,.sk-badge,.sk-btn{background:linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%);background-size:200%;animation:shimmer 1.4s infinite;border-radius:4px;}
.sk-line{height:12px;display:block;}
.sk-badge{height:20px;width:50px;border-radius:6px;display:inline-block;}
.sk-btn{height:24px;width:60px;border-radius:6px;display:inline-block;}
.sk-card{display:flex;flex-direction:column;gap:10px;pointer-events:none;}
.sk-hd{display:flex;justify-content:space-between;align-items:center;}
.sk-footer{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:10px;border-top:1px solid #F1F5F9;}

/* ── Modal ── */
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;z-index:200;padding:16px;backdrop-filter:blur(4px);}
.modal{background:#fff;border-radius:16px;width:100%;max-width:500px;box-shadow:0 24px 64px rgba(0,0,0,.2);overflow:hidden;}
.modal-hd{display:flex;align-items:center;gap:12px;padding:20px 24px 16px;border-bottom:1px solid #F1F5F9;background:#FAFBFF;}
.modal-icon{width:36px;height:36px;border-radius:10px;background:#EBF4FF;color:#2F80ED;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.modal-title{font-size:15px;font-weight:700;color:#0F172A;margin-bottom:1px;}
.modal-sub{font-size:12px;color:#94A3B8;}
.modal-close{margin-left:auto;background:none;border:none;cursor:pointer;padding:6px;border-radius:8px;color:#94A3B8;transition:all .15s;}
.modal-close:hover{background:#F1F5F9;color:#374151;}
.modal-body{padding:20px 24px;}
.modal-footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 24px;border-top:1px solid #F1F5F9;background:#F8FAFC;}

/* Form inside modal */
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.field{display:flex;flex-direction:column;gap:5px;}
.full{grid-column:span 2;}
.field-label{font-size:11px;font-weight:600;color:#374151;}
.req{color:#EF4444;}
.field-input{padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:#0F172A;background:#fff;outline:none;transition:border-color .15s;}
.field-input:focus{border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}

/* Type toggle */
.type-toggle{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.type-opt{padding:12px;border:1.5px solid #E2E8F0;border-radius:10px;cursor:pointer;text-align:left;background:#fff;transition:all .15s;font-family:'DM Sans',sans-serif;}
.type-opt strong{display:block;font-size:13px;font-weight:700;color:#0F172A;margin-bottom:3px;}
.type-opt span{font-size:10px;color:#94A3B8;line-height:1.4;}
.type-opt:hover{border-color:#CBD5E1;}
.type-opt.active{border-color:#3B82F6;background:#EBF4FF;}
.type-opt.active strong{color:#1A56B0;}

/* Spinner */
.spinner-sm{display:inline-block;width:11px;height:11px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;margin-right:4px;}
@keyframes spin{to{transform:rotate(360deg)}}

/* Toast */
.toast{position:fixed;bottom:24px;right:24px;background:#0F172A;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:999;}
.toast-error{background:#EB5757;}
.toast-warning{background:#E9A840;}

/* Transitions */
.modal-fade-enter-active,.modal-fade-leave-active{transition:opacity .2s,transform .2s;}
.modal-fade-enter-from,.modal-fade-leave-to{opacity:0;transform:scale(.97);}
.toast-slide-enter-active,.toast-slide-leave-active{transition:all .25s;}
.toast-slide-enter-from,.toast-slide-leave-to{opacity:0;transform:translateY(8px);}
</style>