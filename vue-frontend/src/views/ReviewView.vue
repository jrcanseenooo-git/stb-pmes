<template>
  <div class="review-page">
    <section class="review-shell">
      <header class="review-hd">
        <div>
          <h2>Review Queue</h2>
          <p>IPCRF / CCEF forms assigned for checking</p>
        </div>
        <div class="review-filters">
          <select v-model="statusFilter" class="filter">
            <option value="">Active review</option>
            <option value="Submitted">Submitted</option>
            <option value="Approved">Approved</option>
            <option value="Rated">Rated</option>
          </select>
          <select v-model="semesterFilter" class="filter">
            <option value="">All Semesters</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
          </select>
          <button class="btn" @click="loadQueue" :disabled="loading">{{ loading ? 'Loading...' : 'Refresh' }}</button>
        </div>
      </header>

      <div v-if="loading" class="empty">Loading assigned forms...</div>
      <div v-else-if="!forms.length" class="empty">No forms assigned for review.</div>

      <div v-else class="queue-grid">
        <button
          v-for="form in forms"
          :key="form.id"
          :class="['queue-card', selectedForm?.id === form.id && 'active']"
          @click="selectForm(form)"
        >
          <span :class="['type-chip', form.type === 'IPCRF' ? 'ipcrf' : 'ccef']">{{ form.type }}</span>
          <span class="period">S{{ form.semester }} {{ form.year }}</span>
          <strong>{{ form.employeeName }}</strong>
          <small>{{ form.divisionName }}<span v-if="form.sectionName"> · {{ form.sectionName }}</span></small>
          <span class="status">{{ form.status }}</span>
        </button>
      </div>

      <section v-if="selectedForm" class="sheet-panel">
        <div class="sheet-title">
          <div>
            <div class="agency">DEPARTMENT OF SOCIAL WELFARE AND DEVELOPMENT</div>
            <div class="form-name">{{ selectedForm.type === 'CCEF' ? 'Contractor Commitment and Evaluation Form (CCEF)' : 'Individual Performance Commitment and Review Form (IPCRF)' }} - Review</div>
            <div class="period-title">{{ semesterText(selectedForm.semester) }}, CY {{ selectedForm.year }}</div>
            <div class="division-title">{{ selectedForm.divisionName }}</div>
          </div>
          <div class="sheet-actions">
            <button v-if="selectedForm.status === 'Submitted'" class="btn approve" @click="approveSelected">Approve</button>
            <button v-if="selectedForm.status === 'Submitted'" class="btn return" @click="returnSelected">Return</button>
          </div>
        </div>

        <div class="cert-text">
          Review the performance commitments, rating periods, guide, means of verification, accomplishments, ratings, and remarks before taking action.
        </div>

        <div class="sheet-table-wrap">
          <table class="sheet-table">
            <thead>
              <tr class="band">
                <th colspan="10">PART I. INDIVIDUAL COMMITMENTS AND ACCOMPLISHMENTS</th>
              </tr>
              <tr>
                <th>Key Result Area (KRA)</th>
                <th>Success Indicator (SI)</th>
                <th>Applicable Rating Period</th>
                <th>Accomplishment</th>
                <th>Efficiency (E)</th>
                <th>Quality (Q)</th>
                <th>Timeliness (T)</th>
                <th>Average</th>
                <th>Means of Verification</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="entriesLoading">
                <td colspan="10" class="empty-cell">Loading form entries...</td>
              </tr>
              <tr v-for="entry in entries" :key="entry.id">
                <td>{{ entry.kraName }}</td>
                <td>{{ entry.successIndicator }}</td>
                <td>{{ entry.applicableRatingPeriod }}</td>
                <td>{{ entry.accomplishment || '---' }}</td>
                <td class="rating">{{ displayRating(entry.ratingEfficiency) }}</td>
                <td class="rating">{{ displayRating(entry.ratingQuality) }}</td>
                <td class="rating">{{ displayRating(entry.ratingTimeliness) }}</td>
                <td class="rating">{{ displayRating(entry.ratingAverage) }}</td>
                <td>{{ entry.movReferences || entry.meansOfVerification || '---' }}</td>
                <td>{{ entry.remarks || '---' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="feedback-block">
          <div class="feedback-title">PART II. FEEDBACK AND PROPOSED INTERVENTION</div>
          <div class="feedback-grid">
            <div>Strengths</div>
            <div>{{ selectedForm.feedbackStrengths || 'For Division Chief input' }}</div>
            <div>Areas for Improvement</div>
            <div>{{ selectedForm.feedbackAreasForImprovement || 'For Division Chief input' }}</div>
            <div>Comments / Recommendations</div>
            <div>{{ selectedForm.feedbackComments || selectedForm.feedbackRecommendations || 'For Division Chief input' }}</div>
          </div>
        </div>
      </section>
    </section>

    <teleport to="body">
      <transition name="toast-slide">
        <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">{{ toast.msg }}</div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ipcrf as ipcrfApi } from '@/services/api'
import { useConfirm, CONFIRMS } from '@/composables/useConfirm'

const { confirm } = useConfirm()
const loading = ref(false)
const entriesLoading = ref(false)
const forms = ref([])
const entries = ref([])
const selectedForm = ref(null)
const statusFilter = ref('')
const semesterFilter = ref('')
const toast = ref({ show: false, msg: '', type: 'success' })

const queueParams = computed(() => ({
  ...(statusFilter.value ? { status: statusFilter.value } : {}),
  ...(semesterFilter.value ? { semester: semesterFilter.value } : {})
}))

onMounted(loadQueue)
watch([statusFilter, semesterFilter], loadQueue)

async function loadQueue() {
  loading.value = true
  try {
    const result = await ipcrfApi.reviewQueue(queueParams.value)
    forms.value = result?.items || (Array.isArray(result) ? result : [])
    if (!selectedForm.value && forms.value.length) await selectForm(forms.value[0])
    if (selectedForm.value && !forms.value.some(f => f.id === selectedForm.value.id)) {
      selectedForm.value = null
      entries.value = []
    }
  } catch (e) {
    showToast(`Could not load review queue: ${e.message}`, 'error')
  } finally {
    loading.value = false
  }
}

async function selectForm(form) {
  selectedForm.value = form
  entries.value = []
  entriesLoading.value = true
  try {
    const result = await ipcrfApi.listEntries(form.id)
    entries.value = Array.isArray(result) ? result : []
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    entriesLoading.value = false
  }
}

async function approveSelected() {
  if (!selectedForm.value) return
  const ok = await confirm(CONFIRMS.approveForm(selectedForm.value.employeeName, selectedForm.value.type))
  if (!ok) return
  try {
    const updated = await ipcrfApi.approveForm(selectedForm.value.id)
    syncSelected(updated)
    showToast('Form approved.')
  } catch (e) {
    showToast(e.message, 'error')
  }
}

async function returnSelected() {
  if (!selectedForm.value) return
  const ok = await confirm(CONFIRMS.returnForm(selectedForm.value.employeeName))
  if (!ok) return
  try {
    const updated = await ipcrfApi.returnForm(selectedForm.value.id)
    syncSelected(updated)
    showToast('Form returned for revision.', 'warning')
  } catch (e) {
    showToast(e.message, 'error')
  }
}

function syncSelected(updated) {
  selectedForm.value = { ...selectedForm.value, ...updated }
  const index = forms.value.findIndex(f => f.id === selectedForm.value.id)
  if (index >= 0) forms.value[index] = selectedForm.value
}

function semesterText(value) {
  return String(value) === '1' ? '1st Semester' : '2nd Semester'
}

function displayRating(value) {
  return value === '' || value === null || value === undefined ? '---' : value
}

function showToast(msg, type = 'success') {
  toast.value = { show: true, msg, type }
  setTimeout(() => { toast.value.show = false }, 3500)
}
</script>

<style scoped>
.review-page{min-height:100%;padding:16px;background:#EEF2F7;color:#0F172A;}
.review-shell{background:#fff;border:1px solid #DDE7F3;border-radius:14px;overflow:hidden;}
.review-hd{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:20px 22px;border-bottom:1px solid #E7EEF7;}
.review-hd h2{font-size:22px;margin:0 0 4px;}
.review-hd p{margin:0;color:#8A9AB5;}
.review-filters{display:flex;gap:8px;align-items:center;}
.filter{height:36px;border:1px solid #D7E2EF;border-radius:8px;background:#fff;padding:0 10px;font:inherit;color:#0F172A;}
.btn{height:34px;border:1px solid #D7E2EF;border-radius:8px;background:#fff;padding:0 14px;font:inherit;font-weight:600;cursor:pointer;color:#0F172A;}
.btn:hover{background:#F8FAFC;}
.approve{border-color:#86EFAC;color:#15803D;background:#F0FDF4;}
.return{border-color:#FCD34D;color:#B45309;background:#FFFBEB;}
.empty{padding:32px;text-align:center;color:#8A9AB5;}
.queue-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;padding:16px 22px;border-bottom:1px solid #E7EEF7;}
.queue-card{text-align:left;border:1px solid #DDE7F3;background:#fff;border-radius:10px;padding:12px;display:grid;grid-template-columns:1fr auto;gap:6px;cursor:pointer;}
.queue-card.active{border-color:#2F80ED;box-shadow:0 0 0 3px rgba(47,128,237,.12);}
.queue-card strong{grid-column:1/-1;font-size:14px;}
.queue-card small{grid-column:1/-1;color:#7B8CA8;}
.type-chip,.status,.period{font-size:11px;font-weight:700;border-radius:999px;padding:3px 8px;width:max-content;}
.type-chip.ipcrf{background:#E8F1FF;color:#1A56B0;}
.type-chip.ccef{background:#F3E8FF;color:#7E3BB2;}
.period{color:#47617E;background:#F2F6FB;}
.status{grid-column:1/-1;color:#B45309;background:#FFFBEB;}
.sheet-panel{padding:18px 22px 24px;}
.sheet-title{display:flex;justify-content:space-between;gap:16px;text-align:center;margin-bottom:14px;}
.sheet-title>div:first-child{flex:1;}
.agency{font-weight:800;font-size:13px;}
.form-name{margin-top:10px;font-size:13px;}
.period-title{font-weight:800;margin-top:4px;}
.division-title{font-weight:800;margin-top:16px;}
.sheet-actions{display:flex;align-items:flex-start;gap:8px;}
.cert-text{border:2px solid #111;border-bottom:none;padding:8px;font-size:12px;}
.sheet-table-wrap{overflow:auto;border:2px solid #111;}
.sheet-table{width:100%;border-collapse:collapse;min-width:1180px;font-size:11px;line-height:1.35;}
.sheet-table th,.sheet-table td{border:1px dotted #777;padding:6px;vertical-align:top;}
.sheet-table th{background:#D9D9D9;text-align:center;font-weight:800;}
.sheet-table .band th{background:#4F95AE;color:#fff;text-align:left;font-size:12px;border:1px solid #111;}
.sheet-table .rating{text-align:center;white-space:nowrap;}
.empty-cell{text-align:center;color:#7B8CA8;padding:20px!important;}
.feedback-block{border:2px solid #111;border-top:none;}
.feedback-title{background:#4F95AE;color:#fff;font-weight:800;font-size:12px;padding:6px 8px;}
.feedback-grid{display:grid;grid-template-columns:220px 1fr;font-size:12px;}
.feedback-grid>div{border-top:1px dotted #777;padding:8px;}
.feedback-grid>div:nth-child(odd){font-weight:700;background:#F8FAFC;}
.toast{position:fixed;right:24px;bottom:24px;background:#0F172A;color:#fff;border-radius:10px;padding:10px 16px;z-index:999;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,.18);}
.toast-error{background:#EB5757;}
.toast-warning{background:#E9A840;}
.toast-slide-enter-active,.toast-slide-leave-active{transition:all .2s;}
.toast-slide-enter-from,.toast-slide-leave-to{opacity:0;transform:translateY(8px);}
@media (max-width: 900px){
  .review-hd,.sheet-title{flex-direction:column;text-align:left;}
  .review-filters{flex-wrap:wrap;}
}
</style>
