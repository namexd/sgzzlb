<template>
  <view class="page recommend-page">
    <view class="recommend-bg"></view>

    <view class="recommend-header">
      <view class="back-btn" @tap="goBack">‹</view>
      <view>
        <view class="page-title">智能配将</view>
        <view class="page-subtitle">库存推荐 · 共存阵容 · 可解释评分</view>
      </view>
      <view class="mode-pill">{{ isRemote ? '远程资料' : '本地估算' }}</view>
    </view>

    <view class="panel">
      <view class="panel-title">库存与偏好</view>
      <view class="form-row">
        <picker :range="targetOptions" range-key="name" :value="targetIndex" @change="onTargetChange">
          <view class="select-field">目标队数：{{ targetOptions[targetIndex].name }}</view>
        </picker>
        <picker :range="scenarios" range-key="name" :value="scenarioIndex" @change="onScenarioChange">
          <view class="select-field">{{ scenarios[scenarioIndex].name }}</view>
        </picker>
      </view>
      <view class="troop-options">
        <view
          v-for="(troop, index) in troopOptions"
          :key="troop.value"
          :class="['troop-chip', { active: troopIndex === index }]"
          @tap="troopIndex = index"
        >{{ troop.name }}</view>
      </view>
    </view>

    <view class="panel">
      <view class="section-head">
        <text>武将库存</text>
        <text>{{ selectedGeneralIds.length }} / 至少 3</text>
      </view>
      <view class="chip-list">
        <view v-for="id in selectedGeneralIds" :key="id" class="pick-chip" @tap="removeGeneral(id)">
          {{ generalName(id) }} ×
        </view>
        <view class="pick-chip add" @tap="openPicker('generals')">＋ 添加武将</view>
      </view>
    </view>

    <view class="panel">
      <view class="section-head">
        <text>战法库存</text>
        <text>{{ selectedTacticIds.length }} / 至少 6</text>
      </view>
      <view class="chip-list tactic-list">
        <view v-for="id in selectedTacticIds" :key="id" class="pick-chip" @tap="removeTactic(id)">
          {{ tacticName(id) }} ×
        </view>
        <view class="pick-chip add" @tap="openPicker('tactics')">＋ 添加战法</view>
      </view>
    </view>

    <view class="action-panel">
      <button class="primary-btn" :disabled="loading" @tap="generateRecommendations">
        {{ loading ? '正在生成...' : '生成配将建议' }}
      </button>
      <view v-if="inputHint" class="hint">{{ inputHint }}</view>
      <view v-if="errorMsg" class="error-line">{{ errorMsg }}</view>
    </view>

    <view v-if="result" class="result-panel">
      <view class="result-summary">
        <view>
          <view class="panel-title">推荐结果</view>
          <view class="muted">{{ result.message }}</view>
        </view>
        <view class="score-badge">{{ result.summary ? result.summary.averageScore : '-' }}</view>
      </view>

      <view v-for="lineup in result.lineups" :key="lineup.rank || lineup.priority" class="lineup-card">
        <view class="lineup-top">
          <view>
            <view class="lineup-title">{{ lineup.role || ('第 ' + (lineup.rank || lineup.priority) + ' 队') }}</view>
            <view class="lineup-sub">{{ lineup.troop }} · {{ lineup.confidence || '中' }}可信</view>
          </view>
          <view class="lineup-score">{{ lineup.score }}</view>
        </view>
        <view class="name-grid">
          <view v-for="name in lineup.generals" :key="name" class="name-cell general">{{ name }}</view>
        </view>
        <view class="name-grid tactic-grid">
          <view v-for="name in lineup.tactics" :key="name" class="name-cell">{{ name }}</view>
        </view>
        <view v-if="lineup.reasons && lineup.reasons.length" class="info-list">
          <view v-for="reason in lineup.reasons.slice(0, 2)" :key="reason">· {{ reason }}</view>
        </view>
        <view v-if="lineup.weaknesses && lineup.weaknesses.length" class="weakness-list">
          <view v-for="weakness in lineup.weaknesses.slice(0, 2)" :key="weakness">短板：{{ weakness }}</view>
        </view>
        <view class="card-actions">
          <button class="mini-btn" @tap="saveRecommendation(lineup)">保存</button>
          <button class="mini-btn" @tap="goToAnalyze(lineup)">去评分</button>
          <button class="mini-btn" @tap="goToMatchup(lineup)">去对位</button>
          <button class="mini-btn accent" @tap="goToSimulation(lineup)">战报模拟</button>
        </view>
      </view>

      <view v-if="result.warnings && result.warnings.length" class="notice-box">
        <view class="notice-title">提示</view>
        <view v-for="warning in result.warnings" :key="warning">{{ warning }}</view>
      </view>
      <view v-if="result.conflicts && result.conflicts.length" class="notice-box">
        <view class="notice-title">冲突</view>
        <view v-for="conflict in result.conflicts" :key="conflict.tacticName">{{ conflict.tacticName }}：{{ conflict.usedBy.join('、') }}</view>
      </view>
      <view v-if="unusedText" class="notice-box">
        <view class="notice-title">未使用库存</view>
        <view>{{ unusedText }}</view>
      </view>
      <view v-if="catalogContextText" class="catalog-line">资料版本：{{ catalogContextText }}</view>
    </view>

    <SearchPicker
      :visible="pickerVisible"
      :type="pickerType"
      :selected-id="''"
      :exclude-ids="pickerExcludeIds"
      @select="onPickerSelect"
      @close="pickerVisible = false"
    />
  </view>
