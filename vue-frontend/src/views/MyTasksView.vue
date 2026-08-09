<template>
  <div class="pui-page">
    <PageHeader
      kicker="Assessment"
      title="My Rating Tasks"
      subtitle="People you have been assigned to rate for the current assessment period."
    />

    <div class="pui-grid pui-grid-3">
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
        <div class="pui-tabs" role="tablist" aria-label="Filter by status">
          <button
            v-for="tab in STATUS_TABS"
            :key="tab.value"
            type="button"
            role="tab"
            :aria-selected="statusTab === tab.value"
            :class="['pui-tab', statusTab === tab.value && 'pui-tab-active']"
            @click="statusTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
      </template>

      <!-- Desktop: table. Below 720px the same rows render as stacked cards,
           since a six-column table is unreadable on a phone. -->
      <table v-if="!isNarrow" class="pui-table">
        <thead>
          <tr>
            <th scope="col">Person to Rate</th>
            <th scope="col">Organizational Unit</th>
            <th scope="col">Your Role as Rater</th>
            <th scope="col">Status</th>
            <th scope="col">Last Saved</th>
            <th scope="col" style="text-align:right;">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in filteredItems" :key="task.id">
            <td>
              <strong>{{ task.rateeName }}</strong>
              <small>{{ task.rateePosition || '—' }}</small>
            </td>
            <td>{{ task.organizationalUnit || '—' }}</td>
            <td>{{ raterTypeLabel(task.raterType) }}</td>
            <td><StatusPill :status="task.status" /></td>
            <td style="white-space:nowrap;">{{ formatDateTime(task.submittedAt || task.lastSavedAt) }}</td>
            <td style="text-align:right;">
              <RouterLink
                :to="{ path: '/evaluation', query: { assignment: task.id } }"
                :class="['pui-btn', 'pui-btn-sm', task.status !== 'SUBMITTED' && 'pui-btn-primary']"
              >
                {{ actionLabel(task.status) }}
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>

      <ul v-if="isNarrow" style="list-style:none; margin:0; padding:0;">
        <li v-for="task in filteredItems" :key="task.id" style="padding:14px 16px; border-bottom:1px solid #eef2f7;">
          <div class="pui-row-between">
            <div style="min-width:0;">
              <strong style="display:block; font-size:14px; color:#0f172a;">{{ task.rateeName }}</strong>
              <span style="display:block; font-size:12px; color:#64748b; margin-top:2px;">{{ task.rateePosition || '—' }}</span>
            </div>
            <StatusPill :status="task.status" />
          </div>
          <dl style="margin:10px 0 0; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <dt style="font-size:10px; font-weight:800; text-transform:uppercase; color:#94a3b8;">Unit</dt>
              <dd style="margin:2px 0 0; font-size:12px; font-weight:700; color:#334155;">{{ task.organizationalUnit || '—' }}</dd>
            </div>
            <div>
              <dt style="font-size:10px; font-weight:800; text-transform:uppercase; color:#94a3b8;">Your Role</dt>
              <dd style="margin:2px 0 0; font-size:12px; font-weight:700; color:#334155;">{{ raterTypeLabel(task.raterType) }}</dd>
            </div>
          </dl>
          <RouterLink
            :to="{ path: '/evaluation', query: { assignment: task.id } }"
            :class="['pui-btn', 'pui-btn-block', task.status !== 'SUBMITTED' && 'pui-btn-primary']"
            style="margin-top:12px;"
          >
            {{ actionLabel(task.status) }}
          </RouterLink>
        </li>
      </ul>
    </DataPanel>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
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
const isNarrow = ref(false)

onMounted(() => {
  load()
  checkWidth()
  window.addEventListener('resize', checkWidth)
})
onUnmounted(() => window.removeEventListener('resize', checkWidth))

function checkWidth() {
  isNarrow.value = window.innerWidth < 720
}

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
