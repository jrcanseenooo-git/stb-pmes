<template>
  <div class="kra-page" style="padding: 24px 32px 40px;">

    <!-- Header -->
    <div class="page-hd">
      <div>
        <h2 class="page-title">KRA Library</h2>
        <p class="page-sub">Master KRA &amp; Success Indicator List</p>
      </div>
      <button class="btn btn-primary" @click="openAddModal">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        Add KRA
      </button>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <div class="srch-wrap">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" class="srch-icon">
          <circle cx="5.5" cy="5.5" r="4" stroke="#94A3B8" stroke-width="1.3"/>
          <path d="M9 9l2.5 2.5" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <input v-model="search" type="text" class="srch-inp" placeholder="Search KRA name or indicator…"/>
      </div>
      <div class="filter-selects">
        <select v-model="filterPhase" class="filter-select">
          <option value="">All Phases</option>
          <option v-for="p in PHASES" :key="p" :value="p">{{ p }}</option>
        </select>
        <select v-model="filterFnType" class="filter-select">
          <option value="">All Types</option>
          <option value="Core">Core</option>
          <option value="Support">Support</option>
        </select>
        <select v-model="filterClass" class="filter-select">
          <option value="">All Classifications</option>
          <option value="Simple">Simple</option>
          <option value="Complex">Complex</option>
          <option value="Highly Technical">Highly Technical</option>
          <option value="Exempted">Exempted</option>
        </select>
      </div>
    </div>

    <!-- Stats bar -->
    <div v-if="!loading" class="stats-bar">
      <span class="stat-item"><strong>{{ filteredKRAs.length }}</strong> results</span>
      <span class="stat-item"><strong>{{ countByFnType('Core') }}</strong> Core</span>
      <span class="stat-item"><strong>{{ countByFnType('Support') }}</strong> Support</span>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="kra-table">
      <div class="table-hd">
        <div class="th" style="width:160px">Phase</div>
        <div class="th" style="flex:1">KRA / Indicator</div>
        <div class="th" style="width:100px">Type</div>
        <div class="th" style="width:110px">Classification</div>
        <div class="th" style="width:90px">Weights</div>
        <div class="th" style="width:80px">Actions</div>
      </div>
      <div v-for="i in 6" :key="i" class="table-row">
        <div class="sk-line" style="width:100px;height:12px"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">
          <div class="sk-line" style="width:60%;height:13px"></div>
          <div class="sk-line" style="width:80%;height:11px"></div>
        </div>
        <div class="sk-line" style="width:60px;height:12px"></div>
        <div class="sk-line" style="width:80px;height:12px"></div>
        <div class="sk-line" style="width:60px;height:12px"></div>
        <div class="sk-line" style="width:50px;height:12px"></div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="!filteredKRAs.length" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="6" width="32" height="36" rx="3" stroke="#E2E8F0" stroke-width="2"/>
        <path d="M16 16h16M16 22h16M16 28h10" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <p class="empty-title">{{ kras.length === 0 ? 'No KRAs yet' : 'No matching KRAs' }}</p>
      <p class="empty-sub">{{ kras.length === 0 ? 'Click Add KRA to create the first entry.' : 'Try adjusting your filters.' }}</p>
    </div>

    <!-- Table -->
    <div v-else class="kra-table">
      <div class="table-hd">
        <div class="th th-phase">Phase</div>
        <div class="th th-main">KRA / Performance Indicator</div>
        <div class="th th-type">Type</div>
        <div class="th th-class">Classification</div>
        <div class="th th-wt">Weights</div>
        <div class="th th-act">Actions</div>
      </div>
      <div v-for="row in filteredKRAs" :key="row.id" class="table-row" @click="openViewModal(row)">
        <div class="td td-phase">
          <span class="phase-pill">{{ row.phase }}</span>
        </div>
        <div class="td td-main">
          <div class="kra-name">{{ row.kraName }}</div>
          <div class="kra-pi">{{ row.performanceIndicator || row.successIndicator || '' }}</div>
          <div v-if="row.meansOfVerification" class="kra-mov">
            <span class="mov-lbl">MOV:</span> {{ row.meansOfVerification }}
          </div>
        </div>
        <div class="td td-type">
          <span :class="['fn-badge', row.functionType === 'Core' ? 'fn-core' : 'fn-support']">
            {{ row.functionType }}
          </span>
        </div>
        <div class="td td-class">
          <span :class="['class-badge', classStyle(row.classification)]">{{ row.classification }}</span>
        </div>
        <div class="td td-wt">
          <div class="wt-stack">
            <span class="wt-item">II: {{ row.weightII }}%</span>
            <span class="wt-item">III: {{ row.weightIII }}%</span>
            <span class="wt-item">IV: {{ row.weightIV }}%</span>
          </div>
        </div>
        <div class="td td-act" @click.stop>
          <button class="act" @click="openEditModal(row)" title="Edit">
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M8.5 1.5l2 2L4 10H2V8l6.5-6.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="act act-del" @click="confirmRemove(row)" title="Deactivate">
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M2 3h8M5 3V2h2v1M3.5 3v6.5c0 .28.22.5.5.5h4c.28 0 .5-.22.5-.5V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════
         VIEW MODAL
    ══════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showViewModal" class="modal-overlay" @click.self="showViewModal = false">
        <div class="modal modal-view">
          <div class="modal-hd">
            <div>
              <div class="modal-hd-badges">
                <span :class="['fn-badge', viewItem?.functionType === 'Core' ? 'fn-core' : 'fn-support']">{{ viewItem?.functionType }}</span>
                <span :class="['class-badge', classStyle(viewItem?.classification)]">{{ viewItem?.classification }}</span>
                <span class="phase-pill">{{ viewItem?.phase }}</span>
              </div>
              <h3 class="modal-title" style="margin-top:8px">{{ viewItem?.kraName }}</h3>
            </div>
            <button class="modal-close" @click="showViewModal = false">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body" v-if="viewItem">
            <div class="view-section">
              <div class="view-label">Performance Indicator</div>
              <div class="view-text">{{ viewItem.performanceIndicator || '—' }}</div>
            </div>
            <div class="view-section">
              <div class="view-label">Means of Verification</div>
              <div class="view-text">{{ viewItem.meansOfVerification || '—' }}</div>
            </div>
            <div class="view-2col">
              <div class="view-section">
                <div class="view-label">Applicable To</div>
                <div class="view-text">{{ viewItem.applicableTo || 'BOTH' }}</div>
              </div>
              <div class="view-section">
                <div class="view-label">Weights (II / III / IV)</div>
                <div class="view-text">{{ viewItem.weightII }}% / {{ viewItem.weightIII }}% / {{ viewItem.weightIV }}%</div>
              </div>
            </div>
            <div v-if="viewItem.efficiencyGuide" class="view-section">
              <div class="view-label">Efficiency Guide</div>
              <div class="view-guide">{{ viewItem.efficiencyGuide }}</div>
            </div>
            <div v-if="viewItem.qualityGuide" class="view-section">
              <div class="view-label">Quality Guide</div>
              <div class="view-guide">{{ viewItem.qualityGuide }}</div>
            </div>
            <div v-if="viewItem.timelinessGuide" class="view-section">
              <div class="view-label">Timeliness Guide</div>
              <div class="view-guide">{{ viewItem.timelinessGuide }}</div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showViewModal = false">Close</button>
            <button class="btn btn-primary" @click="openEditModal(viewItem); showViewModal = false">Edit</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- ══════════════════════════════════
         ADD / EDIT MODAL
    ══════════════════════════════════ -->
    <teleport to="body">
      <div v-if="showFormModal" class="modal-overlay" @click.self="closeFormModal">
        <div class="modal modal-form">
          <div class="modal-hd">
            <div class="modal-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/>
                <path d="M6 7h6M6 10h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <h3 class="modal-title">{{ editingItem ? 'Edit KRA Entry' : 'Add KRA Entry' }}</h3>
              <p class="modal-sub">Master KRA Library</p>
            </div>
            <button class="modal-close" @click="closeFormModal">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field">
                <label class="field-label">Phase <span class="req">*</span></label>
                <select v-model="form.phase" class="field-input">
                  <option value="">Select phase…</option>
                  <option v-for="p in PHASES" :key="p" :value="p">{{ p }}</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Function Type <span class="req">*</span></label>
                <select v-model="form.functionType" class="field-input">
                  <option value="Core">Core</option>
                  <option value="Support">Support</option>
                </select>
              </div>
              <div class="field full">
                <label class="field-label">KRA Name <span class="req">*</span></label>
                <input v-model="form.kraName" type="text" class="field-input" placeholder="e.g. Research"/>
              </div>
              <div class="field">
                <label class="field-label">Classification <span class="req">*</span></label>
                <select v-model="form.classification" class="field-input">
                  <option value="Simple">Simple</option>
                  <option value="Complex">Complex</option>
                  <option value="Highly Technical">Highly Technical</option>
                  <option value="Exempted">Exempted</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Applicable To</label>
                <select v-model="form.applicableTo" class="field-input">
                  <option value="BOTH">Both Semesters</option>
                  <option value="S1">1st Semester Only</option>
                  <option value="S2">2nd Semester Only</option>
                </select>
              </div>
              <div class="field full">
                <label class="field-label">Performance Indicator <span class="req">*</span></label>
                <textarea v-model="form.performanceIndicator" class="field-input" rows="3" placeholder="Describe the specific target output…"></textarea>
              </div>
              <div class="field full">
                <label class="field-label">Means of Verification</label>
                <input v-model="form.meansOfVerification" type="text" class="field-input" placeholder="e.g. Approved report with memo endorsement"/>
              </div>
            </div>

            <div class="field-section-label">Weights per Position Level</div>
            <div class="form-grid">
              <div class="field">
                <label class="field-label">Weight II (%)</label>
                <input v-model.number="form.weightII" type="number" class="field-input" min="0" max="100"/>
              </div>
              <div class="field">
                <label class="field-label">Weight III (%)</label>
                <input v-model.number="form.weightIII" type="number" class="field-input" min="0" max="100"/>
              </div>
              <div class="field">
                <label class="field-label">Weight IV (%)</label>
                <input v-model.number="form.weightIV" type="number" class="field-input" min="0" max="100"/>
              </div>
            </div>

            <div class="field-section-label">Rating Guides <span class="field-label-opt">(optional)</span></div>
            <div class="form-grid">
              <div class="field full">
                <label class="field-label">Efficiency Guide</label>
                <textarea v-model="form.efficiencyGuide" class="field-input" rows="3" placeholder="5: …&#10;4: …&#10;3: …"></textarea>
              </div>
              <div class="field full">
                <label class="field-label">Quality Guide</label>
                <textarea v-model="form.qualityGuide" class="field-input" rows="3" placeholder="5: …&#10;4: …&#10;3: …"></textarea>
              </div>
              <div class="field full">
                <label class="field-label">Timeliness Guide</label>
                <textarea v-model="form.timelinessGuide" class="field-input" rows="3" placeholder="5: …&#10;4: …&#10;3: …"></textarea>
              </div>
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

    <!-- Confirm deactivate -->
    <teleport to="body">
      <div v-if="confirmDel.show" class="modal-overlay">
        <div class="confirm-box">
          <div class="cb-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 6h16M8 6V4h6v2M5 6v13a2 2 0 002 2h8a2 2 0 002-2V6" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="cb-title">Deactivate Entry?</div>
          <div class="cb-msg">
            Deactivate <strong>{{ confirmDel.name }}</strong>?<br>
            <span class="muted-text" style="font-size:11px">It will no longer appear in the KRA Library picker.</span>
          </div>
          <div class="cb-btns">
            <button class="btn" @click="confirmDel.show = false">Cancel</button>
            <button class="btn btn-danger" :disabled="removing" @click="doRemove">
              {{ removing ? 'Removing…' : 'Deactivate' }}
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
import { kraLibrary as kraLibraryApi } from '@/services/api'

