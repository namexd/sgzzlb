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

      <view class="simulation-config">
        <view>
          <view class="notice-title">模拟复核环境</view>
          <view class="muted">使用环境模板作为敌方阵容，模拟结果仅用于复核推荐稳定性。</view>
        </view>
        <view class="form-row compact">
          <picker :range="enemyTemplates" range-key="name" :value="enemyIndex" @change="onEnemyTemplateChange">
            <view class="select-field">{{ enemyTemplates[enemyIndex].name }}</view>
          </picker>
          <picker :range="iterationOptions" range-key="name" :value="iterationIndex" @change="onIterationChange">
            <view class="select-field">{{ iterationOptions[iterationIndex].name }}</view>
          </picker>
        </view>
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
        <view v-if="lineup.alternatives && lineup.alternatives.length" class="alternative-list">
          <view class="mini-title">替代建议</view>
          <view v-for="item in lineup.alternatives.slice(0, 3)" :key="item.id || item.name" class="alternative-item">
            <view>
              <text class="quality-badge">{{ item.quality || '建议' }}</text>
              <text>{{ item.name }}</text>
              <text class="muted"> · {{ formatAlternativeType(item.type) }}</text>
            </view>
            <view class="muted">{{ item.reason }}</view>
          </view>
        </view>
        <view v-if="coverageText(lineup.ruleCoverage)" class="coverage-panel">
          <view class="mini-title">评分规则覆盖</view>
          <view class="coverage-line">{{ coverageText(lineup.ruleCoverage) }}</view>
          <view v-if="coverageHasEstimate(lineup.ruleCoverage)" class="assumption-line">存在通用估算，推荐分仅用于排序参考。</view>
        </view>
        <view v-if="lineup.assumptions && lineup.assumptions.length" class="assumption-list">
          <view v-for="assumption in lineup.assumptions.slice(0, 2)" :key="assumption" class="assumption-line">{{ assumption }}</view>
        </view>
        <view v-if="simulationError(lineup)" class="error-line">{{ simulationError(lineup) }}</view>
        <view v-if="simulationResult(lineup)" class="simulation-result">
          <view class="mini-title">模拟复核</view>
          <view class="coverage-grid">
            <view class="coverage-item"><text>胜率</text><strong>{{ formatPercent(simulationResult(lineup).summary && simulationResult(lineup).summary.winRate) }}</strong></view>
            <view class="coverage-item"><text>场次</text><strong>{{ simulationResult(lineup).summary ? simulationResult(lineup).summary.iterations : '-' }}</strong></view>
            <view class="coverage-item"><text>稳定性</text><strong>{{ simulationResult(lineup).aggregate ? simulationResult(lineup).aggregate.stability : '-' }}</strong></view>
          </view>
          <view v-if="simulationResult(lineup).aggregate" class="muted">{{ simulationResult(lineup).aggregate.scoreSuggestion }}</view>
          <view v-if="simulationCoverageText(simulationResult(lineup).ruleCoverage)" class="coverage-line">模拟规则覆盖：{{ simulationCoverageText(simulationResult(lineup).ruleCoverage) }}</view>
          <view v-for="assumption in (simulationResult(lineup).assumptions || []).slice(0, 2)" :key="assumption" class="assumption-line">{{ assumption }}</view>
        </view>
        <view class="card-actions">
          <button class="mini-btn" @tap="saveRecommendation(lineup)">保存</button>
          <button class="mini-btn" @tap="goToAnalyze(lineup)">去评分</button>
          <button class="mini-btn" @tap="goToMatchup(lineup)">去对位</button>
          <button class="mini-btn" @tap="runLineupSimulation(lineup)">{{ simulationLoadingKey === lineupKey(lineup) ? '复核中' : '模拟复核' }}</button>
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
import { getGenerals, getTactics, isRemoteMode, optimizeAccountAsync, saveLineupAsync, simulateBattleAsync } from "../../services/api";
import SearchPicker from "../../components/search-picker.vue";

const SAVED_LINEUPS_KEY = "savedLineups";
const SCENARIOS = [
  { id: "pk", name: "PK赛季" },
  { id: "war", name: "打架环境" },
  { id: "pioneer", name: "开荒" }
];

