<template>
  <div class="shell" :class="{ 'sidebar-collapsed': collapsed }">

    <!-- ── Sidebar ── -->
    <aside class="sidebar">
      <!-- Brand -->
      <div class="sb-brand">
        <div class="brand-icon">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="3" width="14" height="2" rx="1" fill="white" />
            <rect x="2" y="8" width="10" height="2" rx="1" fill="white" />
            <rect x="2" y="13" width="12" height="2" rx="1" fill="white" />
          </svg>
        </div>
        <transition name="fade">
          <div v-if="!collapsed" class="brand-text">
            <div class="brand-name">PMES</div>
            <div class="brand-sub">Monitoring System</div>
          </div>
        </transition>
      </div>

      <!-- Nav -->
      <nav class="sb-nav">
        <div class="nav-group">
          <div v-if="!collapsed" class="nav-label">Overview</div>
          <RouterLink to="/dashboard" class="nav-item" active-class="active" :title="collapsed ? 'Dashboard' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.4" />
                <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.4" />
                <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.4" />
                <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.4" />
              </svg>
            </div>
            <transition name="fade"><span v-if="!collapsed" class="nav-label-text">Dashboard</span></transition>
          </RouterLink>
          <RouterLink to="/kra" class="nav-item" active-class="active" :title="collapsed ? 'KRA & Targets' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4" />
                <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.4" />
                <circle cx="8" cy="8" r="1" fill="currentColor" />
              </svg>
            </div>
            <transition name="fade"><span v-if="!collapsed" class="nav-label-text">IPCRF / CCEF</span></transition>
          </RouterLink>
          <RouterLink to="/accomplishments" class="nav-item" active-class="active"
            :title="collapsed ? 'Accomplishments' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.4" />
                <path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">
                Accomplishments
                <span class="nav-badge">3</span>
              </span>
            </transition>
            <span v-if="collapsed" class="nav-badge-dot"></span>
          </RouterLink>
          <RouterLink to="/mov" class="nav-item" active-class="active" :title="collapsed ? 'MOV Files' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M9 1.5H4a1.5 1.5 0 00-1.5 1.5v10A1.5 1.5 0 004 14.5h8A1.5 1.5 0 0013.5 13V6L9 1.5z"
                  stroke="currentColor" stroke-width="1.4" />
                <path d="M9 1.5V6H13.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
              </svg>
            </div>
            <transition name="fade"><span v-if="!collapsed" class="nav-label-text">MOV Files</span></transition>
          </RouterLink>
        </div>

        <div class="nav-group">
          <div v-if="!collapsed" class="nav-label">Monitoring</div>
          <div v-else class="nav-divider"></div>
          <RouterLink to="/reports" class="nav-item" active-class="active" :title="collapsed ? 'Reports' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.4" />
                <path d="M5 6h6M5 9h4M5 12h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
              </svg>
            </div>
            <transition name="fade"><span v-if="!collapsed" class="nav-label-text">Reports</span></transition>
          </RouterLink>
          <RouterLink to="/evaluation" class="nav-item" active-class="active" :title="collapsed ? 'Evaluation' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5l1.8 3.5 3.9.6-2.85 2.75.67 3.9L8 10.4l-3.52 1.85.67-3.9L2.3 5.6l3.9-.6L8 1.5z"
                  stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
              </svg>
            </div>
            <transition name="fade"><span v-if="!collapsed" class="nav-label-text">Evaluation</span></transition>
          </RouterLink>
          <RouterLink to="/audit" class="nav-item" active-class="active" :title="collapsed ? 'Audit Trail' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5L2 4v4.5c0 3.5 2.5 6 6 6.5 3.5-.5 6-3 6-6.5V4L8 1.5z" stroke="currentColor"
                  stroke-width="1.4" stroke-linejoin="round" />
                <path d="M5.5 8l2 2 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </div>
            <transition name="fade"><span v-if="!collapsed" class="nav-label-text">Audit Trail</span></transition>
          </RouterLink>
        </div>

        <div class="nav-group">
          <div v-if="!collapsed" class="nav-label">Administration</div>
          <div v-else class="nav-divider"></div>
          <RouterLink v-if="canManageUsers" to="/users" class="nav-item" active-class="active" :title="collapsed ? 'User Management' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.4" />
                <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" stroke-width="1.4"
                  stroke-linecap="round" />
              </svg>
            </div>
            <transition name="fade"><span v-if="!collapsed" class="nav-label-text">User Management</span></transition>
          </RouterLink>
          <RouterLink to="/profile" class="nav-item" active-class="active" :title="collapsed ? 'Settings' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"
                  stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
              </svg>
            </div>
            <transition name="fade"><span v-if="!collapsed" class="nav-label-text">Settings</span></transition>
          </RouterLink>
        </div>
      </nav>

      <!-- User -->
      <div class="sb-footer">
        <div class="sb-user" :class="{ centered: collapsed }" @click="$router.push('/profile')">
          <div class="user-av">{{ authStore.initials || 'U' }}</div>
          <transition name="fade">
            <div v-if="!collapsed" class="user-meta">
              <div class="user-name">{{ authStore.fullName || 'User' }}</div>
              <div class="user-role">{{ authStore.role || 'Staff' }}</div>
            </div>
          </transition>
          <transition name="fade">
            <button v-if="!collapsed" class="logout-btn" @click.stop="handleLogout" title="Sign out">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 1.5H2.5A1 1 0 001.5 2.5v9a1 1 0 001 1H5M10 10l3-3-3-3M13 7H5" stroke="currentColor"
                  stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </transition>
        </div>
      </div>
    </aside>

    <!-- ── Main ── -->
    <div class="main">

      <!-- Topbar -->
      <header class="topbar">
        <button class="burger" @click="collapsed = !collapsed"
          :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'">
          <span :class="['burger-line', collapsed && 'open']"></span>
          <span :class="['burger-line', collapsed && 'open']"></span>
          <span :class="['burger-line', collapsed && 'open']"></span>
        </button>

        <div class="topbar-left">
          <span class="topbar-title">{{ pageTitle }}</span>
          <span v-if="pageSub" class="topbar-sep">/</span>
          <span v-if="pageSub" class="topbar-sub">{{ pageSub }}</span>
        </div>

        <div class="topbar-right">
          <div class="sem-pill">
            <span class="live-dot"></span>
            S1 · 2025
          </div>

          <div class="search-wrap">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke="#94A3B8" stroke-width="1.3" />
              <path d="M9 9l2.5 2.5" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round" />
            </svg>
            <input v-model="search" type="text" placeholder="Search..." />
          </div>

          <div class="icon-btn" @click="showNotifs = !showNotifs">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5a4.5 4.5 0 014.5 4.5v3l1.5 2.5H2L3.5 9V6A4.5 4.5 0 018 1.5zM6.5 12.5a1.5 1.5 0 003 0"
                stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            </svg>
            <span class="badge-dot">2</span>
          </div>

          <!-- Notif dropdown -->
          <div v-if="showNotifs" class="notif-dropdown" v-click-outside="() => showNotifs = false">
            <div class="notif-hd">
              <span class="notif-title">Notifications</span>
              <span class="notif-count">5 new</span>
            </div>
            <div v-for="n in notifs" :key="n.msg" class="notif-row">
              <div class="notif-icon-wrap" :style="{ background: n.bg }">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" :stroke="n.color" stroke-width="1.2" />
                </svg>
              </div>
              <div>
                <div class="notif-msg"><b>{{ n.type }}:</b> {{ n.msg }}</div>
                <div class="notif-time">{{ n.time }}</div>
              </div>
            </div>
          </div>

          <button class="export-btn" @click="handleExport">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v7M4 6l2.5 2.5L9 6M2 10v1a1 1 0 001 1h7a1 1 0 001-1v-1" stroke="currentColor"
                stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Export
          </button>

          <div class="topbar-avatar" @click="$router.push('/profile')" :title="authStore.fullName">
            {{ authStore.initials || 'U' }}
          </div>
        </div>
      </header>

      <!-- Page content -->
      <main class="page-body">
        <RouterView />
      </main>
    </div>

    <!-- Mobile overlay -->
    <div v-if="!collapsed && isMobile" class="overlay" @click="collapsed = true"></div>

    <!-- ── Password Change Prompt (first-time login) ── -->
    <PasswordChangePrompt :show="showPwPrompt" @changed="onPasswordChanged" @skip="showPwPrompt = false" />

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePermissions } from '@/composables/usePermissions'
import PasswordChangePrompt from '@/components/common/PasswordChangePrompt.vue'

