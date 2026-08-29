<template>
  <div class="pui-page office-dashboard-page">
    <PageHeader
      kicker="Office Administration"
      title="Office Assessment Dashboard"
      :subtitle="`${officeName || 'Your office'} - ${periodLabel}`"
    >
      <template #actions>
        <div class="dashboard-actions">
          <label class="period-control">
            <span>Semester</span>
            <select v-model.number="selectedSemester" class="period-select" :disabled="loading" @change="load({ notify: true })">
              <option :value="1">Semester 1</option>
              <option :value="2">Semester 2</option>
            </select>
          </label>
          <label class="period-control">
            <span>Year</span>
            <select v-model.number="selectedYear" class="period-select" :disabled="loading" @change="load({ notify: true })">
              <option v-for="year in yearOptions" :key="year" :value="year">{{ year }}</option>
            </select>
          </label>
          <button class="pui-btn" type="button" :disabled="loading" @click="load">
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </template>
    </PageHeader>

    <div v-if="error" class="pui-card pui-alert pui-alert-error dashboard-alert" role="alert">
      <p class="pui-alert-title">Office monitoring could not be loaded</p>
      <p>{{ error }}</p>
      <button class="pui-btn pui-btn-sm" type="button" @click="load">Try again</button>
    </div>

    <div v-if="loading && loadingNotice" class="dashboard-loading-note" role="status">
      {{ loadingNotice }}
    </div>

    <section class="pui-card insight-section">
      <div class="section-head">
        <div>
          <h2 class="pui-card-title">Personnel Status</h2>
          <p class="pui-card-subtitle">Actual people and assessment outcomes for {{ periodLabel }}.</p>
        </div>
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
          :empty-text="`No Outstanding ratings found for ${periodLabel}.`"
          :items="currentTop.outstanding"
          kind="outstanding"
          metric="outstandingCount"
          metric-label="Outstanding"
          @open="openGroupList"
        />
        <GroupList
          title="Top Needs Improvement"
          :empty-text="`No Needs Improvement ratings found for ${periodLabel}.`"
          :items="currentTop.needsImprovement"
          kind="needsImprovement"
          metric="needsImprovementCount"
          metric-label="Needs Improvement"
          @open="openGroupList"
        />
        <GroupList
          title="Pending Rating Workload"
          :empty-text="`No pending rating tasks found for ${periodLabel}.`"
          :items="currentTop.pending"
          kind="pending"
          metric="pendingTasks"
          metric-label="Pending tasks"
          @open="openGroupList"
        />
      </div>
    </section>

    <section class="pui-card insight-section">
      <div class="section-head">
        <div>
          <h2 class="pui-card-title">Personnel Score List</h2>
          <p class="pui-card-subtitle">All personnel for {{ periodLabel }}, sorted highest score first; pending or uncomputed records stay below scored records.</p>
        </div>
      </div>

      <div v-if="loading" class="loading-panel">Loading personnel scores...</div>
      <div v-else-if="personnelScoreRows.length" class="score-list-wrap">
        <table class="score-list-table">
          <thead>
            <tr>
              <th>Personnel</th>
              <th>Division</th>
              <th>Section</th>
              <th>Rating</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in personnelScoreRows" :key="row.id || row.name">
              <td data-label="Personnel">
                <strong>{{ row.name }}</strong>
                <span>{{ row.role || '-' }}</span>
              </td>
              <td data-label="Division">{{ displayDivision(row.division) || '-' }}</td>
              <td data-label="Section">{{ row.section || '-' }}</td>
              <td data-label="Rating">
                <span :class="['score-chip', scoreChipTone(row)]">{{ scoreLabel(row) }}</span>
              </td>
              <td data-label="Progress">{{ progressLabel(row) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-detail compact">No personnel score records found for {{ periodLabel }}.</div>
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
                <td :data-label="detail.kind === 'group' ? 'Group' : 'Personnel'">
                  <strong>{{ row.name || row.label }}</strong>
                  <span v-if="row.role">{{ row.role }}</span>
                </td>
                <td data-label="Division">{{ displayDivision(row.division) || '-' }}</td>
                <td data-label="Section">{{ row.section || '-' }}</td>
                <td :data-label="detail.kind === 'pending' ? 'Pending' : 'Rating'">{{ detailMetric(row, detail.kind) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-detail">No records found for {{ periodLabel }}.</div>
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
import { useOrgOptions } from '@/composables/useOrgOptions'
import { usePermissions } from '@/composables/usePermissions'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusPill from '@/components/ui/StatusPill.vue'

const GroupList = defineComponent({
  props: {
    title: { type: String, required: true },
    emptyText: { type: String, default: 'No data yet.' },
    items: { type: Array, default: () => [] },
    kind: { type: String, default: 'score' },
    metric: { type: String, required: true },
    metricLabel: { type: String, required: true }
  },
  emits: ['open'],
  setup(props, { emit }) {
    return () => h('div', { class: 'group-card' }, [
      h('h3', props.title),
      props.items.length
        ? h('div', { class: 'group-list' }, props.items.map(item =>
            h('button', { class: 'group-row', type: 'button', onClick: () => emit('open', item, props.kind) }, [
              h('span', { class: 'group-label', title: item.label }, item.label),
              h('span', { class: 'group-meta' }, [
                h('strong', item[props.metric] || 0),
                ` ${props.metricLabel}`,
                item.averageScore ? ` · ${item.averageScore} avg` : '',
                item.totalTasks ? ` · ${item.completionRate || 0}% submitted` : ''
              ]),
              item.previewRows?.length
                ? h('div', { class: 'group-preview-wrap' }, [
                    h('ol', { class: 'group-preview' }, item.previewRows.map(row =>
                      h('li', { key: row.id || row.name }, [
                        h('span', { class: 'preview-name', title: row.name }, row.name),
                        h('span', { class: 'preview-score' }, row.score ? `${row.score} · ${row.descriptor || 'Scored'}` : (row.status || 'Not computed'))
                      ])
                    )),
                    item.previewMoreCount > 0
                      ? h('span', { class: 'preview-more' }, `+ ${item.previewMoreCount} more in details`)
                      : null
                  ])
                : null
            ])
          ))
        : h('div', { class: 'empty-detail compact' }, props.emptyText)
    ])
  }
})

const { officeName } = useBranding()
const { loadOrgOptions, currentDivisions } = useOrgOptions()
const { isStbSystemAdmin, systemScope, canViewClusterMonitoring, isExplicitOfficeAdmin, hasPermission } = usePermissions()
const now = new Date()
const currentYear = now.getFullYear()
const currentSemester = now.getMonth() < 6 ? 1 : 2

const FALLBACK_DIVISION_NAMES = {
  'admin-pool': 'Admin Pool',
  dfd: 'Design Formulation Division',
  pid: 'Pilot Implementation Division',
  staed: 'Social Technology Analysis and Evaluation Division'
}

const EMPTY_KPIS = {
  totalPersonnel: 0, activePersonnel: 0, pendingValidation: 0, inactivePersonnel: 0,
  totalTasks: 0, submittedTasks: 0, outstandingTasks: 0, completionRate: 0,
  assessmentRecords: 0, finalizedRecords: 0
}

const EMPTY_INSIGHTS = {
  allPersonnelScores: [],
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
const selectedSemester = ref(currentSemester)
const selectedYear = ref(currentYear)
const attention = ref([])
const insights = ref(cloneInsights())
const scope = ref('section')
const detail = ref(null)
const lastUpdatedAt = ref(null)
const loadingNotice = ref('')
let loadRequestId = 0

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

onMounted(() => {
  load()
  loadOrgOptions()
})

watch(canUseOfficeScope, allowed => {
  if (!allowed && scope.value === 'office') scope.value = 'section'
}, { immediate: true })

const currentTop = computed(() => {
  const rows = (insights.value.top && insights.value.top[scope.value]) || cloneInsights().top.section
  const normalizedRows = scope.value === 'division'
    ? {
        outstanding: rows.outstanding.map(normalizeDivisionGroup),
        needsImprovement: rows.needsImprovement.map(normalizeDivisionGroup),
        pending: rows.pending.map(normalizeDivisionGroup),
        all: rows.all.map(normalizeDivisionGroup)
      }
    : rows

  return {
    ...normalizedRows,
    outstanding: decorateGroupRows(normalizedRows.outstanding, 'outstanding'),
    needsImprovement: decorateGroupRows(normalizedRows.needsImprovement, 'needsImprovement')
  }
})

const needsImprovementRows = computed(() =>
  insights.value.needsImprovementPersonnel.length
    ? insights.value.needsImprovementPersonnel
    : insights.value.lowestPersonnel
)

const personnelScoreRows = computed(() =>
  sortedDetailRows(uniqueRows(insights.value.allPersonnelScores || [])
    .filter(row => !isSystemAdminPersonnel(row)), 'score')
)

const lastUpdatedLabel = computed(() =>
  lastUpdatedAt.value ? lastUpdatedAt.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
)

const periodLabel = computed(() => selectedPeriodLabel())
const actionableAttention = computed(() =>
  (attention.value || []).filter(item => String(item.level || '').toUpperCase() !== 'ON_TRACK')
)
const canSeeOperationalAttention = computed(() =>
  isExplicitOfficeAdmin.value || hasPermission('manage_office_rater_matrix').value
)

const yearOptions = computed(() => {
  const years = []
  const maxYear = Math.max(currentYear + 1, 2027)
  for (let year = 2025; year <= maxYear; year += 1) years.push(year)
  if (selectedYear.value) years.push(Number(selectedYear.value))
  return Array.from(new Set(years)).sort((a, b) => a - b)
})

async function load(options = {}) {
  const requestId = ++loadRequestId
  loading.value = true
  loadingNotice.value = options.notify
    ? `Loading ${selectedPeriodLabel()} monitoring data...`
    : ''
  error.value = ''
  detail.value = null
  period.value = {
    semester: selectedSemester.value,
    year: selectedYear.value,
    label: selectedPeriodLabel()
  }
  kpis.value = { ...EMPTY_KPIS }
  attention.value = []
  insights.value = cloneInsights()
  try {
    const data = await portalApi.officeSummary({
      semester: selectedSemester.value,
      year: selectedYear.value
    })
    if (requestId !== loadRequestId) return
    kpis.value = { ...EMPTY_KPIS, ...(data.kpis || {}) }
    period.value = data.period || {}
    attention.value = data.attention || []
    insights.value = { ...cloneInsights(), ...(data.insights || {}) }
    lastUpdatedAt.value = new Date()
  } catch (e) {
    if (requestId !== loadRequestId) return
    error.value = e?.message || 'Please check your connection and try again.'
  } finally {
    if (requestId === loadRequestId) {
      loading.value = false
      loadingNotice.value = ''
    }
  }
}

function selectedPeriodLabel() {
  return `Semester ${selectedSemester.value} · ${selectedYear.value}`
}

function cloneInsights() {
  return JSON.parse(JSON.stringify(EMPTY_INSIGHTS))
}

function openPersonnelList(title, rows, kind) {
  detail.value = { title, rows: rows || [], kind }
}

function openGroupList(group, kind = 'score') {
  const rawLabel = group.rawLabel || group.label
  const label = scope.value === 'division' ? displayDivision(rawLabel) : group.label
  const sourceRows = kind === 'pending'
    ? insights.value.pendingPersonnel
    : insights.value.allPersonnelScores
  const rows = sourceRows
    .filter(row => matchesScope(row, label, rawLabel))
    .filter(row => matchesGroupKind(row, kind))

  detail.value = {
    title: groupDetailTitle(label, kind),
    rows: rows.length ? sortedDetailRows(uniqueRows(rows), kind) : [group],
    kind: rows.length ? (kind === 'pending' ? 'pending' : 'score') : 'group'
  }
}

function groupDetailTitle(label, kind) {
  if (kind === 'outstanding') return `${label} Outstanding details`
  if (kind === 'needsImprovement') return `${label} Needs Improvement details`
  if (kind === 'pending') return `${label} pending rating details`
  return `${label} details`
}

function matchesGroupKind(row, kind) {
  if (kind === 'pending') return true
  if (kind === 'outstanding' || kind === 'needsImprovement') {
    return isPreviewDescriptor(row, kind)
  }
  return true
}

function matchesScope(row, label, rawLabel = label) {
  if (!row || !label) return false
  if (scope.value === 'office') return true
  if (scope.value !== 'division') return String(row[scope.value] || '').trim() === String(label).trim()
  const candidates = divisionMatchCandidates(row.division)
  return candidates.has(normalizeKey(label)) || candidates.has(normalizeKey(rawLabel))
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

function sortedDetailRows(rows, kind = 'score') {
  if (kind === 'pending') {
    return rows.slice().sort((a, b) =>
      (Number(b.pendingTasks) || 0) - (Number(a.pendingTasks) || 0) ||
      scoreSortValue(b) - scoreSortValue(a) ||
      String(a.name || '').localeCompare(String(b.name || ''))
    )
  }
  if (kind === 'needsImprovement') {
    return rows.slice().sort((a, b) =>
      scoreSortValue(a) - scoreSortValue(b) ||
      String(a.name || '').localeCompare(String(b.name || ''))
    )
  }
  return rows.slice().sort((a, b) =>
    scoreSortValue(b) - scoreSortValue(a) ||
    String(a.name || '').localeCompare(String(b.name || ''))
  )
}

function scoreSortValue(row) {
  const score = Number(row?.score ?? row?.averageScore)
  return Number.isFinite(score) && score > 0 ? score : -1
}

function normalizeDivisionGroup(row) {
  const rawLabel = row.rawLabel || row.label
  const label = displayDivision(rawLabel)
  return { ...row, rawLabel, label }
}

function decorateGroupRows(rows, kind) {
  return (rows || []).map(group => ({
    ...group,
    ...groupPreview(group, kind)
  }))
}

function groupPreview(group, kind) {
  const rawLabel = group.rawLabel || group.label
  const label = scope.value === 'division' ? displayDivision(rawLabel) : group.label
  const rows = sortedDetailRows(uniqueRows((insights.value.allPersonnelScores || [])
    .filter(row => matchesScope(row, label, rawLabel))
    .filter(row => isPreviewDescriptor(row, kind))), kind)

  return {
    previewRows: rows.slice(0, 3),
    previewTotal: rows.length,
    previewMoreCount: Math.max(0, rows.length - 3)
  }
}

function isPreviewDescriptor(row, kind) {
  const descriptor = String(row?.descriptor || '').trim()
  if (kind === 'outstanding') return descriptor === 'Outstanding'
  if (kind === 'needsImprovement') {
    return descriptor === 'Needs Improvement' || descriptor === 'Requires Immediate Intervention'
  }
  return false
}

const divisionNameByKey = computed(() => {
  const map = new Map()
  Object.entries(FALLBACK_DIVISION_NAMES).forEach(([id, name]) => {
    map.set(normalizeKey(id), name)
    map.set(normalizeKey(name), name)
  })
  ;(currentDivisions.value || []).forEach(division => {
    const name = division.name || division.divisionName || division.label || ''
    if (!name) return
    ;[division.id, division.divisionId, division.code, division.name, division.divisionName, division.label].forEach(key => {
      const normalized = normalizeKey(key)
      if (normalized) map.set(normalized, name)
    })
  })
  return map
})

function displayDivision(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return divisionNameByKey.value.get(normalizeKey(raw)) || raw
}

function divisionMatchCandidates(value) {
  const raw = String(value || '').trim()
  const display = displayDivision(raw)
  return new Set([normalizeKey(raw), normalizeKey(display)].filter(Boolean))
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase()
}

function detailMetric(row, kind) {
  if (kind === 'pending') {
    const pending = `${row.pendingTasks || 0} of ${row.totalTasks || 0} tasks pending`
    const score = row.score || row.averageScore
    return score ? `${row.descriptor || 'Scored'} · ${score} · ${pending}` : pending
  }
  if (kind === 'group') {
    return `${row.outstandingCount || 0} Outstanding · ${row.needsImprovementCount || 0} Needs Improvement · ${row.pendingTasks || 0} pending`
  }
  const score = row.score || row.averageScore
  return score ? `${row.descriptor || 'Scored'} · ${score}` : (row.status || 'Not computed')
}

function scoreLabel(row) {
  const score = row.score || row.averageScore
  if (score) return `${score} · ${row.descriptor || 'Scored'}`
  return row.status || 'Pending / not computed'
}

function progressLabel(row) {
  const total = Number(row.totalTasks) || 0
  const completed = Number(row.completedTasks) || Math.max(0, total - (Number(row.pendingTasks) || 0))
  const pending = Number(row.pendingTasks) || 0
  if (!total) return row.status || 'No tasks yet'
  if (pending > 0) return `${completed} of ${total} submitted · ${pending} pending`
  return `${completed} of ${total} submitted`
}

function scoreChipTone(row) {
  const descriptor = String(row?.descriptor || '').trim()
  if (!row?.score && !row?.averageScore) return 'muted'
  if (descriptor === 'Outstanding') return 'good'
  if (descriptor === 'Very Satisfactory') return 'blue'
  if (descriptor === 'Needs Improvement' || descriptor === 'Requires Immediate Intervention') return 'risk'
  return 'neutral'
}

function isSystemAdminPersonnel(row) {
  const role = String(row?.role || '').trim().toLowerCase()
  return role === 'system administrator' ||
    role === 'super admin' ||
    role === 'super administrator'
}
</script>

<style>
.dashboard-alert { padding: 16px; }
.dashboard-alert .pui-btn { margin-top: 10px; }
.dashboard-actions { display: flex; align-items: end; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
.dashboard-loading-note { margin: -6px 0 12px; padding: 10px 14px; border: 1px solid #bfdbfe; border-radius: 8px; background: #eff6ff; color: #1d4ed8; font-size: 13px; font-weight: 700; }
.period-control { display: grid; gap: 4px; min-width: 128px; }
.period-control span { color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
.period-select { height: 34px; border: 1px solid #d5e0ef; border-radius: 8px; background: #fff; color: #0f172a; font-size: 13px; font-weight: 700; outline: none; padding: 0 34px 0 10px; }
.period-select:focus { border-color: #1d4ed8; box-shadow: 0 0 0 3px rgba(29, 78, 216, .14); }
.period-select:disabled { background: #f8fafc; color: #94a3b8; cursor: not-allowed; }
.insight-section { padding: 18px; }
.section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.scope-head { align-items: center; }
.loading-panel { min-height: 132px; display: grid; place-items: center; color: #64748b; font-size: 13px; background: #f8fafc; border: 1px dashed #dbe5f1; border-radius: 8px; }
.score-list-wrap { overflow: auto; border: 1px solid #dbe5f1; border-radius: 8px; max-height: 420px; background: #fff; }
.score-list-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.score-list-table th { position: sticky; top: 0; z-index: 1; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; background: #f8fafc; padding: 11px 14px; border-bottom: 1px solid #e5edf7; }
.score-list-table td { padding: 12px 14px; border-bottom: 1px solid #eef2f7; color: #0f172a; vertical-align: top; }
.score-list-table td strong { display: block; color: #0f172a; }
.score-list-table td span:not(.score-chip) { display: block; margin-top: 2px; color: #64748b; font-size: 12px; }
.score-chip { display: inline-flex; align-items: center; min-height: 22px; border-radius: 999px; padding: 3px 8px; font-size: 11px; font-weight: 800; border: 1px solid #dbe5f1; color: #334155; background: #f8fafc; white-space: nowrap; }
.score-chip.good { color: #047857; background: #ecfdf5; border-color: #bbf7d0; }
.score-chip.blue { color: #0b4bb3; background: #eff6ff; border-color: #bfdbfe; }
.score-chip.risk { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
.score-chip.muted { color: #64748b; background: #f8fafc; border-color: #e2e8f0; }
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
.group-list { display: grid; gap: 10px; padding: 12px; }
.group-row { display: grid; gap: 4px; text-align: left; padding: 12px; border: 1px solid #dbe5f1; border-radius: 8px; background: #fff; cursor: pointer; box-shadow: 0 1px 0 rgba(15, 23, 42, .03); }
.group-row:hover { background: #f8fbff; border-color: #bfd7f6; }
.group-label { font-size: 13px; font-weight: 800; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.group-meta { font-size: 12px; color: #64748b; }
.group-preview-wrap { margin-top: 8px; padding-top: 9px; border-top: 1px dashed #c9d8ea; display: grid; gap: 7px; }
.group-preview { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.group-preview li { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 20px; }
.preview-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #334155; font-size: 12px; font-weight: 700; }
.preview-score { color: #0b4bb3; background: #eff6ff; border: 1px solid #dbeafe; border-radius: 999px; padding: 2px 7px; font-size: 10.5px; font-weight: 800; white-space: nowrap; }
.preview-more { color: #64748b; font-size: 11px; font-weight: 800; }
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
  .dashboard-actions { width: 100%; justify-content: stretch; }
  .dashboard-actions .pui-btn,
  .period-control { flex: 1 1 150px; }
  .period-select { width: 100%; }
  .insight-grid,
  .group-grid { grid-template-columns: 1fr; }
  .section-head { flex-direction: column; }
  .scope-tabs { width: 100%; }
  .detail-overlay { align-items: flex-end; padding: 10px; }
  .detail-modal { width: 100%; max-height: 92vh; }
  .detail-head { padding: 14px 16px; }
}

@media (max-width: 720px) {
  .office-dashboard-page { gap: 12px; }
  .insight-section { padding: 14px; }
  .dashboard-actions { gap: 8px; }
  .dashboard-actions .pui-btn,
  .period-control { flex-basis: 100%; }
  .insight-card { min-height: 112px; padding: 14px; }
  .group-list { padding: 10px; }
  .group-preview li { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  .preview-score { justify-self: start; }
  .score-list-wrap,
  .detail-body { border: 0; overflow: auto; }
  .score-list-table,
  .score-list-table thead,
  .score-list-table tbody,
  .score-list-table tr,
  .score-list-table th,
  .score-list-table td,
  .detail-table,
  .detail-table thead,
  .detail-table tbody,
  .detail-table tr,
  .detail-table th,
  .detail-table td { display: block; }
  .score-list-table thead,
  .detail-table thead { display: none; }
  .score-list-table tr,
  .detail-table tr {
    border: 1px solid #dbe5f1;
    border-radius: 8px;
    margin-bottom: 10px;
    overflow: hidden;
    background: #fff;
  }
  .score-list-table td,
  .detail-table td {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 10px;
    padding: 9px 12px;
    border-bottom: 1px solid #eef2f7;
    word-break: break-word;
  }
  .score-list-table td::before,
  .detail-table td::before {
    content: attr(data-label);
    color: #64748b;
    font-size: 10.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  .score-list-table td:last-child,
  .detail-table td:last-child { border-bottom: 0; }
  .score-chip,
  .preview-score { white-space: normal; text-align: left; }
}
</style>
