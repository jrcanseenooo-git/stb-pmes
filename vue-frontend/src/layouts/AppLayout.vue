<template>
  <div class="shell" :class="{ 'sidebar-collapsed': collapsed }">
    <aside class="sidebar">
      <!--
        Text-only wordmark — no seal/icon. The system runs cluster-wide now, not
        just for STB, so a fixed STB seal image no longer represents every
        participating office; a text mark scales to any office without needing
        per-office artwork.
      -->
      <div class="sb-brand">
        <transition name="fade" mode="out-in">
          <div v-if="!collapsed" key="full" class="brand-text">
            <div class="brand-name">{{ wordmarkTop }}</div>
            <div class="brand-sub">{{ wordmarkBottom }}</div>
            <div class="brand-office" :title="portalSubtitle">{{ portalSubtitle }}</div>
          </div>
          <div v-else key="mark" class="brand-mark" :title="portalTitle">{{ shortName }}</div>
        </transition>
      </div>

      <nav class="sb-nav">
        <div class="nav-group">
          <div v-if="!collapsed" class="nav-label">{{ canAccessFullSystem ? 'Overview' : 'Main' }}</div>

          <RouterLink v-if="canAccessFullSystem" to="/dashboard" class="nav-item" active-class="active" :title="collapsed ? 'Dashboard' : ''">
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

          <RouterLink v-if="showPortalNav" to="/my-dashboard" class="nav-item" active-class="active" :title="collapsed ? 'Dashboard' : ''">
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

          <RouterLink v-if="showPortalNav" to="/my-tasks" class="nav-item" active-class="active" :title="collapsed ? 'My Rating Tasks' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2.5" y="1.5" width="11" height="13" rx="2" stroke="currentColor" stroke-width="1.4" />
                <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">My Rating Tasks</span>
            </transition>
          </RouterLink>

          <RouterLink v-if="showPortalNav" to="/my-results" class="nav-item" active-class="active" :title="collapsed ? 'My Results' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 13.5V9M6 13.5V4M10 13.5V6.5M14 13.5V2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">My Results</span>
            </transition>
          </RouterLink>

          <RouterLink v-if="showPortalNav" to="/library" class="nav-item" active-class="active" :title="collapsed ? 'Assessment Library' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2.5 3a1 1 0 011-1H7v12H3.5a1 1 0 01-1-1V3zM13.5 3a1 1 0 00-1-1H9v12h3.5a1 1 0 001-1V3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">Assessment Library</span>
            </transition>
          </RouterLink>

          <RouterLink v-if="canManageLibraries" to="/kra" class="nav-item" active-class="active" :title="collapsed ? 'KRA Library' : ''">
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

        <div v-if="canAccessFullSystem" class="nav-group">
          <div v-if="!collapsed" class="nav-label">Monitoring</div>
          <div v-else class="nav-divider"></div>

          <RouterLink v-if="canAccessFullSystem" to="/ipcrf" class="nav-item" active-class="active" :title="collapsed ? 'KRA & Targets' : ''">
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

          <RouterLink v-if="canAccessFullSystem" to="/accomplishments" class="nav-item" active-class="active" :title="collapsed ? 'Accomplishments' : ''">
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

          <RouterLink v-if="canAccessFullSystem" to="/review" class="nav-item" active-class="active" :title="collapsed ? 'Review' : ''">
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
          <div v-if="!collapsed" class="nav-label">{{ canAccessFullSystem ? 'Administration' : 'Account' }}</div>
          <div v-else class="nav-divider"></div>

          <RouterLink v-if="canGenerateReports" to="/reports" class="nav-item" active-class="active" :title="collapsed ? 'Reports' : ''">
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

          <RouterLink v-if="canViewAudit" to="/audit" class="nav-item" active-class="active" :title="collapsed ? 'Audit Trail' : ''">
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

          <RouterLink v-if="canAccessUserManagement" to="/users" class="nav-item" active-class="active" :title="collapsed ? 'User Management' : ''">
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

          <RouterLink v-if="isOfficeAdminScope" to="/office-dashboard" class="nav-item" active-class="active" :title="collapsed ? 'Office Dashboard' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 13.5V9M6 13.5V4M10 13.5V6.5M14 13.5V2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">Office Dashboard</span>
            </transition>
          </RouterLink>

          <RouterLink v-if="canViewClusterMonitoring || canManageOfficeRegistry" to="/cluster-overview" class="nav-item" active-class="active" :title="collapsed ? 'Cluster Overview' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4" />
                <path d="M1.5 8h13M8 1.5c1.7 1.8 2.6 4 2.6 6.5S9.7 12.7 8 14.5C6.3 12.7 5.4 10.5 5.4 8S6.3 3.3 8 1.5z" stroke="currentColor" stroke-width="1.3" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">Cluster Overview</span>
            </transition>
          </RouterLink>

          <RouterLink v-if="canManageOfficeRegistry || canViewClusterMonitoring" to="/office-registry" class="nav-item" active-class="active" :title="collapsed ? 'Office Registry' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2.5 13.5h11M3.5 13.5V3.5h5v10M8.5 6.5h4v7M5.2 6h1.6M5.2 8.5h1.6M10.2 9h1.2M10.2 11h1.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">Office Registry</span>
            </transition>
          </RouterLink>

          <RouterLink v-if="isOfficeAdminScope" to="/office-personnel" class="nav-item" active-class="active" :title="collapsed ? 'Office Personnel' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="5.5" cy="5" r="2.5" stroke="currentColor" stroke-width="1.4"/>
                <circle cx="11.5" cy="6" r="1.8" stroke="currentColor" stroke-width="1.3"/>
                <path d="M1.8 14c.4-2.8 2.2-4.4 3.7-4.4s3.3 1.6 3.7 4.4M9.5 13.8c.25-1.7 1.25-2.7 2-2.7s1.75 1 2 2.7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">Office Personnel</span>
            </transition>
          </RouterLink>

          <RouterLink v-if="showPortalNav" to="/my-notifications" class="nav-item" active-class="active" :title="collapsed ? 'Assessment Status' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5a4.5 4.5 0 014.5 4.5v3l1.5 2.5H2L3.5 9V6A4.5 4.5 0 018 1.5zM6.5 12.5a1.5 1.5 0 003 0"
                  stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">
                Assessment Status
                <span v-if="notifStore.unreadCount > 0" class="nav-badge">{{ notifStore.unreadCount }}</span>
              </span>
            </transition>
            <span v-if="collapsed && notifStore.unreadCount > 0" class="nav-badge-dot"></span>
          </RouterLink>

          <RouterLink v-if="showPortalNav" to="/help" class="nav-item" active-class="active" :title="collapsed ? 'Rating Guide' : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4" />
                <path d="M6.2 6.1a1.85 1.85 0 013.6.6c0 1.2-1.8 1.5-1.8 2.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                <circle cx="8" cy="11.6" r=".8" fill="currentColor" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">Rating Guide</span>
            </transition>
          </RouterLink>

          <RouterLink :to="personalInfoPath" class="nav-item" active-class="active" :title="collapsed ? personalInfoLabel : ''">
            <div class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"
                  stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
              </svg>
            </div>
            <transition name="fade">
              <span v-if="!collapsed" class="nav-label-text">{{ personalInfoLabel }}</span>
            </transition>
          </RouterLink>
        </div>
      </nav>

      <div class="sb-footer">
        <div class="sb-user" :class="{ centered: collapsed }" @click="$router.push(personalInfoPath)">
          <div class="user-av">{{ authStore.initials || 'U' }}</div>

          <transition name="fade">
            <div v-if="!collapsed" class="user-meta">
              <div class="user-name">{{ authStore.fullName || 'User' }}</div>
              <div class="user-role">{{ authStore.role || 'Profile not loaded' }}</div>
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
          <div class="search-wrap">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke="#94A3B8" stroke-width="1.3" />
              <path d="M9 9l2.5 2.5" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round" />
            </svg>
            <input v-model="search" type="text" placeholder="Search..." />
          </div>

          <div class="sem-pill">
            <span class="live-dot"></span>
            {{ currentSemester }}
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

          <!-- Export hidden until Reports module is implemented -->
          <!--<button class="export-btn" @click="handleExport">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v7M4 6l2.5 2.5L9 6M2 10v1a1 1 0 001 1h7a1 1 0 001-1v-1"
                stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Export
          </button>-->

          <div class="topbar-avatar" @click="$router.push(personalInfoPath)" :title="authStore.fullName">
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
import { useBranding } from '@/composables/useBranding'
import { useNotificationsStore } from '@/stores/notifications'
import { useConfirm } from '@/composables/useConfirm'
import PasswordChangePrompt from '@/components/common/PasswordChangePrompt.vue'
import LogoutConfirmModal from '@/components/common/LogoutConfirmModal.vue'

