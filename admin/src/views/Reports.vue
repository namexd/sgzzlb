<template>
  <div class="reports-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>战报管理</span>
          <div class="header-actions">
            <el-input v-model="userIdFilter" placeholder="用户ID筛选" clearable style="width: 160px" @change="loadData" />
            <el-select v-model="resultFilter" placeholder="结果筛选" clearable style="width: 120px" @change="loadData">
              <el-option label="全部" value="" />
              <el-option label="胜利" value="win" />
              <el-option label="失败" value="loss" />
              <el-option label="平局" value="draw" />
            </el-select>
            <el-button @click="loadData" :loading="loading">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="filteredList" style="width: 100%" v-loading="loading">
        <el-table-column prop="user_id" label="用户" width="120">
          <template #default="{ row }">
            <span class="user-id">{{ row.user_id ? row.user_id.slice(0, 12) + "..." : "-" }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="result" label="结果" width="80">
          <template #default="{ row }">
            <el-tag :type="resultType(row.result)">{{ resultLabel(row.result) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="own_troop" label="我方兵种" width="100" />
        <el-table-column prop="own_score" label="我方评分" width="100">
          <template #default="{ row }">
            <span class="score">{{ row.own_score || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="enemy_troop" label="敌方兵种" width="100" />
        <el-table-column prop="enemy_score" label="敌方评分" width="100">
          <template #default="{ row }">
            <span class="score">{{ row.enemy_score || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="battle_date" label="战斗日期" width="120" />
        <el-table-column prop="created_at" label="记录时间" width="160" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-popconfirm
              title="确定删除此战报？"
              confirm-button-text="确定"
              cancel-button-text="取消"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && filteredList.length === 0" description="暂无战报数据" />
    </el-card>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>战报统计</span>
          </template>
          <el-descriptions :column="2" border v-if="stats">
            <el-descriptions-item label="总战报数">{{ stats.total }}</el-descriptions-item>
            <el-descriptions-item label="胜率">{{ stats.winRate }}%</el-descriptions-item>
            <el-descriptions-item label="胜利">{{ stats.wins }}</el-descriptions-item>
            <el-descriptions-item label="失败">{{ stats.losses }}</el-descriptions-item>
            <el-descriptions-item label="平局">{{ stats.draws }}</el-descriptions-item>
            <el-descriptions-item label="可信度">
              <el-tag :type="stats.confidence === '高' ? 'success' : stats.confidence === '中' ? 'warning' : 'danger'">
                {{ stats.confidence }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="平均伤害(我方)">{{ stats.avgDamageDealt }}</el-descriptions-item>
            <el-descriptions-item label="平均伤害(敌方)">{{ stats.avgDamageTaken }}</el-descriptions-item>
          </el-descriptions>
          <el-empty v-else description="暂无统计数据" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>最近趋势</span>
          </template>
          <div v-if="stats" class="trend-info">
            <p>最近10场: {{ stats.recentTrend }}</p>
            <p>平均回合数: {{ stats.avgRounds }}</p>
          </div>
          <el-empty v-else description="暂无数据" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { getBattleReports, deleteBattleReport, getBattleReportStats } from "../api";
import { ElMessage } from "element-plus";

const loading = ref(false);
const statsLoading = ref(false);
const list = ref([]);
const stats = ref(null);
const userIdFilter = ref("");
const resultFilter = ref("");

const filteredList = computed(() => {
  let result = list.value;
  if (userIdFilter.value) {
    result = result.filter((item) => item.user_id && item.user_id.includes(userIdFilter.value));
  }
  if (resultFilter.value) {
    result = result.filter((item) => item.result === resultFilter.value);
  }
  return result;
});

const resultLabel = (result) => {
  const labels = { win: "胜利", loss: "失败", draw: "平局" };
  return labels[result] || result;
};

const resultType = (result) => {
  const types = { win: "success", loss: "danger", draw: "warning" };
  return types[result] || "info";
};

const loadData = async () => {
  loading.value = true;
  try {
    const res = await getBattleReports({ limit: 200 });
    list.value = res.items || [];
  } catch (e) {
    ElMessage.error("加载失败：" + e.message);
  } finally {
    loading.value = false;
  }
};

const loadStats = async () => {
  statsLoading.value = true;
  try {
    const res = await getBattleReportStats();
    stats.value = res;
  } catch (e) {
    console.error("加载统计失败:", e);
  } finally {
    statsLoading.value = false;
  }
};

const handleDelete = async (row) => {
  try {
    await deleteBattleReport(row.id);
    list.value = list.value.filter((item) => item.id !== row.id);
    ElMessage.success("删除成功");
    loadStats();
  } catch (e) {
    ElMessage.error("删除失败：" + e.message);
  }
};

onMounted(() => {
  loadData();
  loadStats();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.user-id {
  color: #6b7a8d;
  font-size: 12px;
}

.score {
  color: #d6a85d;
  font-weight: 600;
}
</style>
