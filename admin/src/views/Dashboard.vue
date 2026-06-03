<template>
  <div class="dashboard">
    <!-- Stats Cards -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6" v-for="stat in stats" :key="stat.label">
        <el-card class="stat-card">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
          <div class="stat-note">{{ stat.note }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Info Panels -->
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>服务状态</span>
          </template>
          <div v-if="dashboard" class="info-list">
            <div class="info-item">
              <span>后端状态</span>
              <el-tag :type="dashboard.status === 'ok' ? 'success' : 'danger'">
                {{ dashboard.status === 'ok' ? '正常' : '异常' }}
              </el-tag>
            </div>
            <div class="info-item">
              <span>评分规则</span>
              <span>{{ dashboard.rules?.enabled || 0 }} / {{ dashboard.rules?.total || 0 }} 已启用</span>
            </div>
            <div class="info-item">
              <span>保存阵容</span>
              <span>{{ dashboard.lineups?.total || 0 }} 套</span>
            </div>
            <div class="info-item">
              <span>审计日志</span>
              <span>{{ dashboard.auditLog?.total || 0 }} 条</span>
            </div>
          </div>
          <el-empty v-else description="加载中..." />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>目录数据</span>
          </template>
          <div v-if="catalogSummary" class="info-list">
            <div class="info-item">
              <span>武将</span>
              <span>{{ catalogSummary.counts?.generals || catalogSummary.meta?.generalsCount || 0 }}</span>
            </div>
            <div class="info-item">
              <span>战法</span>
              <span>{{ catalogSummary.counts?.tactics || catalogSummary.meta?.tacticsCount || 0 }}</span>
            </div>
            <div class="info-item">
              <span>装备</span>
              <span>{{ catalogSummary.counts?.equipment || catalogSummary.meta?.equipmentCount || 0 }}</span>
            </div>
            <div class="info-item">
              <span>兵种</span>
              <span>{{ catalogSummary.counts?.troopTactics || catalogSummary.meta?.troopTacticsCount || 0 }}</span>
            </div>
          </div>
          <el-empty v-else description="加载中..." />
        </el-card>
      </el-col>
    </el-row>

    <!-- Recent Audit -->
    <el-card class="mt-20">
      <template #header>
        <span>最近操作</span>
      </template>
      <el-table :data="recentAudit" style="width: 100%">
        <el-table-column prop="action" label="操作" />
        <el-table-column prop="detail" label="详情">
          <template #default="{ row }">
            <span class="detail-text">{{ formatDetail(row.detail) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="时间" width="180" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { getDashboard, getCatalogSummary, getAuditLog } from "../api";

const dashboard = ref(null);
const catalogSummary = ref(null);
const recentAudit = ref([]);
const stats = ref([
  { label: "武将", value: 0, note: "官方数据" },
  { label: "战法", value: 0, note: "普通战法" },
  { label: "阵容", value: 0, note: "用户样本" },
  { label: "审计日志", value: 0, note: "操作记录" }
]);

const formatDetail = (detail) => {
  if (!detail) return "-";
  if (typeof detail === "string") return detail;
  return JSON.stringify(detail).slice(0, 100);
};

onMounted(async () => {
  try {
    const [dash, catalog, audit] = await Promise.all([
      getDashboard(),
      getCatalogSummary(),
      getAuditLog({ limit: 10 })
    ]);
    dashboard.value = dash;
    catalogSummary.value = catalog;
    recentAudit.value = audit.items || [];

    const counts = catalog.counts || catalog.meta || {};
    stats.value[0].value = counts.generals || counts.generalsCount || 0;
    stats.value[1].value = counts.tactics || counts.tacticsCount || 0;
    stats.value[2].value = dash.lineups?.total || 0;
    stats.value[3].value = dash.auditLog?.total || 0;
  } catch (e) {
    console.error("Dashboard load error:", e);
  }
});
</script>

<style scoped>
.dashboard {
  max-width: 1400px;
}

.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  text-align: center;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: var(--gold-bright);
  letter-spacing: -0.02em;
}

.stat-label {
  font-size: 14px;
  color: var(--text-stone);
  margin-top: 6px;
  letter-spacing: 0.04em;
}

.stat-note {
  font-size: 12px;
  color: var(--text-fade);
  margin-top: 4px;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-faint);
}

.info-item:last-child {
  border-bottom: none;
}

.info-item span:first-child {
  color: var(--text-stone);
}

.info-item span:last-child {
  color: var(--text-ink);
  font-weight: 500;
}

.detail-text {
  color: var(--text-stone);
  font-size: 13px;
}

.mt-20 {
  margin-top: 24px;
}
</style>