const authStore = useAuthStore()
const { canManageUsers } = usePermissions()
const route = useRoute()
const router = useRouter()

const collapsed = ref(false)
const search = ref('')
const showNotifs = ref(false)
const isMobile = ref(false)
const showPwPrompt = ref(false)

const titleMap = {
  '/dashboard': { title: 'Dashboard', sub: 'Bureau Overview' },
  '/kra': { title: 'IPCRF / CCEF Forms', sub: 'Performance Commitments' },
  '/accomplishments': { title: 'Accomplishments', sub: 'Q1 2025' },
  '/mov': { title: 'MOV Files', sub: 'Google Drive' },
  '/reports': { title: 'Reports', sub: 'Generate & Export' },
  '/evaluation': { title: 'Evaluation', sub: 'Rating Computation' },
  '/audit': { title: 'Audit Trail', sub: 'Activity Log' },
  '/users': { title: 'User Management', sub: 'Access Control' },
  '/profile': { title: 'Profile & Settings', sub: '' }
}

const pageTitle = computed(() => titleMap[route.path]?.title ?? 'PMES')
const pageSub = computed(() => titleMap[route.path]?.sub ?? '')

const notifs = [
  { type: 'Deadline', msg: 'Q1 IPCR ends in 2 days', time: 'May 11 · 8:00 AM', bg: '#FEF2F2', color: '#EF4444' },
  { type: 'Approved', msg: 'M. Santos – Q1 IPCR approved', time: 'May 10 · 2:14 PM', bg: '#F0FDF4', color: '#22C55E' },
  { type: 'Revision', msg: 'J. Cruz – CCEF MOV missing', time: 'May 9 · 10:30 AM', bg: '#FFFBEB', color: '#F59E0B' },
  { type: 'Upload', msg: 'R. Dela Cruz submitted 3 files', time: 'May 8 · 4:00 PM', bg: '#EFF6FF', color: '#3B82F6' }
]

