<template>
  <div class="lineups-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户阵容</span>
          <div class="header-actions">
            <el-input v-model="userIdFilter" placeholder="用户ID筛选" clearable style="width: 160px" @change="loadData" />
            <el-select v-model="troopFilter" placeholder="兵种筛选" clearable style="width: 120px" @change="loadData">
              <el-option label="全部" value="" />
              <el-option label="骑兵" value="骑兵" />
              <el-option label="盾兵" value="盾兵" />
              <el-option label="弓兵" value="弓兵" />
              <el-option label="枪兵" value="枪兵" />
            </el-select>
            <el-select v-model="sortBy" placeholder="排序方式" style="width: 140px" @change="loadData">
              <el-option label="按时间倒序" value="created_at_desc" />
              <el-option label="按评分倒序" value="score_desc" />
              <el-option label="按评分正序" value="score_asc" />
            </el-select>
            <el-button @click="loadData" :loading="loading">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="sortedList" style="width: 100%" v-loading="loading">
        <el-table-column prop="scenario" label="赛季" width="100" />
        <el-table-column prop="troop" label="兵种" width="80" />
        <el-table-column prop="score" label="评分" width="80" sortable>
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
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-popconfirm
              title="确定要删除这个阵容吗？"
              confirm-button-text="删除"
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

      <el-empty v-if="!loading && filteredList.length === 0" description="暂无阵容数据" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { getLineups, deleteLineup } from "../api";
import { ElMessage } from "element-plus";

const loading = ref(false);
const list = ref([]);
const userIdFilter = ref("");
const troopFilter = ref("");
const sortBy = ref("created_at_desc");

const filteredList = computed(() => {
  let result = list.value;
  if (userIdFilter.value) {
    result = result.filter((item) => item.user_id && item.user_id.includes(userIdFilter.value));
  }
  if (troopFilter.value) {
    result = result.filter((item) => item.troop === troopFilter.value);
  }
  return result;
});

const sortedList = computed(() => {
  const arr = [...filteredList.value];
  switch (sortBy.value) {
    case "score_desc":
      return arr.sort((a, b) => (b.score || 0) - (a.score || 0));
    case "score_asc":
      return arr.sort((a, b) => (a.score || 0) - (b.score || 0));
    case "created_at_desc":
    default:
      return arr.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }
});

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

const handleDelete = async (row) => {
  try {
    await deleteLineup(row.id);
    ElMessage.success("删除成功");
    await loadData();
  } catch (e) {
    ElMessage.error("删除失败：" + e.message);
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
