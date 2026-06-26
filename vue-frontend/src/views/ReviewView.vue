<template>
  <div class="review-page">
    <section class="review-shell">
      <header class="review-hd">
        <div>
          <h2>Review Queue</h2>
          <p>IPCRF / CCEF forms assigned for checking</p>
        </div>
        <div class="review-filters">
          <div class="review-type-tabs" aria-label="Review type">
            <button
              type="button"
              :class="['review-type-tab', reviewTypeFilter === 'targets' && 'active']"
              @click="setReviewType('targets')"
            >
              Targets Review
            </button>
            <button
              type="button"
              :class="['review-type-tab', reviewTypeFilter === 'ratings' && 'active']"
              @click="setReviewType('ratings')"
            >
              Ratings Review
            </button>
          </div>
          <select v-model="semesterFilter" class="filter">
            <option value="">All Semesters</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
          </select>
          <button class="btn" @click="loadQueue" :disabled="loading">{{ loading ? 'Loading...' : 'Refresh' }}</button>
        </div>
      </header>

      <div v-if="loading" class="empty">Loading assigned forms...</div>
      <div v-else-if="!forms.length" class="empty">{{ emptyMessage }}</div>

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
          <small>{{ form.divisionName }}<span v-if="form.sectionName"> - {{ form.sectionName }}</span></small>
          <span class="status">{{ reviewLabel(form) }}</span>
          <span class="route-stage">Stage: {{ routeStageFor(form) }}</span>
        </button>
      </div>

      <section v-if="selectedForm" class="workbook">
        <div class="sheet-title">
          <div>
            <div class="agency">DEPARTMENT OF SOCIAL WELFARE AND DEVELOPMENT</div>
            <div class="form-name">{{ formTitle }} - Review Workbook</div>
            <div class="period-title">{{ semesterText(selectedForm.semester) }}, CY {{ selectedForm.year }}</div>
            <div class="division-title">{{ selectedForm.divisionName }}</div>
          </div>
          <div class="sheet-actions">
            <button class="btn" @click="saveSheetEdits" :disabled="editsSaving || entriesLoading">
              {{ editsSaving ? 'Saving...' : 'Save Sheet Edits' }}
            </button>
            <button class="btn" @click="saveComments" :disabled="commentsSaving || entriesLoading">
              {{ commentsSaving ? 'Saving...' : 'Save Comments' }}
            </button>
            <button class="btn approve" @click="routeSelected" :disabled="routing || entriesLoading">
              {{ routing ? 'Routing...' : routeButtonLabel }}
            </button>
            <button class="btn return" @click="returnSelected">Return</button>
          </div>
        </div>

        <div class="workbook-tabs">
          <button
            v-for="tab in workbookTabs"
            :key="tab.value"
            :class="['workbook-tab', activeWorkbookTab === tab.value && 'active']"
            @click="activeWorkbookTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="cert-text">{{ activeInstruction }}</div>

        <div v-if="activeWorkbookTab === 'targets'" class="sheet-table-wrap">
          <table class="sheet-table targets-table">
            <thead>
              <tr class="band">
                <th colspan="9">TARGETS - PERFORMANCE COMMITMENTS</th>
              </tr>
              <tr>
                <th>Key Result Area (KRA)</th>
                <th>Success Indicator (SI)</th>
                <th>Applicable Rating Period</th>
                <th>Efficiency (E)</th>
                <th>Quality (Q)</th>
                <th>Timeliness (T)</th>
                <th>Means of Verification</th>
                <th>Remarks</th>
                <th>Review Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="entriesLoading">
                <td colspan="9" class="empty-cell">Loading form entries...</td>
              </tr>
              <tr v-for="entry in entries" :key="entry.id">
                <td><textarea v-model="editableEntries[entry.id].kraName" class="cell-input strong"></textarea></td>
                <td><textarea v-model="editableEntries[entry.id].successIndicator" class="cell-input tall"></textarea></td>
                <td>
                  <select v-model="editableEntries[entry.id].applicableRatingPeriod" class="cell-select">
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                    <option value="Both semesters">Both semesters</option>
                  </select>
                </td>
                <td><textarea v-model="editableEntries[entry.id].efficiencyGuide" class="cell-input guide"></textarea></td>
                <td><textarea v-model="editableEntries[entry.id].qualityGuide" class="cell-input guide"></textarea></td>
                <td><textarea v-model="editableEntries[entry.id].timelinessGuide" class="cell-input guide"></textarea></td>
                <td><textarea v-model="editableEntries[entry.id].meansOfVerification" class="cell-input"></textarea></td>
                <td><textarea v-model="editableEntries[entry.id].remarks" class="cell-input"></textarea></td>
                <td>
                  <textarea
                    v-model="reviewComments[entry.id]"
                    class="review-note"
                    placeholder="Cell/row comment..."
                  ></textarea>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="activeWorkbookTab === 'ratings'" class="sheet-table-wrap">
          <table class="sheet-table ratings-table">
            <thead>
              <tr class="band">
                <th colspan="11">RATINGS - INDIVIDUAL COMMITMENTS AND ACCOMPLISHMENTS</th>
              </tr>
              <tr>
                <th>Key Result Area (KRA)</th>
                <th>Success Indicator / Target Basis</th>
                <th>Applicable Rating Period</th>
                <th>Accomplishment</th>
                <th>Efficiency (E)</th>
                <th>Quality (Q)</th>
                <th>Timeliness (T)</th>
                <th>Average</th>
                <th>Means of Verification</th>
                <th>Remarks</th>
                <th>Review Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="entriesLoading">
                <td colspan="11" class="empty-cell">Loading form entries...</td>
              </tr>
              <tr v-for="entry in entries" :key="entry.id">
                <td><textarea v-model="editableEntries[entry.id].kraName" class="cell-input strong"></textarea></td>
                <td>
                  <textarea v-model="editableEntries[entry.id].successIndicator" class="cell-input tall"></textarea>
                  <div class="basis-box">
                    <strong>Basis / EQT Guide</strong>
                    <span>E: {{ editableEntries[entry.id].efficiencyGuide || '---' }}</span>
                    <span>Q: {{ editableEntries[entry.id].qualityGuide || '---' }}</span>
                    <span>T: {{ editableEntries[entry.id].timelinessGuide || '---' }}</span>
                  </div>
                </td>
                <td>{{ entry.applicableRatingPeriod || '---' }}</td>
                <td><textarea v-model="editableEntries[entry.id].accomplishment" class="cell-input tall"></textarea></td>
                <td><input v-model="editableEntries[entry.id].ratingEfficiency" class="rating-input" inputmode="decimal"/></td>
                <td><input v-model="editableEntries[entry.id].ratingQuality" class="rating-input" inputmode="decimal"/></td>
                <td><input v-model="editableEntries[entry.id].ratingTimeliness" class="rating-input" inputmode="decimal"/></td>
                <td><input v-model="editableEntries[entry.id].ratingAverage" class="rating-input" inputmode="decimal"/></td>
                <td><textarea v-model="editableEntries[entry.id].movReferences" class="cell-input"></textarea></td>
                <td><textarea v-model="editableEntries[entry.id].remarks" class="cell-input"></textarea></td>
                <td>
                  <textarea
                    v-model="reviewComments[entry.id]"
                    class="review-note"
                    placeholder="Cell/row comment..."
                  ></textarea>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="activeWorkbookTab === 'comments'" class="comments-panel">
          <div class="panel-title">Reviewer Comments</div>
          <div v-for="entry in entries" :key="entry.id" class="comment-row">
            <div>
              <strong>{{ entry.kraName }}</strong>
              <p>{{ entry.successIndicator }}</p>
            </div>
            <textarea
              v-model="reviewComments[entry.id]"
              class="comment-input"
              placeholder="Add clarification, correction, or note for this row..."
            ></textarea>
          </div>
        </div>

        <div v-else class="routing-panel">
          <div class="panel-title">Routing</div>
          <div class="routing-grid">
            <div>Employee</div><div>{{ selectedForm.employeeName }}</div>
            <div>Form Type</div><div>{{ selectedForm.type }}</div>
            <div>Period</div><div>{{ semesterText(selectedForm.semester) }}, CY {{ selectedForm.year }}</div>
            <div>Current Review Type</div><div>{{ selectedReviewType }}</div>
            <div>Current Stage</div><div>{{ currentRouteStage }}</div>
            <div>Next Action</div><div>{{ routeButtonLabel }}</div>
            <div>Targets Submitted</div><div>{{ formatDate(selectedForm.submittedAt) }}</div>
            <div>Targets Approved</div><div>{{ formatDate(selectedForm.approvedAt) }}</div>
            <div>Ratings Completed</div><div>{{ formatDate(selectedForm.ratingCompletedAt || selectedForm.ratedAt) }}</div>
          </div>
        </div>

        <div v-if="activeWorkbookTab === 'ratings'" class="feedback-block">
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
import { useAuthStore } from '@/stores/auth'

