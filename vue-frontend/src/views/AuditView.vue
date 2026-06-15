<template>
  <div class="audit-page">
    <div class="page-hd">
      <div>
        <h2 class="page-title">Audit Trail</h2>
        <p class="page-sub">System activity log</p>
      </div>
      <button class="btn" @click="exportCSV" :disabled="!rows.length">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 11h9M6.5 1v7M4 6l2.5 2.5L9 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Export CSV
      </button>
    </div>

    <div class="filter-bar">
      <div class="srch-wrap">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="srch-icon"><circle cx="5" cy="5" r="4" stroke="#94A3B8" stroke-width="1.2"/><path d="M8.5 8.5l2 2" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/></svg>
        <input v-model="search" type="text" class="srch-inp" placeholder="Search user, action, module…"/>
      </div>
      <select v-model="filterModule" class="filter-select">
        <option value="">All Modules</option>
        <option>Auth</option><option>IPCRF</option><option>Accomplishments</option>
        <option>MOV</option><option>Users</option><option>KRA Library</option>
      </select>
      <select v-model="filterAction" class="filter-select">
        <option value="">All Actions</option>
        <option>LOGIN</option><option>CREATE</option><option>UPDATE</option>
        <option>DELETE</option><option>SUBMIT</option><option>APPROVE</option>
        <option>UPLOAD</option>
      </select>
    </div>

    <div v-if="loading" class="audit-table">
      <div class="table-hd">
        <div class="th th-time">Timestamp</div>
        <div class="th th-user">User</div>
        <div class="th th-action">Action</div>
        <div class="th th-module">Module</div>
        <div class="th th-details">Details</div>
      </div>
      <div v-for="i in 8" :key="i" class="table-row">
        <div class="td th-time"><div class="sk-line" style="width:90%"></div></div>
        <div class="td th-user"><div class="sk-line" style="width:70%"></div></div>
        <div class="td th-action"><div class="sk-line" style="width:60px"></div></div>
        <div class="td th-module"><div class="sk-line" style="width:60px"></div></div>
        <div class="td th-details"><div class="sk-line" style="width:80%"></div></div>
      </div>
    </div>

    <div v-else-if="!filteredRows.length" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="8" y="6" width="32" height="36" rx="3" stroke="#E2E8F0" stroke-width="2"/><path d="M16 16h16M16 22h16M16 28h10" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/></svg>
      <p class="empty-title">No audit logs found</p>
      <p class="empty-sub">System activity will appear here.</p>
    </div>

    <div v-else class="audit-table">
      <div class="table-hd">
        <div class="th th-time">Timestamp</div>
        <div class="th th-user">User</div>
        <div class="th th-action">Action</div>
        <div class="th th-module">Module</div>
        <div class="th th-details">Details</div>
      </div>
      <div v-for="row in filteredRows" :key="row.id" class="table-row">
        <div class="td th-time mono">{{ fmtDateTime(row.timestamp || row.createdAt) }}</div>
        <div class="td th-user">{{ row.userEmail || row.userId || '—' }}</div>
        <div class="td th-action"><span :class="['action-badge', actionClass(row.action)]">{{ row.action }}</span></div>
        <div class="td th-module text-muted">{{ row.module }}</div>
        <div class="td th-details text-muted">{{ row.details }}</div>
      </div>
      <div class="table-footer">
        <span class="text-muted">Showing {{ filteredRows.length }} of {{ rows.length }} entries</span>
      </div>
    </div>

    <teleport to="body">
      <transition name="toast-slide">
        <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">{{ toast.msg }}</div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { auditApi } from '@/services/api'

const rows = ref([])
const loading = ref(false)
const search = ref('')
const filterModule = ref('')
const filterAction = ref('')
const toast = ref({ show: false, msg: '', type: 'success' })

const filteredRows = computed(() => {
  let r = rows.value
  if (search.value) {
    const q = search.value.toLowerCase()
    r = r.filter(x => (x.userEmail || '').toLowerCase().includes(q) || (x.action || '').toLowerCase().includes(q) || (x.module || '').toLowerCase().includes(q) || (x.details || '').toLowerCase().includes(q))
  }
  if (filterModule.value) r = r.filter(x => x.module === filterModule.value)
  if (filterAction.value) r = r.filter(x => x.action === filterAction.value)
  return r
})