</template>

<script>
import catalog from "../../utils/catalog";
import { getStorage, setStorage } from "../../utils/storage";
import { getGenerals, getTactics, isRemoteMode, optimizeAccountAsync, saveLineupAsync } from "../../services/api";
import SearchPicker from "../../components/search-picker.vue";

const SAVED_LINEUPS_KEY = "savedLineups";
const SCENARIOS = [
  { id: "pk", name: "PK赛季" },
  { id: "war", name: "打架环境" },
  { id: "pioneer", name: "开荒" }
];

export default {
  components: { SearchPicker },
  data() {
    return {
      generals: [],
      tactics: [],
      selectedGeneralIds: [],
      selectedTacticIds: [],
      targetOptions: [
        { value: 1, name: "1 队" },
        { value: 2, name: "2 队" },
        { value: 3, name: "3 队" }
      ],
      targetIndex: 0,
      scenarios: SCENARIOS,
      scenarioIndex: 0,
      troopOptions: [
        { value: "", name: "不限" },
        { value: "骑兵", name: "骑兵" },
        { value: "盾兵", name: "盾兵" },
        { value: "弓兵", name: "弓兵" },
        { value: "枪兵", name: "枪兵" }
      ],
      troopIndex: 0,
      result: null,
      loading: false,
      errorMsg: "",
      pickerVisible: false,
      pickerType: "generals",
      isRemote: false
    };
  },
  computed: {
    inputHint() {
      if (this.selectedGeneralIds.length < 3) return "至少选择 3 名武将后才能生成推荐。";
      if (this.selectedTacticIds.length < 6) return "至少选择 6 个战法后才能生成推荐。";
      return "推荐结果为规则估算，可继续进入评分、对位和战报模拟复核。";
    },
    pickerExcludeIds() {
      return this.pickerType === "generals" ? this.selectedGeneralIds : this.selectedTacticIds;
    },
    unusedText() {
      const unused = this.result && this.result.unused;
      if (!unused) return "";
      const generals = (unused.generals || []).map((item) => item.name).slice(0, 6);
      const tactics = (unused.tactics || []).map((item) => item.name).slice(0, 8);
      const parts = [];
      if (generals.length) parts.push(`武将：${generals.join('、')}`);
      if (tactics.length) parts.push(`战法：${tactics.join('、')}`);
      return parts.join("；");
    },
    catalogContextText() {
      const ctx = this.result && this.result.catalogContext;
      if (!ctx) return "本地静态资料";
      return [ctx.season || ctx.seasonKey, ctx.versionKey || ctx.catalogVersionId, ctx.status].filter(Boolean).join(" · ");
    }
  },
  onLoad() {
    this.isRemote = isRemoteMode();
    this.loadCatalog();
  },
  onShow() {
    this.isRemote = isRemoteMode();
  },
  methods: {
    loadCatalog() {
      this.generals = catalog.getGenerals();
      this.tactics = catalog.getAllTactics();
      getGenerals().then((items) => { if (Array.isArray(items) && items.length) this.generals = items; }).catch(() => {});
      getTactics().then((items) => { if (Array.isArray(items) && items.length) this.tactics = items; }).catch(() => {});
    },
    onTargetChange(event) {
      this.targetIndex = Number(event.detail.value);
    },
    onScenarioChange(event) {
      this.scenarioIndex = Number(event.detail.value);
    },
    openPicker(type) {
      this.pickerType = type;
      this.pickerVisible = true;
    },
    onPickerSelect(item) {
      const id = item && item.id;
      if (!id) return;
      if (this.pickerType === "generals" && !this.selectedGeneralIds.includes(id)) this.selectedGeneralIds.push(id);
      if (this.pickerType === "tactics" && !this.selectedTacticIds.includes(id)) this.selectedTacticIds.push(id);
      this.pickerVisible = false;
      this.result = null;
    },
    removeGeneral(id) {
      this.selectedGeneralIds = this.selectedGeneralIds.filter((item) => item !== id);
      this.result = null;
    },
    removeTactic(id) {
      this.selectedTacticIds = this.selectedTacticIds.filter((item) => item !== id);
      this.result = null;
    },
    generalName(id) {
      const item = this.generals.find((g) => g.id === id) || catalog.findGeneralById(id);
      return item ? item.name : id;
    },
    tacticName(id) {
      const item = this.tactics.find((t) => t.id === id) || catalog.findTacticById(id);
      return item ? item.name : id;
    },
    generateRecommendations() {
      this.errorMsg = "";
      if (this.selectedGeneralIds.length < 3 || this.selectedTacticIds.length < 6) {
        uni.showToast({ title: this.inputHint, icon: "none" });
        return;
      }
      this.loading = true;
      const preferredTroop = this.troopOptions[this.troopIndex].value;
      optimizeAccountAsync({
        generalIds: this.selectedGeneralIds,
        tacticIds: this.selectedTacticIds,
        targetLineupCount: this.targetOptions[this.targetIndex].value,
        scenario: this.scenarios[this.scenarioIndex].id,
        options: { preferredTroop }
      }).then((result) => {
        this.result = result;
        this.loading = false;
      }).catch((error) => {
        this.loading = false;
        this.errorMsg = error.message || "生成配将建议失败";
      });
    },
    buildSavedLineup(lineup) {
      return {
        id: `recommend_${Date.now()}_${lineup.rank || lineup.priority || 1}`,
        createdAt: new Date().toISOString(),
        name: `智能配将${lineup.rank || lineup.priority || ''}`,
        source: "recommendation",
        scenario: this.scenarios[this.scenarioIndex].name,
        scenarioId: this.scenarios[this.scenarioIndex].id,
        troop: lineup.troop,
        score: lineup.score,
        generals: lineup.generals || [],
        generalIds: lineup.generalIds || [],
        tactics: lineup.tactics || [],
        tacticIds: lineup.tacticIds || [],
        catalogContext: this.result ? this.result.catalogContext : null
      };
    },
    saveRecommendation(lineup) {
      const item = this.buildSavedLineup(lineup);
      const saved = getStorage(SAVED_LINEUPS_KEY) || [];
      setStorage(SAVED_LINEUPS_KEY, [item, ...saved.filter((old) => old.id !== item.id)]);
      if (this.isRemote) saveLineupAsync({ lineup: item }).catch(() => {});
      uni.showToast({ title: "已保存", icon: "success" });
      return item;
    },
    goToAnalyze(lineup) {
      setStorage("pendingAnalyzeLineup", this.buildSavedLineup(lineup));
      uni.switchTab({ url: "/pages/analyze/index" });
    },
    goToMatchup(lineup) {
      const item = this.saveRecommendation(lineup);
      setStorage("pendingMatchupLineup", item);
      setStorage("pendingMatchupAction", "preview");
      uni.switchTab({ url: "/pages/matchup/index" });
    },
    goToSimulation(lineup) {
      const item = this.saveRecommendation(lineup);
      setStorage("pendingMatchupLineup", item);
      setStorage("pendingMatchupAction", "simulate");
      uni.switchTab({ url: "/pages/matchup/index" });
    },
    goBack() {
      uni.navigateBack({ fail: () => uni.switchTab({ url: "/pages/account/index" }) });
    }
  }
};
</script>

