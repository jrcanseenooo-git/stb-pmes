<template>
  <div class="content">

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card stat-blue">
        <div class="stat-label">{{ primaryStat.label }}</div>
        <div class="stat-value">{{ primaryStat.value }}</div>
        <div class="stat-sub">{{ primaryStat.sub }}</div>
        <div class="stat-icon blue">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="5" r="2.5" stroke="currentColor" stroke-width="1.4" />
            <path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </div>
      </div>
      <div class="stat-card stat-green">
        <div class="stat-label">Completion Rate</div>
        <div class="stat-value">{{ stats.completionRate }}<span style="font-size:14px">%</span></div>
        <div class="stat-sub up">{{ stats.completed }} of {{ stats.totalTargets }} targets</div>
        <div class="stat-icon green">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 14V8l4-4 4 4 4-4v10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
        </div>
      </div>
      <div class="stat-card stat-gold">
        <div class="stat-label">Pending Submissions</div>
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-sub">Awaiting review</div>
        <div class="stat-icon gold">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4" />
            <path d="M8 5v3.5l2 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </div>
      </div>
      <div class="stat-card stat-red">
        <div class="stat-label">Delayed Targets</div>
        <div class="stat-value">{{ stats.delayed }}</div>
        <div class="stat-sub" :class="stats.delayed > 0 && 'down'">{{ stats.delayed > 0 ? 'Needs attention' : 'On track' }}</div>
        <div class="stat-icon red">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2L1 14h14L8 2z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
              stroke-linejoin="round" />
            <path d="M8 7v3M8 11.5v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </div>
      </div>
    </div>

    <div class="grid-2">

      <!-- Division Performance -->
      <div class="card">
        <div class="card-hd">
          <span class="card-title">Division Performance</span>
          <span class="sem-tag">{{ currentSemester }}</span>
        </div>
        <div class="card-body">
          <div class="div-list">
            <div v-if="!divisions.length" class="div-pct">No division data for this period yet.</div>
            <div v-for="div in divisions" :key="div.name" class="div-item">
              <div class="div-row-top">
                <span class="div-name">{{ div.name }}</span>
                <div class="div-right">
                  <span class="div-pct">{{ div.pct }}%</span>
                  <span v-if="div.top" class="badge badge-green">Top</span>
                  <span v-if="div.down" class="badge badge-orange">↓</span>
                </div>
              </div>
              <div class="prog-wrap">
                <div class="prog-bar" :style="{ width: div.pct + '%', background: div.color }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Accomplishment Status -->
      <div class="card">
        <div class="card-hd">
          <span class="card-title">Accomplishment Status</span>
          <button class="btn" @click="router.push('/accomplishments')">View all</button>
        </div>
        <div class="card-body">
          <div class="donut-wrap">
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="42" fill="none" stroke="#E2E8F0" stroke-width="16" />
              <circle v-for="seg in donutSegments" :key="seg.label" cx="55" cy="55" r="42" fill="none"
                :stroke="seg.color" stroke-width="16" :stroke-dasharray="seg.dash"
                :stroke-dashoffset="seg.offset" transform="rotate(-90 55 55)" stroke-linecap="round" />
              <text x="55" y="51" text-anchor="middle" font-size="18" font-weight="600" fill="#1A2332"
                font-family="DM Mono,monospace">{{ totalTargets }}</text>
              <text x="55" y="64" text-anchor="middle" font-size="8" fill="#718096"
                font-family="DM Sans,sans-serif">targets</text>
            </svg>
            <div class="donut-legend">
              <div v-if="!statuses.length" class="legend-item">No targets recorded yet.</div>
              <div v-for="s in statuses" :key="s.label" class="legend-item">
                <div class="legend-dot" :style="{ background: s.color }"></div>
                {{ s.label }} ({{ s.count }})
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <div class="grid-2">

      <!-- Bar chart -->
      <div class="card">
        <div class="card-hd">
          <span class="card-title">Monthly Submission Activity</span>
          <div class="pill-tabs">
            <div v-for="t in ['IPCR', 'CCEF']" :key="t" :class="['pill', activeTab === t && 'active']"
              @click="setTab(t)">{{ t }}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="bar-chart">
            <div v-if="!bars.length" class="bar-lbl">No submissions recorded yet.</div>
            <div v-for="bar in bars" :key="bar.label" class="bar-col">
              <div class="bar" :style="{
                height: (bar.val / maxBar * 100) + '%',
                background: bar.future ? '#E2E8F0' : '#2F80ED',
                opacity: bar.future ? 0.5 : bar.current ? 1 : 0.8
              }"></div>
              <div class="bar-lbl">{{ bar.label }}</div>
            </div>
          </div>
          <div class="chart-legend">
            <div class="cl-item">
              <div class="cl-dot accent"></div>{{ activeTab }} submissions
            </div>
            <div class="cl-item">
              <div class="cl-dot gray"></div>Upcoming months
            </div>
          </div>
        </div>
      </div>

      <!-- Notifications -->
      <div class="card">
        <div class="card-hd">
          <span class="card-title">Notifications</span>
          <span v-if="notifUnread > 0" class="badge badge-red-solid">{{ notifUnread }} new</span>
        </div>
        <div class="card-body notif-body">
          <div v-if="!notifications.length" class="notif-text" style="padding:8px 0;">You're all caught up.</div>
          <div v-for="n in notifications" :key="n.id" class="notif-item">
            <div class="notif-icon" :style="{ background: n.bg }">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path :d="n.path" :stroke="n.color" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <div>
              <div class="notif-text"><strong>{{ n.type }}:</strong> {{ n.msg }}</div>
              <div class="notif-time">{{ n.time }}</div>
            </div>
          </div>
        </div>
      </div>

    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '@/stores/dashboard'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { usePermissions } from '@/composables/usePermissions'

