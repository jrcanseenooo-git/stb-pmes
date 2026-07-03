<template>
  <div class="content">

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card stat-blue">
        <div class="stat-label">Total Personnel</div>
        <div class="stat-value">84</div>
        <div class="stat-sub up">↑ 3 new this semester</div>
        <div class="stat-icon blue">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="5" r="2.5" stroke="currentColor" stroke-width="1.4" />
            <path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </div>
      </div>
      <div class="stat-card stat-green">
        <div class="stat-label">Completion Rate</div>
        <div class="stat-value">73<span style="font-size:14px">%</span></div>
        <div class="stat-sub up">↑ 8% vs last sem.</div>
        <div class="stat-icon green">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 14V8l4-4 4 4 4-4v10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
        </div>
      </div>
      <div class="stat-card stat-gold">
        <div class="stat-label">Pending Submissions</div>
        <div class="stat-value">17</div>
        <div class="stat-sub">Across 4 divisions</div>
        <div class="stat-icon gold">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4" />
            <path d="M8 5v3.5l2 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </div>
      </div>
      <div class="stat-card stat-red">
        <div class="stat-label">Delayed Targets</div>
        <div class="stat-value">6</div>
        <div class="stat-sub down">↑ 2 since last week</div>
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
          <span class="sem-tag">S1 2025</span>
        </div>
        <div class="card-body">
          <div class="div-list">
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
          <button class="btn">View all</button>
        </div>
        <div class="card-body">
          <div class="donut-wrap">
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="42" fill="none" stroke="#E2E8F0" stroke-width="16" />
              <circle cx="55" cy="55" r="42" fill="none" stroke="#27AE60" stroke-width="16" stroke-dasharray="96 168"
                stroke-dashoffset="0" transform="rotate(-90 55 55)" stroke-linecap="round" />
              <circle cx="55" cy="55" r="42" fill="none" stroke="#2F80ED" stroke-width="16" stroke-dasharray="46 168"
                stroke-dashoffset="-96" transform="rotate(-90 55 55)" stroke-linecap="round" />
              <circle cx="55" cy="55" r="42" fill="none" stroke="#F2994A" stroke-width="16" stroke-dasharray="17 168"
                stroke-dashoffset="-142" transform="rotate(-90 55 55)" stroke-linecap="round" />
              <circle cx="55" cy="55" r="42" fill="none" stroke="#EB5757" stroke-width="16" stroke-dasharray="9 168"
                stroke-dashoffset="-159" transform="rotate(-90 55 55)" stroke-linecap="round" />
              <text x="55" y="51" text-anchor="middle" font-size="18" font-weight="600" fill="#1A2332"
                font-family="DM Mono,monospace">152</text>
              <text x="55" y="64" text-anchor="middle" font-size="8" fill="#718096"
                font-family="DM Sans,sans-serif">targets</text>
            </svg>
            <div class="donut-legend">
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
              @click="activeTab = t">{{ t }}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="bar-chart">
            <div v-for="(bar, i) in bars" :key="bar.label" class="bar-col">
              <div class="bar" :style="{
                height: (bar.val / maxBar * 100) + '%',
                background: i === 4 ? '#2F80ED' : i === 5 ? '#E2E8F0' : '#2F80ED',
                opacity: i === 5 ? 0.5 : i < 4 ? 0.65 + i * 0.07 : 1
              }"></div>
              <div class="bar-lbl">{{ bar.label }}</div>
            </div>
          </div>
          <div class="chart-legend">
            <div class="cl-item">
              <div class="cl-dot accent"></div>{{ activeTab }} submissions
            </div>
            <div class="cl-item">
              <div class="cl-dot gray"></div>Projected
            </div>
          </div>
        </div>
      </div>

      <!-- Notifications -->
      <div class="card">
        <div class="card-hd">
          <span class="card-title">Notifications</span>
          <span class="badge badge-red-solid">5 new</span>
        </div>
        <div class="card-body notif-body">
          <div v-for="n in notifications" :key="n.msg" class="notif-item">
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
import { ref, computed, onMounted } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useAuthStore } from '@/stores/auth'

const dashStore = useDashboardStore()
const authStore = useAuthStore()

onMounted(async () => {
  if (!authStore.initialised) await authStore.init()
  if (authStore.isAuthenticated) {
    dashStore.fetchAll().catch(() => { })
  }
})

const activeTab = ref('IPCR')

const divisions = computed(() =>
  dashStore.divisions.length ? dashStore.divisions : [
    { name: 'Admin Pool', pct: 82, color: '#27AE60', top: true },
    { name: 'Design Formulation Div.', pct: 76, color: '#2F80ED' },
    { name: 'Pilot Implementation Div.', pct: 68, color: '#E9A840' },
    { name: 'Social Tech Analysis & Eval.', pct: 61, color: '#F2994A', down: true }
  ]
)

const statuses = computed(() =>
  dashStore.statusBreakdown.length ? dashStore.statusBreakdown : [
    { label: 'Completed', count: 87, color: '#27AE60' },
    { label: 'Ongoing', count: 42, color: '#2F80ED' },
    { label: 'For Revision', count: 15, color: '#F2994A' },
    { label: 'Delayed', count: 8, color: '#EB5757' }
  ]
)

const ipcr = [
  { label: 'Jan', val: 12 }, { label: 'Feb', val: 18 },
  { label: 'Mar', val: 28 }, { label: 'Apr', val: 22 },
  { label: 'May', val: 35 }, { label: 'Jun', val: 14 }
]
const ccef = [
  { label: 'Jan', val: 8 }, { label: 'Feb', val: 14 },
  { label: 'Mar', val: 20 }, { label: 'Apr', val: 16 },
  { label: 'May', val: 25 }, { label: 'Jun', val: 10 }
]

const bars = computed(() => activeTab.value === 'IPCR' ? ipcr : ccef)
const maxBar = computed(() => Math.max(...bars.value.map(b => b.val)))

const notifications = computed(() =>
  dashStore.notifications?.length ? dashStore.notifications : [
    { type: 'Deadline Alert', msg: 'Q1 IPCR submission ends in 2 days', time: 'May 11, 2025 • 8:00 AM', bg: '#FDECEC', color: '#EB5757', path: 'M6 1L1 11h10L6 1zM6 5v3M6 9.5v.5' },
    { type: 'Approved', msg: 'M. Santos – Admin Pool Q1 IPCR', time: 'May 10, 2025 • 2:14 PM', bg: '#E6F4EA', color: '#27AE60', path: 'M1 5l3 3 5-5' },
    { type: 'Revision', msg: 'J. Cruz – CCEF Target 3 MOV missing', time: 'May 9, 2025 • 10:30 AM', bg: '#FEF3E2', color: '#C8882A', path: 'M1 5a4 4 0 017-2M11 7a4 4 0 01-7 2M11 3v3H8' },
    { type: 'New MOV', msg: 'R. Dela Cruz submitted 3 files', time: 'May 8, 2025 • 4:00 PM', bg: '#EBF4FF', color: '#2F80ED', path: 'M6 1v6M3 5l3 2.5L9 5M2 9v1a1 1 0 001 1h6a1 1 0 001-1V9' }
  ]
)
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