<style scoped>
.recommend-page {
  min-height: 100vh;
  padding: var(--sp-lg);
  padding-bottom: 80rpx;
  background: linear-gradient(135deg, #0c0f14 0%, #1a1a2e 52%, #0a1628 100%);
  color: #fff;
}

.recommend-bg {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at 50% 18%, rgba(214, 168, 93, 0.14), transparent 45%), radial-gradient(circle at 20% 85%, rgba(99, 102, 241, 0.12), transparent 45%);
  pointer-events: none;
}

.recommend-header,
.panel,
.action-panel,
.result-panel,
.lineup-card,
.notice-box {
  position: relative;
  z-index: 1;
}

.recommend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp-lg);
}

.back-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  text-align: center;
  line-height: 58rpx;
  font-size: 54rpx;
  color: #f6d58d;
}

.page-title {
  font-size: 40rpx;
  font-weight: 800;
}

.page-subtitle,
.muted,
.hint,
.catalog-line {
  color: var(--text-stone);
  font-size: 24rpx;
}

.mode-pill,
.score-badge,
.lineup-score {
  color: #2b1b05;
  background: linear-gradient(135deg, #f5d27a, #d6a85d);
  border-radius: 999rpx;
  padding: 10rpx 18rpx;
  font-weight: 700;
}

.panel,
.action-panel,
.result-panel,
.lineup-card,
.notice-box {
  margin-bottom: var(--sp-md);
  padding: var(--sp-lg);
  border-radius: var(--r-lg);
  background: rgba(255, 255, 255, 0.07);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 12rpx 40rpx rgba(0, 0, 0, 0.22);
}

.panel-title,
.lineup-title,
.notice-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #f6d58d;
}

