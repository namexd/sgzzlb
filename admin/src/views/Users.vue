<template>
  <div class="users-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <div class="header-actions">
            <el-input v-model="searchKeyword" placeholder="搜索用户ID/昵称" clearable style="width: 200px" @change="loadData" />
            <el-select v-model="tierFilter" placeholder="订阅筛选" clearable style="width: 120px" @change="loadData">
              <el-option label="全部" value="" />
              <el-option label="免费" value="free" />
              <el-option label="高级" value="premium" />
            </el-select>
            <el-button @click="loadData" :loading="loading">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="filteredList" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="用户ID" width="200">
          <template #default="{ row }">
            <span class="user-id">{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="nickname" label="昵称" width="120" />
        <el-table-column prop="username" label="用户名" width="120">
          <template #default="{ row }">
            {{ row.username || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="tier" label="订阅" width="100">
          <template #default="{ row }">
            <el-tag :type="row.tier === 'premium' ? 'success' : 'info'">
              {{ row.tier === "premium" ? "高级" : "免费" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lineup_count" label="阵容数" width="80" />
        <el-table-column prop="created_at" label="注册时间" width="160" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="showDetail(row)">详情</el-button>
            <el-button
              :type="row.tier === 'premium' ? 'warning' : 'success'"
              size="small"
              @click="toggleTier(row)"
            >
              {{ row.tier === "premium" ? "降级" : "升级" }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && filteredList.length === 0" description="暂无用户数据" />
    </el-card>

    <el-dialog v-model="detailVisible" title="用户详情" width="800px">
      <div v-if="currentUser" class="user-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="用户ID">{{ currentUser.id }}</el-descriptions-item>
          <el-descriptions-item label="昵称">{{ currentUser.nickname || "-" }}</el-descriptions-item>
          <el-descriptions-item label="用户名">{{ currentUser.username || "-" }}</el-descriptions-item>
          <el-descriptions-item label="订阅">
            <el-tag :type="currentUser.tier === 'premium' ? 'success' : 'info'">
              {{ currentUser.tier === "premium" ? "高级" : "免费" }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="注册时间">{{ currentUser.created_at }}</el-descriptions-item>
          <el-descriptions-item label="阵容数">{{ detailData.lineups?.length || currentUser.lineup_count || 0 }}</el-descriptions-item>
          <el-descriptions-item label="抽卡记录数">{{ detailData.drawRecords?.length || 0 }}</el-descriptions-item>
          <el-descriptions-item label="战报数">{{ detailData.battleReports?.length || 0 }}</el-descriptions-item>
        </el-descriptions>

        <el-tabs v-model="detailTab" style="margin-top: 16px">
          <el-tab-pane label="阵容" name="lineups">
            <el-table :data="detailData.lineups || []" max-height="300" size="small">
              <el-table-column prop="scenario" label="赛季" width="100" />
              <el-table-column prop="troop" label="兵种" width="80" />
              <el-table-column prop="score" label="评分" width="80" />
              <el-table-column label="武将">
                <template #default="{ row }">
                  {{ Array.isArray(row.generals) ? row.generals.join(", ") : "-" }}
                </template>
              </el-table-column>
              <el-table-column prop="created_at" label="创建时间" width="160" />
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="战报" name="reports">
            <el-table :data="detailData.battleReports || []" max-height="300" size="small">
              <el-table-column prop="result" label="结果" width="80">
                <template #default="{ row }">
                  <el-tag :type="row.result === 'win' ? 'success' : row.result === 'loss' ? 'danger' : 'warning'" size="small">
                    {{ row.result === 'win' ? '胜利' : row.result === 'loss' ? '失败' : '平局' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="own_troop" label="我方兵种" width="100" />
              <el-table-column prop="enemy_troop" label="敌方兵种" width="100" />
              <el-table-column prop="battle_date" label="日期" width="120" />
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { getUsers, getUserDetail, setUserTier } from "../api";
import { ElMessage, ElMessageBox } from "element-plus";

const loading = ref(false);
const list = ref([]);
const searchKeyword = ref("");
const tierFilter = ref("");
const detailVisible = ref(false);
const currentUser = ref(null);
const detailData = ref({});
const detailTab = ref("lineups");
const detailLoading = ref(false);

const filteredList = computed(() => {
  let result = list.value;
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase();
    result = result.filter((item) =>
      (item.id && item.id.toLowerCase().includes(kw)) ||
      (item.nickname && item.nickname.toLowerCase().includes(kw)) ||
      (item.username && item.username.toLowerCase().includes(kw))
    );
  }
  if (tierFilter.value) {
    result = result.filter((item) => item.tier === tierFilter.value);
  }
  return result;
});

const loadData = async () => {
  loading.value = true;
  try {
    const res = await getUsers({ limit: 200 });
    list.value = res.items || [];
  } catch (e) {
    ElMessage.error("加载失败：" + e.message);
  } finally {
    loading.value = false;
  }
};

const showDetail = async (user) => {
  currentUser.value = user;
  detailData.value = {};
  detailTab.value = "lineups";
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const res = await getUserDetail(user.id);
    detailData.value = res;
  } catch (e) {
    ElMessage.warning("加载详情失败：" + e.message);
  } finally {
    detailLoading.value = false;
  }
};

const toggleTier = async (user) => {
  const newTier = user.tier === "premium" ? "free" : "premium";
  const tierLabel = newTier === "premium" ? "高级" : "免费";
  try {
    await ElMessageBox.confirm(
      `确定将用户 ${user.nickname || user.id} 的订阅等级更改为「${tierLabel}」？`,
      "修改订阅等级",
      { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" }
    );
    await setUserTier(user.id, newTier);
    user.tier = newTier;
    ElMessage.success("订阅等级已更新");
  } catch (e) {
    if (e !== "cancel") {
      ElMessage.error("更新失败：" + e.message);
    }
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

.user-id {
  font-family: monospace;
  font-size: 12px;
  color: #6b7a8d;
}

.user-detail {
  padding: 16px 0;
}
</style>
