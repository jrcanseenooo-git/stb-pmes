import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const AppLayout  = () => import("@/layouts/AppLayout.vue");
const AuthLayout = () => import("@/layouts/AuthLayout.vue");

const routes = [
  {
    path: "/auth",
    component: AuthLayout,
    children: [
      { path: "login", name: "Login", component: () => import("@/views/LoginView.vue") }
    ]
  },
  { path: "/", redirect: "/dashboard" },
  {
    path: "/",
    component: AppLayout,
    meta: { requiresAuth: true },
    children: [
      { path: "dashboard",       component: () => import("@/views/DashboardView.vue")      },
      { path: "ipcrf",           component: () => import("@/views/IpcrfView.vue")          },
      { path: "kra",             component: () => import("@/views/KraView.vue")            },
      { path: "accomplishments", component: () => import("@/views/AccomplishmentsView.vue") },
      { path: "mov",             component: () => import("@/views/MovView.vue")            },
      { path: "reports",         component: () => import("@/views/ReportsView.vue")        },
      { path: "evaluation",      component: () => import("@/views/EvaluationView.vue")     },
      { path: "audit",           component: () => import("@/views/AuditView.vue")          },
      { path: "users",           component: () => import("@/views/UsersView.vue")          },
      { path: "profile",         component: () => import("@/views/ProfileView.vue")        },
    ]
  },
  { path: "/:pathMatch(.*)*", component: () => import("@/views/NotFoundView.vue") }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// ── Auth guard ──
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true
  const auth = useAuthStore()
  if (!auth.initialised) await auth.init()
  if (!auth.isAuthenticated) return { path: "/auth/login" }
  return true
})

export default router;