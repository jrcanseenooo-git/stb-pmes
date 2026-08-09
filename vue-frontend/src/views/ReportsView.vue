<template>
  <div class="reports-page">

    <div class="content-card">

    <div class="page-hd">
      <div>
        <h2 class="page-title">Reports</h2>
        <p class="page-sub">Generate and export performance reports</p>
      </div>
    </div>

    <div class="reports-grid">
      <!-- Generate panel -->
      <div class="panel">
        <div class="panel-hd">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M5 8h6M5 5h6M5 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Generate Report
        </div>
        <div class="panel-body">
          <div class="field">
            <label class="field-label">Report Type <span class="req">*</span></label>
            <select v-model="form.type" class="field-input">
              <option v-for="t in reportTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
            <p v-if="isUndersecretaryReport" class="field-note">Generates an annex-ready analytics table with interpretation distribution and domain averages. Office admins are limited to their assigned office/program.</p>
          </div>
          <div class="form-row">
            <div v-if="!isUndersecretaryReport" class="field">
              <label class="field-label">Division</label>
              <select v-model="form.divisionId" class="field-input">
                <option v-if="canSelectAllDivisions" value="">All Divisions</option>
                <option v-for="d in divisions" :key="d.id" :value="d.id">{{ d.name }}</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">Semester</label>
              <select v-model="form.semester" class="field-input">
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">Year</label>
              <input v-model.number="form.year" type="number" class="field-input"/>
            </div>
          </div>
          <div class="field">
            <label class="field-label">Format</label>
            <div class="format-row">
              <label v-for="f in availableFormats" :key="f.value" :class="['format-opt', form.format === f.value && 'active']" @click="form.format = f.value">
                <svg v-if="f.value === 'pdf'" width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M6 6h6M6 9h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                <svg v-else-if="f.value === 'excel'" width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M6 7l2 4M8 7l-2 4M10 7v4M10 9h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                <svg v-else width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M6 6h6M6 9h6M6 12h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                {{ f.label }}
              </label>
            </div>
          </div>
          <button class="btn btn-primary btn-full" @click="loadPreview" :disabled="previewing">
            <span v-if="previewing" class="spinner-sm"></span>
            <svg v-else width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 10.5h9M3 8l2-2 2 1.5L10 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            {{ previewing ? 'Loading analytics...' : 'Preview Analytics' }}
          </button>
          <button class="btn btn-full" @click="generate" :disabled="generating || !preview">
            <span v-if="generating" class="spinner-sm dark"></span>
            {{ generating ? 'Exporting...' : 'Export Current Report' }}
          </button>
        </div>
      </div>

      <!-- Recent reports -->
      <div class="panel">
        <div class="panel-hd">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Recent Reports
        </div>
        <div v-if="!recentReports.length" class="panel-empty">No reports generated yet.</div>
        <div v-else class="report-list">
          <div v-for="r in recentReports" :key="r.id" class="report-item">
            <div class="report-icon" :class="r.format">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M4 5h6M4 7h4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
            </div>
            <div class="report-info">
              <div class="report-name">{{ r.name }}</div>
              <div class="report-meta">{{ fmtDate(r.createdAt) }} · {{ r.format?.toUpperCase() }}</div>
            </div>
            <button class="btn btn-xs" @click="downloadReport(r)">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v6M3 5l2.5 2L8 5M2 9h7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="preview" class="analytics-board">
      <div class="analytics-hd">
        <div>
          <p class="eyebrow">{{ preview.scopeLabel }} · S{{ preview.semester }} {{ preview.year }}</p>
          <h3>Undersecretary Analytics Preview</h3>
        </div>
        <span class="updated">Updated {{ fmtDateTime(preview.generatedAt) }}</span>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><span>Personnel Covered</span><strong>{{ preview.kpis.personnel }}</strong></div>
        <div class="kpi"><span>Assessment Records</span><strong>{{ preview.kpis.records }}</strong></div>
        <div class="kpi"><span>Scored</span><strong>{{ preview.kpis.scoredPercent }}</strong></div>
        <div class="kpi"><span>Overall Average</span><strong>{{ fmtScore(preview.kpis.overallAverage) }}</strong></div>
      </div>

      <div class="chart-grid">
        <div class="chart-panel">
          <h4>Interpretation Distribution</h4>
          <Bar :data="interpretationChartData" :options="barOptions" />
        </div>
        <div class="chart-panel">
          <h4>Domain Average Scores</h4>
          <div class="domain-chart-layout">
            <Doughnut :data="domainChartData" :options="doughnutOptions" />
            <div class="domain-score-list">
              <div v-for="(domain, index) in preview.domainAverages" :key="domain.label" class="domain-score-row">
                <i :style="{ backgroundColor: domainColors[index % domainColors.length] }"></i>
                <span>{{ domain.label }}</span>
                <strong>{{ fmtScore(domain.average) }}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="office-panel">
        <h4>Office / Program Summary</h4>
        <div class="office-list">
          <div v-for="office in preview.officeSummaries" :key="office.office" class="office-row">
            <div>
              <strong>{{ office.office }}</strong>
              <span>{{ office.scored }}/{{ office.records }} scored · {{ office.pendingAssignments }} pending ratings</span>
            </div>
            <div class="office-score">
              <span>{{ fmtScore(office.overallAverage) }}</span>
              <div class="bar"><i :style="{ width: scoreWidth(office.overallAverage) }"></i></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    </div>
    <!-- /Content card -->

    <teleport to="body">
      <transition name="toast-slide">
        <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">{{ toast.msg }}</div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { reportsApi } from '@/services/api'