const authStore = useAuthStore()
const { canManageUsers, canManageOfficeUsers, canManageLibraries, canManageFocalAssignments, canManageDatabase, canManageOfficeRegistry, canViewClusterMonitoring, canManageOfficePersonnel, canViewAudit, canGenerateReports, canAccessFullSystem, isOfficeAdminScope, isClusterPortalScope } = usePermissions()
const { isClusterPortal, portalTitle, portalSubtitle, wordmarkTop, wordmarkBottom, shortName, documentTitle } = useBranding()
const notifStore = useNotificationsStore()
const { confirm } = useConfirm()

// Unread notifications tied to the Accomplishments module — drives the sidebar nav badge
const accomplishmentsUnread = computed(() =>
  notifStore.notifications.filter(n => !n.read && n.module === 'Accomplishments').length
)
// The portal entries replace the STB Dashboard for anyone the rollout guard
// keeps out of the full system — that is exactly the restricted cluster scope.
const showPortalNav = computed(() => !canAccessFullSystem.value)

// Ordinary portal personnel get read-only Personal Information. Office
// administrators and STB users keep the editable Profile & Settings screen,
// because they still need account controls such as changing a password.
const isOrdinaryPortalUser = computed(() =>
  showPortalNav.value && !isOfficeAdminScope.value && isClusterPortalScope.value
)
const personalInfoPath = computed(() => (isOrdinaryPortalUser.value ? '/my-profile' : '/profile'))
const personalInfoLabel = computed(() => (isOrdinaryPortalUser.value ? 'Personal Information' : 'Profile Settings'))

