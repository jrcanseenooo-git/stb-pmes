<template>
  <div class="shell" :class="{ 'sidebar-collapsed': collapsed }">
    <aside class="sidebar">
      <div class="sb-brand">
        <div class="brand-icon">
          <img src="/android-chrome-512x512.png" alt="Social Technology Bureau seal" class="brand-seal" />
        </div>

        <transition name="fade">
          <div v-if="!collapsed" class="brand-text">
            <div class="brand-name">PERFORMANCE MONITORING</div>
            <div class="brand-sub">EVALUATION SYSTEM</div>
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
                <span v-if="accomplishmentsUnread > 0" class="nav-badge">{{ accomplishmentsUnread }}</span>
              </span>
            </transition>

            <span v-if="collapsed && accomplishmentsUnread > 0" class="nav-badge-dot"></span>
          </RouterLink>

          <RouterLink to="/review" class="nav-item" active-class="active" :title="collapsed ? 'Review' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.4" />
                <path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
                <path d="M10.5 10.5l1 1 2-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">Review</span>
            </transition>
          </RouterLink>

          <!-- <RouterLink to="/mov" class="nav-item" active-class="active" :title="collapsed ? 'MOV Files' : ''">
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
          </RouterLink> -->
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
            {{ currentSemester }}
          </div>

          <div class="search-wrap">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke="#94A3B8" stroke-width="1.3" />
              <path d="M9 9l2.5 2.5" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round" />
            </svg>
            <input v-model="search" type="text" placeholder="Search..." />
          </div>

          <div class="icon-btn" @click.stop="showNotifs = !showNotifs">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5a4.5 4.5 0 014.5 4.5v3l1.5 2.5H2L3.5 9V6A4.5 4.5 0 018 1.5zM6.5 12.5a1.5 1.5 0 003 0"
                stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            </svg>
            <span v-if="notifStore.unreadCount > 0" class="badge-dot">{{ notifStore.unreadCount }}</span>
          </div>

          <div v-if="showNotifs" class="notif-dropdown" v-click-outside="() => showNotifs = false">
            <div class="notif-hd">
              <span class="notif-title">Notifications</span>
              <div class="notif-hd-right">
                <span v-if="notifStore.unreadCount > 0" class="notif-count">{{ notifStore.unreadCount }} new</span>
                <button v-if="notifStore.unreadCount > 0" class="notif-mark-all" @click.stop="confirmMarkAllRead">Mark all read</button>
              </div>
            </div>

            <div v-if="notifStore.loading" class="notif-empty">Loading…</div>
            <div v-else-if="!notifStore.notifications.length" class="notif-empty">No notifications</div>
            <template v-else>
              <div
                v-for="n in notifStore.notifications"
                :key="n.id"
                class="notif-row"
                :class="{ 'notif-unread': !n.read, 'notif-actionable': notificationTarget(n) }"
                @click="handleNotificationClick(n)"
              >
                <div class="notif-icon-wrap" :style="{ background: notifStyle(n.type).bg }">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5" :stroke="notifStyle(n.type).color" stroke-width="1.2" />
                  </svg>
                </div>
                <div class="notif-body">
                  <div class="notif-msg"><b>{{ notifTypeLabel(n.type) }}:</b> {{ n.message }}</div>
                  <div class="notif-time">{{ relativeTime(n.createdAt) }}</div>
                </div>
              </div>
            </template>
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

    <PasswordChangePrompt :show="showPwPrompt" :force="authStore.profile?.mustChangePassword === true" @changed="onPasswordChanged" @skip="showPwPrompt = false" />
    <LogoutConfirmModal :show="showLogoutConfirm" @confirm="confirmLogout" @cancel="showLogoutConfirm = false" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePermissions } from '@/composables/usePermissions'
import { useNotificationsStore } from '@/stores/notifications'
import { useConfirm } from '@/composables/useConfirm'
import PasswordChangePrompt from '@/components/common/PasswordChangePrompt.vue'
import LogoutConfirmModal from '@/components/common/LogoutConfirmModal.vue'

const authStore = useAuthStore()
const { canManageUsers } = usePermissions()
const notifStore = useNotificationsStore()
const { confirm } = useConfirm()

// Unread notifications tied to the Accomplishments module — drives the sidebar nav badge
const accomplishmentsUnread = computed(() =>
  notifStore.notifications.filter(n => !n.read && n.module === 'Accomplishments').length
)
const route = useRoute()
const router = useRouter()

watch(() => route.path, () => {
  const el = document.querySelector('.page-body')
  if (el) el.scrollTop = 0
}, { flush: 'post' })

const collapsed = ref(false)
const search = ref('')
const showNotifs = ref(false)
const isMobile = ref(false)
const showPwPrompt = ref(false)
const showLogoutConfirm = ref(false)

