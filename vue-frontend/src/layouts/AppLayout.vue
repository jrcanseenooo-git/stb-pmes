<template>
  <div class="shell" :class="{ 'sidebar-collapsed': collapsed }">
    <aside class="sidebar">
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
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">Dashboard</span>
            </transition>
          </RouterLink>

          <RouterLink v-if="canManageUsers" to="/kra" class="nav-item" active-class="active" :title="collapsed ? 'KRA Library' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.4" />
                <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">KRA Library</span>
            </transition>
          </RouterLink>

          <RouterLink to="/evaluation" class="nav-item" active-class="active" :title="collapsed ? 'Evaluation' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5l1.8 3.5 3.9.6-2.85 2.75.67 3.9L8 10.4l-3.52 1.85.67-3.9L2.3 5.6l3.9-.6L8 1.5z"
                  stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">Evaluation</span>
            </transition>
          </RouterLink>
        </div>

        <div class="nav-group">
          <div v-if="!collapsed" class="nav-label">Monitoring</div>
          <div v-else class="nav-divider"></div>

          <RouterLink to="/ipcrf" class="nav-item" active-class="active" :title="collapsed ? 'KRA & Targets' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4" />
                <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.4" />
                <circle cx="8" cy="8" r="1" fill="currentColor" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">IPCRF / CCEF</span>
            </transition>
          </RouterLink>

          <RouterLink to="/accomplishments" class="nav-item" active-class="active" :title="collapsed ? 'Accomplishments' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.4" />
                <path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
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
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">MOV Files</span>
            </transition>
          </RouterLink>
        </div>

        <div class="nav-group">
          <div v-if="!collapsed" class="nav-label">Administration</div>
          <div v-else class="nav-divider"></div>

          <RouterLink to="/reports" class="nav-item" active-class="active" :title="collapsed ? 'Reports' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.4" />
                <path d="M5 6h6M5 9h4M5 12h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">Reports</span>
            </transition>
          </RouterLink>

          <RouterLink to="/audit" class="nav-item" active-class="active" :title="collapsed ? 'Audit Trail' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5L2 4v4.5c0 3.5 2.5 6 6 6.5 3.5-.5 6-3 6-6.5V4L8 1.5z"
                  stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
                <path d="M5.5 8l2 2 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">Audit Trail</span>
            </transition>
          </RouterLink>

          <RouterLink v-if="canManageUsers" to="/users" class="nav-item" active-class="active" :title="collapsed ? 'User Management' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.4" />
                <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">User Management</span>
            </transition>
          </RouterLink>

          <RouterLink to="/profile" class="nav-item" active-class="active" :title="collapsed ? 'Settings' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"
                  stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">Profile Settings</span>
            </transition>
          </RouterLink>
        </div>
      </nav>

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
                <path d="M5 1.5H2.5A1 1 0 001.5 2.5v9a1 1 0 001 1H5M10 10l3-3-3-3M13 7H5"
                  stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </transition>
        </div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="burger" @click="collapsed = !collapsed" :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'">
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
              <path d="M6.5 1v7M4 6l2.5 2.5L9 6M2 10v1a1 1 0 001 1h7a1 1 0 001-1v-1"
                stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Export
          </button>

          <div class="topbar-avatar" @click="$router.push('/profile')" :title="authStore.fullName">
            {{ authStore.initials || 'U' }}
          </div>
        </div>
      </header>

      <main class="page-body">
        <RouterView />
      </main>
    </div>

    <div v-if="!collapsed && isMobile" class="overlay" @click="collapsed = true"></div>

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
  '/ipcrf': { title: 'IPCRF / CCEF Forms', sub: 'Performance Commitments' },
  '/kra': { title: 'KRA Library', sub: 'Master KRA & SI List' },
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

const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => {
      if (!el.contains(e.target)) binding.value(e)
    }
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
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.shell {
  --sidebar-w: 230px;
  --sidebar-collapsed-w: 64px;
  --topbar-h: 56px;
  --blue: #0038a8;
  --blue-dark: #061b45;
  --blue-soft: #eef4ff;
  --bg: #f4f7fb;
  --card: #ffffff;
  --line: #dbe4f0;
  --text: #0f172a;
  --muted: #64748b;

  position: fixed;
  inset: 0;
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: Inter, system-ui, sans-serif;
  color: var(--text);
  background: var(--bg);
}

.sidebar {
  width: var(--sidebar-w);
  flex: 0 0 var(--sidebar-w);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #071426;
  border-right: 1px solid rgba(255,255,255,.08);
}

.sidebar-collapsed .sidebar {
  width: var(--sidebar-collapsed-w);
  flex-basis: var(--sidebar-collapsed-w);
}

.sb-brand {
  height: var(--topbar-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(255,255,255,.08);
}

.brand-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: var(--blue);
}

.brand-text {
  min-width: 0;
  overflow: hidden;
}

.brand-name {
  color: #ffffff;
  font-size: 14px;
  font-weight: 800;
  line-height: 1;
}

.brand-sub {
  margin-top: 3px;
  color: rgba(255,255,255,.48);
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: .65px;
  text-transform: uppercase;
  white-space: nowrap;
}

.sb-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 9px;
}

.sb-nav::-webkit-scrollbar {
  width: 0;
}

.nav-group {
  margin-bottom: 6px;
}

.nav-label {
  padding: 9px 9px 5px;
  color: rgba(255,255,255,.32);
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: .8px;
  text-transform: uppercase;
  white-space: nowrap;
}

