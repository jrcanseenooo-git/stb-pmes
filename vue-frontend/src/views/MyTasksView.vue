<template>
  <div class="pmes-page p-4 grid gap-4 content-start">
    <PageHeader
      kicker="Assessment"
      title="My Rating Tasks"
      subtitle="People you have been assigned to rate for the current assessment period."
    />

    <div class="grid gap-3 grid-cols-3">
      <StatTile label="Pending" :value="counts.pending" :loading="loading" :tone="counts.pending ? 'warn' : 'default'" />
      <StatTile label="Draft" :value="counts.draft" :loading="loading" />
      <StatTile label="Submitted" :value="counts.submitted" :total="items.length" :loading="loading" tone="good" />
    </div>

    <DataPanel
      title="Assigned Ratings"
      :subtitle="`${filteredItems.length} of ${items.length} tasks shown`"
      :loading="loading"
      :error="error"
      error-title="Your rating tasks could not be loaded"
      :empty="!filteredItems.length"
      :empty-title="items.length ? 'No tasks match this view' : 'No rating tasks assigned yet'"
      :empty-description="items.length
        ? 'Try a different status tab.'
        : 'Your office administrator assigns rating tasks when the assessment period opens. Nothing is required from you until then.'"
      searchable
      :search="search"
      search-placeholder="Search by name or unit..."
      :last-updated="lastUpdatedLabel"
      refreshable
      @update:search="value => (search = value)"
      @refresh="load"
    >
      <template #filters>
        <div class="flex items-center gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Filter by status">
          <button
            v-for="tab in STATUS_TABS"
            :key="tab.value"
            type="button"
            role="tab"
            :aria-selected="statusTab === tab.value"
            :class="[
              'px-3 py-1 rounded-lg text-xs font-extrabold transition-colors',
              statusTab === tab.value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            ]"
            @click="statusTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
      </template>

      <!-- Desktop: table. Below sm the same rows render as stacked cards, because
           a seven-column table is unreadable on a phone. -->
      <table class="data-table hidden sm:table">
        <thead>
          <tr>
            <th scope="col">Person to Rate</th>
            <th scope="col">Organizational Unit</th>
            <th scope="col">Your Role as Rater</th>
            <th scope="col">Status</th>
            <th scope="col">Last Saved</th>
            <th scope="col" class="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in filteredItems" :key="task.id">
            <td>
              <strong class="block text-[13px] text-slate-900">{{ task.rateeName }}</strong>
              <span class="block text-slate-500 mt-0.5">{{ task.rateePosition || '—' }}</span>
            </td>
            <td>{{ task.organizationalUnit || '—' }}</td>
            <td>{{ raterTypeLabel(task.raterType) }}</td>
            <td><StatusPill :status="task.status" /></td>
            <td class="whitespace-nowrap">{{ formatDateTime(task.submittedAt || task.lastSavedAt) }}</td>
            <td>
              <div class="flex justify-end">
                <RouterLink
                  :to="{ path: '/evaluation', query: { assignment: task.id } }"
                  :class="task.status === 'SUBMITTED' ? 'btn-secondary !py-1 !px-2.5 !text-xs' : 'btn-primary !py-1 !px-2.5 !text-xs'"
                >
                  {{ actionLabel(task.status) }}
                </RouterLink>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <ul class="sm:hidden divide-y divide-slate-100">
        <li v-for="task in filteredItems" :key="task.id" class="p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <strong class="block text-sm text-slate-900">{{ task.rateeName }}</strong>
              <span class="block text-xs text-slate-500 mt-0.5">{{ task.rateePosition || '—' }}</span>
            </div>
            <StatusPill :status="task.status" />
          </div>
          <dl class="mt-3 grid grid-cols-2 gap-2">
            <div>
              <dt class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Unit</dt>
              <dd class="text-xs font-bold text-slate-700 truncate">{{ task.organizationalUnit || '—' }}</dd>
            </div>
            <div>
              <dt class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Your Role</dt>
              <dd class="text-xs font-bold text-slate-700">{{ raterTypeLabel(task.raterType) }}</dd>
            </div>
          </dl>
          <RouterLink
            :to="{ path: '/evaluation', query: { assignment: task.id } }"
            :class="['mt-3 w-full', task.status === 'SUBMITTED' ? 'btn-secondary' : 'btn-primary']"
          >
            {{ actionLabel(task.status) }}
          </RouterLink>
        </li>
      </ul>
    </DataPanel>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { portalApi } from '@/services/api'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataPanel from '@/components/ui/DataPanel.vue'
import StatTile from '@/components/ui/StatTile.vue'
import StatusPill from '@/components/ui/StatusPill.vue'

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' }
]

// The protocol's rater relationships, spelled out. "SkipSupervisor" and the
// like are storage values; personnel should read plain language.
const RATER_TYPE_LABELS = {
  Self: 'Self-assessment',
  Peer: 'Peer',
  Peer1: 'Peer',
  Peer2: 'Peer',
  Subordinate: 'Subordinate',
  Supervisor: 'Immediate Supervisor',
  SkipSupervisor: 'Skip-Level Supervisor'
}

const items = ref([])
const loading = ref(false)
const error = ref('')
const search = ref('')
const statusTab = ref('all')
const lastUpdatedAt = ref(null)

onMounted(load)

const counts = computed(() => ({
  pending: items.value.filter(t => t.status === 'PENDING').length,
  draft: items.value.filter(t => t.status === 'DRAFT').length,
  submitted: items.value.filter(t => t.status === 'SUBMITTED').length
}))

const filteredItems = computed(() => {
  const term = search.value.trim().toLowerCase()
  return items.value.filter(task => {
    if (statusTab.value !== 'all' && task.status !== statusTab.value) return false
    if (!term) return true
    return [task.rateeName, task.rateePosition, task.organizationalUnit, task.raterType]
      .some(field => String(field || '').toLowerCase().includes(term))
  })
})

const lastUpdatedLabel = computed(() =>
  lastUpdatedAt.value ? lastUpdatedAt.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
)

function raterTypeLabel(value) {
  return RATER_TYPE_LABELS[value] || value || '—'
}

function actionLabel(status) {
  if (status === 'SUBMITTED') return 'View'
  if (status === 'DRAFT') return 'Continue'
  return 'Start Rating'
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await portalApi.myTasks()
    items.value = data.items || []
    lastUpdatedAt.value = new Date()
  } catch (e) {
    error.value = e?.message || 'Please check your connection and try again.'
  } finally {
    loading.value = false
  }
}
</script>