const { confirm } = useConfirm()
const authStore = useAuthStore()
const loading = ref(false)
const entriesLoading = ref(false)
const commentsSaving = ref(false)
const editsSaving = ref(false)
const routing = ref(false)
const forms = ref([])
const entries = ref([])
const editableEntries = ref({})
const reviewComments = ref({})
const selectedForm = ref(null)
const reviewTypeFilter = ref('targets')
const semesterFilter = ref('')
const activeWorkbookTab = ref('targets')
const toast = ref({ show: false, msg: '', type: 'success' })

const workbookTabs = [
  { value: 'targets', label: 'Targets' },
  { value: 'ratings', label: 'Ratings' },
  { value: 'comments', label: 'Comments' },
  { value: 'routing', label: 'Routing' }
]

const queueParams = computed(() => ({
  reviewType: reviewTypeFilter.value,
  ...(semesterFilter.value ? { semester: semesterFilter.value } : {})
}))

const isTargetsReview = computed(() => selectedForm.value?.status === 'Submitted')
const selectedReviewType = computed(() => isTargetsReview.value ? 'Targets Review' : 'Ratings Review')
const formTitle = computed(() => selectedForm.value?.type === 'CCEF'
  ? 'Contractor Commitment and Evaluation Form (CCEF)'
  : 'Individual Performance Commitment and Review Form (IPCRF)'
)
const currentRouteStage = computed(() => {
  if (!selectedForm.value) return ''
  return isTargetsReview.value
    ? (selectedForm.value.targetReviewStage || 'Division Focal')
    : (selectedForm.value.ratingReviewStage || 'Division Focal')
})
const routeButtonLabel = computed(() => {
  if (!selectedForm.value) return 'Route Forward'
  if (isTargetsReview.value) {
    return currentRouteStage.value === 'Division Focal'
      ? 'Route to Bureau Focal'
      : 'Approve Targets & Notify Staff'
  }
  if (currentRouteStage.value === 'Division Focal') return 'Route to Bureau Focal'
  if (currentRouteStage.value === 'Bureau Focal') return 'Route to Division Chief'
  return 'Complete Ratings Review'
})
const emptyMessage = computed(() => reviewTypeFilter.value === 'ratings'
  ? 'No ratings forms assigned yet. Ratings review appears after targets are approved and accomplishments/ratings are ready.'
  : 'No target forms assigned for review.'
)
const activeInstruction = computed(() => {
  if (activeWorkbookTab.value === 'targets') return 'Review the submitted KRA/SI, applicable rating period, rating guide, means of verification, and remarks.'
  if (activeWorkbookTab.value === 'ratings') return 'Review accomplishments against the target basis, EQT rating guide, MOV, remarks, average, and Part II feedback.'
  if (activeWorkbookTab.value === 'comments') return 'Use row-level comments for clarifications, corrections, or instructions before routing.'
  return 'Route this document to the next reviewer once the current review stage is complete.'
})

