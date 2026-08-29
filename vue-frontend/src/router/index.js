import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const AppLayout = () => import("@/layouts/AppLayout.vue");
const AuthLayout = () => import("@/layouts/AuthLayout.vue");

const routes = [
  {
    path: "/auth",
    component: AuthLayout,
    children: [
      {
        path: "login",
        name: "Login",
        component: () => import("@/views/LoginView.vue"),
      },
      {
        path: "register",
        name: "Register",
        component: () => import("@/views/RegisterView.vue"),
        meta: { requiresFirebaseUser: true },
      },
      {
        path: "pending",
        name: "Pending",
        component: () => import("@/views/PendingView.vue"),
        meta: { requiresFirebaseUser: true },
      },
    ],
  },
  { path: "/", redirect: "/dashboard" },
  {
    path: "/",
    component: AppLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: "dashboard",
        component: () => import("@/views/DashboardView.vue"),
      },
      // Innovation Cluster Personnel Assessment Portal - the restricted
      // assessment-only experience. Data is office-scoped in the backend; these
      // routes carry no office identifier of their own.
      {
        path: "my-dashboard",
        component: () => import("@/views/PortalDashboardView.vue"),
      },
      { path: "my-tasks", redirect: "/evaluation" },
      { path: "my-results", redirect: "/evaluation" },
      {
        path: "library",
        component: () => import("@/views/AssessmentLibraryView.vue"),
      },
      {
        path: "my-notifications",
        component: () => import("@/views/MyNotificationsView.vue"),
      },
      {
        path: "my-profile",
        component: () => import("@/views/MyProfileView.vue"),
      },
      {
        path: "help",
        component: () => import("@/views/HelpGuideView.vue"),
      },
      { path: "ipcrf", component: () => import("@/views/IpcrfView.vue") },
      { path: "review", component: () => import("@/views/ReviewView.vue") },
      { path: "kra", component: () => import("@/views/KraView.vue") },
      {
        path: "accomplishments",
        component: () => import("@/views/AccomplishmentsView.vue"),
      },
      { path: "reports", component: () => import("@/views/ReportsView.vue") },
      {
        path: "evaluation",
        component: () => import("@/views/EvaluationView.vue"),
      },
      { path: "unauthorized", component: () => import("@/views/UnauthorizedView.vue") },
      {
        path: "audit",
        component: () => import("@/views/AuditView.vue"),
        meta: { systemAdminOnly: true },
      },
      {
        path: "users",
        component: () => import("@/views/UsersView.vue"),
        meta: { anyPermission: ['manage_users', 'manage_office_users'] },
      },
      {
        path: "office-registry",
        component: () => import("@/views/OfficeRegistryView.vue"),
        meta: { anyPermission: ['manage_office_registry', 'provision_office_spreadsheets', 'validate_office_spreadsheets', 'view_cluster_monitoring', 'manage_office_users'] },
      },
      {
        path: "office-management",
        component: () => import("@/views/OfficeManagementView.vue"),
        meta: { officeManagementAllowed: true },
      },
      {
        path: "office-personnel",
        redirect: "/users",
      },
      {
        path: "office-dashboard",
        component: () => import("@/views/OfficeDashboardView.vue"),
        meta: { officeDashboardAllowed: true },
      },
      {
        path: "rater-matrix",
        component: () => import("@/views/RaterMatrixView.vue"),
        meta: { raterMatrixAllowed: true },
      },
      {
        path: "cluster-overview",
        component: () => import("@/views/ClusterOverviewView.vue"),
        meta: { anyPermission: ['view_cluster_monitoring', 'manage_office_registry'] },
      },
      { path: "profile", component: () => import("@/views/ProfileView.vue") },
    ],
  },
  {
    path: "/:pathMatch(.*)*",
    component: () => import("@/views/NotFoundView.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const EVALUATION_ROLLOUT_ALLOWED_PATHS = new Set([
  '/my-dashboard',
  '/my-notifications', '/my-profile', '/help',
  '/evaluation', '/profile', '/office-management', '/office-dashboard',
  '/rater-matrix', '/cluster-overview', '/office-registry',
  '/users', '/reports', '/unauthorized'
])

const STB_ONLY_PATHS = new Set(['/ipcrf', '/review', '/kra', '/accomplishments'])

// Restricted-scope users land on the Simplified Dashboard rather than being
// dropped straight into the rating form with no orientation.
const RESTRICTED_SCOPE_HOME = '/my-dashboard'

