<template>
  <div class="acc-page">
    <div class="tp-shell">

      <!-- ═══ LEFT PANEL ═══ -->
      <div class="tp-left">
        <div class="acc-left-inner">
          <div class="page-hd">
            <div>
              <h2 class="page-title">Accomplishments</h2>
              <p class="page-sub">IPCRF / CCEF ratings entry source</p>
            </div>
            <!-- <button class="btn btn-primary" @click="openAddModal">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
              New Entry
            </button> -->
          </div>

          <div v-if="linkedFormId" class="link-banner">
            <span>Showing Ratings entries for your IPCRF/CCEF form.</span>
            <button class="btn btn-sm" @click="router.push('/ipcrf')">Back to Forms</button>
          </div>

          <div class="filter-bar">
            <select v-model="periodFilter" class="filter-select filter-period">
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

          <!-- Skeleton -->
          <div v-if="loading" class="acc-list">
            <div v-for="i in 5" :key="i" class="ali ali-sk">
              <div class="sk-line" style="width:55%;margin-bottom:7px"></div>
              <div class="sk-line" style="width:40%;margin-bottom:5px"></div>
              <div class="sk-line" style="width:70%"></div>
            </div>
          </div>

          <!-- Empty -->
          <div v-else-if="!filteredRows.length" class="empty-state">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="6" width="32" height="36" rx="3" stroke="#E2E8F0" stroke-width="2"/>
              <path d="M16 16h16M16 22h16M16 28h10" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <p class="empty-title">{{ rows.length === 0 ? 'No entries yet' : 'No matching entries' }}</p>
            <p class="empty-sub">{{ rows.length === 0 ? 'Create or select IPCRF/CCEF targets first.' : 'Try adjusting your search.' }}</p>
          </div>

          <!-- List -->
          <div v-else class="acc-list">
            <div
              v-for="row in filteredRows"
              :key="row.id"
              :class="['ali', selectedRow?.id === row.id && 'ali-active']"
              @click="selectedRow = row"
            >
              <div class="ali-top">
                <div class="ali-kra">{{ row.kraTitle || '---' }}</div>
                <div class="ali-badges">
                  <span v-if="row.functionType" :class="['fn-badge', fnBadgeClass(row.functionType)]">{{ row.functionType }}</span>
                  <span class="period-pill">{{ periodLabel(row) }}</span>
                </div>
              </div>
              <div class="ali-emp">
                <div class="av" :style="{ background: avatarColor(row.employeeName) }">{{ initials(row.employeeName) }}</div>
                <span class="ali-name">{{ row.employeeName }}</span>
                <span class="ali-div">· {{ row.divisionName || row.division || '---' }}</span>
              </div>
              <div class="ali-target">{{ row.target || '---' }}</div>
              <div class="ali-foot">
                <span v-if="row.ratingAverage" class="ali-score">Avg: {{ row.ratingAverage }}</span>
                <span v-else class="ali-no-rating">Not yet rated</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ RIGHT PANEL ═══ -->
      <div class="tp-right">
        <div v-if="!selectedRow" class="rp-empty">
          <svg width="52" height="52" viewBox="0 0 48 48" fill="none">
            <rect x="8" y="6" width="32" height="36" rx="3" stroke="#E2E8F0" stroke-width="2"/>
            <path d="M16 16h16M16 22h10" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p class="rp-empty-title">Select an entry</p>
          <p class="rp-empty-sub">Click any entry from the list to view its details</p>
        </div>

        <template v-else>
          <div class="rp-hd">
            <div class="rp-hd-info">
              <div class="rp-title">{{ selectedRow.kraTitle || '---' }}</div>
              <div class="rp-sub">
                {{ selectedRow.employeeName }}
                <span class="rp-sub-dot">·</span>
                {{ periodLabel(selectedRow) }}
                <span v-if="selectedRow.divisionName || selectedRow.division" class="rp-sub-dot">·</span>
                {{ selectedRow.divisionName || selectedRow.division || '' }}
              </div>
            </div>
            <div class="rp-hd-actions">
              <span v-if="saveChipText" :class="['save-chip', `save-${saveState}`]" @click="saveState === 'error' && flushSave()">
                <span v-if="saveState === 'saving'" class="spinner-xs"></span>
                {{ saveChipText }}
              </span>
              <button class="btn btn-primary btn-sm" @click="openEditModal(selectedRow)">Edit</button>
            </div>
          </div>

          <div class="rp-body">
            <div class="det-section">
              <div class="det-label">Target / Success Indicator</div>
              <div class="det-text">{{ selectedRow.target || '---' }}</div>
            </div>

            <div class="det-section">
              <div class="det-label">Accomplishment <span class="inline-hint">auto-saves</span></div>
              <textarea
                v-model="draft.accomplishment"
                :class="['inline-ta', isDirty('accomplishment') && 'inline-dirty']"
                placeholder="What was actually accomplished..."
                @input="onFieldInput($event)"
                @blur="flushSave()"
                @keydown.esc="revertField('accomplishment', $event)"
              ></textarea>
            </div>

            <div class="det-section">
              <div class="det-label">Means of Verification <span class="inline-hint">auto-saves</span></div>
              <textarea
                v-model="draft.movReferences"
                :class="['inline-ta', 'inline-ta-sm', isDirty('movReferences') && 'inline-dirty']"
                placeholder="Documents, report names, links, or MOV references..."
                @input="onFieldInput($event)"
                @blur="flushSave()"
                @keydown.esc="revertField('movReferences', $event)"
              ></textarea>
            </div>

            <div class="det-ratings">
              <div class="det-rating-item">
                <div class="det-label">Efficiency</div>
                <input v-model.number="draft.ratingEfficiency" type="number" min="1" max="5" step="0.01"
                  :class="['det-score-input', isDirty('ratingEfficiency') && 'inline-dirty']" placeholder="-"
                  @input="onFieldInput($event)" @blur="onRatingBlur('ratingEfficiency')"
                  @keydown.esc="revertField('ratingEfficiency', $event)"/>
              </div>
              <div class="det-rating-item">
                <div class="det-label">Quality</div>
                <input v-model.number="draft.ratingQuality" type="number" min="1" max="5" step="0.01"
                  :class="['det-score-input', isDirty('ratingQuality') && 'inline-dirty']" placeholder="-"
                  @input="onFieldInput($event)" @blur="onRatingBlur('ratingQuality')"
                  @keydown.esc="revertField('ratingQuality', $event)"/>
              </div>
              <div class="det-rating-item">
                <div class="det-label">Timeliness</div>
                <input v-model.number="draft.ratingTimeliness" type="number" min="1" max="5" step="0.01"
                  :class="['det-score-input', isDirty('ratingTimeliness') && 'inline-dirty']" placeholder="-"
                  @input="onFieldInput($event)" @blur="onRatingBlur('ratingTimeliness')"
                  @keydown.esc="revertField('ratingTimeliness', $event)"/>
              </div>
              <div class="det-rating-item det-avg">
                <div class="det-label">Average <span class="eqt-hint">auto</span></div>
                <div class="det-score det-score-avg">{{ draftAverage || '---' }}</div>
              </div>
            </div>

            <div class="det-section">
              <div class="det-label">Remarks <span class="inline-hint">auto-saves</span></div>
              <textarea
                v-model="draft.remarks"
                :class="['inline-ta', 'inline-ta-sm', isDirty('remarks') && 'inline-dirty']"
                placeholder="Optional notes..."
                @input="onFieldInput($event)"
                @blur="flushSave()"
                @keydown.esc="revertField('remarks', $event)"
              ></textarea>
            </div>
          </div>
        </template>
      </div>

    </div>

    <!-- ═══ EDIT / ADD MODAL ═══ -->
    <teleport to="body">
      <div v-if="showFormModal" class="modal-overlay">
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
              <div class="field"><label class="field-label">Efficiency (E) <span class="eqt-hint">1 - 5</span></label><input v-model.number="form.ratingEfficiency" type="number" min="1" max="5" step="0.01" class="field-input" placeholder="1 - 5" @blur="clampRating('ratingEfficiency')"/></div>
              <div class="field"><label class="field-label">Quality (Q) <span class="eqt-hint">1 - 5</span></label><input v-model.number="form.ratingQuality" type="number" min="1" max="5" step="0.01" class="field-input" placeholder="1 - 5" @blur="clampRating('ratingQuality')"/></div>
              <div class="field"><label class="field-label">Timeliness (T) <span class="eqt-hint">1 - 5</span></label><input v-model.number="form.ratingTimeliness" type="number" min="1" max="5" step="0.01" class="field-input" placeholder="1 - 5" @blur="clampRating('ratingTimeliness')"/></div>
              <div class="field"><label class="field-label">Average <span class="eqt-hint">auto-computed</span></label><input :value="computedAverage || ''" type="text" class="field-input readonly-input" readonly placeholder="-"/></div>
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
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
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
const showFormModal = ref(false)
const viewItem = ref(null)
const editingItem = ref(null)
const selectedRow = ref(null)
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