onMounted(loadQueue)
watch([reviewTypeFilter, semesterFilter], loadQueue)

function setReviewType(type) {
  reviewTypeFilter.value = type
  activeWorkbookTab.value = type === 'ratings' ? 'ratings' : 'targets'
}

async function loadQueue() {
  loading.value = true
  try {
    const result = await ipcrfApi.reviewQueue(queueParams.value)
    forms.value = result?.items || (Array.isArray(result) ? result : [])
    if (!selectedForm.value && forms.value.length) await selectForm(forms.value[0])
    if (selectedForm.value && !forms.value.some(f => f.id === selectedForm.value.id)) {
      selectedForm.value = null
      entries.value = []
      editableEntries.value = {}
      reviewComments.value = {}
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
  editableEntries.value = {}
  reviewComments.value = {}
  entriesLoading.value = true
  activeWorkbookTab.value = reviewTypeForForm(form) === 'ratings' ? 'ratings' : 'targets'
  try {
    const [entryResult, commentResult] = await Promise.all([
      ipcrfApi.listEntries(form.id),
      ipcrfApi.reviewComments(form.id, reviewTypeForForm(form))
    ])
    entries.value = Array.isArray(entryResult) ? entryResult : []
    editableEntries.value = Object.fromEntries(entries.value.map(entry => [entry.id, cloneEntry(entry)]))
    reviewComments.value = Object.fromEntries((Array.isArray(commentResult) ? commentResult : [])
      .map(comment => [comment.entryId, comment.comment || '']))
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    entriesLoading.value = false
  }
}

async function saveSheetEdits() {
  if (!selectedForm.value) return
  const ok = await confirm({
    type: 'submit',
    title: 'Save Sheet Edits',
    message: 'This will save the direct edits you made in the review workbook cells.',
    confirmLabel: 'Save Sheet Edits',
    cancelLabel: 'Cancel'
  })
  if (!ok) return

  editsSaving.value = true
  try {
    await saveEntryEditsSilently()
    showToast('Sheet edits saved.')
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    editsSaving.value = false
  }
}

async function saveEntryEditsSilently() {
  if (!selectedForm.value) return
  const updatedRows = await Promise.all(entries.value.map(entry => {
    const edited = editableEntries.value[entry.id] || {}
    return ipcrfApi.updateEntry(selectedForm.value.id, entry.id, entryPayload(edited))
  }))
  entries.value = updatedRows
  editableEntries.value = Object.fromEntries(updatedRows.map(entry => [entry.id, cloneEntry(entry)]))
}

async function saveComments() {
  if (!selectedForm.value) return
  const ok = await confirm({
    type: 'submit',
    title: 'Save Review Comments',
    message: `Your review notes for ${selectedForm.value.employeeName}'s ${selectedReviewType.value.toLowerCase()} will be saved to the database.`,
    confirmLabel: 'Save Comments',
    cancelLabel: 'Cancel'
  })
  if (!ok) return

  commentsSaving.value = true
  try {
    await saveCommentsSilently()
    showToast('Review comments saved.')
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    commentsSaving.value = false
  }
}

async function routeSelected() {
  if (!selectedForm.value) return
  const ok = await confirm({
    type: isTargetsReview.value && currentRouteStage.value !== 'Division Focal' ? 'approve' : 'submit',
    title: routeButtonLabel.value,
    message: `This will save edits and comments, then route ${selectedForm.value.employeeName}'s ${selectedForm.value.type} ${selectedReviewType.value.toLowerCase()} from ${authStore.fullName || 'you'} to the next step.`,
    details: [
      { label: 'Current stage', value: currentRouteStage.value },
      { label: 'Review type', value: selectedReviewType.value }
    ],
    confirmLabel: routeButtonLabel.value,
    cancelLabel: 'Cancel'
  })
  if (!ok) return

  routing.value = true
  try {
    await saveEntryEditsSilently()
    await saveCommentsSilently()
    const updated = await ipcrfApi.routeForm(selectedForm.value.id, {
      reviewType: reviewTypeForForm(selectedForm.value)
    })
    syncSelected(updated)
    showToast('Form routed successfully.')
    await loadQueue()
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    routing.value = false
  }
}

async function saveCommentsSilently() {
  if (!selectedForm.value) return
  const result = await ipcrfApi.saveReviewComments(selectedForm.value.id, {
    reviewType: reviewTypeForForm(selectedForm.value),
    comments: entries.value.map(entry => ({
      entryId: entry.id,
      comment: reviewComments.value[entry.id] || ''
    }))
  })
  reviewComments.value = Object.fromEntries((Array.isArray(result) ? result : [])
    .map(comment => [comment.entryId, comment.comment || '']))
}

async function returnSelected() {
  if (!selectedForm.value) return
  const ok = await confirm(CONFIRMS.returnForm(selectedForm.value.employeeName))
  if (!ok) return
  try {
    await saveEntryEditsSilently()
    await saveCommentsSilently()
    const updated = await ipcrfApi.returnForm(selectedForm.value.id)
    syncSelected(updated)
    showToast('Form returned for revision.', 'warning')
    await loadQueue()
  } catch (e) {
    showToast(e.message, 'error')
  }
}

function syncSelected(updated) {
  selectedForm.value = { ...selectedForm.value, ...updated }
  const index = forms.value.findIndex(f => f.id === selectedForm.value.id)
  if (index >= 0) forms.value[index] = selectedForm.value
}

function cloneEntry(entry) {
  return { ...entry }
}

function entryPayload(entry) {
  return {
    kraName: entry.kraName || '',
    successIndicator: entry.successIndicator || '',
    applicableRatingPeriod: entry.applicableRatingPeriod || '',
    efficiencyGuide: entry.efficiencyGuide || '',
    qualityGuide: entry.qualityGuide || '',
    timelinessGuide: entry.timelinessGuide || '',
    meansOfVerification: entry.meansOfVerification || '',
    accomplishment: entry.accomplishment || '',
    ratingEfficiency: entry.ratingEfficiency || '',
    ratingQuality: entry.ratingQuality || '',
    ratingTimeliness: entry.ratingTimeliness || '',
    ratingAverage: entry.ratingAverage || '',
    movReferences: entry.movReferences || '',
    remarks: entry.remarks || ''
  }
}

function semesterText(value) {
  return String(value) === '1' ? '1st Semester' : '2nd Semester'
}

function reviewLabel(form) {
  if (form.status === 'Submitted') return 'Targets Review'
  if (form.status === 'Approved') return 'Ratings Preparation'
  if (form.status === 'Rated') return 'Ratings Review'
  return form.status
}

function reviewTypeForForm(form) {
  return form?.status === 'Submitted' ? 'targets' : 'ratings'
}

function routeStageFor(form) {
  if (!form) return ''
  return reviewTypeForForm(form) === 'targets'
    ? (form.targetReviewStage || 'Division Focal')
    : (form.ratingReviewStage || 'Division Focal')
}

function formatDate(value) {
  if (!value) return '---'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' })
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
.review-type-tabs{display:flex;border:1px solid #D7E2EF;border-radius:9px;background:#F8FAFC;padding:3px;}
.review-type-tab{height:30px;border:0;border-radius:7px;background:transparent;padding:0 12px;font:inherit;font-weight:700;color:#52657F;cursor:pointer;}
.review-type-tab.active{background:#08213D;color:#fff;box-shadow:0 1px 3px rgba(15,23,42,.12);}
.review-type-tab:not(.active):hover{background:#EEF4FB;color:#0F172A;}
.filter{height:36px;border:1px solid #D7E2EF;border-radius:8px;background:#fff;padding:0 10px;font:inherit;color:#0F172A;}
.btn{height:34px;border:1px solid #D7E2EF;border-radius:8px;background:#fff;padding:0 14px;font:inherit;font-weight:600;cursor:pointer;color:#0F172A;white-space:nowrap;}
.btn:hover{background:#F8FAFC;}
.btn:disabled{opacity:.55;cursor:not-allowed;}
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
.route-stage{grid-column:1/-1;color:#52657F;font-size:11px;font-weight:700;}
.workbook{padding:18px 22px 24px;}
.sheet-title{display:flex;justify-content:space-between;gap:16px;text-align:center;margin-bottom:14px;}
.sheet-title>div:first-child{flex:1;}
.agency{font-weight:800;font-size:13px;}
.form-name{margin-top:10px;font-size:13px;}
.period-title{font-weight:800;margin-top:4px;}
.division-title{font-weight:800;margin-top:16px;}
.sheet-actions{display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.workbook-tabs{display:flex;gap:4px;border-bottom:1px solid #DDE7F3;margin:0 0 10px;}
.workbook-tab{border:1px solid transparent;border-bottom:0;background:transparent;padding:9px 16px;font:inherit;font-weight:800;color:#64748B;cursor:pointer;border-radius:8px 8px 0 0;}
.workbook-tab.active{background:#fff;border-color:#DDE7F3;color:#0F172A;box-shadow:0 -2px 0 #2F80ED inset;}
.cert-text{border:2px solid #111;border-bottom:none;padding:8px;font-size:12px;}
.sheet-table-wrap{overflow:auto;border:2px solid #111;}
.sheet-table{width:100%;border-collapse:collapse;min-width:1480px;font-size:11px;line-height:1.35;}
.targets-table{min-width:1420px;}
.ratings-table{min-width:1560px;}
.sheet-table th,.sheet-table td{border:1px dotted #777;padding:6px;vertical-align:top;}
.sheet-table th{background:#D9D9D9;text-align:center;font-weight:800;}
.sheet-table .band th{background:#4F95AE;color:#fff;text-align:left;font-size:12px;border:1px solid #111;}
.cell-input,.review-note,.comment-input{width:100%;border:1px solid #C8D4E3;border-radius:6px;background:#fff;padding:6px;font:inherit;font-size:11px;line-height:1.35;color:#0F172A;resize:vertical;}
.cell-input{min-height:72px;}
.cell-input.tall{min-height:96px;}
.cell-input.guide{min-height:128px;}
.cell-input.strong{font-weight:800;}
.cell-select{width:100%;border:1px solid #C8D4E3;border-radius:6px;background:#fff;padding:6px;font:inherit;font-size:11px;color:#0F172A;}
.rating-input{width:70px;border:1px solid #C8D4E3;border-radius:6px;background:#fff;padding:6px;text-align:center;font:inherit;font-size:11px;color:#0F172A;}
.review-note{min-width:150px;min-height:86px;}
.cell-input:focus,.review-note:focus,.comment-input:focus,.cell-select:focus,.rating-input:focus{outline:2px solid rgba(47,128,237,.28);border-color:#2F80ED;}
.basis-box{margin-top:6px;border:1px solid #DDE7F3;background:#F8FAFC;border-radius:6px;padding:6px;display:grid;gap:4px;color:#475569;}
.basis-box strong{color:#0F172A;}
.empty-cell{text-align:center;color:#7B8CA8;padding:20px!important;}
.comments-panel,.routing-panel{border:2px solid #111;border-top:none;padding:12px;background:#fff;}
.panel-title{font-weight:800;margin-bottom:10px;}
.comment-row{display:grid;grid-template-columns:minmax(260px,420px) 1fr;gap:14px;border-bottom:1px dotted #CBD5E1;padding:12px 0;}
.comment-row:last-child{border-bottom:0;}
.comment-row p{margin:4px 0 0;color:#475569;font-size:12px;}
.comment-input{min-height:90px;}
.routing-grid{display:grid;grid-template-columns:220px 1fr;border:1px solid #DDE7F3;}
.routing-grid>div{padding:9px;border-bottom:1px dotted #CBD5E1;}
.routing-grid>div:nth-child(odd){font-weight:800;background:#F8FAFC;}
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
  .review-filters,.sheet-actions{flex-wrap:wrap;}
  .comment-row,.routing-grid{grid-template-columns:1fr;}
}
</style>