const canAccessUserManagement = computed(() =>
  canManageUsers.value ||
  canManageOfficeUsers.value ||
  canManageFocalAssignments.value ||
  canManageDatabase.value
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
let notificationTimer = null
let lastProfileRefreshAt = 0

const titleMap = {
  '/dashboard': { title: 'Dashboard', sub: 'Bureau Overview' },
  '/my-dashboard': { title: 'Dashboard', sub: 'Assessment Overview' },
  '/my-tasks': { title: 'My Rating Tasks', sub: 'Assigned Assessments' },
  '/my-results': { title: 'My Results', sub: 'Consolidated Assessment Results' },
  '/library': { title: 'Assessment Library', sub: 'Official Assessment Content' },
  '/my-notifications': { title: 'Assessment Status', sub: 'Updates' },
  '/my-profile': { title: 'Personal Information', sub: '' },
  '/help': { title: 'Rating Guide', sub: 'Help' },
  '/ipcrf': { title: 'IPCRF / CCEF Forms', sub: 'Performance Commitments' },
  '/review': { title: 'Review', sub: 'Assigned IPCRF / CCEF Forms' },
  '/kra': { title: 'KRA Library', sub: 'Master KRA & SI List' },
  '/accomplishments': { title: 'Accomplishments', sub: 'Q1 2025' },
  '/reports': { title: 'Reports', sub: 'Generate & Export' },
  '/evaluation': { title: 'Evaluation Ratings', sub: 'Innovations Performance Assessment Tool' },
  '/audit': { title: 'Audit Trail', sub: 'Activity Log' },
  '/users': { title: 'User Management', sub: 'Access Control' },
  '/office-registry': { title: 'Office Registry', sub: 'Central Administration' },
  '/office-personnel': { title: 'Personnel Validation', sub: 'Office Assessment Roster' },
  '/office-dashboard': { title: 'Office Assessment Dashboard', sub: 'Office Monitoring' },
  '/cluster-overview': { title: 'Cluster Assessment Overview', sub: 'Central Monitoring' },
  '/profile': { title: 'Profile & Settings', sub: '' }
}

// Cluster portal users see assessment-neutral wording. The STB labels name
// STB-only instruments (IPCRF/CCEF, KRA) that the cluster scope never reaches.
const CLUSTER_TITLE_OVERRIDES = {
  '/evaluation': { title: 'Evaluation Rating', sub: 'Assessment Form' },
  '/reports': { title: 'Reports', sub: 'Office Assessment Reports' },
  '/users': { title: 'Personnel Validation', sub: 'Office Accounts' },
  '/profile': { title: 'Personal Information', sub: '' }
}

const activeTitle = computed(() => {
  if (isClusterPortal.value && CLUSTER_TITLE_OVERRIDES[route.path]) return CLUSTER_TITLE_OVERRIDES[route.path]
  return titleMap[route.path] ?? null
})

const pageTitle = computed(() => activeTitle.value?.title ?? shortName.value)
const pageSub = computed(() => activeTitle.value?.sub ?? '')

watch([pageTitle, portalSubtitle], () => {
  document.title = documentTitle(pageTitle.value)
}, { immediate: true })

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
  router.push('/reports')
}

