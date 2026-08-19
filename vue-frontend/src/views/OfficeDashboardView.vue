<template>
  <div class="pui-page office-dashboard-page">
    <PageHeader
      kicker="Office Administration"
      title="Office Assessment Dashboard"
      :subtitle="`${officeName || 'Your office'} - ${period.label || 'current assessment period'}`"
    >
      <template #actions>
        <button class="pui-btn" type="button" :disabled="loading" @click="load">
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </template>
    </PageHeader>

    <div v-if="error" class="pui-card pui-alert pui-alert-error dashboard-alert" role="alert">
      <p class="pui-alert-title">Office monitoring could not be loaded</p>
      <p>{{ error }}</p>
      <button class="pui-btn pui-btn-sm" type="button" @click="load">Try again</button>
    </div>

    <section class="pui-card insight-section">
      <div class="section-head">
        <div>
          <h2 class="pui-card-title">Personnel Status</h2>
          <p class="pui-card-subtitle">Actual people and assessment outcomes for {{ period.label || 'this period' }}.</p>
        </div>
        <RouterLink to="/office-management?tab=personnel" class="pui-btn">Personnel List</RouterLink>
      </div>

      <div v-if="loading" class="loading-panel">Loading office activity...</div>
      <div v-else class="insight-grid">
        <button class="insight-card pending" type="button" @click="openPersonnelList('Pending rating tasks', insights.pendingPersonnel, 'pending')">
          <span class="eyebrow">Needs follow-up</span>
          <strong>{{ insights.pendingPersonnel.length }}</strong>
          <span>personnel with pending rating tasks</span>
        </button>
        <button class="insight-card good" type="button" @click="openPersonnelList('Outstanding personnel', insights.outstandingPersonnel, 'score')">
          <span class="eyebrow">High performers</span>
          <strong>{{ insights.outstandingPersonnel.length }}</strong>
          <span>personnel rated Outstanding</span>
        </button>
        <button class="insight-card risk" type="button" @click="openPersonnelList('Needs Improvement / lowest ratings', needsImprovementRows, 'score')">
          <span class="eyebrow">For coaching</span>
          <strong>{{ insights.needsImprovementPersonnel.length }}</strong>
          <span>personnel needing improvement</span>
        </button>
      </div>
    </section>

    <section class="pui-card insight-section">
      <div class="section-head scope-head">
        <div>
          <h2 class="pui-card-title">Group Performance</h2>
          <p class="pui-card-subtitle">Top sections, divisions, and office rollups that need attention or recognition.</p>
        </div>
        <div class="scope-tabs" role="tablist" aria-label="Group scope" :style="{ '--scope-tab-count': scopeOptions.length }">
          <button
            v-for="option in scopeOptions"
            :key="option.value"
            class="scope-tab"
            :class="{ active: scope === option.value }"
            type="button"
            @click="scope = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="group-grid">
        <GroupList
          title="Top Outstanding"
          empty-text="No Outstanding ratings yet."
          :items="currentTop.outstanding"
          metric="outstandingCount"
          metric-label="Outstanding"
          @open="openGroupList"
        />
        <GroupList
          title="Top Needs Improvement"
          empty-text="No Needs Improvement ratings yet."
          :items="currentTop.needsImprovement"
          metric="needsImprovementCount"
          metric-label="Needs Improvement"
          @open="openGroupList"
        />
        <GroupList
          title="Pending Rating Workload"
          empty-text="No pending rating tasks."
          :items="currentTop.pending"
          metric="pendingTasks"
          metric-label="Pending tasks"
          @open="openGroupList"
        />
      </div>
    </section>

    <section class="pui-card" style="overflow:hidden;">
      <div class="pui-card-header">
        <h2 class="pui-card-title">Items Needing Attention</h2>
      </div>
      <ul class="attention-list">
        <li v-for="item in attention" :key="item.label" class="attention-row">
          <StatusPill :status="item.level" />
          <div>
            <p>{{ item.label }}</p>
            <span>{{ item.detail }}</span>
          </div>
        </li>
      </ul>
    </section>

    <p v-if="lastUpdatedLabel" class="last-updated">Last updated {{ lastUpdatedLabel }}</p>

    <div v-if="detail" class="detail-overlay" @click.self="detail = null">
      <div class="detail-modal" role="dialog" aria-modal="true" :aria-label="detail.title">
        <div class="detail-head">
          <div>
            <h2>{{ detail.title }}</h2>
            <p>{{ detail.rows.length }} record{{ detail.rows.length === 1 ? '' : 's' }} shown</p>
          </div>
          <button class="modal-close" type="button" aria-label="Close" @click="detail = null">x</button>
        </div>
        <div class="detail-body">
          <table v-if="detail.rows.length" class="detail-table">
            <thead>
              <tr>
                <th>{{ detail.kind === 'group' ? 'Group' : 'Personnel' }}</th>
                <th>Division</th>
                <th>Section</th>
                <th>{{ detail.kind === 'pending' ? 'Pending' : 'Rating' }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in detail.rows" :key="row.id || row.label || row.name">
                <td>
                  <strong>{{ row.name || row.label }}</strong>
                  <span v-if="row.role">{{ row.role }}</span>
                </td>
                <td>{{ row.division || '-' }}</td>
                <td>{{ row.section || '-' }}</td>
                <td>{{ detailMetric(row, detail.kind) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-detail">No records for this view yet.</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { portalApi } from '@/services/api'
import { useBranding } from '@/composables/useBranding'
import { usePermissions } from '@/composables/usePermissions'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusPill from '@/components/ui/StatusPill.vue'

const GroupList = defineComponent({
  props: {
    title: { type: String, required: true },
    emptyText: { type: String, default: 'No data yet.' },
    items: { type: Array, default: () => [] },
    metric: { type: String, required: true },
    metricLabel: { type: String, required: true }
  },
  emits: ['open'],
  setup(props, { emit }) {
    return () => h('div', { class: 'group-card' }, [
      h('h3', props.title),
      props.items.length
        ? h('div', { class: 'group-list' }, props.items.map(item =>
            h('button', { class: 'group-row', type: 'button', onClick: () => emit('open', item) }, [
              h('span', { class: 'group-label', title: item.label }, item.label),
              h('span', { class: 'group-meta' }, [
                h('strong', item[props.metric] || 0),
                ` ${props.metricLabel}`,
                item.averageScore ? ` · ${item.averageScore} avg` : '',
                item.totalTasks ? ` · ${item.completionRate || 0}% submitted` : ''
              ])
            ])
          ))
        : h('div', { class: 'empty-detail compact' }, props.emptyText)
    ])
  }
})

const { officeName } = useBranding()
const { isStbSystemAdmin, systemScope, canViewClusterMonitoring } = usePermissions()

const EMPTY_KPIS = {
  totalPersonnel: 0, activePersonnel: 0, pendingValidation: 0, inactivePersonnel: 0,
  totalTasks: 0, submittedTasks: 0, outstandingTasks: 0, completionRate: 0,
  assessmentRecords: 0, finalizedRecords: 0
}

const EMPTY_INSIGHTS = {
  pendingPersonnel: [],
  outstandingPersonnel: [],
  needsImprovementPersonnel: [],
  lowestPersonnel: [],
  top: {
    section: { outstanding: [], needsImprovement: [], pending: [], all: [] },
    division: { outstanding: [], needsImprovement: [], pending: [], all: [] },
    office: { outstanding: [], needsImprovement: [], pending: [], all: [] }
  }
}

const loading = ref(false)
const error = ref('')
const kpis = ref({ ...EMPTY_KPIS })
const period = ref({})
const attention = ref([])
const insights = ref(cloneInsights())
const scope = ref('section')
const detail = ref(null)
const lastUpdatedAt = ref(null)

const canUseOfficeScope = computed(() =>
  isStbSystemAdmin.value ||
  systemScope.value === 'CLUSTER_ADMIN' ||
  canViewClusterMonitoring.value
)

const scopeOptions = computed(() => [
  { value: 'section', label: 'Sections' },
  { value: 'division', label: 'Divisions' },
  ...(canUseOfficeScope.value ? [{ value: 'office', label: 'Office' }] : [])
])

onMounted(load)

watch(canUseOfficeScope, allowed => {
  if (!allowed && scope.value === 'office') scope.value = 'section'
}, { immediate: true })

const currentTop = computed(() =>
  (insights.value.top && insights.value.top[scope.value]) || cloneInsights().top.section
)

const needsImprovementRows = computed(() =>
  insights.value.needsImprovementPersonnel.length
    ? insights.value.needsImprovementPersonnel
    : insights.value.lowestPersonnel
)

const lastUpdatedLabel = computed(() =>
  lastUpdatedAt.value ? lastUpdatedAt.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await portalApi.officeSummary()
    kpis.value = { ...EMPTY_KPIS, ...(data.kpis || {}) }
    period.value = data.period || {}
    attention.value = data.attention || []
    insights.value = { ...cloneInsights(), ...(data.insights || {}) }
    lastUpdatedAt.value = new Date()
  } catch (e) {
    error.value = e?.message || 'Please check your connection and try again.'
  } finally {
    loading.value = false
  }
}

function cloneInsights() {
  return JSON.parse(JSON.stringify(EMPTY_INSIGHTS))
}

function openPersonnelList(title, rows, kind) {
  detail.value = { title, rows: rows || [], kind }
}

function openGroupList(group) {
  const label = group.label
  const rows = [
    ...insights.value.pendingPersonnel,
    ...insights.value.outstandingPersonnel,
    ...needsImprovementRows.value
  ].filter(row => matchesScope(row, label))

  detail.value = {
    title: `${label} details`,
    rows: rows.length ? uniqueRows(rows) : [group],
    kind: rows.length ? 'score' : 'group'
  }
}

function matchesScope(row, label) {
  if (!row || !label) return false
  if (scope.value === 'office') return true
  return String(row[scope.value] || '').trim() === String(label).trim()
}

function uniqueRows(rows) {
  const seen = new Set()
  return rows.filter(row => {
    const key = row.id || `${row.name}-${row.division}-${row.section}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function detailMetric(row, kind) {
  if (kind === 'pending') return `${row.pendingTasks || 0} of ${row.totalTasks || 0} tasks pending`
  if (kind === 'group') {
    return `${row.outstandingCount || 0} Outstanding · ${row.needsImprovementCount || 0} Needs Improvement · ${row.pendingTasks || 0} pending`
  }
  const score = row.score || row.averageScore
  return `${row.descriptor || 'Scored'}${score ? ` · ${score}` : ''}`
}
</script>

<style>
.dashboard-alert { padding: 16px; }
.dashboard-alert .pui-btn { margin-top: 10px; }
.insight-section { padding: 18px; }
.section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.scope-head { align-items: center; }
.loading-panel { min-height: 132px; display: grid; place-items: center; color: #64748b; font-size: 13px; background: #f8fafc; border: 1px dashed #dbe5f1; border-radius: 8px; }
.insight-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.insight-card { text-align: left; border: 1px solid #dbe5f1; background: #fff; border-radius: 8px; padding: 16px; cursor: pointer; display: grid; gap: 7px; min-height: 132px; transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease; }
.insight-card:hover { border-color: #7aa7e8; box-shadow: 0 10px 24px rgba(15, 23, 42, .08); transform: translateY(-1px); }
.insight-card strong { font-size: 34px; line-height: 1; color: #061a36; }
.insight-card span:last-child { font-size: 13px; color: #475569; line-height: 1.35; }
.eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; font-weight: 800; }
.insight-card.good { border-top: 3px solid #16a34a; }
.insight-card.pending { border-top: 3px solid #f59e0b; }
.insight-card.risk { border-top: 3px solid #ef4444; }
.scope-tabs { display: grid; grid-template-columns: repeat(var(--scope-tab-count, 2), minmax(92px, 1fr)); gap: 6px; padding: 4px; background: #eef4fb; border-radius: 8px; }
.scope-tab { border: 0; background: transparent; color: #475569; font-weight: 700; font-size: 13px; border-radius: 6px; padding: 9px 12px; cursor: pointer; }
.scope-tab.active { background: #061a36; color: #fff; }
.group-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.group-card { border: 1px solid #dbe5f1; border-radius: 8px; overflow: hidden; background: #fff; min-height: 192px; }
.group-card h3 { margin: 0; padding: 14px 16px; font-size: 14px; border-bottom: 1px solid #eef2f7; color: #0f172a; }
.group-list { display: grid; }
.group-row { display: grid; gap: 4px; text-align: left; padding: 13px 16px; border: 0; border-top: 1px solid #f1f5f9; background: #fff; cursor: pointer; }
.group-row:first-child { border-top: 0; }
.group-row:hover { background: #f8fbff; }
.group-label { font-size: 13px; font-weight: 800; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.group-meta { font-size: 12px; color: #64748b; }
.attention-list { list-style: none; margin: 0; padding: 0; }
.attention-row { padding: 12px 16px; border-top: 1px solid #eef2f7; display: flex; align-items: flex-start; gap: 10px; }
.attention-row p { margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; }
.attention-row span { display: block; margin-top: 2px; font-size: 12px; color: #64748b; line-height: 1.5; }
.last-updated { font-size: 11px; color: #94a3b8; padding: 0 2px; }
.detail-overlay { position: fixed; inset: 0; z-index: 350; background: rgba(15, 23, 42, .45); display: flex; align-items: center; justify-content: center; padding: 18px; }
.detail-modal { width: min(920px, 100%); max-height: 86vh; background: #fff; border-radius: 8px; box-shadow: 0 24px 64px rgba(15, 23, 42, .24); display: flex; flex-direction: column; overflow: hidden; }
.detail-head { display: flex; justify-content: space-between; gap: 14px; padding: 18px 20px; border-bottom: 1px solid #e5edf7; background: #f8fafc; }
.detail-head h2 { margin: 0; font-size: 17px; color: #0f172a; }
.detail-head p { margin: 4px 0 0; font-size: 12px; color: #64748b; }
.modal-close { width: 34px; height: 34px; border: 1px solid #d5e0ef; background: #fff; color: #0f172a; border-radius: 8px; font-weight: 900; cursor: pointer; }
.detail-body { overflow: auto; }
.detail-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.detail-table th { text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; background: #f8fafc; padding: 11px 14px; border-bottom: 1px solid #e5edf7; }
.detail-table td { padding: 12px 14px; border-bottom: 1px solid #eef2f7; color: #0f172a; vertical-align: top; }
.detail-table td strong { display: block; }
.detail-table td span { display: block; margin-top: 2px; color: #64748b; font-size: 12px; }
.empty-detail { display: grid; place-items: center; min-height: 130px; color: #64748b; font-size: 13px; text-align: center; padding: 20px; }
.empty-detail.compact { min-height: 120px; }

@media (max-width: 980px) {
  .insight-grid,
  .group-grid { grid-template-columns: 1fr; }
  .section-head { flex-direction: column; }
  .scope-tabs { width: 100%; }
}
</style>
