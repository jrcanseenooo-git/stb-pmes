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
              <option value="ipcrf-summary">IPCRF Accomplishment Summary</option>
              <option value="ccef-summary">CCEF Targets Summary</option>
              <option value="division-performance">Division Performance Report</option>
              <option value="semestral">Semestral Performance Report</option>
              <option value="delayed">Delayed Submission Report</option>
              <option value="bureau-analytics">Bureau-Wide Analytics</option>
            </select>
          </div>
          <div class="form-row">
            <div class="field">
              <label class="field-label">Division</label>
              <select v-model="form.divisionId" class="field-input">
                <option value="">All Divisions</option>
                <option value="dfd">Design Formulation</option>
                <option value="pid">Pilot Implementation</option>
                <option value="staed">STAE Division</option>
                <option value="admin-pool">Admin Pool</option>
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
              <label v-for="f in formats" :key="f.value" :class="['format-opt', form.format === f.value && 'active']" @click="form.format = f.value">
                <svg v-if="f.value === 'pdf'" width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M6 6h6M6 9h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                <svg v-else-if="f.value === 'excel'" width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M6 7l2 4M8 7l-2 4M10 7v4M10 9h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                <svg v-else width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M6 6h6M6 9h6M6 12h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                {{ f.label }}
              </label>
            </div>
          </div>
          <button class="btn btn-primary btn-full" @click="generate" :disabled="generating">
            <span v-if="generating" class="spinner-sm"></span>
            <svg v-else width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 11h9M6.5 1v7M4 6l2.5 2.5L9 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            {{ generating ? 'Generating…' : 'Generate Report' }}
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
import { ref, onMounted } from 'vue'
import { reportsApi } from '@/services/api'

const generating    = ref(false)
const recentReports = ref([])
const toast         = ref({ show: false, msg: '', type: 'success' })

const form = ref({
  type:       'ipcrf-summary',
  divisionId: '',
  semester:   '1',
  year:       new Date().getFullYear(),
  format:     'pdf'
})

const formats = [
  { value: 'pdf',   label: 'PDF'   },
  { value: 'excel', label: 'Excel' },
  { value: 'csv',   label: 'CSV'   }
]

function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '' }
function showToast(msg, type = 'success') { toast.value = { show: true, msg, type }; setTimeout(() => { toast.value.show = false }, 3500) }

onMounted(async () => {
  try {
    const r = await reportsApi.list()
    recentReports.value = r?.items || (Array.isArray(r) ? r : [])
  } catch (e) { /* silently fail — recent reports is non-critical */ }
})

async function generate() {
  generating.value = true
  try {
    const result = await reportsApi.generate(form.value)
    if (result?.downloadUrl) {
      window.open(result.downloadUrl, '_blank')
    } else if (result?.csv) {
      const blob = new Blob([result.csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `report-${Date.now()}.csv`; a.click()
      URL.revokeObjectURL(url)
    }
    showToast('Report generated successfully')
    if (result?.id) recentReports.value.unshift(result)
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    generating.value = false
  }
}

function downloadReport(r) {
  if (r.downloadUrl) window.open(r.downloadUrl, '_blank')
}
</script>

<style>
.reports-page { padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif; font-size: 13px; color: #1A2332; min-height: 100%; }
.content-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; padding: 20px; }
.page-hd { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 700; color: #0F172A; margin: 0 0 3px; }
.page-sub { font-size: 12px; color: #94A3B8; margin: 0; }
.reports-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
.panel { background: #F8FAFC; border: 1px solid #F1F5F9; border-radius: 12px; overflow: hidden; }
.panel-hd { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid #E2E8F0; font-size: 13px; font-weight: 600; color: #0F172A; }
.panel-body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.panel-empty { padding: 36px 18px; text-align: center; color: #94A3B8; font-size: 12px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 11px; font-weight: 600; color: #374151; }
.field-input { padding: 9px 12px; border: 1.5px solid #E2E8F0; border-radius: 9px; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif; color: #0F172A; background: #fff; outline: none; transition: border-color .15s; }
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
.btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; border-radius: 8px; font-size: 12px; cursor: pointer; border: 1px solid #E2E8F0; background: #fff; color: #374151; transition: all .15s; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif; font-weight: 500; }
.btn:hover { border-color: #CBD5E1; background: #F8FAFC; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-primary { background: #0D2137; color: #fff; border-color: #0D2137; }
.btn-primary:hover:not(:disabled) { background: #1e3f61; }
.btn-full { width: 100%; justify-content: center; }
.btn-xs { padding: 4px 9px; font-size: 11px; }
.spinner-sm { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }
.toast { position: fixed; bottom: 24px; right: 24px; background: #0F172A; color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,.2); z-index: 9999; pointer-events: none; }
.toast-error { background: #EB5757; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all .25s; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateY(8px); }
</style>