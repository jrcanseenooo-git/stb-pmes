<template>
  <div class="pui-page">
    <PageHeader
      kicker="Central Administration"
      title="Cluster Assessment Overview"
      subtitle="Assessment progress across participating Innovation Cluster offices."
    >
      <template #actions>
        <RouterLink v-if="canManageOfficeRegistry" to="/office-registry" class="pui-btn">Office Registry</RouterLink>
        <button class="pui-btn pui-btn-primary" type="button" :disabled="loading" @click="load(true)">
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </template>
    </PageHeader>

    <!-- Cluster completion as a slim strip: one headline number that frames
         everything below without competing with it. -->
    <section class="cluster-progress-strip" role="button" tabindex="0" @click="openOfficeList('Cluster office coverage', officeMetrics, 'coverage')" @keydown.enter.prevent="openOfficeList('Cluster office coverage', officeMetrics, 'coverage')">
      <div>
        <span class="cluster-card-label">Overall Completion</span>
        <p>{{ totals.completedAssignments }} submitted · {{ totals.pendingAssignments }} pending · {{ totals.personnel }} personnel covered</p>
      </div>
      <div class="cluster-progress-meter">
        <ProgressBar
          :value="totals.completedAssignments"
          :total="totals.completedAssignments + totals.pendingAssignments"
          :show-value="false"
        />
      </div>
      <strong :class="['cluster-progress-value', clusterToneClass]">{{ loading ? '-' : `${clusterCompletionRate}%` }}</strong>
      <span class="cluster-period-pill">{{ totals.activeOffices }} of {{ totals.offices }} offices active</span>
    </section>

    <section class="pui-card" style="padding:0; overflow:hidden;">
      <div class="pui-card-header">
        <div>
          <h2 class="pui-card-title">Office Performance</h2>
          <p class="pui-card-subtitle">Offices that need attention or recognition, by assessment outcome.</p>
        </div>
      </div>
      <div class="cluster-signal-grid">
        <div class="cluster-signal-card">
          <button class="signal-card-head" type="button" @click="openOfficeList('Top Outstanding offices', allOutstandingOffices, 'outstanding')">Top Outstanding</button>
          <div v-if="loading" class="signal-empty">Loading…</div>
          <div v-else-if="!topOutstanding.length" class="signal-empty">No Outstanding ratings yet.</div>
          <div v-else class="signal-list">
            <button v-for="office in topOutstanding" :key="`out-${office.officeId}`" class="signal-row" type="button" @click="openOfficeDetail(office)">
              <div>
                <strong>{{ officeDisplayName(office) }}</strong>
                <small>{{ office.outstandingCount }} Outstanding of {{ office.assessments.total }} rated</small>
              </div>
              <span>{{ office.outstandingCount }}</span>
            </button>
          </div>
        </div>

        <div class="cluster-signal-card">
          <button class="signal-card-head" type="button" @click="openOfficeList('Offices needing coaching', allNeedsImprovementOffices, 'coaching')">Top Needs Improvement</button>
          <div v-if="loading" class="signal-empty">Loading…</div>
          <div v-else-if="!topNeedsImprovement.length" class="signal-empty">No records below Satisfactory.</div>
          <div v-else class="signal-list">
            <button v-for="office in topNeedsImprovement" :key="`imp-${office.officeId}`" class="signal-row" type="button" @click="openOfficeDetail(office)">
              <div>
                <strong>{{ officeDisplayName(office) }}</strong>
                <small>{{ office.coachingCount }} needing improvement</small>
              </div>
              <span>{{ office.coachingCount }}</span>
            </button>
          </div>
        </div>

        <div class="cluster-signal-card">
          <button class="signal-card-head" type="button" @click="openOfficeList('Pending rating workload by office', allPendingWorkload, 'pending')">Pending Rating Workload</button>
          <div v-if="loading" class="signal-empty">Loading…</div>
          <div v-else-if="!pendingWorkload.length" class="signal-empty">No pending rating workload.</div>
          <div v-else class="signal-list">
            <button v-for="office in pendingWorkload" :key="`pend-${office.officeId}`" class="signal-row" type="button" @click="openOfficeDetail(office)">
              <div>
                <strong>{{ officeDisplayName(office) }}</strong>
                <small>{{ office.assignments.pendingPersonnel || 0 }} personnel · {{ office.completionRate }}% complete</small>
              </div>
              <span>{{ office.assignments.pending }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="cluster-signals">
      <div class="cluster-signals-head">
        <div>
          <h2>Office Signals</h2>
          <p>Where cluster attention is needed, and which offices are moving well.</p>
        </div>
      </div>

      <div class="cluster-signal-grid">
        <div class="cluster-signal-card">
          <button class="signal-card-head" type="button" @click="openOfficeList('Leading offices', allLeadingOffices, 'leading')">Leading Offices</button>
          <div v-if="loading" class="signal-empty">Loading office signals...</div>
          <div v-else-if="!leadingOffices.length" class="signal-empty">No submitted ratings yet.</div>
          <div v-else class="signal-list">
            <button v-for="office in leadingOffices" :key="`lead-${office.officeId}`" class="signal-row" type="button" @click="openOfficeDetail(office)">
              <div>
                <strong>{{ officeDisplayName(office) }}</strong>
                <small>{{ office.assignments.completed }} of {{ office.assignments.total }} submitted</small>
              </div>
              <span>{{ office.completionRate }}%</span>
            </button>
          </div>
        </div>

        <div class="cluster-signal-card">
          <button class="signal-card-head" type="button" @click="openOfficeList('Offices needing follow-up', allOfficesNeedingFollowUp, 'followup')">Needs Follow-up</button>
          <div v-if="loading" class="signal-empty">Loading office signals...</div>
          <div v-else-if="!officesNeedingFollowUp.length" class="signal-empty">No offices need follow-up.</div>
          <div v-else class="signal-list">
            <button v-for="office in officesNeedingFollowUp" :key="`follow-${office.officeId}`" class="signal-row" type="button" @click="openOfficeDetail(office)">
              <div>
                <strong>{{ officeDisplayName(office) }}</strong>
                <small>{{ office.followUpLabel }}</small>
              </div>
              <span>{{ office.pendingCount }}</span>
            </button>
          </div>
        </div>

        <div class="cluster-signal-card">
          <button class="signal-card-head" type="button" @click="openOfficeList('Largest pending workload', allPendingWorkload, 'pending')">Largest Pending Workload</button>
          <div v-if="loading" class="signal-empty">Loading office signals...</div>
          <div v-else-if="!pendingWorkload.length" class="signal-empty">No pending rating workload.</div>
          <div v-else class="signal-list">
            <button v-for="office in pendingWorkload" :key="`pending-${office.officeId}`" class="signal-row" type="button" @click="openOfficeDetail(office)">
              <div>
                <strong>{{ officeDisplayName(office) }}</strong>
                <small>{{ office.completionRate }}% complete</small>
              </div>
              <span>{{ office.assignments.pending }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <DataPanel
      title="Office Monitoring"
      :subtitle="`${filteredItems.length} of ${items.length} offices shown`"
      :loading="loading"
      :error="error"
      error-title="Cluster monitoring could not be loaded"
      :empty="!filteredItems.length"
      :empty-title="items.length ? 'No offices match your search' : 'No participating offices yet'"
      :empty-description="items.length
        ? 'Try a different search term.'
        : 'Offices appear here once they are registered and provisioned through the Office Registry.'"
      searchable
      :search="search"
      search-placeholder="Search office..."
      :last-updated="lastUpdatedLabel"
      refreshable
      @update:search="value => (search = value)"
      @refresh="load(true)"
    >
      <table class="pui-table">
        <thead>
          <tr>
            <th scope="col">Office</th>
            <th scope="col">Personnel</th>
            <th scope="col">Rating Tasks</th>
            <th scope="col">Completion</th>
            <th scope="col">Last Activity</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="office in filteredItems"
            :key="office.officeId"
            class="office-row"
            tabindex="0"
            @click="openOfficeDetail(office)"
            @keydown.enter.prevent="openOfficeDetail(office)"
          >
            <td>
              <strong>{{ officeDisplayCode(office) }}</strong>
              <small>{{ office.officeName }}</small>
            </td>
            <td style="white-space:nowrap;">
              {{ office.personnel.active }} active
              <span v-if="office.personnel.pending" style="display:block; color:#b45309; font-weight:700; font-size:11px;">
                {{ office.personnel.pending }} for validation
              </span>
            </td>
            <td style="white-space:nowrap;">
              {{ office.assignments.completed }} / {{ office.assignments.total }}
            </td>
            <td style="min-width:140px;">
              <ProgressBar
                :value="office.assignments.completed"
                :total="office.assignments.total"
                :show-value="false"
              />
            </td>
            <td style="white-space:nowrap;">{{ formatDate(office.lastActivityAt) }}</td>
          </tr>
        </tbody>
      </table>
    </DataPanel>

    <p style="font-size:11px; color:#94a3b8; padding:0 2px; line-height:1.5;">
      Aggregate monitoring only. Individual rating content and individual rater identities are not
      included in cluster analytics.
    </p>

    <div v-if="detail" class="detail-overlay" @click.self="detail = null">
      <div class="detail-modal" role="dialog" aria-modal="true" :aria-label="detail.title">
        <div class="detail-head">
          <div>
            <h2>{{ detail.title }}</h2>
            <p>{{ detail.subtitle }}</p>
          </div>
          <button class="modal-close" type="button" aria-label="Close" @click="detail = null">x</button>
        </div>

        <div v-if="detail.kind === 'office'" class="office-detail-body">
          <div class="office-detail-grid">
            <div>
              <span>Personnel</span>
              <strong>{{ detail.office.personnel.active }} active</strong>
              <small>{{ detail.office.personnel.pending }} for validation · {{ detail.office.personnel.total }} total</small>
            </div>
            <div>
              <span>Rating Tasks</span>
              <strong>{{ detail.office.assignments.completed }} / {{ detail.office.assignments.total }}</strong>
              <small>{{ detail.office.assignments.pending }} pending · {{ detail.office.assignments.pendingPersonnel || 0 }} personnel</small>
            </div>
            <div>
              <span>Completion</span>
              <strong>{{ detail.office.completionRate }}%</strong>
              <small>{{ formatDate(detail.office.lastActivityAt) }} last activity</small>
            </div>
            <div>
              <span>Assessment Results</span>
              <strong>{{ detail.office.assessments.total }} records</strong>
              <small>{{ detail.office.assessments.averageOverall || '-' }} average score</small>
            </div>
          </div>

          <div class="descriptor-breakdown">
            <h3>Rating Profile</h3>
            <div class="descriptor-grid">
              <div v-for="item in descriptorRows(detail.office)" :key="item.label">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </div>

          <div class="office-health-note">
            <strong>{{ detail.office.health || 'Status unavailable' }}</strong>
            <span>{{ detail.office.healthNote || 'No additional office status note.' }}</span>
          </div>
        </div>

        <div v-else class="detail-body">
          <table v-if="detail.rows.length" class="detail-table">
            <thead>
              <tr>
                <th>Office</th>
                <th>Personnel</th>
                <th>Rating Tasks</th>
                <th>Completion</th>
                <th>{{ detail.metricLabel }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="office in detail.rows" :key="office.officeId" class="office-row" tabindex="0" @click="openOfficeDetail(office)" @keydown.enter.prevent="openOfficeDetail(office)">
                <td>
                  <strong>{{ officeDisplayCode(office) }}</strong>
                  <span>{{ officeDisplayName(office) }}</span>
                </td>
                <td>{{ office.personnel.active }} active · {{ office.personnel.pending }} pending</td>
                <td>{{ office.assignments.completed }} / {{ office.assignments.total }}</td>
                <td>{{ office.completionRate }}%</td>
                <td>{{ detailMetric(office, detail.kind) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="signal-empty">No office records for this view.</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { officeRegistryApi } from '@/services/api'
import { usePermissions } from '@/composables/usePermissions'
import { officeAcronym } from '@/utils/officeAcronyms'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataPanel from '@/components/ui/DataPanel.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'

const { canManageOfficeRegistry } = usePermissions()

const EMPTY_TOTALS = {
  offices: 0, activeOffices: 0, activeSpreadsheets: 0, attention: 0,
  personnel: 0, assessmentRecords: 0, completedAssignments: 0, pendingAssignments: 0,
  // Added with the cluster dashboard. Defaulted here so an older cached payload
  // renders zeros rather than "undefined" while the cache turns over.
  pendingPersonnel: 0, outstanding: 0, verySatisfactory: 0,
  satisfactory: 0, needsImprovement: 0, requiresIntervention: 0
}

const items = ref([])
const totals = ref({ ...EMPTY_TOTALS })
const loading = ref(false)
const error = ref('')
const search = ref('')
const lastUpdatedAt = ref(null)
const detail = ref(null)

onMounted(() => load(false))

const filteredItems = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return items.value
  return items.value.filter(office =>
    [office.officeCode, office.officeName].some(field => String(field || '').toLowerCase().includes(term))
  )
})

const officeMetrics = computed(() =>
  items.value
    .map(office => {
      const d = office.assessments?.descriptors || {}
      return {
        ...office,
        pendingCount: Number(office.assignments?.pending || 0),
        outstandingCount: Number(d.outstanding || 0),
        // "For coaching" is both bands below Satisfactory - a record needing
        // immediate intervention plainly needs coaching too, and reporting only
        // 'Needs Improvement' would hide the most urgent cases entirely.
        coachingCount: Number(d.needsImprovement || 0) + Number(d.requiresIntervention || 0),
        completionRate: office.assignments?.total
          ? Math.round((Number(office.assignments.completed || 0) / Number(office.assignments.total || 0)) * 100)
          : 0,
        followUpLabel: followUpLabel(office)
      }
    })
)

const allOutstandingOffices = computed(() =>
  officeMetrics.value
    .filter(office => office.outstandingCount > 0)
    .sort((a, b) => b.outstandingCount - a.outstandingCount)
)

const topOutstanding = computed(() =>
  allOutstandingOffices.value.slice(0, 3)
)

const allNeedsImprovementOffices = computed(() =>
  officeMetrics.value
    .filter(office => office.coachingCount > 0)
    .sort((a, b) => b.coachingCount - a.coachingCount)
)

const topNeedsImprovement = computed(() =>
  allNeedsImprovementOffices.value.slice(0, 3)
)

const allLeadingOffices = computed(() =>
  officeMetrics.value
    .filter(office => Number(office.assignments?.total || 0) > 0)
    .sort((a, b) =>
      b.completionRate - a.completionRate ||
      Number(b.assignments?.completed || 0) - Number(a.assignments?.completed || 0)
    )
)

const leadingOffices = computed(() =>
  allLeadingOffices.value.slice(0, 3)
)

const allOfficesNeedingFollowUp = computed(() =>
  officeMetrics.value
    .filter(office => office.pendingCount > 0 || String(office.health || '').toLowerCase() !== 'active')
    .sort((a, b) =>
      Number(b.pendingCount || 0) - Number(a.pendingCount || 0) ||
      a.completionRate - b.completionRate
    )
)

const officesNeedingFollowUp = computed(() =>
  allOfficesNeedingFollowUp.value.slice(0, 3)
)

const allPendingWorkload = computed(() =>
  officeMetrics.value
    .filter(office => Number(office.assignments?.pending || 0) > 0)
    .sort((a, b) => Number(b.assignments.pending || 0) - Number(a.assignments.pending || 0))
)

const pendingWorkload = computed(() =>
  allPendingWorkload.value.slice(0, 3)
)

function officeDisplayCode(office) {
  return officeAcronym(office) || office?.officeCode || ''
}

function officeDisplayName(office) {
  return office.officeName || officeDisplayCode(office)
}

const clusterCompletionRate = computed(() => {
  const total = totals.value.completedAssignments + totals.value.pendingAssignments
  if (!total) return 0
  return Math.round((totals.value.completedAssignments / total) * 100)
})

const clusterTone = computed(() => {
  if (clusterCompletionRate.value >= 80) return 'good'
  if (clusterCompletionRate.value >= 40) return 'default'
  return 'warn'
})

const clusterToneClass = computed(() => {
  if (clusterTone.value === 'good') return 'cluster-progress-good'
  if (clusterTone.value === 'warn') return 'cluster-progress-warn'
  return ''
})

const lastUpdatedLabel = computed(() =>
  lastUpdatedAt.value ? lastUpdatedAt.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
)

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function followUpLabel(office) {
  if (String(office.health || '').toLowerCase() !== 'active') {
    return office.healthNote || 'Configuration needs attention'
  }
  const pending = Number(office.assignments?.pending || 0)
  return `${pending} pending rating task${pending === 1 ? '' : 's'}`
}

function openOfficeList(title, rows, kind) {
  detail.value = {
    title,
    subtitle: `${rows.length} office${rows.length === 1 ? '' : 's'} shown · aggregate monitoring only`,
    rows,
    kind,
    metricLabel: metricLabel(kind)
  }
}

function openOfficeDetail(office) {
  detail.value = {
    title: officeDisplayName(office),
    subtitle: `${officeDisplayCode(office) || 'Office'} · aggregate office monitoring`,
    office,
    kind: 'office'
  }
}

function metricLabel(kind) {
  if (kind === 'outstanding') return 'Outstanding'
  if (kind === 'coaching') return 'For Coaching'
  if (kind === 'pending') return 'Pending'
  if (kind === 'leading') return 'Submitted'
  if (kind === 'followup') return 'Follow-up'
  return 'Status'
}

function detailMetric(office, kind) {
  if (kind === 'outstanding') return `${office.outstandingCount} Outstanding`
  if (kind === 'coaching') return `${office.coachingCount} needing coaching`
  if (kind === 'pending') return `${office.assignments.pending} pending`
  if (kind === 'leading') return `${office.assignments.completed} submitted`
  if (kind === 'followup') return office.followUpLabel
  return office.health || 'Office'
}

function descriptorRows(office) {
  const d = office.assessments?.descriptors || {}
  return [
    { label: 'Outstanding', value: Number(d.outstanding || 0) },
    { label: 'Very Satisfactory', value: Number(d.verySatisfactory || 0) },
    { label: 'Satisfactory', value: Number(d.satisfactory || 0) },
    { label: 'Needs Improvement', value: Number(d.needsImprovement || 0) },
    { label: 'Requires Intervention', value: Number(d.requiresIntervention || 0) }
  ]
}

async function load(forceRefresh = false) {
  loading.value = true
  error.value = ''
  try {
    const data = await officeRegistryApi.monitoring(forceRefresh ? { refresh: 1 } : {})
    items.value = data.items || []
    totals.value = { ...EMPTY_TOTALS, ...(data.totals || {}) }
    lastUpdatedAt.value = new Date()
  } catch (e) {
    error.value = e?.message || 'Please check your connection and try again.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.cluster-signals{
  background:#FFFFFF;
  border:1px solid #DCE6F2;
  border-radius:8px;
  overflow:hidden;
}

/* Completion reads as one slim strip rather than a card, so the office panels
   below carry the visual weight. */
.cluster-progress-strip{
  display:flex;
  align-items:center;
  gap:18px;
  flex-wrap:wrap;
  background:#FFFFFF;
  border:1px solid #DCE6F2;
  border-radius:8px;
  padding:14px 18px;
  cursor:pointer;
}
.cluster-progress-strip:hover{border-color:#8BB7EC; box-shadow:0 10px 24px rgba(15,23,42,.07);}
.cluster-progress-strip:focus{outline:3px solid rgba(37,99,235,.18); outline-offset:2px;}

.cluster-progress-strip > div:first-child{ flex:0 0 auto; min-width:0; }
.cluster-progress-strip p{ margin:4px 0 0; color:#536881; font-size:12px; }
.cluster-progress-meter{ flex:1 1 220px; min-width:160px; }

.cluster-signals-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:16px;
  padding:16px 18px 12px;
  border-bottom:1px solid #E6EEF7;
}

.cluster-signals-head h2{
  margin:0;
  color:#07172D;
  font-size:16px;
  font-weight:800;
}

.cluster-signals-head p{
  margin:4px 0 0;
  color:#5B6E8A;
  font-size:12px;
}

.cluster-period-pill{
  flex:0 0 auto;
  border:1px solid #CFE0F3;
  background:#F6FAFF;
  border-radius:999px;
  padding:6px 10px;
  color:#17457D;
  font-size:11px;
  font-weight:800;
}

.cluster-card-label{
  display:block;
  margin-bottom:8px;
  color:#5B6E8A;
  font-size:11px;
  font-weight:800;
  text-transform:uppercase;
}

.cluster-progress-value{
  display:block;
  margin-bottom:12px;
  color:#07172D;
  font-size:36px;
  line-height:1;
  font-weight:900;
}

.cluster-progress-good{color:#047857;}
.cluster-progress-warn{color:#B45309;}

.cluster-signal-grid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:12px;
  padding:14px 16px 16px;
}

.cluster-signal-card{
  border:1px solid #DCE6F2;
  border-radius:8px;
  min-height:170px;
  overflow:hidden;
}

.signal-card-head{
  display:block;
  width:100%;
  margin:0;
  padding:13px 14px;
  border:0;
  border-bottom:1px solid #E6EEF7;
  background:#FFFFFF;
  color:#07172D;
  cursor:pointer;
  font-size:14px;
  font-weight:800;
  text-align:left;
}
.signal-card-head:hover{background:#F8FBFF;}
.signal-card-head:focus{outline:3px solid rgba(37,99,235,.18); outline-offset:-3px;}

.signal-list{
  display:flex;
  flex-direction:column;
}

.signal-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  width:100%;
  padding:12px 14px;
  border:0;
  border-bottom:1px solid #EEF3F8;
  background:#FFFFFF;
  cursor:pointer;
  text-align:left;
}

.signal-row:last-child{border-bottom:0;}
.signal-row:hover,
.office-row:hover{background:#F8FBFF;}
.signal-row:focus,
.office-row:focus{outline:3px solid rgba(37,99,235,.18); outline-offset:-3px;}

.signal-row strong{
  display:block;
  color:#07172D;
  font-size:12px;
  font-weight:800;
}

.signal-row small{
  display:block;
  margin-top:3px;
  color:#5B6E8A;
  font-size:11px;
}

.signal-row span{
  flex:0 0 auto;
  min-width:44px;
  border-radius:999px;
  background:#F1F6FC;
  padding:5px 8px;
  color:#123A67;
  text-align:center;
  font-size:12px;
  font-weight:900;
}

.signal-empty{
  min-height:116px;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:18px;
  color:#5B6E8A;
  font-size:12px;
  text-align:center;
}

.office-row{cursor:pointer;}

.detail-overlay{
  position:fixed;
  inset:0;
  z-index:350;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:18px;
  background:rgba(15,23,42,.45);
}

.detail-modal{
  width:min(980px,100%);
  max-height:86vh;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  border-radius:8px;
  background:#FFFFFF;
  box-shadow:0 24px 64px rgba(15,23,42,.24);
}

.detail-head{
  display:flex;
  justify-content:space-between;
  gap:14px;
  padding:18px 20px;
  border-bottom:1px solid #E5EDF7;
  background:#F8FAFC;
}

.detail-head h2{margin:0; color:#0F172A; font-size:17px;}
.detail-head p{margin:4px 0 0; color:#64748B; font-size:12px;}
.modal-close{width:34px; height:34px; border:1px solid #D5E0EF; border-radius:8px; background:#FFFFFF; color:#0F172A; cursor:pointer; font-weight:900;}
.detail-body{overflow:auto;}
.detail-table{width:100%; border-collapse:collapse; font-size:13px;}
.detail-table th{padding:11px 14px; border-bottom:1px solid #E5EDF7; background:#F8FAFC; color:#64748B; font-size:11px; font-weight:800; letter-spacing:.04em; text-align:left; text-transform:uppercase;}
.detail-table td{padding:12px 14px; border-bottom:1px solid #EEF2F7; color:#0F172A; vertical-align:top;}
.detail-table td strong{display:block;}
.detail-table td span{display:block; margin-top:2px; color:#64748B; font-size:12px;}

.office-detail-body{overflow:auto; padding:18px;}
.office-detail-grid{display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px;}
.office-detail-grid > div,
.descriptor-breakdown,
.office-health-note{border:1px solid #DCE6F2; border-radius:8px; background:#FFFFFF;}
.office-detail-grid > div{padding:14px;}
.office-detail-grid span,
.descriptor-grid span{display:block; color:#64748B; font-size:11px; font-weight:800; letter-spacing:.04em; text-transform:uppercase;}
.office-detail-grid strong{display:block; margin-top:8px; color:#07172D; font-size:22px; line-height:1;}
.office-detail-grid small{display:block; margin-top:8px; color:#5B6E8A; font-size:12px; line-height:1.35;}
.descriptor-breakdown{margin-top:12px; overflow:hidden;}
.descriptor-breakdown h3{margin:0; padding:13px 14px; border-bottom:1px solid #E6EEF7; color:#07172D; font-size:14px;}
.descriptor-grid{display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:0;}
.descriptor-grid > div{padding:14px; border-right:1px solid #EEF3F8;}
.descriptor-grid > div:last-child{border-right:0;}
.descriptor-grid strong{display:block; margin-top:7px; color:#07172D; font-size:20px;}
.office-health-note{display:grid; gap:4px; margin-top:12px; padding:14px;}
.office-health-note strong{color:#07172D;}
.office-health-note span{color:#5B6E8A; font-size:12px;}

@media (max-width:1100px){
  .cluster-signal-grid{grid-template-columns:1fr;}
  .office-detail-grid,
  .descriptor-grid{grid-template-columns:1fr 1fr;}
}

@media (max-width:720px){
    .cluster-signals-head{flex-direction:column;}
    .office-detail-grid,
    .descriptor-grid{grid-template-columns:1fr;}
    .descriptor-grid > div{border-right:0; border-bottom:1px solid #EEF3F8;}
    .descriptor-grid > div:last-child{border-bottom:0;}
}
</style>