onMounted(() => {
  loadRows()
  window.addEventListener('beforeunload', onBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  flushSave()
})

// ── Inline editing / autosave (right panel) ──
const AUTOSAVE_FIELDS = ['accomplishment', 'movReferences', 'ratingEfficiency', 'ratingQuality', 'ratingTimeliness', 'remarks']
const RATING_KEYS = ['ratingEfficiency', 'ratingQuality', 'ratingTimeliness']

const draft = ref(blankDraft())
const saveState = ref('idle')   // idle | dirty | saving | saved | error
const savedAt = ref(null)
let saveTimer = null
let saveInFlight = false
let saveQueued = false

const draftAverage = computed(() => calculateAverage(draft.value))

const saveChipText = computed(() => {
  if (saveState.value === 'saving') return 'Saving…'
  if (saveState.value === 'dirty') return 'Unsaved changes'
  if (saveState.value === 'error') return 'Save failed - click to retry'
  if (saveState.value === 'saved' && savedAt.value) {
    return `Saved ${savedAt.value.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`
  }
  return ''
})

watch(selectedRow, (newRow, oldRow) => {
  if (newRow?.id === oldRow?.id) return
  if (oldRow) flushSave(oldRow)
  loadDraft(newRow)
})

function blankDraft() {
  return { accomplishment: '', movReferences: '', ratingEfficiency: '', ratingQuality: '', ratingTimeliness: '', remarks: '' }
}

function loadDraft(row) {
  const d = blankDraft()
  AUTOSAVE_FIELDS.forEach(k => { d[k] = row?.[k] ?? '' })
  draft.value = d
  saveState.value = 'idle'
  nextTick(resizeAllTextareas)
}

function isDirty(field) {
  return String(draft.value[field] ?? '') !== String(selectedRow.value?.[field] ?? '')
}

function buildPatch(row) {
  const patch = {}
  AUTOSAVE_FIELDS.forEach(k => {
    if (String(draft.value[k] ?? '') !== String(row?.[k] ?? '')) patch[k] = draft.value[k]
  })
  if (RATING_KEYS.some(k => k in patch)) {
    patch.ratingAverage = calculateAverage(draft.value)
  }
  return patch
}

function onFieldInput(e) {
  if (e?.target?.tagName === 'TEXTAREA') autoGrow(e.target)
  saveState.value = 'dirty'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => flushSave(), 1200)
}