const router     = useRouter()
const dashStore  = useDashboardStore()
const authStore  = useAuthStore()
const notifStore = useNotificationsStore()
const { isAdmin, isDirector, isAsstDir, isDivChief, canViewAllDivisions } = usePermissions()

const activeTab = ref('IPCR')
let dashboardTimer = null

onMounted(async () => {
  if (!authStore.initialised) await authStore.init()
  if (authStore.isAuthenticated) {
    refreshDashboard()
    dashboardTimer = window.setInterval(refreshDashboard, 45000)
    window.addEventListener('focus', refreshDashboard)
    if (!notifStore.notifications.length) notifStore.fetchAll().catch(() => { })
  }
})

onUnmounted(() => {
  if (dashboardTimer) window.clearInterval(dashboardTimer)
  window.removeEventListener('focus', refreshDashboard)
})

function refreshDashboard() {
  return dashStore.fetchAll({ type: activeTab.value, silent: true }).catch(() => { })
}

// ── Period tag ──
const currentSemester = computed(() => {
  const now = new Date()
  return `${now.getMonth() < 6 ? 'S1' : 'S2'} ${now.getFullYear()}`
})

// ── Stat cards (dashboard/summary) ──
const stats = computed(() => dashStore.summary || {
  totalPersonnel: '-', totalTargets: 0, completionRate: 0, delayed: 0, pending: 0, completed: 0
})

const canSeePersonnelSummary = computed(() =>
  canViewAllDivisions.value || isAdmin.value || isDirector.value || isAsstDir.value || isDivChief.value
)

const primaryStat = computed(() => {
  if (canSeePersonnelSummary.value) {
    return {
      label: 'Total Personnel',
      value: stats.value.totalPersonnel,
      sub: 'Active accounts'
    }
  }

  return {
    label: 'My Targets',
    value: stats.value.totalTargets,
    sub: 'Recorded for this period'
  }
})

// ── Division performance (dashboard/divisions) ──
const DIV_COLORS = { blue: '#2F80ED', green: '#27AE60', gold: '#E9A840', orange: '#F2994A', red: '#EB5757', purple: '#7C3AED' }

