<template>
  <div class="pui-page">
    <PageHeader
      kicker="Reporting"
      title="Report Center"
      :subtitle="`Generate and export official reports for ${portalSubtitle}.`"
    >
      <template #actions>
        <button v-if="selectedType" class="pui-btn" type="button" @click="clearSelection">
          Back to catalog
        </button>
      </template>
    </PageHeader>

    <!-- CATALOG -->
    <template v-if="!selectedType">
      <div v-if="optionsLoading" class="pui-card reports-loading-card" aria-live="polite">
        <div class="reports-loading-icon" aria-hidden="true"></div>
        <div>
          <h2>Loading reports</h2>
          <p>Checking your available report tools...</p>
        </div>
      </div>

      <template v-else>
        <section v-for="group in catalog" :key="group.category" style="display:grid; gap:14px;">
          <div style="display:flex; align-items:center; gap:10px; padding:0 2px;">
            <span
              class="pui-icon-chip pui-icon-chip-sm"
              :style="{ background: group.meta.bg, color: group.meta.accent }"
              aria-hidden="true"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path :d="group.meta.icon" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <div>
              <h2 style="margin:0; font-size:14px; font-weight:800; color:#0f172a;">{{ group.category }}</h2>
              <p style="margin:1px 0 0; font-size:12px; color:#64748b;">{{ group.blurb }}</p>
            </div>
          </div>

          <div class="pui-catalog-grid">
            <button
              v-for="report in group.reports"
              :key="report.value"
              type="button"
              class="pui-card pui-catalog-card"
              @click="selectReport(report.value)"
            >
              <span
                class="pui-icon-chip"
                :style="{ background: group.meta.bg, color: group.meta.accent }"
                aria-hidden="true"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <path :d="group.meta.icon" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>

              <div style="flex:1; min-width:0;">
                <h3 style="margin:0; font-size:13.5px; font-weight:800; color:#0f172a; line-height:1.4;">{{ report.label }}</h3>
                <p style="margin:5px 0 0; font-size:12px; color:#475569; line-height:1.5;">{{ report.description }}</p>

                <div style="margin-top:12px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                  <div style="display:flex; flex-wrap:wrap; gap:6px;">
                    <span v-for="format in formatsFor(report.value)" :key="format" :class="['pui-badge', formatTone(format)]">
                      {{ format.toUpperCase() }}
                    </span>
                  </div>
                  <span class="pui-catalog-cta">
                    Configure
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2.5 6h7M6 2.5L9.5 6 6 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </span>
                </div>
              </div>
            </button>
          </div>
        </section>
      </template>

      <div v-if="!optionsLoading && !reportTypes.length" class="pui-card">
        <EmptyState
          title="No reports available for your access level"
          description="Report availability follows your role and office. Contact a central administrator if you expect to see reports here."
        />
      </div>
    </template>

    <!-- RUN PANEL -->
    <template v-else>
      <div class="pui-run-grid">
        <section class="pui-card" style="overflow:hidden;">
          <div class="pui-card-header">
            <h2 class="pui-card-title">{{ selectedMeta.label }}</h2>
          </div>
          <div style="padding:16px; display:grid; gap:14px;">
            <p style="font-size:12px; color:#475569; line-height:1.5; margin:0;">{{ selectedMeta.description }}</p>

            <div v-if="!isUndersecretaryReport">
              <label class="pui-label" for="report-division">Division</label>
              <select id="report-division" v-model="form.divisionId" class="pui-select">
                <option v-if="canSelectAllDivisions" value="">All Divisions</option>
                <option v-for="d in divisions" :key="d.id" :value="d.id">{{ d.name }}</option>
              </select>
            </div>

            <div class="pui-grid pui-grid-2">
              <div>
                <label class="pui-label" for="report-semester">Semester</label>
                <select id="report-semester" v-model="form.semester" class="pui-select">
                  <option value="1">Semester 1</option>
                  <option value="2">Semester 2</option>
                </select>
              </div>
              <div>
                <label class="pui-label" for="report-year">Year</label>
                <input id="report-year" v-model.number="form.year" type="number" class="pui-input" />
              </div>
            </div>

            <div>
              <span class="pui-label">Format</span>
              <div style="display:flex; gap:8px;" role="radiogroup" aria-label="Export format">
                <button
                  v-for="f in availableFormats"
                  :key="f.value"
                  type="button"
                  role="radio"
                  :aria-checked="form.format === f.value"
                  :class="['pui-tab', form.format === f.value && 'pui-tab-active']"
                  :style="{ flex: 1, textAlign: 'center', border: '1px solid ' + (form.format === f.value ? '#1d4ed8' : '#e2e8f0'), padding: '8px' }"
                  @click="form.format = f.value"
                >
                  {{ f.label }}
                </button>
              </div>
            </div>

            <button class="pui-btn pui-btn-primary pui-btn-block" type="button" :disabled="previewing" @click="loadPreview">
              {{ previewing ? 'Loading preview...' : 'Preview' }}
            </button>
            <button class="pui-btn pui-btn-block" type="button" :disabled="generating || !preview" @click="generate">
              {{ generating ? 'Exporting...' : 'Export Report' }}
            </button>
            <p v-if="!preview && !previewing" style="font-size:11px; color:#64748b; line-height:1.5; margin:0;">
              Preview first so you can confirm the report covers the records you expect before exporting.
            </p>
          </div>
        </section>

        <div style="display:grid; gap:16px;">
          <!-- Analytics preview -->
          <section v-if="preview" class="pui-card" style="overflow:hidden;">
            <div class="pui-card-header">
              <div>
                <p style="font-size:10px; font-weight:800; text-transform:uppercase; color:#64748b; margin:0;">
                  {{ preview.scopeLabel }} · S{{ preview.semester }} {{ preview.year }}
                </p>
                <h2 class="pui-card-title" style="margin-top:3px;">Report Preview</h2>
              </div>
              <span style="font-size:11px; color:#64748b;">Generated {{ fmtDateTime(preview.generatedAt) }}</span>
            </div>

            <div class="pui-grid pui-grid-4" style="padding:16px; background:#f8fafc; border-bottom:1px solid #eef2f7;">
              <StatTile label="Personnel Covered" :value="preview.kpis.personnel" />
              <StatTile label="Assessment Records" :value="preview.kpis.records" />
              <StatTile label="Scored" :value="preview.kpis.scoredPercent" />
              <StatTile label="Overall Average" :value="fmtScore(preview.kpis.overallAverage)" />
            </div>

            <div class="pui-grid pui-grid-2" style="padding:16px;">
              <div style="border:1px solid #e2e8f0; border-radius:12px; padding:16px;">
                <h3 style="font-size:11px; font-weight:800; text-transform:uppercase; color:#64748b; margin:0 0 12px;">Interpretation Distribution</h3>
                <div style="height:250px;"><Bar :data="interpretationChartData" :options="barOptions" /></div>
              </div>
              <div style="border:1px solid #e2e8f0; border-radius:12px; padding:16px;">
                <h3 style="font-size:11px; font-weight:800; text-transform:uppercase; color:#64748b; margin:0 0 12px;">Domain Average Scores</h3>
                <div style="height:160px;"><Doughnut :data="domainChartData" :options="doughnutOptions" /></div>
                <ul style="margin:12px 0 0; padding:0; list-style:none; display:grid; gap:6px;">
                  <li
                    v-for="(domain, index) in preview.domainAverages"
                    :key="domain.label"
                    style="display:flex; align-items:center; gap:8px; font-size:12px;"
                  >
                    <i :style="{ width: '10px', height: '10px', borderRadius: '3px', flexShrink: 0, background: domainColors[index % domainColors.length] }"></i>
                    <span style="color:#475569; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ domain.label }}</span>
                    <strong style="margin-left:auto; color:#0f172a;">{{ fmtScore(domain.average) }}</strong>
                  </li>
                </ul>
              </div>
            </div>

            <div v-if="preview.officeSummaries?.length" style="padding:0 16px 16px;">
              <h3 style="font-size:11px; font-weight:800; text-transform:uppercase; color:#64748b; margin:0 0 12px;">Office / Program Summary</h3>
              <ul style="margin:0; padding:0; list-style:none; display:grid; gap:12px;">
                <li v-for="office in preview.officeSummaries" :key="office.office">
                  <div class="pui-row-between" style="margin-bottom:6px;">
                    <div style="min-width:0;">
                      <strong style="font-size:12px; color:#0f172a;">{{ office.office }}</strong>
                      <span style="display:block; font-size:11px; color:#64748b;">
                        {{ office.scored }}/{{ office.records }} scored · {{ office.pendingAssignments }} pending ratings
                      </span>
                    </div>
                    <strong style="font-size:14px; color:#0f172a; flex-shrink:0;">{{ fmtScore(office.overallAverage) }}</strong>
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
            <ul style="list-style:none; margin:0; padding:0;">
              <li v-for="r in recentReports" :key="r.id" style="padding:12px 16px; border-top:1px solid #eef2f7; display:flex; align-items:center; gap:10px;">
                <span class="pui-badge" style="flex-shrink:0;">{{ r.format?.toUpperCase() }}</span>
                <div style="min-width:0; flex:1;">
                  <p style="margin:0; font-size:13px; font-weight:700; color:#0f172a; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ r.name }}</p>
                  <p style="margin:2px 0 0; font-size:11px; color:#94a3b8;">{{ fmtDate(r.createdAt) }}</p>
                </div>
                <button class="pui-btn pui-btn-sm" style="flex-shrink:0;" type="button" @click="downloadReport(r)">
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
import { useConfirm } from '@/composables/useConfirm'
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
const { confirm } = useConfirm()

