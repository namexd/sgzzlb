<template>
  <div class="rules-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>评分规则</span>
          <div class="header-actions">
            <el-input v-model="version" placeholder="规则版本" style="width: 120px" />
            <el-button @click="addRule">新增规则</el-button>
            <el-button type="warning" @click="rollbackRules" :disabled="!history.length">回滚</el-button>
            <el-button type="primary" @click="saveRules" :loading="saving">保存</el-button>
          </div>
        </div>
      </template>

      <div class="rules-meta">
        <el-tag type="info">版本: {{ version || "未设置" }}</el-tag>
        <el-tag :type="allEnabled ? 'success' : 'warning'">
          {{ allEnabled ? "全部启用" : "部分禁用" }}
        </el-tag>
        <el-tag>规则数: {{ rules.length }}</el-tag>
      </div>

      <el-table :data="rules" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="120" show-overflow-tooltip />
        <el-table-column prop="dimension" label="维度" width="100" />
        <el-table-column prop="label" label="标签" width="100" />
        <el-table-column prop="weight" label="权重" width="70" />
        <el-table-column prop="threshold" label="阈值" width="70" />
        <el-table-column prop="description" label="说明" min-width="180" show-overflow-tooltip />
        <el-table-column prop="灰度" label="灰度对象" width="120">
          <template #default="{ row }">
            <el-select v-model="row.targetUsers" multiple collapse-tags placeholder="全部" size="small" style="width: 100px">
              <el-option label="免费用户" value="free" />
              <el-option label="高级用户" value="premium" />
              <el-option label="测试用户" value="test" />
            </el-select>
          </template>
        </el-table-column>
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

    <el-card v-if="history.length" style="margin-top: 16px">
      <template #header>
        <span>历史版本</span>
      </template>
      <el-timeline>
        <el-timeline-item
          v-for="(item, index) in history"
          :key="index"
          :timestamp="item.time"
          placement="top"
        >
          <el-card shadow="never">
            <div class="history-item">
              <span>版本: {{ item.version }}</span>
              <span>规则数: {{ item.rules.length }}</span>
              <el-button size="small" @click="previewHistory(item)">预览</el-button>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { getRules, saveRules as saveRulesApi } from "../api";
import { ElMessage, ElMessageBox } from "element-plus";

const loading = ref(false);
const saving = ref(false);
const rules = ref([]);
const version = ref("1.0.0");
const history = ref([]);

const allEnabled = computed(() => rules.value.length > 0 && rules.value.every((r) => r.enabled));

const loadData = async () => {
  loading.value = true;
  try {
    const res = await getRules();
    rules.value = res.items || [];
    if (res.version) version.value = res.version;
  } catch (e) {
    ElMessage.error("加载失败：" + e.message);
  } finally {
    loading.value = false;
  }
};

const addRule = () => {
  rules.value.push({
    id: `rule_${Date.now()}`,
    dimension: "",
    label: "",
    weight: 1,
    threshold: 0,
    description: "",
    enabled: true,
    targetUsers: []
  });
};

const removeRule = (index) => {
  rules.value.splice(index, 1);
};

const saveRules = async () => {
  await ElMessageBox.confirm("确定保存当前规则配置？", "确认保存", {
    confirmButtonText: "保存",
    cancelButtonText: "取消",
    type: "warning"
  });

  saving.value = true;
  try {
    // 保存当前版本到历史
    history.value.unshift({
      version: version.value,
      rules: JSON.parse(JSON.stringify(rules.value)),
      time: new Date().toLocaleString()
    });
    // 只保留最近 10 个版本
    if (history.value.length > 10) history.value.pop();

    await saveRulesApi({ version: version.value, rules: rules.value });
    ElMessage.success("保存成功");
  } catch (e) {
    if (e.message !== "cancel") {
      ElMessage.error("保存失败：" + e.message);
    }
  } finally {
    saving.value = false;
  }
};

const rollbackRules = async () => {
  if (!history.value.length) return;

  await ElMessageBox.confirm(
    `确定回滚到版本 ${history.value[0].version}？`,
    "确认回滚",
    {
      confirmButtonText: "回滚",
      cancelButtonText: "取消",
      type: "warning"
    }
  );

  const last = history.value.shift();
  rules.value = last.rules;
  version.value = last.version;
  ElMessage.success(`已回滚到版本 ${last.version}`);
};

const previewHistory = (item) => {
  ElMessageBox.alert(
    `<pre>${JSON.stringify(item.rules, null, 2)}</pre>`,
    `版本 ${item.version} 规则预览`,
    { dangerouslyUseHTMLString: true, customStyle: { maxWidth: "600px" } }
  );
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

.rules-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.history-item {
  display: flex;
  gap: 16px;
  align-items: center;
}
</style>
