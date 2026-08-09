<template>
  <div class="pmes-page p-4 grid gap-4 content-start">
    <PageHeader
      kicker="Central Administration"
      title="Cluster Assessment Overview"
      subtitle="Assessment progress across participating Innovation Cluster offices."
    >
      <template #actions>
        <RouterLink v-if="canManageOfficeRegistry" to="/office-registry" class="btn-secondary">Office Registry</RouterLink>
        <button class="btn-primary" type="button" :disabled="loading" @click="load">
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </template>
    </PageHeader>

    <div class="grid gap-3 grid-cols-2 lg:grid-cols-4">
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

    <div class="grid gap-3 grid-cols-2 lg:grid-cols-4">
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
      <table class="data-table">
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
              <strong class="block text-[13px] text-slate-900">{{ office.officeCode }}</strong>
              <span class="block text-slate-500 mt-0.5">{{ office.officeName }}</span>
            </td>
            <td>
              <StatusPill :status="healthStatus(office.health)" />
              <small v-if="office.healthNote" class="block text-slate-400 text-[10.5px] mt-1 leading-snug max-w-[220px]">
                {{ office.healthNote }}
              </small>
            </td>
            <td class="whitespace-nowrap">
              {{ office.personnel.active }} active
              <span v-if="office.personnel.pending" class="block text-amber-600 font-bold text-[11px]">
                {{ office.personnel.pending }} for validation
              </span>
            </td>
            <td class="whitespace-nowrap">
              {{ office.assignments.completed }} / {{ office.assignments.total }}
            </td>
            <td class="min-w-[140px]">
              <ProgressBar
                :value="office.assignments.completed"
                :total="office.assignments.total"
                :label="''"
              />
            </td>
            <td class="whitespace-nowrap">{{ formatDate(office.lastActivityAt) }}</td>
          </tr>
        </tbody>
      </table>
    </DataPanel>

    <p class="text-[11px] text-slate-400 px-1 leading-relaxed">
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
