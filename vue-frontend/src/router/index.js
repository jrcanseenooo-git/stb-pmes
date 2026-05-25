import { createRouter, createWebHistory } from "vue-router";

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
    ],
  },
  { path: "/", redirect: "/dashboard" },
  {
    path: "/",
    component: AppLayout,
    children: [
      {
        path: "dashboard",
        component: () => import("@/views/DashboardView.vue"),
      },
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

export default router;
