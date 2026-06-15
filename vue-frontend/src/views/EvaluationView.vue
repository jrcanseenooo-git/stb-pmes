<template>
  <div class="eval-page">
    <div class="page-hd">
      <div>
        <h2 class="page-title">Evaluation</h2>
        <p class="page-sub">Final Rating Computation — SPMS Formula</p>
      </div>
    </div>

    <!-- Rating Guide -->
    <div class="rating-guide">
      <div v-for="g in guide" :key="g.scale" :class="['guide-item', g.cls]">
        <div class="guide-score">{{ g.scale }}</div>
        <div class="guide-label">{{ g.label }}</div>
        <div class="guide-pct">{{ g.pct }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <div class="srch-wrap">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="srch-icon"><circle cx="5" cy="5" r="4" stroke="#94A3B8" stroke-width="1.2"/><path d="M8.5 8.5l2 2" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/></svg>
        <input v-model="search" type="text" class="srch-inp" placeholder="Search employee…"/>
      </div>
      <select v-model="filterDiv" class="filter-select">
        <option value="">All Divisions</option>
        <option value="dfd">Design Formulation</option>
        <option value="pid">Pilot Implementation</option>
        <option value="staed">STAE Division</option>
        <option value="admin-pool">Admin Pool</option>
      </select>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="eval-table">
      <div class="table-hd">
        <div class="th th-emp">Employee</div>
        <div class="th th-spms">SPMS Score</div>
        <div class="th th-jrb">JRB (Supervisor)</div>
        <div class="th th-peer">JRB (Peers)</div>
        <div class="th th-att">Attendance</div>
        <div class="th th-final">Final Rating</div>
        <div class="th th-adj">Adjectival</div>
        <div class="th th-act">Action</div>
      </div>
      <div v-for="i in 4" :key="i" class="table-row">
        <div class="td th-emp"><div class="sk-line" style="width:80%"></div></div>
        <div class="td th-spms"><div class="sk-line" style="width:40px"></div></div>
        <div class="td th-jrb"><div class="sk-line" style="width:40px"></div></div>
        <div class="td th-peer"><div class="sk-line" style="width:40px"></div></div>
        <div class="td th-att"><div class="sk-line" style="width:40px"></div></div>
        <div class="td th-final"><div class="sk-line" style="width:50px"></div></div>
        <div class="td th-adj"><div class="sk-line" style="width:80px"></div></div>
        <div class="td th-act"><div class="sk-line" style="width:60px"></div></div>
      </div>
    </div>

    <div v-else-if="!filteredRows.length" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="#E2E8F0" stroke-width="2"/><path d="M24 14v10l6 4" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/></svg>
      <p class="empty-title">No evaluation records</p>
      <p class="empty-sub">Evaluations will appear once forms are submitted and rated.</p>
    </div>

    <div v-else class="eval-table">
      <div class="table-hd">
        <div class="th th-emp">Employee</div>
        <div class="th th-spms">SPMS (70%)</div>
        <div class="th th-jrb">Supervisor (15%)</div>
        <div class="th th-peer">Peers (10%)</div>
        <div class="th th-att">Attendance (5%)</div>
        <div class="th th-final">Final Rating</div>
        <div class="th th-adj">Adjectival</div>
        <div class="th th-act">Action</div>
      </div>
      <div v-for="row in filteredRows" :key="row.id" class="table-row">
        <div class="td th-emp">
          <div class="emp-cell">
            <div class="av" :style="{ background: avatarColor(row.employeeName) }">{{ initials(row.employeeName) }}</div>
            <div>
              <div class="emp-name">{{ row.employeeName }}</div>
              <div class="emp-div">{{ row.divisionName || '—' }}</div>
            </div>
          </div>
        </div>
        <div class="td th-spms score-cell">{{ fmt(row.spmsScore) }}</div>
        <div class="td th-jrb score-cell">{{ fmt(row.jrbSupervisorScore) }}</div>
        <div class="td th-peer score-cell">{{ fmt(row.jrbPeerScore) }}</div>
        <div class="td th-att score-cell">{{ fmt(row.attendanceScore) }}</div>
        <div class="td th-final">
          <span v-if="row.finalNumericalRating" :class="['final-score', ratingClass(row.finalNumericalRating)]">{{ Number(row.finalNumericalRating).toFixed(2) }}</span>
          <span v-else class="text-muted">—</span>
        </div>
        <div class="td th-adj">
          <span v-if="row.adjectivalRating" :class="['adj-badge', adjClass(row.adjectivalRating)]">{{ row.adjectivalRating }}</span>
          <span v-else class="text-muted">—</span>
        </div>
        <div class="td th-act">
          <button class="btn btn-xs btn-primary" @click="compute(row)" :disabled="computing === row.id">
            {{ computing === row.id ? '…' : 'Compute' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Formula reference -->
    <div class="formula-card">
      <div class="formula-title">SPMS Final Rating Formula</div>
      <div class="formula-text">
        Final = (SPMS ÷ 5 × 0.70) + (Supervisor ÷ 4 × 0.15) + (Peer 1 ÷ 4 × 0.05) + (Peer 2 ÷ 4 × 0.05) + (Attendance ÷ 5 × 0.05) × 100
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
import { evaluationApi } from '@/services/api'

const rows     = ref([])
const loading  = ref(false)
const computing = ref(null)
const search   = ref('')
const filterDiv = ref('')
const toast    = ref({ show: false, msg: '', type: 'success' })

const guide = [
  { scale: '5', label: 'Outstanding',       pct: '100%+',   cls: 'g-out' },
  { scale: '4', label: 'Very Satisfactory', pct: '90–99%',  cls: 'g-vs'  },
  { scale: '3', label: 'Satisfactory',      pct: '80–89%',  cls: 'g-sat' },
  { scale: '2', label: 'Unsatisfactory',    pct: '51–79%',  cls: 'g-unsat' },
  { scale: '1', label: 'Poor',              pct: '≤50%',    cls: 'g-poor' }
]

const filteredRows = computed(() => {
  let r = rows.value
  if (filterDiv.value) r = r.filter(x => x.divisionId === filterDiv.value)
  if (search.value) { const q = search.value.toLowerCase(); r = r.filter(x => (x.employeeName || '').toLowerCase().includes(q)) }
  return r
})

function fmt(v)       { return v !== undefined && v !== '' && v !== null ? Number(v).toFixed(2) : '—' }
function initials(n)  { return (n || '').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() }
function avatarColor(n) { const c = ['#2F80ED','#27AE60','#E9A840','#9B59B6','#EB5757']; return c[(n?.length || 0) % c.length] }
function showToast(msg, type = 'success') { toast.value = { show: true, msg, type }; setTimeout(() => { toast.value.show = false }, 3500) }
function ratingClass(v) { const s = Number(v); if (s >= 4.5) return 'r-out'; if (s >= 3.5) return 'r-vs'; if (s >= 2.5) return 'r-sat'; return 'r-poor' }
function adjClass(a) { const m = { 'Outstanding': 'a-out', 'Very Satisfactory': 'a-vs', 'Satisfactory': 'a-sat', 'Unsatisfactory': 'a-unsat', 'Poor': 'a-poor' }; return m[a] || '' }

onMounted(async () => {
  loading.value = true
  try {
    const r = await evaluationApi.list()
    rows.value = r?.items || (Array.isArray(r) ? r : [])
  } catch (e) { showToast(`Could not load: ${e.message}`, 'error') }
  finally { loading.value = false }
})

async function compute(row) {
  computing.value = row.id
  try {
    const u = await evaluationApi.compute(row.userId, { semester: row.semester, year: row.year })
    const i = rows.value.findIndex(r => r.id === row.id)
    if (i !== -1) rows.value[i] = { ...rows.value[i], ...u }
    showToast(`Computed: ${u.finalNumericalRating} — ${u.adjectivalRating}`)
  } catch (e) { showToast(e.message, 'error') }
  finally { computing.value = null }
}
</script>

<style>
.eval-page { padding: 16px 20px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif; font-size: 13px; color: #1A2332; min-height: 100%; }
.page-hd { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; color: #0F172A; margin: 0 0 3px; }
.page-sub { font-size: 12px; color: #94A3B8; margin: 0; }
.rating-guide { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.guide-item { flex: 1; min-width: 120px; border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; gap: 10px; }
.guide-score { font-size: 20px; font-weight: 800; line-height: 1; }
.guide-label { font-size: 11px; font-weight: 600; flex: 1; }
.guide-pct { font-size: 10px; color: #64748B; }
.g-out   { background: #F0FDF4; color: #15803D; }
.g-vs    { background: #EBF4FF; color: #1A56B0; }
.g-sat   { background: #FEF9C3; color: #92400E; }
.g-unsat { background: #FEF3E2; color: #B45309; }
.g-poor  { background: #FEF2F2; color: #B91C1C; }
.filter-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.srch-wrap { position: relative; }
.srch-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); pointer-events: none; }
.srch-inp { padding: 7px 11px 7px 28px; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 12px; font-family: inherit; outline: none; width: 220px; background: #fff; }
.srch-inp:focus { border-color: #3B82F6; }
.filter-select { padding: 7px 10px; border: 1px solid #E2E8F0; border-radius: 7px; font-size: 12px; font-family: inherit; color: #374151; background: #fff; outline: none; cursor: pointer; }
.eval-table { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
.table-hd { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; }
.th { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .06em; flex-shrink: 0; }
.th-emp { flex: 1.2; }
.th-spms,.th-jrb,.th-peer,.th-att { width: 90px; }
.th-final { width: 80px; }
.th-adj { width: 130px; }
.th-act { width: 80px; }
.table-row { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #F1F5F9; }
.table-row:last-child { border-bottom: none; }
.table-row:hover { background: #F8FBFF; }
.td { font-size: 12px; color: #374151; flex-shrink: 0; }
.td.th-emp { flex: 1.2; }
.td.th-spms,.td.th-jrb,.td.th-peer,.td.th-att { width: 90px; }
.td.th-final { width: 80px; }
.td.th-adj { width: 130px; }
.td.th-act { width: 80px; }
.emp-cell { display: flex; align-items: center; gap: 8px; }
.av { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0; }
.emp-name { font-size: 12px; font-weight: 600; color: #0F172A; }
.emp-div { font-size: 10px; color: #94A3B8; }
.score-cell { font-family: 'SF Mono','Fira Mono',monospace; font-size: 12px; color: #374151; }
.text-muted { color: #94A3B8; font-size: 11px; }
.final-score { font-size: 16px; font-weight: 800; padding: 2px 8px; border-radius: 8px; }
.r-out  { color: #15803D; background: #F0FDF4; }
.r-vs   { color: #1A56B0; background: #EBF4FF; }
.r-sat  { color: #92400E; background: #FEF9C3; }
.r-poor { color: #B91C1C; background: #FEF2F2; }
.adj-badge { display: inline-flex; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; }
.a-out   { background: #F0FDF4; color: #15803D; }
.a-vs    { background: #EBF4FF; color: #1A56B0; }
.a-sat   { background: #FEF9C3; color: #92400E; }
.a-unsat { background: #FEF3E2; color: #B45309; }
.a-poor  { background: #FEF2F2; color: #B91C1C; }
.formula-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px 18px; }
.formula-title { font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
.formula-text { font-size: 12px; color: #374151; line-height: 1.6; font-family: 'SF Mono','Fira Mono',monospace; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 64px 0; gap: 8px; }
.empty-title { font-size: 15px; font-weight: 600; color: #374151; margin: 4px 0 0; }
.empty-sub { font-size: 13px; color: #94A3B8; margin: 0; }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
.sk-line { background: linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%); background-size: 200%; animation: shimmer 1.4s infinite; border-radius: 4px; height: 11px; display: block; }
.btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; border-radius: 8px; font-size: 12px; cursor: pointer; border: 1px solid #E2E8F0; background: #fff; color: #374151; transition: all .15s; font-family: inherit; font-weight: 500; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-primary { background: #0D2137; color: #fff; border-color: #0D2137; }
.btn-xs { padding: 4px 10px; font-size: 11px; }
.toast { position: fixed; bottom: 24px; right: 24px; background: #0F172A; color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,.2); z-index: 9999; pointer-events: none; }
.toast-error { background: #EB5757; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all .25s; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateY(8px); }
</style>