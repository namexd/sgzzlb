import { createRouter, createWebHashHistory } from "vue-router";
import { isLoggedIn } from "../api";

const routes = [
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/Login.vue"),
    meta: { public: true }
  },
  {
    path: "/",
    component: () => import("../views/Layout.vue"),
    redirect: "/dashboard",
    children: [
      {
        path: "dashboard",
        name: "Dashboard",
        component: () => import("../views/Dashboard.vue"),
        meta: { title: "仪表盘", icon: "DataBoard" }
      },
      {
        path: "feedback",
        name: "Feedback",
        component: () => import("../views/Feedback.vue"),
        meta: { title: "意见反馈", icon: "ChatDotRound" }
      },
      {
        path: "lineups",
        name: "Lineups",
        component: () => import("../views/Lineups.vue"),
        meta: { title: "阵容管理", icon: "Trophy" }
      },
      {
        path: "catalog",
        name: "Catalog",
        component: () => import("../views/Catalog.vue"),
        meta: { title: "资料数据", icon: "Document" }
      },
      {
        path: "rules",
        name: "Rules",
        component: () => import("../views/Rules.vue"),
        meta: { title: "评分规则", icon: "Setting" }
      },
      {
        path: "audit",
        name: "Audit",
        component: () => import("../views/Audit.vue"),
        meta: { title: "审计日志", icon: "Notebook" }
      }
    ]
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  if (to.meta.public) {
    next();
  } else if (!isLoggedIn()) {
    next("/login");
  } else {
    next();
  }
});

export default router;
