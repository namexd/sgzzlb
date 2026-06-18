<template>
  <div class="catalog-updates-page">
    <el-tabs v-model="activeTab" class="catalog-tabs">
      <el-tab-pane label="版本列表" name="versions">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>资料版本</span>
              <div class="toolbar">
                <el-input v-model="filters.season" placeholder="赛季 key" clearable style="width: 160px" @keyup.enter="loadVersions" />
                <el-select v-model="filters.status" placeholder="状态" clearable style="width: 140px">
                  <el-option label="已发布" value="published" />
                  <el-option label="草稿" value="draft" />
                  <el-option label="已归档" value="archived" />
                  <el-option label="已丢弃" value="discarded" />
                </el-select>
                <el-button type="primary" @click="loadVersions">刷新</el-button>
              </div>
            </div>
          </template>
          <el-table :data="versions" style="width: 100%" v-loading="loading.versions">
            <el-table-column prop="seasonLabel" label="赛季" min-width="120">
              <template #default="{ row }">
                <div>{{ row.seasonLabel || row.seasonKey }}</div>
                <small>{{ row.seasonKey }}</small>
              </template>
            </el-table-column>
            <el-table-column prop="versionKey" label="版本" min-width="160" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="statusTag(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="source" label="来源" width="100" />
            <el-table-column label="资料量" min-width="160">
              <template #default="{ row }">
                武将 {{ row.counts?.generals || 0 }} / 战法 {{ row.counts?.tactics || 0 }} / 兵种 {{ row.counts?.troopTactics || 0 }}
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="导入时间" min-width="150" />
            <el-table-column prop="publishedAt" label="发布时间" min-width="150" />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="openVersionDetail(row.id)">详情</el-button>
                <el-button v-if="row.status === 'draft'" size="small" type="success" @click="publishVersion(row)">发布</el-button>
                <el-button v-if="row.status === 'draft'" size="small" type="danger" text @click="discardVersion(row)">丢弃</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="导入审核" name="imports">
        <el-row :gutter="20">
          <el-col :span="10">
            <el-card>
              <template #header>
                <div class="card-header">
                  <span>导入 JSON 快照</span>
                  <el-button type="success" :loading="loading.officialImporting" @click="createOfficialImportJob">采集官方公开资料</el-button>
                </div>
              </template>
              <el-form label-width="90px">
                <el-form-item label="赛季 key">
                  <el-input v-model="importForm.seasonKey" placeholder="例如 pk" />
                </el-form-item>
                <el-form-item label="赛季名称">
                  <el-input v-model="importForm.seasonLabel" placeholder="例如 PK赛季" />
                </el-form-item>
                <el-form-item label="版本号">
                  <el-input v-model="importForm.versionKey" placeholder="例如 pk-202606" />
                </el-form-item>
                <el-form-item label="来源">
                  <el-input v-model="importForm.source" placeholder="manual / official" />
                </el-form-item>
                <el-form-item label="快照 JSON">
                  <el-input v-model="importForm.snapshotText" type="textarea" :rows="14" placeholder="粘贴包含 meta、generals、tactics、troopTactics、equipment 的完整 JSON" />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" :loading="loading.importing" @click="createImportJob">生成草稿</el-button>
                </el-form-item>
              </el-form>
              <el-alert type="info" :closable="false" class="official-alert">
                官方公开资料采集只会生成草稿，需在导入任务中审核 diff 后手动发布。
              </el-alert>
              <el-descriptions v-if="officialStatus.lastResult || officialStatus.lastError" :column="1" border class="official-status">
                <el-descriptions-item label="最近采集">
                  {{ officialStatus.lastFinishedAt || officialStatus.lastStartedAt || "-" }}
                </el-descriptions-item>
                <el-descriptions-item label="结果">
                  <span v-if="officialStatus.lastError">失败：{{ officialStatus.lastError }}</span>
                  <span v-else-if="officialStatus.lastResult?.skipped">已跳过：{{ officialStatus.lastResult.reason || "无差异" }}</span>
                  <span v-else>已生成草稿：{{ officialStatus.lastResult?.versionId || officialStatus.lastResult?.jobId }}</span>
                </el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-col>
          <el-col :span="14">
            <el-card>
              <template #header>
                <div class="card-header">
                  <span>导入任务</span>
                  <el-button @click="loadImportJobs">刷新</el-button>
                </div>
              </template>
              <el-table :data="importJobs" style="width: 100%" v-loading="loading.importJobs">
                <el-table-column prop="seasonKey" label="赛季" width="100" />
                <el-table-column prop="versionKey" label="版本" min-width="150" show-overflow-tooltip />
                <el-table-column prop="status" label="状态" width="90">
                  <template #default="{ row }">
                    <el-tag :type="statusTag(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="差异" min-width="180">
                  <template #default="{ row }">
                    <span v-if="row.diff?.summary">新增 {{ diffTotal(row.diff.summary, 'added') }}，变更 {{ diffTotal(row.diff.summary, 'changed') }}，下架 {{ diffTotal(row.diff.summary, 'removed') }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="createdAt" label="创建时间" min-width="150" />
                <el-table-column label="操作" width="180">
                  <template #default="{ row }">
                    <el-button v-if="row.status === 'draft'" size="small" type="success" @click="publishJob(row)">发布</el-button>
                    <el-button v-if="row.status === 'draft'" size="small" type="danger" text @click="discardJob(row)">丢弃</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="规则覆盖" name="coverage">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>战法规则覆盖</span>
              <div class="toolbar">
                <el-input v-model="coverageFilters.season" placeholder="赛季 key" clearable style="width: 140px" />
                <el-input v-model="coverageFilters.catalogVersionId" placeholder="版本 ID" clearable style="width: 220px" />
                <el-button type="primary" @click="loadCoverage">查询</el-button>
              </div>
            </div>
          </template>
          <el-alert v-if="coverage.catalogContext" type="info" :closable="false" class="context-alert">
            当前资料：{{ coverage.catalogContext.seasonLabel }} / {{ coverage.catalogContext.versionKey }} / {{ coverage.catalogContext.status }}
          </el-alert>
          <div class="summary-row">
            <el-statistic title="总战法" :value="coverage.summary?.total || 0" />
            <el-statistic title="显式规则" :value="coverage.summary?.explicit || 0" />
            <el-statistic title="通用估算" :value="coverage.summary?.fallback || 0" />
            <el-statistic title="未覆盖" :value="coverage.summary?.missed || 0" />
            <el-statistic title="待办" :value="coverage.summary?.todo || 0" />
          </div>
          <el-table :data="coverage.items || []" style="width: 100%" max-height="520" v-loading="loading.coverage">
            <el-table-column prop="tacticName" label="战法" min-width="130" />
            <el-table-column prop="tacticType" label="类型" width="90" />
            <el-table-column prop="status" label="覆盖" width="110">
              <template #default="{ row }">
                <el-tag :type="coverageTag(row.status)" size="small">{{ coverageText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="message" label="说明" min-width="220" show-overflow-tooltip />
            <el-table-column label="待办" width="150">
              <template #default="{ row }">
                <el-tag v-if="row.todo" :type="todoTag(row.todo.status)" size="small">{{ todoText(row.todo.status) }}</el-tag>
                <el-button v-else-if="row.status === 'missed'" size="small" type="primary" text @click="createTodo(row)">创建待办</el-button>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button v-if="row.todo && row.todo.status !== 'done'" size="small" @click="updateTodo(row.todo, 'done')">完成</el-button>
                <el-button v-if="row.todo && row.todo.status !== 'ignored'" size="small" text @click="updateTodo(row.todo, 'ignored')">忽略</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="detailVisible" title="资料版本详情" width="760px">
      <div v-if="versionDetail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="赛季">{{ versionDetail.seasonLabel }}（{{ versionDetail.seasonKey }}）</el-descriptions-item>
          <el-descriptions-item label="版本">{{ versionDetail.versionKey }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ statusText(versionDetail.status) }}</el-descriptions-item>
          <el-descriptions-item label="Hash">{{ versionDetail.snapshotHash }}</el-descriptions-item>
        </el-descriptions>
        <el-divider content-position="left">差异汇总</el-divider>
        <pre class="json-preview">{{ JSON.stringify(versionDetail.diff?.summary || {}, null, 2) }}</pre>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createCatalogRuleTodo,
  createOfficialCatalogImportJob,
  discardCatalogImportJob,
  getCatalogImportJobs,
  getCatalogRuleCoverage,
  getCatalogVersion,
  getCatalogVersions,
  getOfficialCatalogImportStatus,
  publishCatalogImportJob,
  updateCatalogRuleTodo,
  uploadCatalogImportJob
} from "../api";

const activeTab = ref("versions");
const versions = ref([]);
const importJobs = ref([]);
const coverage = ref({ summary: {}, items: [] });
const officialStatus = ref({});
const versionDetail = ref(null);
const detailVisible = ref(false);

const filters = reactive({ season: "", status: "" });
const coverageFilters = reactive({ season: "", catalogVersionId: "" });
const importForm = reactive({
  seasonKey: "pk",
  seasonLabel: "PK赛季",
  versionKey: "",
  source: "manual",
  snapshotText: ""
});

const loading = reactive({
  versions: false,
  importJobs: false,
  importing: false,
  officialImporting: false,
  coverage: false
});

const statusText = (status) => ({ draft: "草稿", published: "已发布", archived: "已归档", discarded: "已丢弃", failed: "失败" }[status] || status || "未知");
const statusTag = (status) => ({ published: "success", draft: "warning", archived: "info", discarded: "danger", failed: "danger" }[status] || "info");
const coverageText = (status) => ({ explicit: "显式规则", fallback: "通用估算", missed: "未覆盖" }[status] || status || "未知");
const coverageTag = (status) => ({ explicit: "success", fallback: "warning", missed: "danger" }[status] || "info");
const todoText = (status) => ({ open: "待处理", done: "已完成", ignored: "已忽略" }[status] || status || "未知");
const diffTotal = (summary = {}, key) => Object.values(summary || {}).reduce((total, item) => total + (Number(item?.[key]) || 0), 0);

async function loadVersions() {
  loading.versions = true;
  try {
    const params = { season: filters.season || undefined, status: filters.status || undefined };
    const res = await getCatalogVersions(params);
    versions.value = res.items || [];
  } catch (error) {
    ElMessage.error("加载资料版本失败：" + error.message);
  } finally {
    loading.versions = false;
  }
}

async function loadImportJobs() {
  loading.importJobs = true;
  try {
    const res = await getCatalogImportJobs();
    importJobs.value = res.items || [];
  } catch (error) {
    ElMessage.error("加载导入任务失败：" + error.message);
  } finally {
    loading.importJobs = false;
  }
}

async function loadCoverage() {
  loading.coverage = true;
  try {
    const params = {
      season: coverageFilters.season || undefined,
      catalogVersionId: coverageFilters.catalogVersionId || undefined
    };
    coverage.value = await getCatalogRuleCoverage(params);
  } catch (error) {
    ElMessage.error("加载规则覆盖失败：" + error.message);
  } finally {
    loading.coverage = false;
  }
}

async function loadOfficialStatus() {
  try {
    const res = await getOfficialCatalogImportStatus();
    officialStatus.value = res.status || {};
  } catch (error) {
    ElMessage.error("加载官方采集状态失败：" + error.message);
  }
}

async function openVersionDetail(id) {
  try {
    const res = await getCatalogVersion(id);
    versionDetail.value = res.item || res;
    detailVisible.value = true;
  } catch (error) {
    ElMessage.error("加载版本详情失败：" + error.message);
  }
}

async function createImportJob() {
  let snapshot;
  try {
    snapshot = JSON.parse(importForm.snapshotText);
  } catch {
    ElMessage.error("快照 JSON 格式不正确。");
    return;
  }
  loading.importing = true;
  try {
    await uploadCatalogImportJob({
      seasonKey: importForm.seasonKey,
      seasonLabel: importForm.seasonLabel,
      versionKey: importForm.versionKey,
      source: importForm.source,
      snapshot
    });
    ElMessage.success("已生成资料草稿。");
    importForm.snapshotText = "";
    await Promise.all([loadVersions(), loadImportJobs()]);
    activeTab.value = "imports";
  } catch (error) {
    ElMessage.error("导入失败：" + error.message);
  } finally {
    loading.importing = false;
  }
}

async function createOfficialImportJob() {
  loading.officialImporting = true;
  try {
    const res = await createOfficialCatalogImportJob({
      seasonKey: importForm.seasonKey,
      seasonLabel: importForm.seasonLabel,
      versionKey: importForm.versionKey || undefined
    });
    officialStatus.value = res.status || officialStatus.value;
    if (res.skipped) {
      ElMessage.info(res.reason || "官方公开资料无差异，已跳过。");
    } else {
      ElMessage.success("已生成官方资料草稿，请审核 diff 后发布。");
    }
    await Promise.all([loadVersions(), loadImportJobs(), loadOfficialStatus()]);
    activeTab.value = "imports";
  } catch (error) {
    ElMessage.error("官方采集失败：" + error.message);
    await loadOfficialStatus();
  } finally {
    loading.officialImporting = false;
  }
}

async function publishJob(row) {
  await ElMessageBox.confirm(`确认发布 ${row.versionKey}？同赛季旧发布版本会归档。`, "发布资料版本", { type: "warning" });
  try {
    await publishCatalogImportJob(row.id);
    ElMessage.success("发布成功。");
    await Promise.all([loadVersions(), loadImportJobs(), loadCoverage()]);
  } catch (error) {
    ElMessage.error("发布失败：" + error.message);
  }
}

async function discardJob(row) {
  await ElMessageBox.confirm(`确认丢弃 ${row.versionKey}？`, "丢弃导入任务", { type: "warning" });
  try {
    await discardCatalogImportJob(row.id);
    ElMessage.success("已丢弃。");
    await Promise.all([loadVersions(), loadImportJobs()]);
  } catch (error) {
    ElMessage.error("丢弃失败：" + error.message);
  }
}

async function publishVersion(row) {
  const job = importJobs.value.find((item) => item.versionId === row.id);
  if (!job) {
    ElMessage.warning("未找到关联导入任务，请在导入任务列表发布。");
    activeTab.value = "imports";
    return;
  }
  await publishJob(job);
}

async function discardVersion(row) {
  const job = importJobs.value.find((item) => item.versionId === row.id);
  if (!job) {
    ElMessage.warning("未找到关联导入任务，请在导入任务列表丢弃。");
    activeTab.value = "imports";
    return;
  }
  await discardJob(job);
}

async function createTodo(row) {
  try {
    await createCatalogRuleTodo({
      tacticId: row.tacticId,
      tacticName: row.tacticName,
      tacticType: row.tacticType,
      coverageStatus: row.status,
      priority: "medium",
      seasonKey: coverage.value.catalogContext?.seasonKey || coverageFilters.season,
      catalogVersionId: coverage.value.catalogContext?.catalogVersionId || coverageFilters.catalogVersionId,
      note: row.message
    });
    ElMessage.success("已创建规则待办。");
    await loadCoverage();
  } catch (error) {
    ElMessage.error("创建待办失败：" + error.message);
  }
}

async function updateTodo(todo, status) {
  try {
    await updateCatalogRuleTodo(todo.id, { status });
    ElMessage.success("待办已更新。");
    await loadCoverage();
  } catch (error) {
    ElMessage.error("更新待办失败：" + error.message);
  }
}

onMounted(async () => {
  await Promise.all([loadVersions(), loadImportJobs(), loadCoverage(), loadOfficialStatus()]);
});
</script>

<style scoped>
.catalog-updates-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.catalog-tabs :deep(.el-tabs__item) {
  color: var(--text-fade);
}

.catalog-tabs :deep(.el-tabs__item.is-active) {
  color: var(--gold);
}

.card-header,
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(120px, 1fr));
  gap: 16px;
  margin: 16px 0;
}

.context-alert,
.official-alert,
.official-status {
  margin-bottom: 12px;
}

.official-alert,
.official-status {
  margin-top: 12px;
}

.json-preview {
  max-height: 260px;
  overflow: auto;
  padding: 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.25);
  color: var(--text-ink);
}

small {
  color: var(--text-fade);
}
</style>