const generating    = ref(false)
const previewing    = ref(false)
const optionsLoading = ref(true)
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

// One accent color + icon per category so the catalog reads as distinct
// groups at a glance instead of a repeated grey box. Icon paths use the same
// thin-stroke style as the sidebar nav icons (viewBox 0 0 16 16, stroke 1.4).
const CATEGORY_META = {
  'Assessment Analytics': {
    accent: '#1d4ed8', bg: '#eff6ff',
    icon: 'M2 13.5V9M6 13.5V4M10 13.5V6.5M14 13.5V2.5'
  },
  'Performance Monitoring': {
    accent: '#059669', bg: '#ecfdf5',
    // Checkmark-in-box, straight-line segments only (no arcs) to avoid any
    // ambiguity in hand-written arc flag/coordinate parsing.
    icon: 'M2.5 2.5h11v11h-11z M5 8l2 2 4-4'
  },
  'STB Instruments': {
    accent: '#7c3aed', bg: '#f5f3ff',
    icon: 'M4 1.5h5.5L13 5v9.5a1 1 0 01-1 1H4a1 1 0 01-1-1v-12a1 1 0 011-1zM9.5 1.5V5H13M5 8h6M5 10.5h6'
  },
  'Other Reports': {
    accent: '#64748b', bg: '#f1f5f9',
    icon: 'M1.5 4a1 1 0 011-1h3.5l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4z'
  }
}

