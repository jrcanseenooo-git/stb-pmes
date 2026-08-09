<template>
  <div class="pmes-page p-4 grid gap-4 content-start">
    <PageHeader
      kicker="Reporting"
      title="Report Center"
      :subtitle="`Generate and export official reports for ${portalSubtitle}.`"
    >
      <template #actions>
        <button v-if="selectedType" class="btn-secondary" type="button" @click="clearSelection">
          Back to catalog
        </button>
      </template>
    </PageHeader>

    <!-- CATALOG -->
    <template v-if="!selectedType">
      <section v-for="group in catalog" :key="group.category" class="grid gap-3">
        <div class="px-1">
          <h2 class="text-sm font-extrabold text-slate-900">{{ group.category }}</h2>
          <p class="text-xs text-slate-500 mt-0.5">{{ group.blurb }}</p>
        </div>
        <div class="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          <button
            v-for="report in group.reports"
            :key="report.value"
            type="button"
            class="card p-4 text-left hover:border-blue-300 hover:shadow-md transition-all focus:outline-none focus:ring-4 focus:ring-blue-100"
            @click="selectReport(report.value)"
          >
            <h3 class="text-sm font-extrabold text-slate-900 leading-snug">{{ report.label }}</h3>
            <p class="mt-1.5 text-xs text-slate-600 leading-relaxed">{{ report.description }}</p>
            <div class="mt-3 flex flex-wrap gap-1.5">
              <span v-for="format in formatsFor(report.value)" :key="format" class="badge-status bg-slate-100 text-slate-600">
                {{ format.toUpperCase() }}
              </span>
            </div>
          </button>
        </div>
      </section>

      <div v-if="!reportTypes.length" class="card">
        <EmptyState
          title="No reports available for your access level"
          description="Report availability follows your role and office. Contact a central administrator if you expect to see reports here."
        />
      </div>
    </template>

    <!-- RUN PANEL -->
    <template v-else>
      <div class="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] items-start">
        <section class="card overflow-hidden">
          <div class="card-header !px-4 !py-3">
            <h2 class="card-title">{{ selectedMeta.label }}</h2>
          </div>
          <div class="p-4 grid gap-3.5">
            <p class="text-xs text-slate-600 leading-relaxed">{{ selectedMeta.description }}</p>

            <div v-if="!isUndersecretaryReport" class="grid gap-1">
              <label class="form-label" for="report-division">Division</label>
              <select id="report-division" v-model="form.divisionId" class="form-select">
                <option v-if="canSelectAllDivisions" value="">All Divisions</option>
                <option v-for="d in divisions" :key="d.id" :value="d.id">{{ d.name }}</option>
              </select>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="grid gap-1">
                <label class="form-label" for="report-semester">Semester</label>
                <select id="report-semester" v-model="form.semester" class="form-select">
                  <option value="1">Semester 1</option>
                  <option value="2">Semester 2</option>
                </select>
              </div>
              <div class="grid gap-1">
                <label class="form-label" for="report-year">Year</label>
                <input id="report-year" v-model.number="form.year" type="number" class="form-input" />
              </div>
            </div>

            <div class="grid gap-1">
              <span class="form-label">Format</span>
              <div class="flex gap-2" role="radiogroup" aria-label="Export format">
                <button
                  v-for="f in availableFormats"
                  :key="f.value"
                  type="button"
                  role="radio"
                  :aria-checked="form.format === f.value"
                  :class="[
                    'flex-1 rounded-xl border px-3 py-2 text-xs font-extrabold transition-colors',
                    form.format === f.value
                      ? 'border-blue-700 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  ]"
                  @click="form.format = f.value"
                >
                  {{ f.label }}
                </button>
              </div>
            </div>

            <button class="btn-primary w-full" type="button" :disabled="previewing" @click="loadPreview">
              {{ previewing ? 'Loading preview...' : 'Preview' }}
            </button>
            <button class="btn-secondary w-full" type="button" :disabled="generating || !preview" @click="generate">
              {{ generating ? 'Exporting...' : 'Export Report' }}
            </button>
            <p v-if="!preview && !previewing" class="text-[11px] text-slate-500 leading-relaxed">
              Preview first so you can confirm the report covers the records you expect before exporting.
            </p>
          </div>
        </section>

        <div class="grid gap-4">
          <!-- Analytics preview -->
          <section v-if="preview" class="card overflow-hidden">
            <div class="card-header !px-4 !py-3 flex-wrap gap-2">
              <div class="min-w-0">
                <p class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  {{ preview.scopeLabel }} · S{{ preview.semester }} {{ preview.year }}
                </p>
                <h2 class="card-title mt-0.5">Report Preview</h2>
              </div>
              <span class="text-[11px] text-slate-500">Generated {{ fmtDateTime(preview.generatedAt) }}</span>
            </div>

            <div class="grid gap-3 grid-cols-2 lg:grid-cols-4 p-4 bg-slate-50 border-b border-slate-100">
              <StatTile label="Personnel Covered" :value="preview.kpis.personnel" />
              <StatTile label="Assessment Records" :value="preview.kpis.records" />
              <StatTile label="Scored" :value="preview.kpis.scoredPercent" />
              <StatTile label="Overall Average" :value="fmtScore(preview.kpis.overallAverage)" />
            </div>

            <div class="grid gap-4 p-4 lg:grid-cols-2">
              <div class="rounded-2xl border border-slate-200 p-4">
                <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">Interpretation Distribution</h3>
                <div class="h-64"><Bar :data="interpretationChartData" :options="barOptions" /></div>
              </div>
              <div class="rounded-2xl border border-slate-200 p-4">
                <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">Domain Average Scores</h3>
                <div class="h-40"><Doughnut :data="domainChartData" :options="doughnutOptions" /></div>
                <ul class="mt-3 grid gap-1.5">
                  <li
                    v-for="(domain, index) in preview.domainAverages"
                    :key="domain.label"
                    class="flex items-center gap-2 text-xs"
                  >
                    <i class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ backgroundColor: domainColors[index % domainColors.length] }"></i>
                    <span class="text-slate-600 truncate">{{ domain.label }}</span>
                    <strong class="ml-auto text-slate-900">{{ fmtScore(domain.average) }}</strong>
                  </li>
                </ul>
              </div>
            </div>

            <div v-if="preview.officeSummaries?.length" class="p-4 pt-0">
              <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">Office / Program Summary</h3>
              <ul class="grid gap-3">
                <li v-for="office in preview.officeSummaries" :key="office.office">
                  <div class="flex items-baseline justify-between gap-3 mb-1.5">
                    <div class="min-w-0">
                      <strong class="text-xs text-slate-900">{{ office.office }}</strong>
                      <span class="block text-[11px] text-slate-500">
                        {{ office.scored }}/{{ office.records }} scored · {{ office.pendingAssignments }} pending ratings
                      </span>
                    </div>
                    <strong class="text-sm text-slate-900 shrink-0">{{ fmtScore(office.overallAverage) }}</strong>
                  </div>
                  <ProgressBar :value="Number(office.overallAverage || 0)" :total="4" :show-value="false" />
                </li>
              </ul>
            </div>
          </section>

          <!-- Recent reports -->
          <DataPanel
            title="Recent Reports"
            :subtitle="`${recentReports.length} generated`"
            :empty="!recentReports.length"
            empty-title="No reports generated yet"
            empty-description="Generated reports are listed here with a download link."
          >
            <ul class="divide-y divide-slate-100">
              <li v-for="r in recentReports" :key="r.id" class="px-4 py-3 flex items-center gap-3">
                <span class="badge-status bg-slate-100 text-slate-600 shrink-0">{{ r.format?.toUpperCase() }}</span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-bold text-slate-900 truncate">{{ r.name }}</p>
                  <p class="text-[11px] text-slate-500">{{ fmtDate(r.createdAt) }}</p>
                </div>
                <button class="btn-secondary !py-1 !px-2.5 !text-xs shrink-0" type="button" @click="downloadReport(r)">
                  Download
                </button>
              </li>
            </ul>
          </DataPanel>
        </div>
      </div>
    </template>

    <teleport to="body">
      <transition name="toast-slide">
        <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]" role="status">{{ toast.msg }}</div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { reportsApi } from '@/services/api'