const divisions = computed(() => {
  const rows = dashStore.divisions || []
  const maxPct = Math.max(...rows.map(d => d.completionRate || 0), 0)
  return rows.map(d => ({
    name:  d.name,
    pct:   d.completionRate || 0,
    color: DIV_COLORS[d.color] || (String(d.color || '').startsWith('#') ? d.color : '#2F80ED'),
    top:   rows.length > 1 && maxPct > 0 && d.completionRate === maxPct
  }))
})

// ── Status donut (dashboard/status) ──
const STATUS_COLORS = {
  'Not Started': '#CBD5E1', 'Ongoing': '#2F80ED', 'Submitted': '#E9A840',
  'For Revision': '#F2994A', 'Approved': '#6FCF97', 'Delayed': '#EB5757', 'Completed': '#27AE60'
}

const statuses = computed(() =>
  (dashStore.statusBreakdown || []).map(s => ({
    label: s.status, count: s.count, color: STATUS_COLORS[s.status] || '#94A3B8'
  }))
)

const totalTargets = computed(() => statuses.value.reduce((sum, s) => sum + s.count, 0))

const DONUT_CIRC = 2 * Math.PI * 42
const donutSegments = computed(() => {
  const total = totalTargets.value
  if (!total) return []
  let acc = 0
  return statuses.value.map(s => {
    const len = (s.count / total) * DONUT_CIRC
    const seg = { label: s.label, color: s.color, dash: `${len} ${DONUT_CIRC - len}`, offset: -acc }
    acc += len
    return seg
  })
})

// ── Monthly activity (dashboard/activity) ──
const bars = computed(() => {
  const rows = dashStore.monthlyActivity || []
  const nowMonth = new Date().getMonth()
  return rows.map((m, idx) => ({
    label:   m.label,
    val:     m.count || 0,
    current: idx === nowMonth,
    future:  idx > nowMonth
  }))
})
const maxBar = computed(() => Math.max(...bars.value.map(b => b.val), 1))

function setTab(t) {
  if (activeTab.value === t) return
  activeTab.value = t
  refreshDashboard()
}

// ── Notifications (real store, same one AppLayout uses) ──
const NOTIF_META = {
  approval: { bg: '#E6F4EA', color: '#27AE60', path: 'M1 5l3 3 5-5' },
  revision: { bg: '#FEF3E2', color: '#C8882A', path: 'M1 5a4 4 0 017-2M11 7a4 4 0 01-7 2M11 3v3H8' },
  deadline: { bg: '#FDECEC', color: '#EB5757', path: 'M6 1L1 11h10L6 1zM6 5v3M6 9.5v.5' },
  alert:    { bg: '#EBF4FF', color: '#2F80ED', path: 'M6 1v6M3 5l3 2.5L9 5M2 9v1a1 1 0 001 1h6a1 1 0 001-1V9' }
}
const NOTIF_LABELS = { approval: 'Approved', revision: 'Revision', deadline: 'Deadline Alert', alert: 'Alert' }

const notifications = computed(() =>
  (notifStore.notifications || []).slice(0, 4).map(n => {
    const meta = NOTIF_META[n.type] || NOTIF_META.alert
    return {
      id:    n.id,
      type:  NOTIF_LABELS[n.type] || 'Notice',
      msg:   n.message,
      time:  formatNotifTime(n.createdAt),
      bg:    meta.bg,
      color: meta.color,
      path:  meta.path
    }
  })
)
const notifUnread = computed(() => notifStore.unreadCount)

function formatNotifTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) +
           ' • ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

* {
  box-sizing: border-box;
}