import { Bar, Doughnut } from 'vue-chartjs'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js'

const generating    = ref(false)
const previewing    = ref(false)
const recentReports = ref([])
const preview       = ref(null)
const toast         = ref({ show: false, msg: '', type: 'success' })

// Divisions and report types come from the backend so the form reflects the
// caller's actual scope. Division-level users only ever see their own division
// and never the bureau-wide report.
const divisions             = ref([])
const canSelectAllDivisions = ref(false)
const reportTypes           = ref([
  { value: 'undersecretary-analytics', label: 'Undersecretary Analytics Annex' },
  { value: 'ipcrf-summary',        label: 'IPCRF Accomplishment Summary' },
  { value: 'ccef-summary',         label: 'CCEF Targets Summary' },
  { value: 'division-performance', label: 'Division Performance Report' },
  { value: 'semestral',            label: 'Semestral Performance Report' },
  { value: 'delayed',              label: 'Delayed Submission Report' }
])

const form = ref({
  type:       'undersecretary-analytics',
  divisionId: '',
  semester:   '1',
  year:       new Date().getFullYear(),
  format:     'excel'
})

const formats = [
  { value: 'pdf',   label: 'PDF'   },
  { value: 'excel', label: 'Excel' },
  { value: 'csv',   label: 'CSV'   }
]

const isUndersecretaryReport = computed(() => form.value.type === 'undersecretary-analytics')
const availableFormats = computed(() =>
  isUndersecretaryReport.value
    ? formats.filter(format => format.value !== 'pdf')
    : formats
)

watch(isUndersecretaryReport, (enabled) => {
  if (enabled && form.value.format === 'pdf') form.value.format = 'excel'
}, { immediate: true })

const chartColors = ['#1D4ED8', '#059669', '#F59E0B', '#DC2626', '#7C3AED']
const domainColors = ['#1D4ED8', '#059669', '#F59E0B', '#7C3AED']
const valueLabelPlugin = {
  id: 'pmesValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    ctx.save()
    ctx.font = '700 11px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex)
      meta.data.forEach((element, index) => {
        const raw = dataset.data[index]
        const value = Number(raw || 0)
        if (!value) return
        const label = chart.config.type === 'doughnut'
          ? value.toFixed(2)
          : String(value)
        const position = element.tooltipPosition()
        if (chart.config.type === 'doughnut') {
          ctx.fillStyle = '#0F172A'
          ctx.fillText(label, position.x, position.y)
        } else {
          ctx.fillStyle = '#0F172A'
          ctx.fillText(label, position.x, position.y - 12)
        }
      })
    })
    ctx.restore()
  }
}
ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip, valueLabelPlugin)
const interpretationChartData = computed(() => ({
  labels: (preview.value?.interpretationDistribution || []).map(item => item.label),
  datasets: [{
    label: 'Responses',
    data: (preview.value?.interpretationDistribution || []).map(item => item.count),
    backgroundColor: chartColors,
    borderRadius: 5
  }]
}))
const domainChartData = computed(() => ({
  labels: (preview.value?.domainAverages || []).map(item => item.label),
  datasets: [{
    data: (preview.value?.domainAverages || []).map(item => item.average),
    backgroundColor: domainColors
  }]
}))
const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, pmesValueLabels: true },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
}
const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, pmesValueLabels: true }
}