const FORMAT_TONES = { pdf: 'pui-badge-pdf', excel: 'pui-badge-excel', csv: 'pui-badge-csv' }
function formatTone(format) {
  return FORMAT_TONES[format] || 'pui-badge-neutral'
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
      groups.set(category, {
        category,
        blurb: CATEGORY_BLURBS[category] || '',
        meta: CATEGORY_META[category] || CATEGORY_META['Other Reports'],
        reports: []
      })
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
function fmtScore(value) { return Number(value || 0) ? Number(value).toFixed(2) : '-' }
function showToast(msg, type = 'success') { toast.value = { show: true, msg, type }; setTimeout(() => { toast.value.show = false }, 3500) }

onMounted(() => {
  // Independent reads with independent loading/error states (optionsLoading
  // only gates the options section; recentReports only feeds the separate
  // history list) - they were awaited strictly in sequence for no reason.
  // Each keeps its own try/catch so error isolation is unchanged; they just
  // no longer block each other.
  ;(async () => {
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
    } finally {
      optionsLoading.value = false
    }
  })()

  ;(async () => {
    try {
      const r = await reportsApi.list()
      recentReports.value = r?.items || (Array.isArray(r) ? r : [])
    } catch (e) { /* recent reports is non-critical */ }
  })()
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
  const ok = await confirm({
    title: 'Export Report',
    message: `Generate ${selectedMeta.value.label} as ${form.value.format.toUpperCase()} for Semester ${form.value.semester}, ${form.value.year}?`,
    confirmLabel: 'Export'
  })
  if (!ok) return

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
    showToast(`Report generated - ${result?.rowCount ?? 0} row(s)`)
    if (result?.id) recentReports.value.unshift(result)
  } catch (e) {
    console.error(e)
    // Backend messages below 500 are written for end users - show them.
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
/* Fixed column count rather than auto-fill: keeps card width identical across
   every category section regardless of how many cards a given row has, so a
   2-card row doesn't stretch its cards wider than the 3-card row below it. */
.pui-catalog-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.reports-loading-card {
  min-height: 156px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #475569;
}

.reports-loading-card h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 800;
  color: #0f172a;
}

.reports-loading-card p {
  margin: 3px 0 0;
  font-size: 12px;
}

.reports-loading-icon {
  width: 34px;
  height: 34px;
  border: 3px solid #dbeafe;
  border-top-color: #2563eb;
  border-radius: 999px;
  animation: reports-spin .8s linear infinite;
}

@keyframes reports-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 960px) {
  .pui-catalog-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 620px) {
  .pui-catalog-grid { grid-template-columns: 1fr; }
}

/* Catalog cards are native <button> elements for keyboard/click affordance;
   reset the button-specific defaults main.css would otherwise have handled. */
.pui-catalog-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition: box-shadow .12s, border-color .12s, transform .12s;
}

.pui-catalog-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 6px 18px rgba(15, 23, 42, .09);
  transform: translateY(-1px);
}

.pui-catalog-card:focus-visible {
  outline: 3px solid rgba(29, 78, 216, .3);
  outline-offset: 1px;
}

.pui-catalog-cta {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 800;
  color: #1d4ed8;
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity .12s, transform .12s;
  white-space: nowrap;
}

.pui-catalog-card:hover .pui-catalog-cta,
.pui-catalog-card:focus-visible .pui-catalog-cta {
  opacity: 1;
  transform: translateX(0);
}

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