import { useBranding } from '@/composables/useBranding'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataPanel from '@/components/ui/DataPanel.vue'
import StatTile from '@/components/ui/StatTile.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
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

const { portalSubtitle } = useBranding()

const generating    = ref(false)
const previewing    = ref(false)
const recentReports = ref([])
const preview       = ref(null)
const toast         = ref({ show: false, msg: '', type: 'success' })
const selectedType  = ref('')

// Divisions and report types come from the backend so the catalog reflects the
// caller's actual scope. Division-level users only ever see their own division
// and never the bureau-wide report.
const divisions             = ref([])
const canSelectAllDivisions = ref(false)
const reportTypes           = ref([])

// Catalog metadata. The backend owns which report types a caller may run; this
// only supplies the human description and grouping for the ones it returns, so
// an unknown type still renders rather than disappearing.
const REPORT_META = {
  'undersecretary-analytics': {
    category: 'Assessment Analytics',
    description: 'Annex-ready analytics with interpretation distribution and domain averages. Office administrators are limited to their assigned office or program.'
  },
  'bureau-analytics': {
    category: 'Assessment Analytics',
    description: 'Bureau-wide assessment analytics across all divisions. Requires bureau-level monitoring access.'
  },
  'division-performance': {
    category: 'Performance Monitoring',
    description: 'Performance summary for a selected division over one assessment period.'
  },
  'semestral': {
    category: 'Performance Monitoring',
    description: 'Consolidated semestral performance report for the selected scope and period.'
  },
  'delayed': {
    category: 'Performance Monitoring',
    description: 'Submissions past their expected date, for follow-up. Uses neutral status labels only.'
  },
  'ipcrf-summary': {
    category: 'STB Instruments',
    description: 'Accomplishment summary drawn from IPCRF forms. Applies to the Social Technology Bureau scope.'
  },
  'ccef-summary': {
    category: 'STB Instruments',
    description: 'Targets summary drawn from CCEF forms. Applies to the Social Technology Bureau scope.'
  }
}