const PHASES = ['ANALYSIS', 'DESIGN', 'TESTING', 'PILOT IMPLEMENTATION', 'EVALUATION', 'SUPPORT', 'PROMOTION']

// ── State ──
const kras        = ref([])
const loading     = ref(false)
const saving      = ref(false)
const removing    = ref(false)
const search      = ref('')
const filterPhase  = ref('')
const filterFnType = ref('')
const filterClass  = ref('')

const showViewModal = ref(false)
const showFormModal = ref(false)
const viewItem      = ref(null)
const editingItem   = ref(null)
const confirmDel    = ref({ show: false, id: null, name: '' })
const toast         = ref({ show: false, msg: '', type: 'success' })

const emptyForm = () => ({
  phase: '', functionType: 'Core', kraName: '', classification: 'Complex',
  performanceIndicator: '', meansOfVerification: '', applicableTo: 'BOTH',
  weightII: 0, weightIII: 0, weightIV: 0,
  efficiencyGuide: '', qualityGuide: '', timelinessGuide: ''
})

const form = ref(emptyForm())

// ── Computed ──
const filteredKRAs = computed(() => {
  let rows = kras.value
  if (search.value) {
    const q = search.value.toLowerCase()
    rows = rows.filter(r =>
      r.kraName?.toLowerCase().includes(q) ||
      (r.performanceIndicator || '').toLowerCase().includes(q)
    )
  }
  if (filterPhase.value)  rows = rows.filter(r => r.phase        === filterPhase.value)
  if (filterFnType.value) rows = rows.filter(r => r.functionType === filterFnType.value)
  if (filterClass.value)  rows = rows.filter(r => r.classification === filterClass.value)
  return rows
})