const ENEMY_TEMPLATES = [
  { name: "太尉盾", troop: "盾兵", scenario: "pk", generals: ["司马懿", "曹操", "满宠"], tactics: ["士别三日", "用武通神", "魅惑", "抚辑军民", "锋矢阵", "刮骨疗毒"] },
  { name: "吴骑", troop: "骑兵", scenario: "war", generals: ["孙尚香", "凌统", "周泰"], tactics: ["裸衣血战", "虎踞鹰扬", "卧薪尝胆", "横扫千军", "盛气凌敌", "西凉铁骑"] },
  { name: "麒麟弓", troop: "弓兵", scenario: "pk", generals: ["姜维", "庞统", "诸葛亮"], tactics: ["夺魂挟魄", "杯蛇鬼车", "太平道法", "士别三日", "八门金锁阵", "婴城自守"] },
  { name: "关关张", troop: "枪兵", scenario: "war", generals: ["关羽", "关银屏", "张飞"], tactics: ["威谋靡亢", "箕形阵", "据水断桥", "青州兵", "横扫千军", "盛气凌敌"] },
  { name: "虎臣弓", troop: "弓兵", scenario: "pk", generals: ["甘宁", "太史慈", "程普"], tactics: ["万箭齐发", "避实击虚", "折冲御侮", "白马义从", "当锋摧决", "弯弓饮羽"] },
  { name: "三势吕", troop: "骑兵", scenario: "pk", generals: ["吕布", "郭嘉", "黄月英"], tactics: ["一骑当千", "暴戾无仁", "虎豹骑", "铁骑驱驰", "三势阵", "横戈跃马"] },
  { name: "桃园盾", troop: "盾兵", scenario: "war", generals: ["刘备", "关羽", "张飞"], tactics: ["陷阵营", "暂避其锋", "落凤", "横扫千军", "盛气凌敌", "刮骨疗毒"] }
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
      isRemote: false,
      enemyTemplates: ENEMY_TEMPLATES,
      enemyIndex: 0,
      iterationOptions: [
        { value: 20, name: "20 场" },
        { value: 50, name: "50 场" },
        { value: 100, name: "100 场" }
      ],
      iterationIndex: 0,
      simulationOptions: { maxRounds: 8 },
      simulationByLineupKey: {},
      simulationLoadingKey: "",
      simulationErrorByLineupKey: {}
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
    onEnemyTemplateChange(event) {
      this.enemyIndex = Number(event.detail.value);
    },
    onIterationChange(event) {
      this.iterationIndex = Number(event.detail.value);
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
        this.simulationByLineupKey = {};
        this.simulationErrorByLineupKey = {};
        this.loading = false;
      }).catch((error) => {
        this.loading = false;
        this.errorMsg = error.message || "生成配将建议失败";
      });
    },

    formatAlternativeType(type) {
      if (type === "tactic" || type === "战法") return "战法";
      if (type === "general" || type === "武将") return "武将";
      return type || "建议";
    },
    normalizeCoverage(coverage = {}) {
      return {
        explicit: Number(coverage.explicit || 0),
        estimated: Number(coverage.estimated || coverage.fallback || 0),
        missed: Number(coverage.missed || 0)
      };
    },
    coverageText(coverage) {
      if (!coverage) return "";
      const value = this.normalizeCoverage(coverage);
      if (!value.explicit && !value.estimated && !value.missed) return "";
      return `显式 ${value.explicit} · 估算 ${value.estimated} · 未覆盖 ${value.missed}`;
    },
    coverageHasEstimate(coverage) {
      const value = this.normalizeCoverage(coverage || {});
      return value.estimated > 0 || value.missed > 0;
    },
    simulationCoverageText(coverage) {
      return this.coverageText(coverage);
    },
    formatPercent(value) {
      if (value === undefined || value === null || Number.isNaN(Number(value))) return "-";
      const number = Number(value);
      return number <= 1 ? `${Math.round(number * 100)}%` : `${Math.round(number)}%`;
    },
    lineupKey(lineup) {
      return [lineup.rank || lineup.priority || 0, ...(lineup.generalIds || []), ...(lineup.tacticIds || [])].join("_");
    },
    simulationResult(lineup) {
      return this.simulationByLineupKey[this.lineupKey(lineup)] || null;
    },
    simulationError(lineup) {
      return this.simulationErrorByLineupKey[this.lineupKey(lineup)] || "";
    },
    idsByNames(items, names) {
      return (names || []).map((name) => {
        const item = items.find((entry) => entry.name === name || entry.id === name);
        return item ? item.id : "";
      }).filter(Boolean);
    },
    lineupToBattleInput(lineup) {
      return {
        troop: lineup.troop || "骑兵",
        scenario: lineup.scenario || this.scenarios[this.scenarioIndex].id,
        generalIds: (lineup.generalIds || []).slice(0, 3),
        tacticIds: (lineup.tacticIds || []).slice(0, 6),
        redLevels: [0, 0, 0]
      };
    },
    templateToBattleInput(template) {
      return {
        troop: template.troop || "骑兵",
        scenario: template.scenario || this.scenarios[this.scenarioIndex].id,
        generalIds: this.idsByNames(this.generals, template.generals).slice(0, 3),
        tacticIds: this.idsByNames(this.tactics, template.tactics).slice(0, 6),
        redLevels: [0, 0, 0]
      };
    },
    buildSimulationPayload(lineup) {
      const ctx = this.result && this.result.catalogContext ? this.result.catalogContext : {};
      return {
        own: this.lineupToBattleInput(lineup),
        enemy: this.templateToBattleInput(this.enemyTemplates[this.enemyIndex]),
        iterations: this.iterationOptions[this.iterationIndex].value,
        season: ctx.seasonKey || ctx.season || this.scenarios[this.scenarioIndex].id,
        catalogVersionId: ctx.catalogVersionId || "",
        options: { maxRounds: this.simulationOptions.maxRounds }
      };
    },
    runLineupSimulation(lineup) {
      const key = this.lineupKey(lineup);
      const payload = this.buildSimulationPayload(lineup);
      if (payload.own.generalIds.length < 3 || payload.own.tacticIds.length < 6) {
        this.simulationErrorByLineupKey = { ...this.simulationErrorByLineupKey, [key]: "推荐阵容资料不完整，无法模拟复核。" };
        return;
      }
      if (payload.enemy.generalIds.length < 3 || payload.enemy.tacticIds.length < 6) {
        this.simulationErrorByLineupKey = { ...this.simulationErrorByLineupKey, [key]: "当前环境模板资料不完整，无法模拟复核。" };
        return;
      }
      this.simulationLoadingKey = key;
      this.simulationErrorByLineupKey = { ...this.simulationErrorByLineupKey, [key]: "" };
      simulateBattleAsync(payload).then((result) => {
        this.simulationLoadingKey = "";
        this.simulationByLineupKey = { ...this.simulationByLineupKey, [key]: result };
      }).catch((error) => {
        this.simulationLoadingKey = "";
        this.simulationErrorByLineupKey = { ...this.simulationErrorByLineupKey, [key]: error.message || "模拟复核失败" };
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

.simulation-config,
.coverage-panel,
.simulation-result,
.alternative-list,
.assumption-list {
  margin-top: var(--sp-md);
  padding: var(--sp-md);
  border-radius: var(--r-md);
  background: rgba(0, 0, 0, 0.18);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}

.form-row.compact {
  margin-top: var(--sp-sm);
  justify-content: flex-start;
  flex-wrap: wrap;
}

.mini-title {
  color: #f6d58d;
  font-size: 24rpx;
  font-weight: 700;
  margin-bottom: 10rpx;
}

.alternative-item {
  padding: 10rpx 0;
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
  color: #fff;
  font-size: 24rpx;
}

.quality-badge {
  display: inline-block;
  margin-right: 10rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(214, 168, 93, 0.22);
  color: #f6d58d;
  font-size: 20rpx;
}

.coverage-line,
.assumption-line {
  color: var(--text-stone);
  font-size: 23rpx;
  line-height: 1.6;
}

.coverage-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10rpx;
  margin: 12rpx 0;
}

.coverage-item {
  padding: 12rpx;
  border-radius: var(--r-sm);
  background: rgba(255, 255, 255, 0.07);
  text-align: center;
}

.coverage-item text {
  display: block;
  color: var(--text-stone);
  font-size: 20rpx;
}

.coverage-item strong {
  display: block;
  color: #f6d58d;
  font-size: 26rpx;
}

</style>
