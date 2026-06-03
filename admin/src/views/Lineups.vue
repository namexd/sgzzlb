<template>
  <div class="lineups-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户阵容</span>
          <el-button @click="loadData" :loading="loading">刷新</el-button>
        </div>
      </template>

      <el-table :data="list" style="width: 100%" v-loading="loading">
        <el-table-column prop="scenario" label="赛季" width="100" />
        <el-table-column prop="troop" label="兵种" width="80" />
        <el-table-column prop="score" label="评分" width="80">
          <template #default="{ row }">
            <span class="score">{{ row.score }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="generals" label="武将" min-width="200">
          <template #default="{ row }">
            <span>{{ formatJson(row.generals) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="tactics" label="战法" min-width="200">
          <template #default="{ row }">
            <span class="tactics-text">{{ formatJson(row.tactics) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="user_id" label="用户" width="120">
          <template #default="{ row }">
            <span class="user-id">{{ row.user_id ? row.user_id.slice(0, 12) + "..." : "-" }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="80" />
        <el-table-column prop="created_at" label="时间" width="160" />
      </el-table>

      <el-empty v-if="!loading && list.length === 0" description="暂无阵容数据" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { getLineups } from "../api";
import { ElMessage } from "element-plus";

const loading = ref(false);
const list = ref([]);

const formatJson = (val) => {
  if (!val) return "-";
  if (typeof val === "string") {
    try {
      return JSON.parse(val).join(" / ");
    } catch {
      return val;
    }
  }
  if (Array.isArray(val)) return val.join(" / ");
  return String(val);
};

const loadData = async () => {
  loading.value = true;
  try {
    const res = await getLineups();
    list.value = res.items || [];
  } catch (e) {
    ElMessage.error("加载失败：" + e.message);
  } finally {
    loading.value = false;
  }
};

onMounted(loadData);
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.score {
  color: #d6a85d;
  font-weight: 700;
  font-size: 16px;
}

.tactics-text {
  color: #a89b82;
  font-size: 13px;
}

.user-id {
  color: #6b7a8d;
  font-size: 12px;
}
</style>