// ── Helpers ──
function countByFnType(type) { return kras.value.filter(r => r.functionType === type).length }

function classStyle(c) {
  if (c === 'Simple')          return 'class-simple'
  if (c === 'Complex')         return 'class-complex'
  if (c === 'Highly Technical') return 'class-ht'
  return 'class-exempt'
}

function showToast(msg, type = 'success') {
  toast.value = { show: true, msg, type }
  setTimeout(() => { toast.value.show = false }, 3500)
}

// ── Actions ──
function openAddModal() {
  editingItem.value = null
  form.value = emptyForm()
  showFormModal.value = true
}

function openEditModal(item) {
  editingItem.value = item
  form.value = {
    phase:                item.phase || '',
    functionType:         item.functionType || 'Core',
    kraName:              item.kraName || '',
    classification:       item.classification || 'Complex',
    performanceIndicator: item.performanceIndicator || '',
    meansOfVerification:  item.meansOfVerification || '',
    applicableTo:         item.applicableTo || 'BOTH',
    weightII:             Number(item.weightII)  || 0,
    weightIII:            Number(item.weightIII) || 0,
    weightIV:             Number(item.weightIV)  || 0,
    efficiencyGuide:      item.efficiencyGuide  || '',
    qualityGuide:         item.qualityGuide     || '',
    timelinessGuide:      item.timelinessGuide  || ''
  }
  showFormModal.value = true
}