function checkMobile() {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value) collapsed.value = true
}

async function refreshRealtimeShell(options = {}) {
  if (!authStore.hasAccess) return
  const forceProfile = options.forceProfile === true
  const now = Date.now()
  try {
    if (forceProfile || now - lastProfileRefreshAt > 60000) {
      await authStore.fetchProfile()
      lastProfileRefreshAt = now
    }
    await notifStore.fetchAll({ silent: true })
  } catch {
    // Background refresh should never interrupt the user.
  }
}

function handleVisibilityChange() {
  if (!document.hidden) refreshRealtimeShell({ forceProfile: true })
}

function handleWindowFocus() {
  refreshRealtimeShell({ forceProfile: true })
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
  window.addEventListener('focus', handleWindowFocus)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  refreshRealtimeShell({ forceProfile: true })
  notificationTimer = window.setInterval(refreshRealtimeShell, 30000)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('focus', handleWindowFocus)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (notificationTimer) window.clearInterval(notificationTimer)
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
  min-height: var(--topbar-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,.08);
}

.brand-text {
  min-width: 0;
  overflow: hidden;
}

.brand-name {
  color: #ffffff;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.2;
}

/* Collapsed-sidebar fallback: a short text initialism (PMES, or the office
   code) rather than an icon — still pure text, just compact enough for the
   narrow collapsed rail. */
