<template>
  <div class="feedback-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户反馈</span>
          <div class="header-actions">
            <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 140px">
              <el-option label="全部" value="" />
              <el-option label="待处理" value="pending" />
              <el-option label="已读" value="read" />
              <el-option label="已解决" value="resolved" />
              <el-option label="已驳回" value="rejected" />
            </el-select>
            <el-button @click="loadData" :loading="loading">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="filteredList" style="width: 100%" v-loading="loading">
        <el-table-column prop="content" label="反馈内容" min-width="300">
          <template #default="{ row }">
            <div class="feedback-content">{{ row.content }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="contact" label="联系方式" width="150">
          <template #default="{ row }">
            {{ row.contact || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="user_id" label="用户" width="120">
          <template #default="{ row }">
            <span class="user-id">{{ row.user_id ? row.user_id.slice(0, 12) + "..." : "游客" }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="160" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-select
              v-model="row.status"
              size="small"
              @change="(val) => updateStatus(row.id, val)"
              style="width: 110px"
            >
              <el-option label="待处理" value="pending" />
              <el-option label="已读" value="read" />
              <el-option label="已解决" value="resolved" />
              <el-option label="已驳回" value="rejected" />
            </el-select>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && filteredList.length === 0" description="暂无反馈数据" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { getFeedback, updateFeedbackStatus } from "../api";
import { ElMessage } from "element-plus";

const loading = ref(false);
const list = ref([]);
const statusFilter = ref("");

const filteredList = computed(() => {
  if (!statusFilter.value) return list.value;
  return list.value.filter((item) => item.status === statusFilter.value);
});

const statusLabel = (status) => {
  const labels = { pending: "待处理", read: "已读", resolved: "已解决", rejected: "已驳回" };
  return labels[status] || status;
};

const statusType = (status) => {
  const types = { pending: "warning", read: "info", resolved: "success", rejected: "danger" };
  return types[status] || "info";
};

const loadData = async () => {
  loading.value = true;
  try {
    const res = await getFeedback({ limit: 200 });
    list.value = res.items || [];
  } catch (e) {
    ElMessage.error("加载失败：" + e.message);
  } finally {
    loading.value = false;
  }
};

const updateStatus = async (id, status) => {
  try {
    await updateFeedbackStatus(id, status);
    ElMessage.success("状态已更新");
  } catch (e) {
    ElMessage.error("更新失败：" + e.message);
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

.feedback-content {
  color: #f4ead8;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.user-id {
  color: #6b7a8d;
  font-size: 12px;
}
</style>
