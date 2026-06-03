<template>
  <div class="rules-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>评分规则</span>
          <div class="header-actions">
            <el-button @click="addRule">新增规则</el-button>
            <el-button type="primary" @click="saveRules" :loading="saving">保存</el-button>
          </div>
        </div>
      </template>

      <el-table :data="rules" style="width: 100%" v-loading="loading">
        <el-table-column prop="dimension" label="维度" width="120" />
        <el-table-column prop="label" label="标签" width="120" />
        <el-table-column prop="weight" label="权重" width="80" />
        <el-table-column prop="threshold" label="阈值" width="80" />
        <el-table-column prop="description" label="说明" min-width="200" show-overflow-tooltip />
        <el-table-column prop="enabled" label="状态" width="80">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ $index }">
            <el-button type="danger" text size="small" @click="removeRule($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && rules.length === 0" description="暂无评分规则" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { getRules, saveRules as saveRulesApi } from "../api";
import { ElMessage, ElMessageBox } from "element-plus";

const loading = ref(false);
const saving = ref(false);
const rules = ref([]);

const loadData = async () => {
  loading.value = true;
  try {
    const res = await getRules();
    rules.value = res.items || [];
  } catch (e) {
    ElMessage.error("加载失败：" + e.message);
  } finally {
    loading.value = false;
  }
};

const addRule = () => {
  rules.value.push({
    dimension: "",
    label: "",
    weight: 1,
    threshold: 0,
    description: "",
    enabled: true
  });
};

const removeRule = (index) => {
  rules.value.splice(index, 1);
};

const saveRules = async () => {
  saving.value = true;
  try {
    await saveRulesApi(rules.value);
    ElMessage.success("保存成功");
  } catch (e) {
    ElMessage.error("保存失败：" + e.message);
  } finally {
    saving.value = false;
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
}
</style>