// ── Watch for first-login flag ──
watch(
  () => authStore.profile,
  (profile) => {
    if (profile?.mustChangePassword || profile?.tempPassword) {
      showPwPrompt.value = true
    }
  },
  { immediate: true }
)

function onPasswordChanged() {
  showPwPrompt.value = false
  // TODO: clear mustChangePassword + tempPassword in Users sheet via API
  // usersApi.update(authStore.profile.id, { mustChangePassword: false, tempPassword: '' })
}

async function handleLogout() {
  await authStore.logout()
  router.push('/auth/login')
}

function handleExport() {
  alert('Export feature — connect to ReportsService to generate PDF/Excel')
}

function checkMobile() {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value) collapsed.value = true
}

// v-click-outside custom directive
const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => { if (!el.contains(e.target)) binding.value(e) }
    document.addEventListener('click', el._clickOutside)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside)
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  color: #0F172A;
  background: #F1F5F9;
  --sidebar-w: 220px;
  --sidebar-collapsed-w: 60px;
  --topbar-h: 56px;
  --transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ── Sidebar ── */
.sidebar {
  width: var(--sidebar-w);
  flex-shrink: 0;
  background: #0F172A;
  display: flex;
  flex-direction: column;
  transition: var(--transition);
  overflow: hidden;
  z-index: 50;
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
}