// Ordinary participating-office personnel get read-only Personal Information
// instead of the full Profile & Settings screen. Office administrators keep the
// full screen because they still need account controls such as password change.
// This is a route-level block, not a hidden menu item; the backend validates the
// underlying profile-write routes independently.
function isOrdinaryPortalUser(profile) {
  if (!profile) return false
  const scope = profile.systemScope || 'STB_FULL'
  if (scope === 'OFFICE_ADMIN' || scope === 'CLUSTER_ADMIN') return false
  if (profile.officeRole === 'OFFICE_ADMIN') return false
  if (canViewOfficeScope(profile)) return false
  return !hasFullSystemAccess(profile)
}

function isEvaluationOnlyRollout(profile) {
  if (profile?.systemAccessMode) return profile.systemAccessMode !== 'full_access'
  return import.meta.env.VITE_EVALUATION_ONLY_ROLLOUT !== 'false'
}

function hasFullSystemAccess(profile) {
  return !isEvaluationOnlyRollout(profile)
}

function canUseStbOnlyPaths(profile) {
  return (profile?.systemScope || 'STB_FULL') === 'STB_FULL' && hasFullSystemAccess(profile)
}

function isStbSystemAdmin(profile) {
  if (profile?.role !== 'System Administrator') return false
  if ((profile?.systemScope || 'STB_FULL') !== 'STB_FULL') return false
  const officeKey = String(profile?.officeId || profile?.officeCode || profile?.officeName || 'STB').trim().toUpperCase()
  return !officeKey || officeKey === 'STB' || officeKey === 'SOCIAL TECHNOLOGY BUREAU'
}

function canViewAssessmentLibrary(profile) {
  return isStbSystemAdmin(profile) && (profile?.permissions || []).includes('manage_assessment_content')
}

function isExplicitOfficeAdmin(profile) {
  const permissions = profile?.permissions || []
  const groups = profile?.permissionGroups || []
  return profile?.officeRole === 'OFFICE_ADMIN' ||
    permissions.includes('manage_office_users') ||
    groups.includes('office-assessment-admin')
}

function canViewOfficeScope(profile) {
  const permissions = profile?.permissions || []
  return isExplicitOfficeAdmin(profile) ||
    profile?.role === 'Division Chief' ||
    profile?.role === 'Section Head' ||
    permissions.includes('view_division_monitoring') ||
    permissions.includes('view_bureau_monitoring') ||
    permissions.includes('manage_cluster_office_admins') ||
    permissions.includes('manage_office_registry')
}

function canManageOfficePersonnel(profile) {
  const permissions = profile?.permissions || []
  return isExplicitOfficeAdmin(profile) ||
    permissions.includes('manage_cluster_office_admins') ||
    permissions.includes('manage_office_registry')
}

// Keep this in lock-step with RaterMatrixService.requireManage_. An Office
// Admin Portal account or delegated rater-tagging focal is allowed to manage
// only the assigned office's rater configuration.
function canManageRaterMatrix(profile) {
  const permissions = profile?.permissions || []
  return isExplicitOfficeAdmin(profile) ||
    permissions.includes('generate_ipat_assignments') ||
    permissions.includes('manage_office_rater_matrix') ||
    permissions.includes('manage_office_registry')
}

function canViewCentralRegistry(profile) {
  const permissions = profile?.permissions || []
  return permissions.includes('manage_office_registry') ||
    permissions.includes('provision_office_spreadsheets') ||
    permissions.includes('validate_office_spreadsheets') ||
    permissions.includes('view_cluster_monitoring')
}

function preferredDashboardPath(profile) {
  // ONLY the Undersecretary lands on the cluster view. This was keyed off the
  // `view_cluster_monitoring` permission, which also caught the System
  // Administrator - that account is granted cluster groups per-user so it can
  // reach Cluster Overview and Office Registry at all, but its home is still
  // the STB dashboard. The role is the thing that actually distinguishes
  // cluster oversight from an administrator who merely has access to it.
  //
  // Checked before scope because the Undersecretary sits in an office of their
  // own (OUSI); that office is where their record lives, not the boundary of
  // what they monitor.
  if (profile?.role === 'Undersecretary') return '/cluster-overview'
  const scope = profile?.systemScope || 'STB_FULL'
  if (canUseStbOnlyPaths(profile)) return '/dashboard'
  return canViewOfficeScope(profile) ? '/office-dashboard' : RESTRICTED_SCOPE_HOME
}

