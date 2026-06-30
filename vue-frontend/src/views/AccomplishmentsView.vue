<template>
  <div class="acc-page">
    <div class="content-card">
      <div class="page-hd">
        <div>
          <h2 class="page-title">Accomplishments</h2>
          <p class="page-sub">IPCRF / CCEF ratings entry source</p>
        </div>
        <button class="btn btn-primary" @click="openAddModal">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          New Entry
        </button>
      </div>

      <div v-if="linkedFormId" class="link-banner">
        <span>Showing Ratings entries for your IPCRF/CCEF form.</span>
        <button class="btn btn-sm" @click="router.push('/ipcrf')">Back to IPCRF/CCEF Forms</button>
      </div>

      <div class="filter-bar">
        <select v-model="periodFilter" class="filter-select">
          <option value="">All Periods</option>
          <option v-for="period in periodOptions" :key="period.value" :value="period.value">
            {{ period.label }}
          </option>
        </select>
        <div class="srch-wrap">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="srch-icon">
            <circle cx="5" cy="5" r="4" stroke="#94A3B8" stroke-width="1.2"/>
            <path d="M8.5 8.5l2 2" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          <input v-model="search" type="text" class="srch-inp" placeholder="Search KRA, target, employee..."/>
        </div>
      </div>

      <div v-if="loading" class="acc-table">
        <div class="table-hd">
          <div class="th th-emp">Employee</div>
          <div class="th th-period">Period</div>
          <div class="th th-kra">KRA</div>
          <div class="th th-target">Target / SI</div>
          <div class="th th-accomp">Accomplishment</div>
          <div class="th th-rating">Average</div>
          <div class="th th-act">Actions</div>
        </div>
        <div v-for="i in 5" :key="i" class="table-row">
          <div class="td td-emp"><div class="sk-line" style="width:80%"></div></div>
          <div class="td td-period"><div class="sk-line" style="width:70px"></div></div>
          <div class="td td-kra"><div class="sk-line" style="width:70%"></div></div>
          <div class="td td-target"><div class="sk-line" style="width:90%"></div></div>
          <div class="td td-accomp"><div class="sk-line" style="width:90%"></div></div>
          <div class="td td-rating"><div class="sk-line" style="width:50px"></div></div>
          <div class="td td-act"><div class="sk-line" style="width:50px"></div></div>
        </div>
      </div>

      <div v-else-if="!filteredRows.length" class="empty-state">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="6" width="32" height="36" rx="3" stroke="#E2E8F0" stroke-width="2"/>
          <path d="M16 16h16M16 22h16M16 28h10" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <p class="empty-title">{{ rows.length === 0 ? 'No entries yet' : 'No matching entries' }}</p>
        <p class="empty-sub">{{ rows.length === 0 ? 'Create or select IPCRF/CCEF targets first.' : 'Try adjusting your search.' }}</p>
      </div>

      <div v-else class="acc-table">
        <div class="table-hd">
          <div class="th th-emp">Employee</div>
          <div class="th th-period">Period</div>
          <div class="th th-kra">KRA</div>
          <div class="th th-target">Target / SI</div>
          <div class="th th-accomp">Accomplishment</div>
          <div class="th th-rating">Average</div>
          <div class="th th-act">Actions</div>
        </div>
        <div v-for="row in filteredRows" :key="row.id" class="table-row" @click="openViewModal(row)">
          <div class="td td-emp">
            <div class="emp-cell">
              <div class="av" :style="{ background: avatarColor(row.employeeName) }">{{ initials(row.employeeName) }}</div>
              <div class="emp-meta">
                <div class="emp-name">{{ row.employeeName }}</div>
                <div class="emp-div">{{ row.divisionName || row.division || '---' }}</div>
              </div>
            </div>
          </div>
          <div class="td td-period">
            <span class="period-pill">{{ periodLabel(row) }}</span>
          </div>
          <div class="td td-kra text-muted">{{ row.kraTitle || '---' }}</div>
          <div class="td td-target">{{ row.target || '---' }}</div>
          <div class="td td-accomp">{{ row.accomplishment || '---' }}</div>
          <div class="td td-rating">{{ ratingText(row.ratingAverage) }}</div>
          <div class="td td-act" @click.stop>
            <button class="btn btn-xs" @click="openEditModal(row)">Edit</button>
          </div>
        </div>
      </div>
    </div>

    <teleport to="body">
      <div v-if="showViewModal" class="modal-overlay" @click.self="showViewModal = false">
        <div class="modal modal-view">
          <div class="modal-hd">
            <div>
              <h3 class="modal-title">{{ viewItem?.kraTitle }}</h3>
              <p class="modal-sub">{{ viewItem?.employeeName }} - {{ periodLabel(viewItem) }} - {{ viewItem?.divisionName || viewItem?.division || '---' }}</p>
            </div>
            <button class="modal-close" @click="showViewModal = false">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="modal-body" v-if="viewItem">
            <div class="view-section"><div class="view-label">Target / Success Indicator</div><div class="view-text">{{ viewItem.target || '---' }}</div></div>
            <div class="view-section"><div class="view-label">Accomplishment</div><div class="view-text">{{ viewItem.accomplishment || '---' }}</div></div>
            <div class="view-section"><div class="view-label">Means of Verification</div><div class="view-text">{{ viewItem.movReferences || '---' }}</div></div>
            <div class="view-4col">
              <div class="view-section"><div class="view-label">Efficiency</div><div class="view-text">{{ ratingText(viewItem.ratingEfficiency) }}</div></div>
              <div class="view-section"><div class="view-label">Quality</div><div class="view-text">{{ ratingText(viewItem.ratingQuality) }}</div></div>
              <div class="view-section"><div class="view-label">Timeliness</div><div class="view-text">{{ ratingText(viewItem.ratingTimeliness) }}</div></div>
              <div class="view-section"><div class="view-label">Average</div><div class="view-text">{{ ratingText(viewItem.ratingAverage) }}</div></div>
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

    <teleport to="body">
      <div v-if="showFormModal" class="modal-overlay" @click.self="closeFormModal">
        <div class="modal modal-form">
          <div class="modal-hd">
            <div class="modal-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M6 7h6M6 10h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            </div>
            <div>
              <h3 class="modal-title">{{ editingItem ? 'Edit Ratings Entry' : 'New Ratings Entry' }}</h3>
              <p class="modal-sub">Accomplishment, MOV, remarks, and E/Q/T rating</p>
            </div>
            <button class="modal-close" @click="closeFormModal">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field full">
                <label class="field-label">KRA Name <span class="req">*</span></label>
                <input v-model="form.kraTitle" type="text" class="field-input" placeholder="e.g. Research & Documentation" :readonly="!!editingItem?.formId" :class="editingItem?.formId && 'readonly-input'"/>
              </div>
              <div class="field full">
                <label class="field-label">Success Indicator / Target <span class="req">*</span></label>
                <textarea v-model="form.target" class="field-input" rows="2" placeholder="Specific target or output..." :readonly="!!editingItem?.formId" :class="editingItem?.formId && 'readonly-input'"></textarea>
              </div>
              <p v-if="editingItem?.formId" class="linked-note">Linked to your IPCRF/CCEF form. KRA and indicator text come from there and cannot be edited here.</p>
              <div class="field full"><label class="field-label">Accomplishment</label><textarea v-model="form.accomplishment" class="field-input" rows="3" placeholder="What was actually accomplished..."></textarea></div>
              <div class="field full"><label class="field-label">Means of Verification</label><textarea v-model="form.movReferences" class="field-input" rows="2" placeholder="Documents, report names, links, or MOV references..."></textarea></div>
              <div class="field"><label class="field-label">Efficiency (E)</label><input v-model="form.ratingEfficiency" type="text" inputmode="decimal" class="field-input" placeholder="e.g. 4.5 or N/A"/></div>
              <div class="field"><label class="field-label">Quality (Q)</label><input v-model="form.ratingQuality" type="text" inputmode="decimal" class="field-input" placeholder="e.g. 5 or N/A"/></div>
              <div class="field"><label class="field-label">Timeliness (T)</label><input v-model="form.ratingTimeliness" type="text" inputmode="decimal" class="field-input" placeholder="e.g. 3.75 or N/A"/></div>
              <div class="field"><label class="field-label">Average</label><input :value="computedAverage || ''" type="text" class="field-input readonly-input" readonly placeholder="Auto"/></div>
              <div class="field full"><label class="field-label">Remarks</label><input v-model="form.remarks" type="text" class="field-input" placeholder="Optional notes..."/></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="closeFormModal">Cancel</button>
            <button class="btn btn-primary" :disabled="saving" @click="saveEntry">
              <span v-if="saving" class="spinner-sm"></span>
              {{ saving ? 'Saving...' : (editingItem ? 'Save Changes' : 'Add Entry') }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

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
import { useConfirm } from '@/composables/useConfirm'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const { confirm } = useConfirm()
const authStore = useAuthStore()
const linkedFormId = computed(() => route.query.formId || '')

const rows = ref([])
const loading = ref(false)
const saving = ref(false)
const search = ref('')
const periodFilter = ref('')
const showViewModal = ref(false)
const showFormModal = ref(false)
const viewItem = ref(null)
const editingItem = ref(null)
const toast = ref({ show: false, msg: '', type: 'success' })

const form = ref(blankForm())
const computedAverage = computed(() => calculateAverage(form.value))

const periodOptions = computed(() => {
  const periods = new Map()
  rows.value.forEach(row => {
    const value = periodKey(row)
    if (!value) return
    periods.set(value, periodLabel(row))
  })
  return Array.from(periods, ([value, label]) => ({ value, label }))
    .sort((a, b) => b.value.localeCompare(a.value))
})

const filteredRows = computed(() => {
  let result = rows.value
  if (periodFilter.value) {
    result = result.filter(row => periodKey(row) === periodFilter.value)
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(row =>
      (row.kraTitle || '').toLowerCase().includes(q) ||
      (row.target || '').toLowerCase().includes(q) ||
      (row.accomplishment || '').toLowerCase().includes(q) ||
      (row.employeeName || '').toLowerCase().includes(q) ||
      periodLabel(row).toLowerCase().includes(q)
    )
  }
  return result
})

onMounted(loadRows)

function blankForm() {
  return {
    kraTitle: '',
    target: '',
    accomplishment: '',
    movReferences: '',
    ratingEfficiency: '',
    ratingQuality: '',
    ratingTimeliness: '',
    ratingAverage: '',
    remarks: ''
  }
}

function initials(name) {
  return (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function avatarColor(name) {
  const colors = ['#2F80ED', '#27AE60', '#E9A840', '#9B59B6', '#EB5757', '#1A56B0']
  return colors[(name || '').length % colors.length] || '#2F80ED'
}

function showToast(msg, type = 'success') {
  toast.value = { show: true, msg, type }
  setTimeout(() => { toast.value.show = false }, 3500)
}

function ratingText(value) {
  return value === '' || value === null || value === undefined ? '---' : value
}

function semesterText(value) {
  const semester = String(value || '').trim()
  if (semester === '1') return 'S1'
  if (semester === '2') return 'S2'
  return semester ? `S${semester}` : ''
}

function periodKey(row) {
  const semester = String(row?.semester || '').trim()
  const year = String(row?.year || '').trim()
  if (!semester && !year) return ''
  return `${year || 'No Year'}-${semester || 'No Semester'}`
}

function periodLabel(row) {
  const semester = semesterText(row?.semester)
  const year = String(row?.year || '').trim()
  if (semester && year) return `${semester} ${year}`
  if (semester) return semester
  if (year) return year
  return 'No period'
}

function ratingFields(source) {
  return [source.ratingEfficiency, source.ratingQuality, source.ratingTimeliness]
    .map(v => String(v ?? '').trim())
    .filter(v => v !== '' && v.toUpperCase() !== 'N/A')
}

function calculateAverage(source) {
  const values = ratingFields(source)
    .map(Number)
    .filter(n => !Number.isNaN(n))
  if (!values.length) return ''
  return Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 100000) / 100000
}

function validateRatings() {
  const invalid = ratingFields(form.value).find(v => {
    const n = Number(v)
    return Number.isNaN(n) || n < 1 || n > 5
  })
  if (!invalid) return true
  showToast('Ratings must be blank, N/A, or a number from 1 to 5', 'error')
  return false
}

function openAddModal() {
  editingItem.value = null
  form.value = blankForm()
  showFormModal.value = true
}

function openEditModal(item) {
  editingItem.value = item
  form.value = {
    ...blankForm(),
    kraTitle: item.kraTitle || '',
    target: item.target || '',
    accomplishment: item.accomplishment || '',
    movReferences: item.movReferences || '',
    ratingEfficiency: item.ratingEfficiency || '',
    ratingQuality: item.ratingQuality || '',
    ratingTimeliness: item.ratingTimeliness || '',
    ratingAverage: item.ratingAverage || '',
    remarks: item.remarks || ''
  }
  showFormModal.value = true
}

function openViewModal(item) {
  viewItem.value = item
  showViewModal.value = true
}

function closeFormModal() {
  showFormModal.value = false
  editingItem.value = null
}

async function loadRows() {
  loading.value = true
  try {
    const response = await accomplishmentsApi.list({
      ...(authStore.profileId ? { userId: authStore.profileId } : {}),
      ...(linkedFormId.value ? { formId: linkedFormId.value } : {})
    })
    rows.value = response?.items || (Array.isArray(response) ? response : [])
  } catch (e) {
    showToast(`Could not load: ${e.message}`, 'error')
  } finally {
    loading.value = false
  }
}

async function saveEntry() {
  if (!form.value.kraTitle || !form.value.target) {
    showToast('KRA name and target are required', 'error')
    return
  }
  if (!validateRatings()) return
  const ok = await confirm({
    type: 'submit',
    title: editingItem.value ? 'Save Ratings Entry' : 'Add Ratings Entry',
    message: editingItem.value
      ? 'This will update the accomplishment, MOV, remarks, and ratings for this entry.'
      : 'This will create a ratings entry that can be used when generating the Ratings sheet.',
    details: [
      { label: 'KRA', value: form.value.kraTitle },
      { label: 'Average', value: computedAverage.value || 'Not rated yet' }
    ],
    confirmLabel: editingItem.value ? 'Save Changes' : 'Add Entry',
    cancelLabel: 'Review Again'
  })
  if (!ok) return

  saving.value = true
  try {
    const payload = { ...form.value, ratingAverage: computedAverage.value }
    if (editingItem.value) {
      const updated = await accomplishmentsApi.update(editingItem.value.id, payload)
      const idx = rows.value.findIndex(row => row.id === editingItem.value.id)
      if (idx !== -1) rows.value[idx] = { ...rows.value[idx], ...updated }
      showToast('Entry updated')
    } else {
      const created = await accomplishmentsApi.create(payload)
      rows.value.unshift(created)
      showToast('Entry added')
    }
    closeFormModal()
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    saving.value = false
  }
}
</script>

<style>
.acc-page { padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif; font-size: 13px; color: #1A2332; min-height: 100%; }
.content-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; padding: 20px; }
.page-hd { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; color: #0F172A; margin: 0 0 3px; letter-spacing: -.3px; }
.page-sub { font-size: 12px; color: #94A3B8; margin: 0; }
.filter-bar { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.filter-select { padding: 7px 28px 7px 11px; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif; color: #0F172A; outline: none; background: #fff; min-width: 135px; }
.filter-select:focus { border-color: #3B82F6; }
.link-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; margin-bottom: 14px; background: #F5F9FF; border: 1px solid #DCE9FB; border-radius: 9px; font-size: 12px; color: #1A56B0; flex-wrap: wrap; }
.readonly-input { background: #F8FAFC; color: #64748B; cursor: not-allowed; }
.linked-note { font-size: 11px; color: #94A3B8; grid-column: span 2; margin: -4px 0 4px; }
.srch-wrap { position: relative; }
.srch-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); pointer-events: none; }
.srch-inp { padding: 7px 11px 7px 28px; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif; color: #0F172A; outline: none; width: 260px; background: #fff; }
.srch-inp:focus { border-color: #3B82F6; }
.acc-table { border: 1px solid #E2E8F0; border-radius: 12px; overflow-x: auto; }
.table-hd, .table-row { display: grid; grid-template-columns: minmax(150px, 1.05fr) minmax(86px, .55fr) minmax(110px, .85fr) minmax(180px, 1.3fr) minmax(180px, 1.3fr) 80px 90px; align-items: center; column-gap: 10px; }
.table-hd { padding: 10px 14px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; }
.th { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .06em; }
.table-row { padding: 10px 14px; border-bottom: 1px solid #F1F5F9; cursor: pointer; transition: background .12s; }
.table-row:last-child { border-bottom: none; }
.table-row:hover { background: #F8FBFF; }
.td { font-size: 12px; color: #374151; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-emp { overflow: visible; white-space: normal; }
.td-act { display: flex; gap: 4px; flex-wrap: wrap; }
.period-pill { display: inline-flex; align-items: center; justify-content: center; padding: 4px 8px; border-radius: 999px; background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; font-size: 11px; font-weight: 700; white-space: nowrap; }
.emp-cell { display: flex; align-items: center; gap: 8px; min-width: 0; }
.emp-meta { min-width: 0; }
.av { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0; }
.emp-name { font-size: 12px; font-weight: 600; color: #0F172A; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.emp-div { font-size: 10px; color: #94A3B8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.text-muted { color: #94A3B8; font-size: 11px; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 64px 0; gap: 8px; }
.empty-title { font-size: 15px; font-weight: 600; color: #374151; margin: 4px 0 0; }
.empty-sub { font-size: 13px; color: #94A3B8; margin: 0 0 8px; }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
.sk-line { background: linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%); background-size: 200%; animation: shimmer 1.4s infinite; border-radius: 4px; height: 12px; display: block; }
.btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; border-radius: 8px; font-size: 12px; cursor: pointer; border: 1px solid #E2E8F0; background: #fff; color: #374151; transition: all .15s; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif; font-weight: 500; }
.btn:hover { border-color: #CBD5E1; background: #F8FAFC; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-primary { background: #0D2137; color: #fff; border-color: #0D2137; }
.btn-primary:hover:not(:disabled) { background: #1e3f61; }
.btn-xs { padding: 4px 9px; font-size: 11px; }
.req { color: #EF4444; font-size: 11px; }
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 16px; backdrop-filter: blur(4px); }
.modal { background: #fff; border-radius: 16px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 24px 64px rgba(0,0,0,.2); overflow: hidden; }
.modal-view { max-width: 560px; }
.modal-form { max-width: 700px; }
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
.view-text { font-size: 13px; color: #1A2332; line-height: 1.6; white-space: pre-wrap; }
.view-4col { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.full { grid-column: span 2; }
.field-label { font-size: 11px; font-weight: 600; color: #374151; }
.field-input { padding: 9px 12px; border: 1.5px solid #E2E8F0; border-radius: 9px; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif; color: #0F172A; background: #fff; outline: none; transition: border-color .15s; resize: vertical; }
.field-input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
.spinner-sm { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }
.toast { position: fixed; bottom: 24px; right: 24px; background: #0F172A; color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,.2); z-index: 9999; pointer-events: none; }
.toast-error { background: #EB5757; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all .25s; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateY(8px); }
</style>