const titleMap = {
  '/dashboard': { title: 'Dashboard', sub: 'Bureau Overview' },
  '/ipcrf': { title: 'IPCRF / CCEF Forms', sub: 'Performance Commitments' },
  '/review': { title: 'Review', sub: 'Assigned IPCRF / CCEF Forms' },
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

const currentSemester = computed(() => {
  const now = new Date()
  const month = now.getMonth() + 1 // 1–12
  const year = now.getFullYear()
  const sem = month >= 1 && month <= 6 ? 'S1' : 'S2'
  return `${sem} · ${year}`
})

const NOTIF_STYLES = {
  approval: { bg: '#F0FDF4', color: '#22C55E' },
  revision:  { bg: '#FFFBEB', color: '#F59E0B' },
  deadline:  { bg: '#FEF2F2', color: '#EF4444' },
  alert:     { bg: '#EFF6FF', color: '#3B82F6' },
}
const NOTIF_LABELS = { approval: 'Approved', revision: 'Revision', deadline: 'Deadline', alert: 'Alert' }

function notifStyle(type) {
  return NOTIF_STYLES[type] || { bg: '#F8FAFC', color: '#94A3B8' }
}
function notifTypeLabel(type) {
  return NOTIF_LABELS[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Notice')
}
function relativeTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function notificationTarget(notification) {
  const moduleName = String(notification?.module || '').toLowerCase()
  const text = `${notification?.type || ''} ${notification?.message || ''}`.toLowerCase()
  const relatedId = notification?.relatedId || notification?.formId || notification?.recordId || notification?.assignmentId || ''
  const withRelated = relatedId ? { highlight: relatedId } : {}

  if (moduleName.includes('accomplishment')) return { path: '/accomplishments', query: withRelated }
  if (moduleName.includes('review')) return { path: '/review', query: withRelated }
  if (moduleName.includes('ipcr') || moduleName.includes('ccef') || moduleName.includes('form')) {
    return { path: '/ipcrf', query: withRelated }
  }
  if (moduleName.includes('evaluation') || moduleName.includes('ipat')) {
    return { path: '/evaluation', query: withRelated }
  }
  if (moduleName.includes('kra')) return { path: '/kra', query: withRelated }
  if (moduleName.includes('report')) return { path: '/reports', query: withRelated }
  if (moduleName.includes('audit')) return { path: '/audit', query: withRelated }
  if (moduleName.includes('user')) return { path: '/users', query: withRelated }
  if (moduleName.includes('mov')) return { path: '/mov', query: withRelated }

  if (text.includes('returned') || text.includes('revision') || text.includes('target') || text.includes('ipcrf') || text.includes('ccef')) {
    return { path: '/ipcrf', query: withRelated }
  }
  if (text.includes('accomplishment') || text.includes('rating period') || text.includes('deadline')) {
    return { path: '/accomplishments', query: withRelated }
  }
  if (text.includes('review') || text.includes('route') || text.includes('checking')) {
    return { path: '/review', query: withRelated }
  }

  return null
}

async function handleNotificationClick(notification) {
  const target = notificationTarget(notification)

  if (!notification.read) {
    try {
      await notifStore.markRead(notification.id)
    } catch {
      return
    }
  }

  if (!target) return
  showNotifs.value = false
  router.push(target)
}

async function confirmMarkAllRead() {
  const count = notifStore.unreadCount
  if (!count) return

  const ok = await confirm({
    type: 'info',
    title: 'Mark all as read?',
    message: `This will clear ${count} unread notification${count === 1 ? '' : 's'} from your badge.`,
    confirmLabel: 'Yes, Mark All Read',
    cancelLabel: 'Cancel'
  })

  if (!ok) return
  try {
    await notifStore.markAllRead()
  } catch {
    // Keep browser messages generic; detailed errors stay server-side.
  }
}

watch(
  () => authStore.profile,
  (profile) => {
    if (profile?.mustChangePassword === true) {
      showPwPrompt.value = true
    }
  },
  { immediate: true }
)

function onPasswordChanged() {
  showPwPrompt.value = false
}

function handleLogout() {
  showLogoutConfirm.value = true
}

async function confirmLogout() {
  await authStore.logout()
  showLogoutConfirm.value = false
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
  notifStore.fetchAll()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
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

  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
  position: fixed;
  inset: 0;
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
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
  border-radius: 50%;
  overflow: hidden;
  background: #ffffff;
}

.brand-seal {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.notif-hd-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notif-count {
  padding: 3px 8px;
  border-radius: 999px;
  background: #fee2e2;
  color: #dc2626;
  font-size: 10px;
  font-weight: 800;
}

.notif-mark-all {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 10px;
  font-weight: 600;
  color: var(--blue);
  padding: 0;
 
}
.notif-mark-all:hover { text-decoration: underline; }

.notif-empty {
  padding: 20px 13px;
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
}

.notif-row {
  display: flex;
  gap: 9px;
  padding: 10px 13px;
  border-bottom: 1px solid #eef2f7;
  cursor: default;
  transition: background .12s;
}

.notif-row.notif-unread {
  background: #f8faff;
  cursor: pointer;
}
.notif-row.notif-actionable {
  cursor: pointer;
}
.notif-row.notif-unread:hover,
.notif-row.notif-actionable:hover { background: #eef4ff; }

.notif-icon-wrap {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
}

.notif-body { min-width: 0; }

.notif-msg {
  color: var(--text);
  font-size: 12px;
  line-height: 1.4;
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