.form-row,
.result-summary,
.lineup-top,
.section-head,
.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-sm);
}

.select-field {
  min-width: 220rpx;
  padding: 18rpx 22rpx;
  border-radius: var(--r-md);
  background: rgba(0, 0, 0, 0.24);
  color: #fff;
  font-size: 26rpx;
}

.troop-options,
.chip-list,
.name-grid,
.info-list,
.weakness-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: var(--sp-md);
}

.troop-chip,
.pick-chip,
.name-cell {
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 24rpx;
}

.troop-chip.active,
.pick-chip.add,
.name-cell.general {
  background: rgba(214, 168, 93, 0.22);
  color: #f6d58d;
  border: 1rpx solid rgba(214, 168, 93, 0.38);
}

.tactic-list .pick-chip,
.tactic-grid .name-cell {
  border-radius: var(--r-sm);
}

.primary-btn,
.mini-btn {
  border: 0;
  color: #2b1b05;
  background: linear-gradient(135deg, #f5d27a, #d6a85d);
  font-weight: 700;
}

.primary-btn {
  width: 100%;
  border-radius: 999rpx;
}

.mini-btn {
  margin: 0;
  padding: 0 18rpx;
  height: 58rpx;
  line-height: 58rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
}

.mini-btn.accent {
  background: linear-gradient(135deg, #7dd3fc, #60a5fa);
}

.error-line,
.weakness-list {
  color: #fca5a5;
  font-size: 24rpx;
  margin-top: var(--sp-sm);
}

.lineup-sub,
.info-list,
.notice-box {
  color: var(--text-stone);
  font-size: 24rpx;
}

.lineup-score {
  min-width: 88rpx;
  text-align: center;
}
</style>