function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '' }
function fmtDateTime(iso) { return iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '' }
function fmtScore(value) { return Number(value || 0) ? Number(value).toFixed(2) : '-' }
function scoreWidth(value) { return `${Math.max(0, Math.min(100, (Number(value || 0) / 4) * 100))}%` }
function showToast(msg, type = 'success') { toast.value = { show: true, msg, type }; setTimeout(() => { toast.value.show = false }, 3500) }

onMounted(async () => {
  try {
    const opts = await reportsApi.options()
    divisions.value             = opts?.divisions || []
    canSelectAllDivisions.value = !!opts?.canSelectAllDivisions
    if (opts?.types?.length) reportTypes.value = opts.types
    if (reportTypes.value.some(type => type.value === 'undersecretary-analytics')) {
      form.value.type = 'undersecretary-analytics'
    } else if (reportTypes.value.length && !reportTypes.value.some(type => type.value === form.value.type)) {
      form.value.type = reportTypes.value[0].value
    }
    if (!canSelectAllDivisions.value && divisions.value.length) {
      form.value.divisionId = divisions.value[0].id
    }
  } catch (e) { /* keep the built-in defaults if options are unavailable */ }

  try {
    const r = await reportsApi.list()
    recentReports.value = r?.items || (Array.isArray(r) ? r : [])
  } catch (e) { /* silently fail — recent reports is non-critical */ }
  if (form.value.type === 'undersecretary-analytics') loadPreview()
})

async function loadPreview() {
  previewing.value = true
  try {
    preview.value = await reportsApi.preview(form.value)
    showToast('Analytics preview updated.')
  } catch (e) {
    console.error(e)
    showToast(e?.message || 'Could not load analytics preview.', 'error')
  } finally {
    previewing.value = false
  }
}