.brand-mark {
  width: 100%;
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
  letter-spacing: .03em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Wraps rather than truncates — the cluster-scope text here is a full system
   name ("Performance Monitoring and Evaluation System"), not a short label. */
.brand-sub {
  margin-top: 3px;
  color: rgba(255,255,255,.48);
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: .5px;
  text-transform: uppercase;
  line-height: 1.35;
  white-space: normal;
}

/* Office name. Participating office names are long ("Information and
   Communications Technology Management Service"), so this wraps to two lines
   and then clamps rather than stretching the sidebar. */
.brand-office {
  margin-top: 6px;
  color: rgba(255,255,255,.72);
  font-size: 9.5px;
  font-weight: 700;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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

@media (min-width: 2200px) {
  .shell {
    --sidebar-w: 260px;
    --sidebar-collapsed-w: 72px;
    --topbar-h: 64px;
  }

  .sb-brand {
    padding: 14px 18px;
  }

  .brand-name {
    font-size: 16.5px;
  }

  .brand-sub {
    font-size: 9.5px;
  }

  .sb-nav {
    padding: 13px 11px;
  }

  .nav-item {
    min-height: 46px;
    padding: 11px 14px;
    border-radius: 14px;
  }

  .nav-label-text,
  .topbar-title {
    font-size: 16px;
  }

  .topbar {
    padding: 0 20px;
  }

  .topbar-sub,
  .topbar-sep {
    font-size: 12.5px;
  }

  .search-wrap {
    width: 230px;
    height: 36px;
  }

  .sem-pill,
  .icon-btn,
  .export-btn {
    min-height: 36px;
  }

  .page-body {
    padding: 22px 28px;
    background-size: 40px 40px;
  }

  .page-body :deep(.page-title),
  .page-body :deep(.page-heading),
  .page-body :deep(h1) {
    font-size: 23px;
    line-height: 1.2;
  }

  .page-body :deep(.page-sub),
  .page-body :deep(.page-subtitle),
  .page-body :deep(.subtitle) {
    font-size: 13.5px;
    line-height: 1.45;
  }

  .page-body :deep(.content-card),
  .page-body :deep(.card),
  .page-body :deep(.panel),
  .page-body :deep(.section-card) {
    border-radius: 16px;
  }

  .page-body :deep(.content-card) {
    padding: 20px 22px;
  }

  .page-body :deep(.card-hd),
  .page-body :deep(.card-header),
  .page-body :deep(.panel-header) {
    padding: 17px 20px;
  }

  .page-body :deep(.card-title),
  .page-body :deep(.panel-title) {
    font-size: 13.5px;
  }

  .page-body :deep(.card-subtitle),
  .page-body :deep(.panel-subtitle) {
    font-size: 13px;
  }

  .page-body :deep(.btn),
  .page-body :deep(button.btn),
  .page-body :deep(.filter-select),
  .page-body :deep(.form-input),
  .page-body :deep(.form-select),
  .page-body :deep(input),
  .page-body :deep(select),
  .page-body :deep(textarea) {
    font-size: 13.5px;
  }

  .page-body :deep(.btn) {
    min-height: 38px;
    padding: 8px 15px;
  }

  .page-body :deep(.btn-sm) {
    min-height: 32px;
    padding: 6px 12px;
  }

  .page-body :deep(.filter-select),
  .page-body :deep(.form-input),
  .page-body :deep(.form-select),
  .page-body :deep(input),
  .page-body :deep(select) {
    min-height: 40px;
  }

  .page-body :deep(textarea) {
    min-height: 96px;
  }

  .page-body :deep(.table-wrap),
  .page-body :deep(.table-container),
  .page-body :deep(.table-responsive) {
    border-radius: 16px;
  }

  .page-body :deep(.data-table),
  .page-body :deep(.tbl),
  .page-body :deep(.table-row),
  .page-body :deep(.table-cell) {
    font-size: 13.5px;
  }

  .page-body :deep(.data-table th),
  .page-body :deep(.tbl th),
  .page-body :deep(.table-hd) {
    font-size: 11.5px;
  }

  .page-body :deep(.data-table td),
  .page-body :deep(.data-table th),
  .page-body :deep(.tbl td),
  .page-body :deep(.tbl th) {
    padding-top: 12px;
    padding-bottom: 12px;
  }

  .page-body :deep(.modal) {
    border-radius: 18px;
  }

  .page-body :deep(.modal-title) {
    font-size: 17px;
  }

  .page-body :deep(.modal-sub),
  .page-body :deep(.modal-message) {
    font-size: 13.5px;
  }

  .page-body :deep(.modal-hd),
  .page-body :deep(.modal-body),
  .page-body :deep(.modal-footer) {
    padding-left: 28px;
    padding-right: 28px;
  }

  .page-body :deep(.empty-title),
  .page-body :deep(.rp-empty-title),
  .page-body :deep(.eval-rp-empty-title) {
    font-size: 16px;
  }

  .page-body :deep(.empty-sub),
  .page-body :deep(.rp-empty-sub),
  .page-body :deep(.eval-rp-empty-sub) {
    font-size: 13px;
  }
}

@media (min-width: 2800px) {
  .shell {
    --sidebar-w: 290px;
    --sidebar-collapsed-w: 78px;
    --topbar-h: 70px;
  }

  .page-body {
    padding: 30px 40px;
    background-size: 46px 46px;
  }

  .page-body :deep(> *) {
    max-width: 2440px;
    margin-left: auto;
    margin-right: auto;
  }

  .page-body :deep(.page-title),
  .page-body :deep(.page-heading),
  .page-body :deep(h1) {
    font-size: 26px;
  }

  .page-body :deep(.page-sub),
  .page-body :deep(.page-subtitle),
  .page-body :deep(.subtitle) {
    font-size: 15px;
  }

  .page-body :deep(.content-card) {
    padding: 26px 30px;
  }

  .page-body :deep(.card-title),
  .page-body :deep(.panel-title) {
    font-size: 15px;
  }

  .page-body :deep(.btn),
  .page-body :deep(button.btn),
  .page-body :deep(.filter-select),
  .page-body :deep(.form-input),
  .page-body :deep(.form-select),
  .page-body :deep(input),
  .page-body :deep(select),
  .page-body :deep(textarea),
  .page-body :deep(.data-table),
  .page-body :deep(.tbl),
  .page-body :deep(.table-row),
  .page-body :deep(.table-cell) {
    font-size: 15px;
  }

  .page-body :deep(.btn) {
    min-height: 42px;
    padding: 10px 18px;
  }

  .page-body :deep(.filter-select),
  .page-body :deep(.form-input),
  .page-body :deep(.form-select),
  .page-body :deep(input),
  .page-body :deep(select) {
    min-height: 44px;
  }

  .page-body :deep(.data-table th),
  .page-body :deep(.tbl th),
  .page-body :deep(.table-hd) {
    font-size: 12.5px;
  }

  .page-body :deep(.modal-title) {
    font-size: 19px;
  }

  .page-body :deep(.modal-sub),
  .page-body :deep(.modal-message) {
    font-size: 15px;
  }
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

  .page-body :deep(.page-title),
  .page-body :deep(.page-heading),
  .page-body :deep(h1) {
    font-size: 18px;
    line-height: 1.25;
  }

  .page-body :deep(.page-sub),
  .page-body :deep(.page-subtitle),
  .page-body :deep(.subtitle) {
    font-size: 12px;
    line-height: 1.4;
    white-space: normal;
  }

  .page-body :deep(.content-card),
  .page-body :deep(.card),
  .page-body :deep(.panel),
  .page-body :deep(.section-card) {
    border-radius: 14px;
  }

  .page-body :deep(.content-card) {
    padding: 12px;
  }

  .page-body :deep(.filter-bar),
  .page-body :deep(.top-actions),
  .page-body :deep(.page-actions) {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .page-body :deep(.btn),
  .page-body :deep(button.btn),
  .page-body :deep(.filter-select),
  .page-body :deep(.form-input),
  .page-body :deep(.form-select),
  .page-body :deep(input),
  .page-body :deep(select),
  .page-body :deep(textarea) {
    max-width: 100%;
    font-size: 13px;
  }

  .page-body :deep(.table-wrap),
  .page-body :deep(.table-container),
  .page-body :deep(.table-responsive) {
    border-radius: 12px;
  }

  .page-body :deep(.modal-overlay) {
    padding: 10px;
    align-items: flex-end;
  }

  .page-body :deep(.modal) {
    max-height: 94vh;
    border-radius: 16px;
  }

  .page-body :deep(.modal-hd),
  .page-body :deep(.modal-body),
  .page-body :deep(.modal-footer) {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