function onRatingBlur(field) {
  clampDraftRating(field)
  flushSave()
}

function clampDraftRating(field) {
  const v = draft.value[field]
  if (v === '' || v === null || v === undefined) return
  const n = Number(v)
  if (isNaN(n)) { draft.value[field] = ''; return }
  if (n < 1) draft.value[field] = 1
  else if (n > 5) draft.value[field] = 5
}

function revertField(field, e) {
  draft.value[field] = selectedRow.value?.[field] ?? ''
  if (e?.target?.tagName === 'TEXTAREA') nextTick(() => autoGrow(e.target))
  saveState.value = Object.keys(buildPatch(selectedRow.value)).length ? 'dirty' : 'idle'
}

async function flushSave(row = selectedRow.value, isRetry = false) {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  if (!row?.id) return
  const patch = buildPatch(row)
  if (!Object.keys(patch).length) {
    if (saveState.value === 'dirty') saveState.value = 'idle'
    return
  }
  if (saveInFlight) { saveQueued = true; return }
  saveInFlight = true
  saveState.value = 'saving'
  try {
    const updated = await accomplishmentsApi.update(row.id, patch)
    const merged = { ...row, ...patch, ...(updated || {}) }
    const idx = rows.value.findIndex(r => r.id === row.id)
    if (idx !== -1) rows.value[idx] = { ...rows.value[idx], ...merged }
    if (selectedRow.value?.id === row.id) selectedRow.value = { ...selectedRow.value, ...merged }
    savedAt.value = new Date()
    if (saveState.value === 'saving') saveState.value = 'saved'
  } catch (e) {
    if (!isRetry) {
      // One silent retry for transient failures before bothering the user
      setTimeout(() => flushSave(row, true), 1500)
    } else {
      saveState.value = 'error'
      console.error(e); showToast('Auto-save failed. Please try again.', 'error')
    }
  } finally {
    saveInFlight = false
    if (saveQueued) { saveQueued = false; flushSave() }
  }
}