function openViewModal(item) {
  viewItem.value = item
  showViewModal.value = true
}

function closeFormModal() {
  showFormModal.value = false
  editingItem.value   = null
}

function confirmRemove(item) {
  confirmDel.value = { show: true, id: item.id, name: item.kraName }
}

// ── API ──
onMounted(loadKRAs)

async function loadKRAs() {
  loading.value = true
  try {
    const r = await kraLibraryApi.list()
    kras.value = r?.items || (Array.isArray(r) ? r : [])
  } catch (e) {
    showToast(`Could not load KRA library: ${e.message}`, 'error')
  } finally {
    loading.value = false
  }
}

async function saveEntry() {
  if (!form.value.phase || !form.value.kraName || !form.value.performanceIndicator) {
    showToast('Phase, KRA name and performance indicator are required', 'error')
    return
  }
  saving.value = true
  try {
    if (editingItem.value) {
      const u = await kraLibraryApi.update(editingItem.value.id, form.value)
      const i = kras.value.findIndex(r => r.id === editingItem.value.id)
      if (i !== -1) kras.value[i] = { ...kras.value[i], ...u }
      showToast('KRA entry updated')
    } else {
      const created = await kraLibraryApi.create(form.value)
      kras.value.unshift(created)
      showToast('KRA entry added')
    }
    closeFormModal()
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    saving.value = false
  }
}

