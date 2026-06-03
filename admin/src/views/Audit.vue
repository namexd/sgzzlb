<template>
  <div class="audit-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>审计日志</span>
          <div class="header-actions">
            <el-input v-model="keyword" placeholder="搜索操作或详情" clearable style="width: 200px" />
            <el-select v-model="level" placeholder="结果筛选" clearable style="width: 120px">
              <el-option label="全部" value="" />
              <el-option label="成功" value="success" />
              <el-option label="警告" value="warning" />
              <el-option label="失败" value="failed" />
            </el-select>
            <el-button @click="loadData" :loading="loading">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="filteredList" style="width: 100%" v-loading="loading">
        <el-table-column prop="action" label="操作" width="200" />
        <el-table-column prop="detail" label="详情" min-width="300">
          <template #default="{ row }">
            <span class="detail-text">{{ formatDetail(row.detail) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="100">
          <template #default="{ row }">
            <el-tag :type="getLevelType(row)" size="small">{{ getLevel(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="时间" width="180" />
      </el-table>

      <el-empty v-if="!loading && filteredList.length === 0" description="暂无日志数据" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { getAuditLog } from "../api";
import { ElMessage } from "element-plus";

const loading = ref(false);
const list = ref([]);
const keyword = ref("");
const level = ref("");

const filteredList = computed(() => {
  return list.value.filter((item) => {
    const body = `${item.action} ${JSON.stringify(item.detail || {})}`.toLowerCase();
    const matchKeyword = !keyword.value || body.includes(keyword.value.toLowerCase());
    const matchLevel = !level.value || getLevel(item) === level.value;
    return matchKeyword && matchLevel;
  });
});

const getLevel = (item) => {
  if (item.action?.includes("failed")) return "failed";
  if (item.action?.includes("warning")) return "warning";
  return "success";
};

const getLevelType = (item) => {
  const l = getLevel(item);
  if (l === "failed") return "danger";
  if (l === "warning") return "warning";
  return "success";
};

const formatDetail = (detail) => {
  if (!detail) return "-";
  if (typeof detail === "string") return detail;
  return JSON.stringify(detail).slice(0, 120);
};

const loadData = async () => {
  loading.value = true;
  try {
    const res = await getAuditLog({ limit: 200 });
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

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.detail-text {
  color: #a89b82;
  font-size: 13px;
  word-break: break-all;
}
</style>
