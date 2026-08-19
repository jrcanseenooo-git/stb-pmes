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
    <section class="cluster-progress-strip">
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
          <h3>Top Outstanding</h3>
          <div v-if="loading" class="signal-empty">Loading…</div>
          <div v-else-if="!topOutstanding.length" class="signal-empty">No Outstanding ratings yet.</div>
          <div v-else class="signal-list">
            <div v-for="office in topOutstanding" :key="`out-${office.officeId}`" class="signal-row">
              <div>
                <strong>{{ officeDisplayName(office) }}</strong>
                <small>{{ office.outstandingCount }} Outstanding of {{ office.assessments.total }} rated</small>
              </div>
              <span>{{ office.outstandingCount }}</span>
            </div>
          </div>
        </div>

        <div class="cluster-signal-card">
          <h3>Top Needs Improvement</h3>
          <div v-if="loading" class="signal-empty">Loading…</div>
          <div v-else-if="!topNeedsImprovement.length" class="signal-empty">No records below Satisfactory.</div>
          <div v-else class="signal-list">
            <div v-for="office in topNeedsImprovement" :key="`imp-${office.officeId}`" class="signal-row">
              <div>
                <strong>{{ officeDisplayName(office) }}</strong>
                <small>{{ office.coachingCount }} needing improvement</small>
              </div>
              <span>{{ office.coachingCount }}</span>
            </div>
          </div>
        </div>

        <div class="cluster-signal-card">
          <h3>Pending Rating Workload</h3>
          <div v-if="loading" class="signal-empty">Loading…</div>
          <div v-else-if="!pendingWorkload.length" class="signal-empty">No pending rating workload.</div>
          <div v-else class="signal-list">
            <div v-for="office in pendingWorkload" :key="`pend-${office.officeId}`" class="signal-row">
              <div>
                <strong>{{ officeDisplayName(office) }}</strong>
                <small>{{ office.assignments.pendingPersonnel || 0 }} personnel · {{ office.completionRate }}% complete</small>
              </div>
              <span>{{ office.assignments.pending }}</span>
            </div>
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
          <h3>Leading Offices</h3>
          <div v-if="loading" class="signal-empty">Loading office signals...</div>
          <div v-else-if="!leadingOffices.length" class="signal-empty">No submitted ratings yet.</div>
          <div v-else class="signal-list">
            <div v-for="office in leadingOffices" :key="`lead-${office.officeId}`" class="signal-row">
              <div>
                <strong>{{ officeDisplayName(office) }}</strong>
                <small>{{ office.assignments.completed }} of {{ office.assignments.total }} submitted</small>
              </div>
              <span>{{ office.completionRate }}%</span>
            </div>
          </div>
        </div>

        <div class="cluster-signal-card">
          <h3>Needs Follow-up</h3>
          <div v-if="loading" class="signal-empty">Loading office signals...</div>
          <div v-else-if="!officesNeedingFollowUp.length" class="signal-empty">No offices need follow-up.</div>
          <div v-else class="signal-list">
            <div v-for="office in officesNeedingFollowUp" :key="`follow-${office.officeId}`" class="signal-row">
              <div>
                <strong>{{ officeDisplayName(office) }}</strong>
                <small>{{ office.followUpLabel }}</small>
              </div>
              <span>{{ office.pendingCount }}</span>
            </div>
          </div>
        </div>

        <div class="cluster-signal-card">
          <h3>Largest Pending Workload</h3>
          <div v-if="loading" class="signal-empty">Loading office signals...</div>
          <div v-else-if="!pendingWorkload.length" class="signal-empty">No pending rating workload.</div>
          <div v-else class="signal-list">
            <div v-for="office in pendingWorkload" :key="`pending-${office.officeId}`" class="signal-row">
              <div>
                <strong>{{ officeDisplayName(office) }}</strong>
                <small>{{ office.completionRate }}% complete</small>
              </div>
              <span>{{ office.assignments.pending }}</span>
            </div>
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
          <tr v-for="office in filteredItems" :key="office.officeId">
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

const topOutstanding = computed(() =>
  officeMetrics.value
    .filter(office => office.outstandingCount > 0)
    .sort((a, b) => b.outstandingCount - a.outstandingCount)
    .slice(0, 3)
)

const topNeedsImprovement = computed(() =>
  officeMetrics.value
    .filter(office => office.coachingCount > 0)
    .sort((a, b) => b.coachingCount - a.coachingCount)
    .slice(0, 3)
)

const leadingOffices = computed(() =>
  officeMetrics.value
    .filter(office => Number(office.assignments?.total || 0) > 0)
    .sort((a, b) =>
      b.completionRate - a.completionRate ||
      Number(b.assignments?.completed || 0) - Number(a.assignments?.completed || 0)
    )
    .slice(0, 3)
)

const officesNeedingFollowUp = computed(() =>
  officeMetrics.value
    .filter(office => office.pendingCount > 0 || String(office.health || '').toLowerCase() !== 'active')
    .sort((a, b) =>
      Number(b.pendingCount || 0) - Number(a.pendingCount || 0) ||
      a.completionRate - b.completionRate
    )
    .slice(0, 3)
)

const pendingWorkload = computed(() =>
  officeMetrics.value
    .filter(office => Number(office.assignments?.pending || 0) > 0)
    .sort((a, b) => Number(b.assignments.pending || 0) - Number(a.assignments.pending || 0))
    .slice(0, 3)
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
}

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

.cluster-signal-card h3{
  margin:0;
  padding:13px 14px;
  border-bottom:1px solid #E6EEF7;
  color:#07172D;
  font-size:14px;
  font-weight:800;
}

.signal-list{
  display:flex;
  flex-direction:column;
}

.signal-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:12px 14px;
  border-bottom:1px solid #EEF3F8;
}

.signal-row:last-child{border-bottom:0;}

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

@media (max-width:1100px){
  .cluster-signal-grid{grid-template-columns:1fr;}
}

@media (max-width:720px){
    .cluster-signals-head{flex-direction:column;}
}
</style>