.sidebar-collapsed .sidebar {
  width: var(--sidebar-collapsed-w);
}

.sb-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  height: var(--topbar-h);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  overflow: hidden;
}

.brand-icon {
  width: 32px;
  height: 32px;
  background: #3B82F6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
}

.brand-text {
  overflow: hidden;
  white-space: nowrap;
}

.brand-name {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.3px;
}

.brand-sub {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.35);
  text-transform: uppercase;
  letter-spacing: 0.7px;
  margin-top: 1px;
}

.sb-nav {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  overflow-x: hidden;
}

.sb-nav::-webkit-scrollbar {
  width: 0;
}

.nav-group {
  margin-bottom: 4px;
}

.nav-label {
  font-size: 9px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.25);
  text-transform: uppercase;
  letter-spacing: 0.9px;
  padding: 10px 8px 4px;
  white-space: nowrap;
}

.nav-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 8px 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 8px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  font-size: 13px;
  font-weight: 450;
  transition: var(--transition);
  margin-bottom: 1px;
  position: relative;
  white-space: nowrap;
  overflow: hidden;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.9);
}

.nav-item.active {
  background: rgba(59, 130, 246, 0.15);
  color: #fff;
  font-weight: 500;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 25%;
  bottom: 25%;
  width: 3px;
  background: #3B82F6;
  border-radius: 0 3px 3px 0;
}

.nav-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-item.active .nav-icon {
  color: #60A5FA;
}

.nav-label-text {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.nav-badge {
  margin-left: auto;
  background: #EF4444;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 10px;
}

.nav-badge-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  background: #EF4444;
  border-radius: 50%;
  border: 1.5px solid #0F172A;
}

.sb-footer {
  flex-shrink: 0;
  padding: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.sb-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: var(--transition);
  overflow: hidden;
}

.sb-user:hover {
  background: rgba(255, 255, 255, 0.1);
}

.sb-user.centered {
  justify-content: center;
}

.user-av {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3B82F6, #1D4ED8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.user-meta {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.user-name {
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  color: rgba(255, 255, 255, 0.35);
  font-size: 10px;
  margin-top: 1px;
}

.logout-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.3);
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: all 0.15s;
  flex-shrink: 0;
}

.logout-btn:hover {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.1);
}

/* ── Main ── */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* ── Topbar ── */
.topbar {
  height: var(--topbar-h);
  background: #fff;
  border-bottom: 1px solid #E2E8F0;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  position: relative;
  z-index: 40;
}

.burger {
  width: 34px;
  height: 34px;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px;
  border-radius: 8px;
  transition: background 0.15s;
  flex-shrink: 0;
}

.burger:hover {
  background: #F1F5F9;
}

.burger-line {
  display: block;
  width: 16px;
  height: 1.5px;
  background: #64748B;
  border-radius: 2px;
  transition: var(--transition);
  transform-origin: center;
}

.burger-line.open:nth-child(1) {
  transform: rotate(45deg) translate(4px, 4px);
}

.burger-line.open:nth-child(2) {
  opacity: 0;
  transform: scaleX(0);
}

.burger-line.open:nth-child(3) {
  transform: rotate(-45deg) translate(4px, -4px);
}

.topbar-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.topbar-title {
  font-size: 15px;
  font-weight: 600;
  color: #0F172A;
  white-space: nowrap;
}

.topbar-sep {
  color: #CBD5E1;
  font-size: 13px;
}