function autoGrow(el) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

function resizeAllTextareas() {
  document.querySelectorAll('.inline-ta').forEach(autoGrow)
}

function onBeforeUnload(e) {
  if (saveState.value === 'dirty' || saveState.value === 'saving' || saveTimer) {
    e.preventDefault()
    e.returnValue = ''
  }
}

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
  return (name || '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase()
}

function avatarColor(name) {
  const colors = ['#2F80ED', '#27AE60', '#E9A840', '#9B59B6', '#EB5757', '#1A56B0']
  return colors[(name || '').length % colors.length] || '#2F80ED'
}

function fnBadgeClass(type) {
  if (type === 'Core')    return 'fn-core'
  if (type === 'Support') return 'fn-support'
  return ''
}

function clampRating(field) {
  const v = form.value[field]
  if (v === '' || v === null || v === undefined) return
  const n = Number(v)
  if (isNaN(n)) { form.value[field] = ''; return }
  if (n < 1) form.value[field] = 1
  else if (n > 5) form.value[field] = 5
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
    console.error(e); showToast('Could not load accomplishments. Please try again.', 'error')
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
      if (selectedRow.value?.id === editingItem.value.id) {
        selectedRow.value = { ...selectedRow.value, ...updated }
        loadDraft(selectedRow.value)
      }
      showToast('Entry updated')
    } else {
      const created = await accomplishmentsApi.create(payload)
      rows.value.unshift(created)
      selectedRow.value = created
      showToast('Entry added')
    }
    closeFormModal()
  } catch (e) {
    console.error(e); showToast('Something went wrong. Please try again.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.acc-page { padding: 0; font-size: 13px; color: #1A2332; min-height: 100%; }

/* Two-panel shell */
.tp-shell { display: flex; background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; overflow: hidden; min-height: 520px; }
.tp-left { width: 680px; flex-shrink: 0; border-right: 1px solid #E2E8F0; display: flex; flex-direction: column; overflow-x: hidden; overflow-y: auto; max-height: 82vh; scrollbar-width: thin; scrollbar-color: #E2E8F0 transparent; }
.tp-left::-webkit-scrollbar { width: 4px; }
.tp-left::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
.tp-right { flex: 1; min-width: 0; overflow-y: auto; max-height: 82vh; background: #F4F7FB; scrollbar-width: thin; scrollbar-color: #E2E8F0 transparent; }
.tp-right::-webkit-scrollbar { width: 4px; }
.tp-right::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
.acc-left-inner { padding: 20px; display: flex; flex-direction: column; flex: 1; }

/* Header */
.page-hd { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; gap: 10px; }
.page-title { font-size: 18px; font-weight: 700; color: #0F172A; margin: 0 0 2px; letter-spacing: -.3px; }
.page-sub { font-size: 11px; color: #94A3B8; margin: 0; }

/* Filters */
.filter-bar { display: flex; flex-direction: row; flex-wrap: nowrap; align-items: center; gap: 8px; margin-bottom: 12px; }
.filter-period { flex-shrink: 0; }
.filter-select { padding: 6px 10px; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 12px; color: #0F172A; outline: none; background: #fff; }
.filter-select:focus { border-color: #3B82F6; }
.link-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; margin-bottom: 12px; background: #F5F9FF; border: 1px solid #DCE9FB; border-radius: 9px; font-size: 12px; color: #1A56B0; flex-wrap: wrap; }
.srch-wrap { position: relative; flex: 1; min-width: 120px; max-width: 200px; }
.srch-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); pointer-events: none; }
.srch-inp { width: 100%; padding: 6px 11px 6px 28px; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 12px; color: #0F172A; outline: none; background: #fff; }
.srch-inp:focus { border-color: #3B82F6; }

/* List items */
.acc-list { display: flex; flex-direction: column; }
.ali { padding: 14px 18px; border-bottom: 1px solid #F1F5F9; cursor: pointer; transition: background .12s; display: flex; flex-direction: column; gap: 7px; }
.ali:last-child { border-bottom: none; }
.ali:hover { background: #F8FBFF; }
.ali-active { background: #EFF6FF !important; border-left: 3px solid #1A56B0; padding-left: 15px; }
.ali-sk { pointer-events: none; }
.ali-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.ali-kra { font-size: 13.5px; font-weight: 700; color: #0F172A; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3; }
.ali-badges { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.fn-badge { font-size: 9.5px; font-weight: 700; border-radius: 20px; padding: 2px 7px; letter-spacing: .02em; text-transform: uppercase; }
.eqt-hint { font-size: 10px; font-weight: 500; color: #94A3B8; margin-left: 4px; text-transform: none; letter-spacing: 0; }
.fn-core { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }
.fn-support { background: #FFF7ED; color: #C2410C; border: 1px solid #FED7AA; }
.ali-emp { display: flex; align-items: center; gap: 6px; }
.ali-name { font-size: 12px; color: #374151; font-weight: 500; }
.ali-div { font-size: 11px; color: #94A3B8; }
.ali-target { font-size: 11.5px; color: #64748B; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ali-foot { display: flex; align-items: center; }
.ali-score { font-size: 11.5px; font-weight: 700; color: #1A56B0; background: #EBF4FF; padding: 3px 9px; border-radius: 10px; }
.ali-no-rating { font-size: 10px; color: #94A3B8; }

/* Avatar */
.av { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 700; color: #fff; flex-shrink: 0; }

/* Period pill */
.period-pill { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 999px; background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; font-size: 10px; font-weight: 700; white-space: nowrap; flex-shrink: 0; }

/* Right panel empty state */
.rp-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 300px; gap: 10px; color: #94A3B8; padding: 40px 20px; }
.rp-empty-title { font-size: 15px; font-weight: 600; color: #374151; margin: 4px 0 0; }
.rp-empty-sub { font-size: 12px; color: #94A3B8; text-align: center; }

/* Right panel header */
.rp-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 28px 16px; border-bottom: 1px solid #E8EDF3; background: linear-gradient(to bottom, #FAFBFF, #F7F9FF); position: sticky; top: 0; z-index: 2; }
.rp-hd-info { flex: 1; min-width: 0; }
.rp-title { font-size: 17px; font-weight: 700; color: #0F172A; letter-spacing: -.4px; margin-bottom: 5px; }
.rp-sub { font-size: 12.5px; color: #64748B; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.rp-sub-dot { color: #CBD5E1; }

/* Right panel body */
.rp-body { padding: 8px 28px 28px; display: flex; flex-direction: column; }
.det-section { padding: 16px 0; border-bottom: 1px solid #F1F5F9; }
.det-section:last-child { border-bottom: none; }
.det-label { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.det-label::after { content: ''; flex: 1; height: 1px; background: #F1F5F9; }
.det-text { font-size: 13.5px; color: #1A2332; line-height: 1.7; white-space: pre-wrap; }
.det-ratings { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 16px 0; border-bottom: 1px solid #F1F5F9; }
.det-rating-item { background: #F8FAFC; border: 1px solid #E8EDF3; border-radius: 10px; padding: 14px 10px; text-align: center; }
.det-avg { background: #EBF4FF; border-color: #BFDBFE; }
.det-score { font-size: 24px; font-weight: 800; color: #0F172A; margin-top: 4px; }
.det-score-avg { color: #1A56B0; font-size: 28px; }

/* Inline editing (right panel) */
.rp-hd-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.save-chip { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.save-dirty { background: #FEF3E2; color: #B45309; }
.save-saving { background: #EFF6FF; color: #1D4ED8; }
.save-saved { background: #ECFDF5; color: #047857; }
.save-error { background: #FEF2F2; color: #B91C1C; cursor: pointer; }
.spinner-xs { width: 9px; height: 9px; border: 2px solid rgba(29,78,216,.25); border-top-color: #1D4ED8; border-radius: 50%; animation: spin .6s linear infinite; display: inline-block; }
.inline-hint { font-size: 9px; font-weight: 600; color: #B7C3D4; text-transform: none; letter-spacing: .02em; }
.inline-ta { width: 100%; min-height: 96px; padding: 10px 12px; border: 1.5px solid #D8E0EA; border-radius: 9px; font-size: 13.5px; line-height: 1.7; color: #1A2332; background: #fff; box-shadow: 0 1px 2px rgba(15,23,42,.05); outline: none; resize: none; overflow: hidden; transition: border-color .15s, background .15s; }
.inline-ta-sm { min-height: 72px; }
.inline-ta:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
.inline-ta::placeholder { color: #CBD5E1; }
.inline-dirty { border-left: 3px solid #E9A840 !important; }
.det-score-input { width: 100%; border: 1.5px solid #D8E0EA; background: #fff; text-align: center; font-size: 24px; font-weight: 800; color: #0F172A; margin-top: 4px; outline: none; border-radius: 8px; padding: 4px 0; box-shadow: 0 1px 2px rgba(15,23,42,.05); transition: border-color .15s, background .15s; }
.det-score-input:hover { border-color: #B9C6D8; }
.det-score-input:focus { border-color: #3B82F6; background: #fff; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
.det-score-input::placeholder { color: #CBD5E1; }
.det-score-input::-webkit-outer-spin-button, .det-score-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.det-score-input[type=number] { -moz-appearance: textfield; appearance: textfield; }

/* Empty state (list) */
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 40px 16px; gap: 8px; text-align: center; }
.empty-title { font-size: 14px; font-weight: 600; color: #374151; margin: 4px 0 0; }
.empty-sub { font-size: 12px; color: #94A3B8; margin: 0; }

/* Skeleton */
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
.sk-line { background: linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%); background-size: 200%; animation: shimmer 1.4s infinite; border-radius: 4px; height: 12px; display: block; }

/* Buttons */
.btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; border-radius: 8px; font-size: 12px; cursor: pointer; border: 1px solid #E2E8F0; background: #fff; color: #374151; transition: all .15s; font-weight: 500; }
.btn:hover { border-color: #CBD5E1; background: #F8FAFC; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-primary { background: #0D2137; color: #fff; border-color: #0D2137; }
.btn-primary:hover:not(:disabled) { background: #1e3f61; }
.btn-sm { padding: 5px 10px; font-size: 11px; }
.btn-xs { padding: 4px 9px; font-size: 11px; }
.req { color: #EF4444; font-size: 11px; }

/* Modal */
.readonly-input { background: #F8FAFC; color: #64748B; cursor: not-allowed; }
.linked-note { font-size: 11px; color: #94A3B8; grid-column: span 2; margin: -4px 0 4px; }
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 16px; backdrop-filter: blur(4px); }
.modal { background: #fff; border-radius: 16px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 24px 64px rgba(0,0,0,.2); overflow: hidden; }
.modal-form { max-width: 700px; }
.modal-hd { display: flex; align-items: flex-start; gap: 12px; padding: 20px 24px 16px; border-bottom: 1px solid #F1F5F9; background: #FAFBFF; flex-shrink: 0; }
.modal-icon { width: 36px; height: 36px; border-radius: 10px; background: #EBF4FF; color: #2F80ED; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.modal-title { font-size: 15px; font-weight: 700; color: #0F172A; margin: 0 0 2px; }
.modal-sub { font-size: 12px; color: #94A3B8; margin: 0; }
.modal-close { margin-left: auto; background: none; border: none; cursor: pointer; padding: 6px; border-radius: 8px; color: #94A3B8; }
.modal-close:hover { background: #F1F5F9; color: #374151; }
.modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 24px; border-top: 1px solid #F1F5F9; background: #F8FAFC; flex-shrink: 0; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.full { grid-column: span 2; }
.field-label { font-size: 11px; font-weight: 600; color: #374151; }
.field-input { padding: 9px 12px; border: 1.5px solid #E2E8F0; border-radius: 9px; font-size: 13px; color: #0F172A; background: #fff; outline: none; transition: border-color .15s; resize: vertical; }
.field-input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
.spinner-sm { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }
.toast { position: fixed; bottom: 24px; right: 24px; background: #0F172A; color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,.2); z-index: 9999; pointer-events: none; }
.toast-error { background: #EB5757; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all .25s; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateY(8px); }
</style>
