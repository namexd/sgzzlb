<template>
  <el-container class="layout-container">
    <!-- Sidebar -->
    <el-aside :width="isCollapse ? '64px' : '220px'" class="aside">
      <div class="logo">
        <span v-if="!isCollapse">配将管理台</span>
        <span v-else>管</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        router
        class="sidebar-menu"
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- Main -->
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="isCollapse = !isCollapse">
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </el-icon>
          <span class="page-title">{{ currentTitle }}</span>
        </div>
        <div class="header-right">
          <span class="api-url">{{ apiUrl }}</span>
          <el-button type="danger" text @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { logout } from "../api";

const route = useRoute();
const router = useRouter();
const isCollapse = ref(false);
const apiUrl = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8787";

const menuItems = [
  { path: "/dashboard", title: "仪表盘", icon: "DataBoard" },
  { path: "/feedback", title: "意见反馈", icon: "ChatDotRound" },
  { path: "/lineups", title: "阵容管理", icon: "Trophy" },
  { path: "/catalog", title: "资料数据", icon: "Document" },
  { path: "/catalog-updates", title: "赛季资料", icon: "Collection" },
  { path: "/rules", title: "评分规则", icon: "Setting" },
  { path: "/audit", title: "审计日志", icon: "Notebook" }
];

const activeMenu = computed(() => route.path);
const currentTitle = computed(() => {
  const item = menuItems.find((m) => m.path === route.path);
  return item ? item.title : "";
});

const handleLogout = () => {
  logout();
  router.push("/login");
};
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.aside {
  background: var(--ink-mid);
  border-right: 1px solid var(--border-faint);
  transition: width 0.3s var(--ease);
  overflow: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border-faint);
}

.sidebar-menu {
  border-right: none !important;
}

.header {
  background: var(--ink-mid);
  border-bottom: 1px solid var(--border-faint);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  font-size: 20px;
  color: var(--text-fade);
  cursor: pointer;
  transition: color 0.2s var(--ease);
}

.collapse-btn:hover {
  color: var(--gold);
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-ink);
  letter-spacing: 0.02em;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.api-url {
  font-size: 12px;
  color: var(--text-fade);
  font-family: monospace;
}

.main {
  background: var(--ink-deep);
  padding: 24px;
  overflow-y: auto;
}
</style>
