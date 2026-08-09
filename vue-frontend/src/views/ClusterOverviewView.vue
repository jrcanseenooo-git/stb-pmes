<template>
  <div class="pui-page">
    <PageHeader
      kicker="Central Administration"
      title="Cluster Assessment Overview"
      subtitle="Assessment progress across participating Innovation Cluster offices."
    >
      <template #actions>
        <RouterLink v-if="canManageOfficeRegistry" to="/office-registry" class="pui-btn">Office Registry</RouterLink>
        <button class="pui-btn pui-btn-primary" type="button" :disabled="loading" @click="load">
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </template>
    </PageHeader>

    <div class="pui-grid pui-grid-4">
      <StatTile label="Participating Offices" :value="totals.activeOffices" :total="totals.offices" :loading="loading" />
      <StatTile label="Total Personnel" :value="totals.personnel" :loading="loading" />
      <StatTile label="Assessment Records" :value="totals.assessmentRecords" :loading="loading" />
      <StatTile
        label="Offices for Attention"
        :value="totals.attention"
        :loading="loading"
        :tone="totals.attention ? 'bad' : 'good'"
      />
    </div>

    <div class="pui-grid pui-grid-4">
      <StatTile label="Submitted Ratings" :value="totals.completedAssignments" :loading="loading" tone="good" />
      <StatTile
        label="Pending Ratings"
        :value="totals.pendingAssignments"
        :loading="loading"
        :tone="totals.pendingAssignments ? 'warn' : 'default'"
      />
      <StatTile label="Active Spreadsheets" :value="totals.activeSpreadsheets" :total="totals.offices" :loading="loading" />
      <StatTile label="Cluster Completion" :value="`${clusterCompletionRate}%`" :loading="loading" :tone="clusterTone" />
    </div>

    <BarList
      title="Completion Rate by Office"
      :items="completionByOffice"
      :loading="loading"
      empty-description="Office completion appears once participating offices have rating assignments."
    />

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
      @refresh="load"
    >
      <table class="pui-table">
        <thead>
          <tr>
            <th scope="col">Office</th>
            <th scope="col">Status</th>
            <th scope="col">Personnel</th>
            <th scope="col">Rating Tasks</th>
            <th scope="col">Completion</th>
            <th scope="col">Last Activity</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="office in filteredItems" :key="office.officeId">
            <td>
              <strong>{{ office.officeCode }}</strong>
              <small>{{ office.officeName }}</small>
            </td>
            <td>
              <StatusPill :status="healthStatus(office.health)" />
              <small v-if="office.healthNote" style="max-width:220px;">{{ office.healthNote }}</small>
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
import PageHeader from '@/components/ui/PageHeader.vue'
import DataPanel from '@/components/ui/DataPanel.vue'
import StatTile from '@/components/ui/StatTile.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import BarList from '@/components/ui/BarList.vue'

const { canManageOfficeRegistry } = usePermissions()

const EMPTY_TOTALS = {
  offices: 0, activeOffices: 0, activeSpreadsheets: 0, attention: 0,
  personnel: 0, assessmentRecords: 0, completedAssignments: 0, pendingAssignments: 0
}

const items = ref([])
const totals = ref({ ...EMPTY_TOTALS })
const loading = ref(false)
const error = ref('')
const search = ref('')
const lastUpdatedAt = ref(null)

onMounted(load)

const filteredItems = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return items.value
  return items.value.filter(office =>
    [office.officeCode, office.officeName].some(field => String(field || '').toLowerCase().includes(term))
  )
})

const completionByOffice = computed(() =>
  items.value
    .filter(office => office.assignments.total > 0)
    .map(office => ({
      label: office.officeName || office.officeCode,
      total: office.assignments.total,
      completed: office.assignments.completed,
      completionRate: office.assignments.total
        ? Math.round((office.assignments.completed / office.assignments.total) * 100)
        : 0
    }))
    .sort((a, b) => b.completionRate - a.completionRate)
)

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

const lastUpdatedLabel = computed(() =>
  lastUpdatedAt.value ? lastUpdatedAt.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
)

// Maps the backend's free-text health string onto the neutral status vocabulary
// the specification requires.
function healthStatus(health) {
  const value = String(health || '').toLowerCase()
  if (value === 'active') return 'ON_TRACK'
  if (value.includes('attention')) return 'FOR_ATTENTION'
  return 'FOR_CONFIGURATION'
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await officeRegistryApi.monitoring({})
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