function fmtDateTime(iso) { return iso ? new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—' }
function showToast(msg, type = 'success') { toast.value = { show: true, msg, type }; setTimeout(() => { toast.value.show = false }, 3500) }
function actionClass(a) {
  const m = { LOGIN: 'a-blue', CREATE: 'a-green', UPDATE: 'a-orange', DELETE: 'a-red', SUBMIT: 'a-blue', APPROVE: 'a-green', UPLOAD: 'a-green', RETURN: 'a-orange' }
  return m[a] || 'a-gray'
}

function exportCSV() {
  const headers = ['Timestamp','User','Action','Module','Details']
  const csvRows = [headers.join(','), ...filteredRows.value.map(r => [fmtDateTime(r.timestamp || r.createdAt), r.userEmail || r.userId || '', r.action || '', r.module || '', `"${(r.details || '').replace(/"/g, '""')}"`].join(','))]
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  loading.value = true
  try {
    const r = await auditApi.list()
    rows.value = r?.items || (Array.isArray(r) ? r : [])
  } catch (e) { showToast(`Could not load audit log: ${e.message}`, 'error') }
  finally { loading.value = false }
})
</script>

<style>
.audit-page { padding: 16px 20px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif; font-size: 13px; color: #1A2332; min-height: 100%; }
.page-hd { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; color: #0F172A; margin: 0 0 3px; letter-spacing: -.3px; }
.page-sub { font-size: 12px; color: #94A3B8; margin: 0; }
.filter-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.srch-wrap { position: relative; }
.srch-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); pointer-events: none; }
.srch-inp { padding: 7px 11px 7px 28px; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 12px; font-family: inherit; color: #0F172A; outline: none; width: 260px; background: #fff; }
.srch-inp:focus { border-color: #3B82F6; }
.filter-select { padding: 7px 10px; border: 1px solid #E2E8F0; border-radius: 7px; font-size: 12px; font-family: inherit; color: #374151; background: #fff; outline: none; cursor: pointer; }
.audit-table { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; }
.table-hd { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; }
.th { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .06em; flex-shrink: 0; }
.th-time { width: 170px; }
.th-user { width: 160px; }
.th-action { width: 90px; }
.th-module { width: 120px; }
.th-details { flex: 1; }
.table-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid #F1F5F9; transition: background .12s; }
.table-row:last-child { border-bottom: none; }
.table-row:hover { background: #F8FBFF; }
.td { font-size: 11px; color: #374151; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td.th-time { width: 170px; }
.td.th-user { width: 160px; }
.td.th-action { width: 90px; }
.td.th-module { width: 120px; }
.td.th-details { flex: 1; }
.table-footer { padding: 10px 14px; border-top: 1px solid #F1F5F9; }
.mono { font-family: 'SF Mono', 'Fira Mono', monospace; font-size: 10px; }
.text-muted { color: #94A3B8; font-size: 11px; }
.action-badge { display: inline-flex; padding: 2px 7px; border-radius: 6px; font-size: 10px; font-weight: 700; }
.a-blue   { background: #EBF4FF; color: #1A56B0; }
.a-green  { background: #F0FDF4; color: #15803D; }
.a-orange { background: #FEF3E2; color: #B45309; }
.a-red    { background: #FEF2F2; color: #B91C1C; }
.a-gray   { background: #F8FAFC; color: #64748B; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 64px 0; gap: 8px; }
.empty-title { font-size: 15px; font-weight: 600; color: #374151; margin: 4px 0 0; }
.empty-sub { font-size: 13px; color: #94A3B8; margin: 0; }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
.sk-line { background: linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%); background-size: 200%; animation: shimmer 1.4s infinite; border-radius: 4px; height: 11px; display: block; }
.btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; border-radius: 8px; font-size: 12px; cursor: pointer; border: 1px solid #E2E8F0; background: #fff; color: #374151; transition: all .15s; font-family: inherit; font-weight: 500; }
.btn:hover { border-color: #CBD5E1; background: #F8FAFC; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.toast { position: fixed; bottom: 24px; right: 24px; background: #0F172A; color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,.2); z-index: 9999; pointer-events: none; }
.toast-error { background: #EB5757; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all .25s; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateY(8px); }
</style>