async function doRemove() {
  removing.value = true
  try {
    await kraLibraryApi.delete(confirmDel.value.id)
    kras.value = kras.value.filter(r => r.id !== confirmDel.value.id)
    showToast('Entry deactivated')
    confirmDel.value.show = false
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    removing.value = false
  }
}
</script>

<style>
.kra-page { padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif; font-size: 13px; color: #1A2332; min-height: 100%; }
.muted-text { color: #94A3B8; }
.req { color: #EF4444; font-size: 11px; }

/* Header */
.page-hd { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; color: #0F172A; margin: 0 0 3px; letter-spacing: -.3px; }
.page-sub { font-size: 12px; color: #94A3B8; margin: 0; }

/* Filters */
.filter-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.srch-wrap { flex: 1; position: relative; min-width: 220px; max-width: 360px; }
.srch-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; }
.srch-inp { width: 100%; padding: 8px 11px 8px 30px; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 12px; font-family: inherit; color: #0F172A; outline: none; background: #fff; }
.srch-inp:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
.filter-selects { display: flex; gap: 6px; }
.filter-select { padding: 7px 10px; border: 1px solid #E2E8F0; border-radius: 7px; font-size: 12px; font-family: inherit; color: #374151; background: #fff; outline: none; cursor: pointer; }
.filter-select:focus { border-color: #3B82F6; }

/* Stats bar */
.stats-bar { display: flex; gap: 16px; margin-bottom: 12px; }
.stat-item { font-size: 12px; color: #64748B; }
.stat-item strong { color: #0F172A; }

/* Table */
.kra-table { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; }
.table-hd { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; }
.th { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .06em; }
.th-phase { width: 120px; flex-shrink: 0; }
.th-main { flex: 1; }
.th-type { width: 80px; flex-shrink: 0; }
.th-class { width: 120px; flex-shrink: 0; }
.th-wt { width: 90px; flex-shrink: 0; }
.th-act { width: 64px; flex-shrink: 0; }

.table-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #F1F5F9; cursor: pointer; transition: background .12s; }
.table-row:last-child { border-bottom: none; }
.table-row:hover { background: #F8FBFF; }

.td { font-size: 12px; color: #374151; }
.td-phase { width: 120px; flex-shrink: 0; padding-top: 2px; }
.td-main { flex: 1; min-width: 0; }
.td-type { width: 80px; flex-shrink: 0; padding-top: 2px; }
.td-class { width: 120px; flex-shrink: 0; padding-top: 2px; }
.td-wt { width: 90px; flex-shrink: 0; padding-top: 2px; }
.td-act { width: 64px; flex-shrink: 0; display: flex; gap: 3px; padding-top: 2px; }

/* KRA cell */
.kra-name { font-size: 12px; font-weight: 600; color: #0F172A; margin-bottom: 3px; }
.kra-pi { font-size: 11px; color: #475569; line-height: 1.55; margin-bottom: 4px; }
.kra-mov { font-size: 11px; color: #94A3B8; }
.mov-lbl { font-weight: 600; color: #64748B; }

/* Phase pill */
.phase-pill { display: inline-flex; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; background: #F1F5F9; color: #475569; }

/* Function type badge */
.fn-badge { display: inline-flex; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; }
.fn-core { background: #EBF4FF; color: #1A56B0; }
.fn-support { background: #F3EEFF; color: #6B3FA0; }

/* Classification badge */
.class-badge { display: inline-flex; padding: 2px 7px; border-radius: 6px; font-size: 10px; font-weight: 500; }
.class-simple { background: #F0FDF4; color: #15803D; }
.class-complex { background: #FEF3E2; color: #B45309; }
.class-ht { background: #FEF2F2; color: #B91C1C; }
.class-exempt { background: #F8FAFC; color: #64748B; }

/* Weight stack */
.wt-stack { display: flex; flex-direction: column; gap: 2px; }
.wt-item { font-size: 10px; color: #64748B; }

/* Action buttons */
.act { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; border: 1px solid transparent; background: transparent; cursor: pointer; color: #94A3B8; transition: all .12s; }
.act:hover { background: #F1F5F9; border-color: #E2E8F0; color: #475569; }
.act-del:hover { background: #FEF2F2; border-color: #FCA5A5; color: #EF4444; }

/* Empty */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 20px; gap: 8px; }
.empty-title { font-size: 15px; font-weight: 600; color: #374151; margin: 4px 0 0; }
.empty-sub { font-size: 13px; color: #94A3B8; margin: 0 0 8px; }

/* Skeleton */
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
.sk-line { background: linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%); background-size: 200%; animation: shimmer 1.4s infinite; border-radius: 4px; display: block; }

/* Buttons */
.btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; border-radius: 8px; font-size: 12px; cursor: pointer; border: 1px solid #E2E8F0; background: #fff; color: #374151; transition: all .15s; font-family: inherit; font-weight: 500; }
.btn:hover { border-color: #CBD5E1; background: #F8FAFC; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-primary { background: #0D2137; color: #fff; border-color: #0D2137; }
.btn-primary:hover:not(:disabled) { background: #1e3f61; border-color: #1e3f61; }
.btn-danger { background: #EF4444; color: #fff; border-color: #EF4444; }
.btn-danger:hover { background: #DC2626; }
.btn-sm { padding: 5px 12px; font-size: 11px; }

/* Modal overlay */
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 16px; backdrop-filter: blur(4px); }

/* Modal base */
.modal { background: #fff; border-radius: 16px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 24px 64px rgba(0,0,0,.2); overflow: hidden; }
.modal-view { max-width: 640px; }
.modal-form { max-width: 680px; }
.modal-hd { display: flex; align-items: flex-start; gap: 12px; padding: 20px 24px 16px; border-bottom: 1px solid #F1F5F9; background: #FAFBFF; flex-shrink: 0; }
.modal-hd-badges { display: flex; gap: 6px; margin-bottom: 4px; }
.modal-icon { width: 36px; height: 36px; border-radius: 10px; background: #EBF4FF; color: #2F80ED; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.modal-title { font-size: 15px; font-weight: 700; color: #0F172A; margin: 0 0 2px; }
.modal-sub { font-size: 12px; color: #94A3B8; margin: 0; }
.modal-close { margin-left: auto; background: none; border: none; cursor: pointer; padding: 6px; border-radius: 8px; color: #94A3B8; transition: all .15s; }
.modal-close:hover { background: #F1F5F9; color: #374151; }
.modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 24px; border-top: 1px solid #F1F5F9; background: #F8FAFC; flex-shrink: 0; }

/* View modal */
.view-section { margin-bottom: 16px; }
.view-label { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 5px; }
.view-text { font-size: 13px; color: #1A2332; line-height: 1.6; }
.view-guide { font-size: 12px; color: #475569; line-height: 1.7; white-space: pre-line; background: #F8FAFC; border: 1px solid #F1F5F9; border-radius: 7px; padding: 8px 12px; }
.view-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

/* Form fields */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.full { grid-column: span 2; }
.field-label { font-size: 11px; font-weight: 600; color: #374151; }
.field-input { padding: 9px 12px; border: 1.5px solid #E2E8F0; border-radius: 9px; font-size: 13px; font-family: inherit; color: #0F172A; background: #fff; outline: none; transition: border-color .15s; resize: vertical; }
.field-input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
.field-input::placeholder { color: #CBD5E1; }
.field-section-label { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 10px; }
.field-label-opt { font-weight: 400; text-transform: none; letter-spacing: 0; color: #CBD5E1; font-size: 10px; }

/* Confirm delete */
.confirm-box { background: #fff; border-radius: 16px; padding: 28px 26px; max-width: 360px; width: calc(100% - 32px); text-align: center; box-shadow: 0 24px 64px rgba(0,0,0,.2); }
.cb-icon { width: 48px; height: 48px; border-radius: 14px; background: #FEF2F2; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
.cb-title { font-size: 15px; font-weight: 700; color: #0F172A; margin-bottom: 7px; }
.cb-msg { font-size: 12px; color: #475569; line-height: 1.65; margin-bottom: 20px; }
.cb-btns { display: flex; justify-content: center; gap: 8px; }

/* Spinner */
.spinner-sm { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }

/* Toast */
.toast { position: fixed; bottom: 24px; right: 24px; background: #0F172A; color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,.2); z-index: 9999; pointer-events: none; }
.toast-error { background: #EB5757; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all .25s; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateY(8px); }
</style>