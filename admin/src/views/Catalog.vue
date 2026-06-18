<template>
  <div class="catalog-page">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>武将 ({{ generals.length }})</span>
              <el-input v-model="generalSearch" placeholder="搜索武将" clearable style="width: 200px" />
            </div>
          </template>
          <el-table :data="filteredGenerals" style="width: 100%" max-height="400" v-loading="loading">
            <el-table-column prop="name" label="名称" width="100" />
            <el-table-column prop="quality" label="品质" width="60">
              <template #default="{ row }">
                <el-tag :type="row.quality === '橙' ? 'warning' : row.quality === '紫' ? '' : 'info'" size="small">
                  {{ row.quality }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="camp" label="阵营" width="60" />
            <el-table-column prop="type" label="兵种" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>战法 ({{ tactics.length }})</span>
              <el-input v-model="tacticSearch" placeholder="搜索战法" clearable style="width: 200px" />
            </div>
          </template>
          <el-table :data="filteredTactics" style="width: 100%" max-height="400" v-loading="loading">
            <el-table-column prop="name" label="名称" width="120" />
            <el-table-column prop="quality" label="品质" width="60">
              <template #default="{ row }">
                <el-tag :type="row.quality === '橙' ? 'warning' : row.quality === '紫' ? '' : 'info'" size="small">
                  {{ row.quality }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="type" label="类型" width="80" />
            <el-table-column prop="description" label="描述" show-overflow-tooltip />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>装备 ({{ equipment.length }})</span>
              <el-input v-model="equipmentSearch" placeholder="搜索装备" clearable style="width: 200px" />
            </div>
          </template>
          <el-table :data="filteredEquipment" style="width: 100%" max-height="400" v-loading="loading">
            <el-table-column prop="name" label="名称" width="120" />
            <el-table-column prop="quality" label="品质" width="60">
              <template #default="{ row }">
                <el-tag :type="row.quality === '橙' ? 'warning' : row.quality === '紫' ? '' : 'info'" size="small">
                  {{ row.quality }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="type" label="类型" width="80" />
            <el-table-column prop="description" label="描述" show-overflow-tooltip />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>兵种战法 ({{ troopTactics.length }})</span>
              <el-input v-model="troopTacticSearch" placeholder="搜索兵种战法" clearable style="width: 200px" />
            </div>
          </template>
          <el-table :data="filteredTroopTactics" style="width: 100%" max-height="400" v-loading="loading">
            <el-table-column prop="name" label="名称" width="120" />
            <el-table-column prop="quality" label="品质" width="60">
              <template #default="{ row }">
                <el-tag :type="row.quality === '橙' ? 'warning' : row.quality === '紫' ? '' : 'info'" size="small">
                  {{ row.quality }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="troop" label="兵种" width="80" />
            <el-table-column prop="description" label="描述" show-overflow-tooltip />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { getGenerals, getTactics, getEquipment, getTroopTactics } from "../api";
import { ElMessage } from "element-plus";

const loading = ref(false);
const generals = ref([]);
const tactics = ref([]);
const equipment = ref([]);
const troopTactics = ref([]);
const generalSearch = ref("");
const tacticSearch = ref("");
const equipmentSearch = ref("");
const troopTacticSearch = ref("");

const filteredGenerals = computed(() => {
  if (!generalSearch.value) return generals.value;
  const kw = generalSearch.value.toLowerCase();
  return generals.value.filter((g) => g.name?.toLowerCase().includes(kw));
});

const filteredTactics = computed(() => {
  if (!tacticSearch.value) return tactics.value;
  const kw = tacticSearch.value.toLowerCase();
  return tactics.value.filter((t) => t.name?.toLowerCase().includes(kw));
});

const filteredEquipment = computed(() => {
  if (!equipmentSearch.value) return equipment.value;
  const kw = equipmentSearch.value.toLowerCase();
  return equipment.value.filter((e) => e.name?.toLowerCase().includes(kw));
});

const filteredTroopTactics = computed(() => {
  if (!troopTacticSearch.value) return troopTactics.value;
  const kw = troopTacticSearch.value.toLowerCase();
  return troopTactics.value.filter((t) => t.name?.toLowerCase().includes(kw));
});

onMounted(async () => {
  loading.value = true;
  try {
    const [genRes, tacRes, eqRes, ttRes] = await Promise.all([
      getGenerals({ pageSize: 500 }),
      getTactics({ pageSize: 500 }),
      getEquipment({ pageSize: 500 }),
      getTroopTactics({ pageSize: 500 })
    ]);
    generals.value = genRes.items || genRes || [];
    tactics.value = tacRes.items || tacRes || [];
    equipment.value = eqRes.items || eqRes || [];
    troopTactics.value = ttRes.items || ttRes || [];
  } catch (e) {
    ElMessage.error("加载失败：" + e.message);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
