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
      { path: "ipcrf", component: () => import("@/views/IpcrfView.vue") },
      { path: "review", component: () => import("@/views/ReviewView.vue") },
      { path: "kra", component: () => import("@/views/KraView.vue") },
      {
        path: "accomplishments",
        component: () => import("@/views/AccomplishmentsView.vue"),
      },
      { path: "mov", component: () => import("@/views/MovView.vue") },
      { path: "reports", component: () => import("@/views/ReportsView.vue") },
      {
        path: "evaluation",
        component: () => import("@/views/EvaluationView.vue"),
      },
      { path: "unauthorized", component: () => import("@/views/UnauthorizedView.vue") },
      { path: "audit", component: () => import("@/views/AuditView.vue") },
      {
        path: "users",
        component: () => import("@/views/UsersView.vue"),
        meta: { anyPermission: ['manage_users', 'manage_office_users'] },
      },
      {
        path: "office-registry",
        component: () => import("@/views/OfficeRegistryView.vue"),
        meta: { anyPermission: ['manage_office_registry', 'provision_office_spreadsheets', 'validate_office_spreadsheets', 'view_cluster_monitoring'] },
      },
      {
        path: "office-personnel",
        component: () => import("@/views/OfficePersonnelView.vue"),
        meta: { officeAdminAllowed: true },
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

const EVALUATION_ROLLOUT_ALLOWED_PATHS = new Set(['/evaluation', '/profile', '/office-personnel', '/users', '/reports', '/unauthorized'])

function isEvaluationOnlyRollout(profile) {
  if (profile?.systemAccessMode) return profile.systemAccessMode !== 'full_access'
  return import.meta.env.VITE_EVALUATION_ONLY_ROLLOUT !== 'false'
}

function hasFullSystemAccess(profile) {
  const permissions = profile?.permissions || []
  const groups = profile?.permissionGroups || []
  return !isEvaluationOnlyRollout(profile) ||
    profile?.role === 'System Administrator' ||
    permissions.includes('manage_users') ||
    permissions.includes('manage_focal_assignments') ||
    permissions.includes('manage_database') ||
    permissions.includes('manage_libraries') ||
    permissions.includes('manage_assessment_content') ||
    permissions.includes('manage_office_registry') ||
    permissions.includes('provision_office_spreadsheets') ||
    permissions.includes('validate_office_spreadsheets') ||
    permissions.includes('view_cluster_monitoring') ||
    permissions.includes('view_bureau_monitoring') ||
    permissions.includes('view_audit') ||
    groups.includes('system-admin') ||
    groups.includes('user-manager') ||
    groups.includes('library-manager') ||
    groups.includes('database-manager')
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
      return auth.needsActivation ? { path: "/auth/pending" } : { path: "/dashboard" };
    }
    if (to.name === "Pending" && !auth.needsActivation) {
      return auth.needsRegistration ? { path: "/auth/register" } : { path: "/dashboard" };
    }
    return true;
  }

  if (!to.meta.requiresAuth) return true;
  if (!auth.initialised) await auth.init();
  if (!auth.isAuthenticated) return { path: "/auth/login" };
  // Signed in but not yet provisioned / approved in PMES
  if (auth.needsRegistration) return { path: "/auth/register" };
  if (auth.needsActivation)   return { path: "/auth/pending" };
  if (Array.isArray(to.meta.anyPermission) && to.meta.anyPermission.length) {
    const permissions = auth.profile?.permissions || []
    if (!to.meta.anyPermission.some(permission => permissions.includes(permission))) {
      return { path: "/unauthorized" };
    }
  }
  if (to.meta.officeAdminAllowed) {
    const permissions = auth.profile?.permissions || []
    const isOfficeAdmin = auth.profile?.systemScope === 'OFFICE_ADMIN' ||
      auth.profile?.officeRole === 'OFFICE_ADMIN' ||
      permissions.includes('manage_cluster_office_admins') ||
      permissions.includes('manage_office_registry')
    if (!isOfficeAdmin) return { path: "/unauthorized" };
  }
  if (
    isEvaluationOnlyRollout(auth.profile) &&
    !hasFullSystemAccess(auth.profile) &&
    !EVALUATION_ROLLOUT_ALLOWED_PATHS.has(to.path)
  ) {
    return { path: "/evaluation" };
  }
  return true;
});

export default router;