async function generate() {
  generating.value = true
  try {
    const result = await reportsApi.generate(form.value)
    if (result?.rowCount === 0) {
      showToast('No records matched that division and period.', 'error')
      return
    }
    if (result?.downloadUrl) {
      window.open(result.downloadUrl, '_blank')
    } else if (result?.csv) {
      const blob = new Blob([result.csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `${result.name || 'report-' + Date.now()}.csv`; a.click()
      URL.revokeObjectURL(url)
    }
    showToast(`Report generated — ${result?.rowCount ?? 0} row(s)`)
    if (result?.id) recentReports.value.unshift(result)
  } catch (e) {
    console.error(e)
    // Backend messages below 500 are written for end users — show them.
    showToast(e?.message || 'Something went wrong. Please try again.', 'error')
  } finally {
    generating.value = false
  }
}

function downloadReport(r) {
  if (r.downloadUrl) window.open(r.downloadUrl, '_blank')
}
</script>

<style scoped>
.reports-page { padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif; font-size: 13px; color: #1A2332; min-height: 100%; }
.content-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; padding: 20px; }
.page-hd { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 700; color: #0F172A; margin: 0 0 3px; }
.page-sub { font-size: 12px; color: #94A3B8; margin: 0; }
.reports-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
.analytics-board { margin-top: 18px; border: 1px solid #E2E8F0; border-radius: 12px; background: #fff; overflow: hidden; }
.analytics-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 16px 18px; border-bottom: 1px solid #E2E8F0; }
.analytics-hd h3 { margin: 0; font-size: 17px; color: #0F172A; }
.eyebrow { margin: 0 0 4px; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #64748B; }
.updated { font-size: 11px; color: #64748B; white-space: nowrap; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding: 14px 18px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; }
.kpi { background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; }
.kpi span { display: block; color: #64748B; font-size: 11px; font-weight: 700; text-transform: uppercase; }
.kpi strong { display: block; margin-top: 6px; font-size: 24px; color: #0F172A; }
.chart-grid { display: grid; grid-template-columns: 1.2fr .8fr; gap: 12px; padding: 14px 18px; }
.chart-panel { height: 300px; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px; background: #fff; }
.chart-panel h4, .office-panel h4 { margin: 0 0 12px; font-size: 13px; color: #0F172A; }
.domain-chart-layout { display: grid; grid-template-columns: minmax(0, 1fr) 210px; align-items: center; gap: 12px; height: 248px; }
.domain-score-list { display: grid; gap: 8px; }
.domain-score-row { display: grid; grid-template-columns: 10px 1fr auto; gap: 8px; align-items: center; padding: 8px 0; border-bottom: 1px solid #F1F5F9; }
.domain-score-row:last-child { border-bottom: none; }
.domain-score-row i { width: 10px; height: 10px; border-radius: 3px; }
.domain-score-row span { font-size: 11px; color: #475569; line-height: 1.25; }
.domain-score-row strong { font-size: 14px; color: #0F172A; }
.office-panel { margin: 0 18px 18px; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px; }
.office-list { display: grid; gap: 10px; }
.office-row { display: grid; grid-template-columns: 1fr 190px; align-items: center; gap: 14px; padding: 10px 0; border-bottom: 1px solid #F1F5F9; }
.office-row:last-child { border-bottom: none; }
.office-row strong { display: block; color: #0F172A; font-size: 12px; }
.office-row span { display: block; margin-top: 3px; color: #64748B; font-size: 11px; }
.office-score { display: flex; align-items: center; gap: 10px; }
.office-score > span { width: 42px; color: #0F172A; font-weight: 800; text-align: right; }
.bar { flex: 1; height: 8px; border-radius: 999px; background: #E2E8F0; overflow: hidden; }
.bar i { display: block; height: 100%; border-radius: inherit; background: #1D4ED8; }
.panel { background: #F8FAFC; border: 1px solid #F1F5F9; border-radius: 12px; overflow: hidden; }
.panel-hd { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid #E2E8F0; font-size: 13px; font-weight: 600; color: #0F172A; }
.panel-body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.panel-empty { padding: 36px 18px; text-align: center; color: #94A3B8; font-size: 12px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 11px; font-weight: 600; color: #374151; }
.field-note { margin: 2px 0 0; font-size: 11px; line-height: 1.45; color: #64748B; }
.field-input { padding: 9px 12px; border: 1.5px solid #E2E8F0; border-radius: 9px; font-size: 13px; color: #0F172A; background: #fff; outline: none; transition: border-color .15s; }
.field-input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
.form-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.format-row { display: flex; gap: 8px; }
.format-opt { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 12px; border: 1.5px solid #E2E8F0; border-radius: 9px; cursor: pointer; font-size: 12px; font-weight: 500; color: #374151; transition: all .15s; }
.format-opt:hover { border-color: #CBD5E1; }
.format-opt.active { border-color: #3B82F6; background: #EBF4FF; color: #1A56B0; }
.req { color: #EF4444; font-size: 11px; }
.report-list { padding: 8px 0; }
.report-item { display: flex; align-items: center; gap: 12px; padding: 10px 18px; border-bottom: 1px solid #F1F5F9; }
.report-item:last-child { border-bottom: none; }
.report-item:hover { background: #F8FBFF; }
.report-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.report-icon.pdf   { background: #FEF2F2; color: #B91C1C; }
.report-icon.excel { background: #F0FDF4; color: #15803D; }
.report-icon.csv   { background: #F8FAFC; color: #64748B; }
.report-info { flex: 1; min-width: 0; }
.report-name { font-size: 12px; font-weight: 600; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.report-meta { font-size: 10px; color: #94A3B8; }
.btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; border-radius: 8px; font-size: 12px; cursor: pointer; border: 1px solid #E2E8F0; background: #fff; color: #374151; transition: all .15s; font-weight: 500; }
.btn:hover { border-color: #CBD5E1; background: #F8FAFC; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-primary { background: #0D2137; color: #fff; border-color: #0D2137; }
.btn-primary:hover:not(:disabled) { background: #1e3f61; }
.btn-full { width: 100%; justify-content: center; }
.btn-xs { padding: 4px 9px; font-size: 11px; }
.spinner-sm { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; }
.spinner-sm.dark { border-color: rgba(15,23,42,.2); border-top-color: #0F172A; }
@keyframes spin { to { transform: rotate(360deg) } }
.toast { position: fixed; bottom: 24px; right: 24px; background: #0F172A; color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,.2); z-index: 9999; pointer-events: none; }
.toast-error { background: #EB5757; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all .25s; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateY(8px); }
@media (max-width: 900px) {
  .reports-grid, .chart-grid, .kpi-grid { grid-template-columns: 1fr; }
  .domain-chart-layout { grid-template-columns: 1fr; height: auto; }
  .domain-chart-layout canvas { max-height: 220px; }
  .office-row { grid-template-columns: 1fr; }
  .chart-panel { height: 260px; }
}
</style>