.nav-divider {
  height: 1px;
  margin: 9px;
  background: rgba(255,255,255,.08);
}

.nav-item {
  position: relative;
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 4px;
  padding: 9px 12px;
  border-radius: 12px;
  color: rgba(255,255,255,.72);
  text-decoration: none;
  transition: .15s ease;
}

.nav-item:hover {
  background: rgba(255,255,255,.08);
  color: #ffffff;
}

.nav-item.active {
  background: #ffffff;
  color: var(--blue);
  box-shadow: 0 8px 18px rgba(0,0,0,.16);
}

.nav-icon {
  width: 19px;
  height: 19px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
}

.nav-label-text {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 750;
}

.nav-badge {
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  background: #ef4444;
  color: #ffffff;
  font-size: 9px;
  font-weight: 800;
}

.nav-badge-dot {
  position: absolute;
  right: 7px;
  top: 7px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ef4444;
}

.sb-footer {
  flex-shrink: 0;
  padding: 9px;
}

.sb-user {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px;
  border-radius: 14px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.07);
  cursor: pointer;
}

.sb-user.centered {
  justify-content: center;
}

.user-av,
.topbar-avatar {
  width: 31px;
  height: 31px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--blue);
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
}

.user-meta {
  min-width: 0;
  flex: 1;
}

.user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #ffffff;
  font-size: 11.5px;
  font-weight: 750;
}

.user-role {
  color: rgba(255,255,255,.45);
  font-size: 10px;
}

.logout-btn {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: 0;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: transparent;
  color: rgba(255,255,255,.5);
  cursor: pointer;
}

.logout-btn:hover {
  background: rgba(255,255,255,.08);
  color: #ffffff;
}

.main {
  min-width: 0;
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.topbar {
  height: var(--topbar-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  background: rgba(255,255,255,.96);
  border-bottom: 1px solid var(--line);
  z-index: 20;
}

.burger {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: 1px solid transparent;
  border-radius: 9px;
  display: grid;
  place-items: center;
  gap: 3px;
  background: transparent;
  cursor: pointer;
}

.burger:hover {
  background: #f1f5f9;
  border-color: var(--line);
}

.burger-line {
  width: 15px;
  height: 2px;
  border-radius: 999px;
  background: #475569;
}

.topbar-left {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 7px;
}

.topbar-title {
  color: var(--text);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -.25px;
  white-space: nowrap;
}

.topbar-sep,
.topbar-sub {
  color: #94a3b8;
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}

.topbar-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 7px;
}

.sem-pill {
  height: 30px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 11px;
  border-radius: 999px;
  background: var(--blue-soft);
  border: 1px solid #c9dcff;
  color: var(--blue);
  font-size: 11.5px;
  font-weight: 800;
  white-space: nowrap;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
}

.search-wrap {
  width: 180px;
  height: 32px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #f8fafc;
}

.search-wrap input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 12px;
}

.icon-btn {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
}

.icon-btn:hover {
  background: #f8fafc;
  color: var(--blue);
}

.badge-dot {
  position: absolute;
  top: -5px;
  right: -4px;
  min-width: 15px;
  height: 15px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #ef4444;
  color: #ffffff;
  font-size: 8.5px;
  font-weight: 800;
}

.export-btn {
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: 10px;
  padding: 0 12px;
  background: var(--blue);
  color: #ffffff;
  font-size: 11.5px;
  font-weight: 800;
  cursor: pointer;
}

.notif-dropdown {
  position: absolute;
  top: 46px;
  right: 68px;
  width: 320px;
  max-height: 400px;
  overflow: hidden;
  border-radius: 15px;
  background: #ffffff;
  border: 1px solid var(--line);
  box-shadow: 0 24px 70px rgba(15,23,42,.18);
  z-index: 60;
}

.notif-hd {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 13px;
  border-bottom: 1px solid var(--line);
}

.notif-title {
  font-size: 13px;
  font-weight: 800;
}

.notif-count {
  padding: 3px 8px;
  border-radius: 999px;
  background: #fee2e2;
  color: #dc2626;
  font-size: 10px;
  font-weight: 800;
}

.notif-row {
  display: flex;
  gap: 9px;
  padding: 10px 13px;
  border-bottom: 1px solid #eef2f7;
}

.notif-icon-wrap {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
}

.notif-msg {
  color: var(--text);
  font-size: 12px;
}

.notif-time {
  margin-top: 3px;
  color: #94a3b8;
  font-size: 10px;
}

.page-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 18px;
  background:
    linear-gradient(rgba(15,23,42,.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15,23,42,.025) 1px, transparent 1px),
    #f4f7fb;
  background-size: 34px 34px;
}

.page-body :deep(> *) {
  min-width: 0;
  max-width: 100%;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity .15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(15,23,42,.42);
  z-index: 40;
}

@media (max-width: 900px) {
  .shell {
    --sidebar-w: 230px;
  }

  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 50;
  }

  .sidebar-collapsed .sidebar {
    transform: translateX(-100%);
    width: var(--sidebar-w);
    flex-basis: var(--sidebar-w);
  }

  .topbar {
    padding: 0 10px;
  }

  .search-wrap,
  .sem-pill {
    display: none;
  }

  .page-body {
    padding: 12px;
  }
}

@media (max-width: 520px) {
  .topbar-title {
    font-size: 14px;
  }

  .topbar-sub,
  .topbar-sep {
    display: none;
  }

  .export-btn {
    display: none;
  }
}
</style>