const CATEGORY_ORDER = ['Assessment Analytics', 'Performance Monitoring', 'STB Instruments', 'Other Reports']
const CATEGORY_BLURBS = {
  'Assessment Analytics': 'Aggregate assessment progress and scoring. No individual rating content is included.',
  'Performance Monitoring': 'Completion and status reporting for a division, office or period.',
  'STB Instruments': 'Reports specific to the Social Technology Bureau instruments.',
  'Other Reports': 'Additional reports available to your access level.'
}

const form = ref({
  type:       '',
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

// PDF is unavailable for the analytics annex; the backend rejects it.
const availableFormats = computed(() =>
  isUndersecretaryReport.value ? formats.filter(format => format.value !== 'pdf') : formats
)

const selectedMeta = computed(() => {
  const found = reportTypes.value.find(t => t.value === selectedType.value)
  return {
    label: found?.label || selectedType.value,
    description: REPORT_META[selectedType.value]?.description || 'Generate this report for the selected scope and period.'
  }
})

const catalog = computed(() => {
  const groups = new Map()
  reportTypes.value.forEach(type => {
    const category = REPORT_META[type.value]?.category || 'Other Reports'
    if (!groups.has(category)) {
      groups.set(category, { category, blurb: CATEGORY_BLURBS[category] || '', reports: [] })
    }
    groups.get(category).reports.push({
      ...type,
      description: REPORT_META[type.value]?.description || 'Generate this report for the selected scope and period.'
    })
  })
  return Array.from(groups.values())
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
})

function formatsFor(type) {
  return type === 'undersecretary-analytics' ? ['excel', 'csv'] : ['pdf', 'excel', 'csv']
}

watch(isUndersecretaryReport, (enabled) => {
  if (enabled && form.value.format === 'pdf') form.value.format = 'excel'
}, { immediate: true })

function selectReport(value) {
  selectedType.value = value
  form.value.type = value
  preview.value = null
  if (value === 'undersecretary-analytics') loadPreview()
}

function clearSelection() {
  selectedType.value = ''
  preview.value = null
}

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
        const label = chart.config.type === 'doughnut' ? value.toFixed(2) : String(value)
        const position = element.tooltipPosition()
        ctx.fillStyle = '#0F172A'
        ctx.fillText(label, position.x, chart.config.type === 'doughnut' ? position.y : position.y - 12)
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
function fmtScore(value) { return Number(value || 0) ? Number(value).toFixed(2) : '—' }
function showToast(msg, type = 'success') { toast.value = { show: true, msg, type }; setTimeout(() => { toast.value.show = false }, 3500) }

onMounted(async () => {
  try {
    const opts = await reportsApi.options()
    divisions.value             = opts?.divisions || []
    canSelectAllDivisions.value = !!opts?.canSelectAllDivisions
    if (opts?.types?.length) reportTypes.value = opts.types
    if (!canSelectAllDivisions.value && divisions.value.length) {
      form.value.divisionId = divisions.value[0].id
    }
  } catch (e) {
    showToast('Report options could not be loaded. Some reports may be unavailable.', 'error')
  }

  try {
    const r = await reportsApi.list()
    recentReports.value = r?.items || (Array.isArray(r) ? r : [])
  } catch (e) { /* recent reports is non-critical */ }
})

async function loadPreview() {
  previewing.value = true
  try {
    preview.value = await reportsApi.preview(form.value)
  } catch (e) {
    console.error(e)
    showToast(e?.message || 'Could not load the report preview.', 'error')
  } finally {
    previewing.value = false
  }
}

async function generate() {
  generating.value = true
  try {
    const result = await reportsApi.generate(form.value)
    if (result?.rowCount === 0) {
      showToast('No records matched that scope and period.', 'error')
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
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 200;
  padding: 12px 18px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  box-shadow: 0 12px 32px rgba(15, 23, 42, .22);
}
.toast-success { background: #047857; }
.toast-error { background: #b91c1c; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all .25s ease; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateY(10px); }
</style>