// ── Auth guard ──
router.beforeEach(async (to) => {
  // Strip open-redirect payloads from the ?redirect query param
  const r = to.query.redirect
  if (r && !/^\/(?!\/)/.test(r)) {
    const q = { ...to.query }
    delete q.redirect
    return { path: to.path, query: q }
  }

  const auth = useAuthStore();

  // Onboarding pages: require a signed-in Firebase user, and keep users on the
  // page that matches their state (unregistered → register, pending → pending).
  if (to.meta.requiresFirebaseUser) {
    if (!auth.initialised) await auth.init();
    if (!auth.isAuthenticated) return { path: "/auth/login" };
    if (to.name === "Register") await auth.fetchProfile();
    if (to.name === "Register" && !auth.needsRegistration) {
      return auth.needsActivation ? { path: "/auth/pending" } : { path: preferredDashboardPath(auth.profile) };
    }
    if (to.name === "Pending" && !auth.needsActivation) {
      return auth.needsRegistration ? { path: "/auth/register" } : { path: preferredDashboardPath(auth.profile) };
    }
    return true;
  }

  if (!to.meta.requiresAuth) return true;
  if (!auth.initialised) await auth.init();
  if (!auth.isAuthenticated) return { path: "/auth/login" };
  // Do not evaluate route permissions while the signed-in user's PMES profile
  // is still unavailable because of a transient backend failure. Previously a
  // null profile fell through to every capability check and rendered a false
  // 403 page with "Profile not loaded" in the sidebar.
  if (!auth.profile && !auth.profileResolved && !auth.needsRegistration && !auth.needsActivation) {
    if (to.path === '/unauthorized' && to.query.reason === 'profile-unavailable') return true;
    return { path: '/unauthorized', query: { reason: 'profile-unavailable' } };
  }
  // Signed in but not yet provisioned / approved in PMES
  if (auth.needsRegistration) return { path: "/auth/register" };
  if (auth.needsActivation)   return { path: "/auth/pending" };
  if (to.path === '/office-registry' && !canViewCentralRegistry(auth.profile)) {
    return { path: '/office-management', query: { ...to.query, tab: 'structure' } }
  }
  if (!canUseStbOnlyPaths(auth.profile) && STB_ONLY_PATHS.has(to.path)) {
    return { path: preferredDashboardPath(auth.profile) }
  }
  if (to.path === '/library' && !canViewAssessmentLibrary(auth.profile)) {
    return { path: preferredDashboardPath(auth.profile) }
  }
  if (to.path === '/dashboard') {
    const preferred = preferredDashboardPath(auth.profile)
    if (preferred !== '/dashboard') return { path: preferred }
  }
  if (Array.isArray(to.meta.anyPermission) && to.meta.anyPermission.length) {
    const permissions = auth.profile?.permissions || []
    if (!to.meta.anyPermission.some(permission => permissions.includes(permission))) {
      return { path: "/unauthorized" };
    }
  }
  if (to.meta.systemAdminOnly && !isStbSystemAdmin(auth.profile)) {
    return { path: "/unauthorized" };
  }
  if (to.meta.officeManagementAllowed || to.meta.officePersonnelAllowed) {
    if (!canManageOfficePersonnel(auth.profile)) return { path: "/unauthorized" };
  }
  if (to.meta.officeDashboardAllowed) {
    if (!canViewOfficeScope(auth.profile)) return { path: "/unauthorized" };
  }
  if (to.meta.raterMatrixAllowed && !canManageRaterMatrix(auth.profile)) {
    return { path: "/unauthorized" };
  }
  // Ordinary portal personnel are sent to the read-only equivalent rather than
  // the editable Profile & Settings screen.
  if (to.path === '/profile' && isOrdinaryPortalUser(auth.profile)) {
    return { path: '/my-profile' };
  }
  if (
    isEvaluationOnlyRollout(auth.profile) &&
    !hasFullSystemAccess(auth.profile) &&
    !EVALUATION_ROLLOUT_ALLOWED_PATHS.has(to.path)
  ) {
    return { path: RESTRICTED_SCOPE_HOME };
  }
  return true;
});

// A successful navigation means the current build's chunks are loadable
// again, so a later one-off chunk failure gets its own retry instead of
// silently no-oping because an earlier failure already spent the guard.
router.afterEach(() => {
  sessionStorage.removeItem("pmes:chunk-reload-attempted");
});

// Every route/layout is its own lazy chunk with a hash tied to the build. A
// tab left open across a deploy - or a refresh that lands mid-deploy - asks
// for a chunk hash the CDN no longer has once a newer build replaces it. Vite
// rejects that dynamic import instead of throwing a catchable render error,
// so nothing appears: no console output (prod silences it), no fallback UI,
// just a permanently blank page. The only real fix is a fresh load of the
// current build; the sessionStorage guard stops a genuinely broken deploy
// from reloading forever.
router.onError((error, to) => {
  const message = String(error?.message || "");
  const isChunkLoadFailure =
    /dynamically imported module/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    error?.name === "ChunkLoadError";
  if (!isChunkLoadFailure) return;

  const key = "pmes:chunk-reload-attempted";
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  window.location.href = to?.fullPath || window.location.href;
});

export default router;