.topbar-sub {
  font-size: 12px;
  color: #94A3B8;
  white-space: nowrap;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.sem-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  background: linear-gradient(135deg, #EFF6FF, #EEF2FF);
  border: 1px solid #BFDBFE;
  border-radius: 20px;
  font-size: 11px;
  color: #1D4ED8;
  font-weight: 600;
}

.live-dot {
  width: 6px;
  height: 6px;
  background: #22C55E;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.4;
    transform: scale(0.7);
  }
}

.search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #F8FAFC;
  border: 1.5px solid #E2E8F0;
  border-radius: 8px;
  padding: 6px 10px;
  transition: border-color 0.15s;
}

.search-wrap:focus-within {
  border-color: #3B82F6;
  background: #fff;
}

.search-wrap input {
  border: none;
  background: transparent;
  font-size: 12px;
  color: #0F172A;
  width: 150px;
  outline: none;
  font-family: 'Inter', sans-serif;
}

.search-wrap input::placeholder {
  color: #CBD5E1;
}

.icon-btn {
  position: relative;
  width: 34px;
  height: 34px;
  background: #F8FAFC;
  border: 1.5px solid #E2E8F0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #64748B;
  transition: all 0.15s;
}

.icon-btn:hover {
  background: #EFF6FF;
  border-color: #BFDBFE;
  color: #3B82F6;
}

.badge-dot {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 15px;
  height: 15px;
  background: #EF4444;
  color: #fff;
  font-size: 8px;
  font-weight: 700;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
}

.notif-dropdown {
  position: absolute;
  top: calc(var(--topbar-h) + 4px);
  right: 80px;
  width: 320px;
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  z-index: 100;
  overflow: hidden;
}

.notif-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #F1F5F9;
}

.notif-title {
  font-size: 13px;
  font-weight: 600;
  color: #0F172A;
}

.notif-count {
  font-size: 10px;
  background: #EF4444;
  color: #fff;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 600;
}

.notif-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid #F8FAFC;
  transition: background 0.1s;
}

.notif-row:last-child {
  border-bottom: none;
}

.notif-row:hover {
  background: #F8FAFC;
}

.notif-icon-wrap {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notif-msg {
  font-size: 11px;
  color: #374151;
  line-height: 1.4;
}

.notif-time {
  font-size: 9px;
  color: #94A3B8;
  margin-top: 2px;
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: #1D4ED8;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(29, 78, 216, 0.3);
  transition: all 0.15s;
}

.export-btn:hover {
  background: #1E40AF;
  box-shadow: 0 4px 14px rgba(29, 78, 216, 0.4);
  transform: translateY(-1px);
}

.topbar-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3B82F6, #1D4ED8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
  transition: transform 0.15s;
  flex-shrink: 0;
}

.topbar-avatar:hover {
  transform: scale(1.05);
}

/* ── Role bar ── */
.role-bar {
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid #E2E8F0;
  padding: 6px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.role-label {
  font-size: 11px;
  color: #94A3B8;
  font-weight: 500;
  white-space: nowrap;
}

.role-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.role-tab {
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid #E2E8F0;
  background: #fff;
  font-size: 11px;
  color: #64748B;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: all 0.15s;
}

.role-tab:hover {
  border-color: #3B82F6;
  color: #3B82F6;
}

.role-tab.active {
  background: #0F172A;
  color: #fff;
  border-color: #0F172A;
  font-weight: 500;
}

/* ── Page body ── */
.page-body {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #CBD5E1 transparent;
}

.page-body::-webkit-scrollbar {
  width: 5px;
}

.page-body::-webkit-scrollbar-thumb {
  background: #CBD5E1;
  border-radius: 3px;
}

/* ── Mobile overlay ── */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 45;
  backdrop-filter: blur(2px);
}

/* ── Transitions ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-4px);
}

.sidebar-collapsed .nav-item {
  justify-content: center;
}

.sidebar-collapsed .nav-item.active::before {
  display: none;
}

.sidebar-collapsed .nav-item.active {
  border-radius: 8px;
}
</style>