.content {
  padding: 16px 20px 20px;
 
  font-size: 13px;
  color: #1A2332;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}

.stat-card {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 12px 14px;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
}

.stat-blue::before {
  background: #2F80ED;
}

.stat-green::before {
  background: #27AE60;
}

.stat-gold::before {
  background: #E9A840;
}

.stat-red::before {
  background: #EB5757;
}

.stat-label {
  font-size: 10px;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: .4px;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #1A2332;
  line-height: 1;
  font-family: 'DM Mono', monospace;
  margin-bottom: 4px;
}

.stat-sub {
  font-size: 10px;
  color: #718096;
}

.stat-sub.up {
  color: #27AE60;
}

.stat-sub.down {
  color: #EB5757;
}

.stat-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon.blue {
  background: #EBF4FF;
  color: #2F80ED;
}

.stat-icon.green {
  background: #E6F4EA;
  color: #27AE60;
}

.stat-icon.gold {
  background: #FEF3E2;
  color: #C8882A;
}

.stat-icon.red {
  background: #FDECEC;
  color: #EB5757;
}

/* Grid */
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}

/* Card */
.card {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  overflow: hidden;
}

.card-hd {
  padding: 12px 14px;
  border-bottom: 1px solid #E2E8F0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 12px;
  font-weight: 600;
  color: #1A2332;
}

.card-body {
  padding: 14px;
}

.sem-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: linear-gradient(135deg, #EBF4FF, #F3EEFF);
  border: 1px solid #C7D8F6;
  border-radius: 20px;
  font-size: 10px;
  color: #1A56B0;
  font-weight: 500;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  background: #fff;
  font-size: 11px;
  color: #4A5568;
  cursor: pointer;
 
  transition: all .15s;
}

.btn:hover {
  background: #F7FAFC;
  border-color: #2F80ED;
  color: #2F80ED;
}

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 500;
}

.badge-green {
  background: #E6F4EA;
  color: #1E7E34;
}

.badge-orange {
  background: #FEF3E2;
  color: #B35A0F;
}

.badge-red-solid {
  background: #EB5757;
  color: #fff;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 20px;
}

/* Division list */
.div-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.div-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.div-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.div-name {
  font-size: 12px;
  font-weight: 500;
  color: #1A2332;
}

.div-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.div-pct {
  font-size: 11px;
  color: #718096;
}

.prog-wrap {
  height: 6px;
  background: #EDF2F7;
  border-radius: 4px;
  overflow: hidden;
}

.prog-bar {
  height: 100%;
  border-radius: 4px;
  transition: width .5s;
}

/* Donut */
.donut-wrap {
  display: flex;
  align-items: center;
  gap: 16px;
}

.donut-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #4A5568;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Pill tabs */
.pill-tabs {
  display: flex;
  gap: 4px;
}

.pill {
  padding: 3px 9px;
  border-radius: 20px;
  font-size: 11px;
  cursor: pointer;
  border: 1px solid #E2E8F0;
  color: #718096;
  transition: all .15s;
}

.pill.active {
  background: #2F80ED;
  color: #fff;
  border-color: #2F80ED;
}

/* Bar chart */
.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 90px;
  margin-bottom: 8px;
}

.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
  justify-content: flex-end;
}

.bar {
  width: 100%;
  border-radius: 3px 3px 0 0;
  min-height: 3px;
  transition: height .5s;
}

.bar-lbl {
  font-size: 9px;
  color: #718096;
}

.chart-legend {
  display: flex;
  gap: 14px;
}

.cl-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: #718096;
}

.cl-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.cl-dot.accent {
  background: #2F80ED;
}

.cl-dot.gray {
  background: #E2E8F0;
  border: 1px solid #CBD5E1;
}

/* Notifications */
.notif-body {
  padding: 8px 14px;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #E2E8F0;
}

.notif-item:last-child {
  border-bottom: none;
}

.notif-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.notif-text {
  font-size: 11px;
  color: #4A5568;
  line-height: 1.4;
}

.notif-text strong {
  color: #1A2332;
}

.notif-time {
  font-size: 9px;
  color: #718096;
  margin-top: 2px;
}

@media (max-width: 900px) {
  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }

  .grid-2 {
    grid-template-columns: 1fr;
  }
}
</style>
