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
      { path: "audit", component: () => import("@/views/AuditView.vue") },
      { path: "users", component: () => import("@/views/UsersView.vue") },
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
  return true;
});

export default router;
