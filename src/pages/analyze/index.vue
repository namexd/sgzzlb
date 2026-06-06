<template>
  <view class="page analyze-page">
    <view class="analyze-bg"></view>

    <view class="lineup-header">
      <view class="back-btn" @tap="goToFeedback">‹</view>
      <view class="header-center">
        <view class="page-title">阵容配置</view>
        <view class="page-subtitle">LINEUP</view>
      </view>
      <view class="share-btn" @tap="saveLineup">阵容分享</view>
    </view>

    <view class="selector-panel">
      <picker :range="scenarios" range-key="name" :value="scenarioIndex" @change="onScenarioChange">
        <view class="select-field">{{ currentScenarioName }}</view>
      </picker>
      <view class="troop-options">
        <view
          v-for="(t, idx) in troops"
          :key="t"
          :class="['troop-chip', { active: troopIndex === idx }]"
          @tap="onTroopChange({ detail: { value: idx } })"
        >{{ t }}</view>
      </view>
    </view>

    <view class="section-title">当前阵容</view>
    <view class="lineup-cards">
      <view v-for="(general, slot) in selectedGeneralsView" :key="general.id" :class="['lineup-card', 'slot-' + slot]" @tap="openGeneralPicker(slot)">
        <view v-if="!general.cardImageUrl" class="cost-badge">御{{ general.cost || '-' }}</view>
        <image v-if="general.cardImageUrl" class="general-card-img" :src="general.cardImageUrl" mode="aspectFit" />
        <view v-else class="general-card-placeholder">
          <text class="placeholder-initial">{{ general.name[0] }}</text>
        </view>
        <view v-if="!general.cardImageUrl" class="card-shade">
          <view class="faction-line">{{ general.faction || '群' }}</view>
          <view class="general-name">{{ general.name }}</view>
          <view class="star-row">
            <text v-for="star in 5" :key="star">●</text>
          </view>
          <view class="level-text">50级</view>
          <view class="arms-row">
            <text>骑{{ general.arms.cavalry || '-' }}</text>
            <text>盾{{ general.arms.shield || '-' }}</text>
            <text>弓{{ general.arms.bow || '-' }}</text>
          </view>
        </view>
      </view>
      <view class="swap-btn swap-0" @tap.stop="swapGenerals(0, 1)">
        <text class="swap-icon">↔</text>
      </view>
      <view class="swap-btn swap-1" @tap.stop="swapGenerals(1, 2)">
        <text class="swap-icon">↔</text>
      </view>
    </view>

    <view class="section-panel tactic-panel">
      <view class="section-title inline">战法配置</view>
      <view class="tactic-grid">
        <view v-for="group in tacticsByGeneral" :key="group.general.id" class="tactic-column">
          <view class="tactic-heading">{{ group.general.name }}战法</view>
          <view class="tactic-row innate">
            <view class="tactic-dot"></view>
            <text>{{ group.general.tactics.innate || '自带战法' }}</text>
            <text class="grade">S</text>
          </view>
          <view
            v-for="tacticSlot in group.general.tacticSlots"
            :key="tacticSlot.slot"
            class="tactic-row"
            @tap="openTacticPicker(tacticSlot.slot)"
          >
            <view class="tactic-dot"></view>
            <text>{{ tacticSlot.tactic ? tacticSlot.tactic.name : '选择战法' }}</text>
            <text class="grade">{{ tacticSlot.tactic && tacticSlot.tactic.quality ? tacticSlot.tactic.quality : 'A' }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section-panel bonus-panel">
      <view class="section-title inline">阵容加成</view>
      <view class="bonus-row">
        <view v-for="item in lineupBonuses" :key="item.name" class="bonus-item">
          <view class="bonus-mark">{{ item.mark }}</view>
          <view>
            <view class="bonus-name">{{ item.name }}</view>
            <view :class="['bonus-status', { active: item.active }]">{{ item.active ? '激活' : '未激活' }}</view>
          </view>
        </view>
      </view>
    </view>

    <view class="section-panel overview-panel">
      <view class="section-title inline">阵容总览</view>
      <view class="overview-grid">
        <view v-for="item in overviewMetrics" :key="item.label" class="overview-item">
          <view class="overview-label">{{ item.label }}</view>
          <view class="overview-value">{{ item.value }}</view>
        </view>
      </view>
    </view>

    <view v-if="apiStatus" class="api-message">{{ apiStatus }}</view>
    <view v-if="savedMessage" class="saved-message">{{ savedMessage }}</view>

    <view class="action-row">
      <button class="primary-cta" :loading="isAnalyzing" :disabled="isAnalyzing" @tap="analyze">开始评分</button>
      <button class="save-cta" :disabled="!report" @tap="saveLineup">保存阵容</button>
    </view>

    <view v-if="report" class="report-panel">
      <view class="report-score">{{ report.totalScore }}</view>
      <view class="report-meta">{{ report.scenarioName }} · {{ report.troop }} · 可信度 {{ report.confidence }}</view>
      <view v-for="(dim, idx) in report.dimensions" :key="idx" class="dimension">
        <view class="row-between">
          <text>{{ dim.label }}</text>
          <text>{{ dim.score }}</text>
        </view>
        <view class="bar">
          <view class="bar-inner" :style="{ width: dim.score + '%' }"></view>
        </view>
      </view>
    </view>

    <search-picker
      :type="pickerType"
      :selected-id="pickerSelectedId"
      :visible="pickerVisible"
      @select="onPickerSelect"
      @close="closePicker"
    />
  </view>
</template>

<script>
import catalog from "../../utils/catalog";
import { getEntitlements } from "../../utils/subscription";
import { getOriginalCardStyle, getCardImageUrl } from "../../utils/assetPolicy";
import { analyzeLineupAsync, isRemoteMode, saveLineupAsync } from "../../services/api";
import { getStorage, setStorage } from "../../utils/storage";
import SearchPicker from "../../components/search-picker.vue";

const SCENARIOS = [
  { id: "pk", name: "PK赛季" },
  { id: "war", name: "打架" },
  { id: "pioneer", name: "开荒" }
];

const SAVED_LINEUPS_KEY = "savedLineups";

export default {
  components: { SearchPicker },

  data() {
    return {
      scenarios: SCENARIOS,
      scenarioIndex: 0,
      troops: ["骑兵", "盾兵", "弓兵", "枪兵", "器械"],
      troopIndex: 0,
      generals: [],
      tactics: [],
      selectedGeneralIndexes: [0, 1, 2],
      selectedTacticIndexes: [0, 1, 2, 3, 4, 5],
      redLevels: [0, 0, 0],
      selectedGeneralsView: [],
      selectedTacticsView: [],
      entitlements: { tier: "free" },
      report: null,
      visibleReplacements: [],
      isAnalyzing: false,
      apiStatus: "",
      savedMessage: "",
      pickerVisible: false,
      pickerType: "generals",
      pickerSlot: -1,
      pickerSelectedId: ""
    };
  },

  computed: {
    currentScenarioName() {
      return this.scenarios[this.scenarioIndex] ? this.scenarios[this.scenarioIndex].name : "PK赛季";
    },

    currentTroopName() {
      return this.troops[this.troopIndex] || "骑兵";
    },

    tacticsByGeneral() {
      return this.selectedGeneralsView.map((general) => ({ general }));
    },

    totalCost() {
      return this.selectedGeneralsView.reduce((sum, general) => sum + (Number(general.cost) || 0), 0);
    },

    lineupPower() {
      if (this.report && this.report.totalScore) return this.report.totalScore;
      return 26000 + this.selectedGeneralsView.length * 850 + this.totalCost * 300;
    },

    lineupBonuses() {
      const factions = this.selectedGeneralsView.map((item) => item.faction).filter(Boolean);
      const factionSet = new Set(factions);
      return [
        { name: "同阵营", mark: factions[0] || "阵", active: factionSet.size === 1 && factions.length === 3 },
        { name: "统御均衡", mark: "御", active: this.totalCost <= 20 },
        { name: "兵种契合", mark: "兵", active: this.currentTroopName !== "器械" }
      ];
    },

    overviewMetrics() {
      return [
        { label: "总兵力", value: this.lineupPower },
        { label: "统御值", value: `${this.totalCost}/20` },
        { label: "总战法加成", value: this.report ? "已评分" : "待评分" },
        { label: "攻城值", value: this.currentTroopName === "器械" ? 180 : 136 },
        { label: "行军速度", value: this.currentTroopName === "骑兵" ? 132 : 120 },
        { label: "战斗评分", value: this.report ? "S+" : "A+" }
      ];
    }
  },

  onLoad() {
    this.generals = catalog.getGenerals();
    this.tactics = catalog.getAllTactics();
    this.selectedGeneralIndexes = this.makeDefaultGeneralIndexes(this.generals);
    this.selectedTacticIndexes = this.makeDefaultTacticIndexes(this.tactics, this.generals, this.selectedGeneralIndexes);
    this.entitlements = getEntitlements();
    this.refreshSelection();
  },

  onShow() {
    this.entitlements = getEntitlements();
    if (this.report) {
      this.updateVisibleReplacements(this.report);
    }
  },

  methods: {
    makeDefaultGeneralIndexes(generals) {
      const names = ["赵云", "诸葛亮", "周瑜"];
      return names.map((name, fallback) => {
        const index = generals.findIndex((item) => item.name === name);
        return index >= 0 ? index : fallback;
      });
    },

    makeDefaultTacticIndexes(tactics, generals, generalIndexes) {
      const selectedGenerals = generalIndexes.map((index) => generals[index]).filter(Boolean);
      const tacticNames = selectedGenerals.flatMap((general) => [
        general.tactics && general.tactics.innate,
        general.tactics && general.tactics.inherited
      ]);
      return Array.from({ length: 6 }, (_, index) => {
        const wanted = tacticNames[index];
        const found = tactics.findIndex((item) => item.name === wanted);
        return found >= 0 ? found : index;
      });
    },

    refreshSelection() {
      const selectedTacticsView = this.selectedTacticIndexes.map((index) => this.tactics[index]);
      const selectedGeneralsView = this.selectedGeneralIndexes.map((index, slot) => {
        const general = this.generals[index];
        if (!general) return null;
        return {
          ...general,
          slot,
          red: this.redLevels[slot],
          tagText: general.tags && general.tags.length ? general.tags.join(" / ") : "未标记",
          card: getOriginalCardStyle(general),
          cardImageUrl: getCardImageUrl(general),
          tacticSlots: [0, 1].map((offset) => {
            const tacticSlot = slot * 2 + offset;
            return {
              slot: tacticSlot,
              selectedIndex: this.selectedTacticIndexes[tacticSlot],
              tactic: selectedTacticsView[tacticSlot]
            };
          })
        };
      });
      this.selectedGeneralsView = selectedGeneralsView.filter(Boolean);
      this.selectedTacticsView = selectedTacticsView;
    },

    onScenarioChange(event) {
      this.scenarioIndex = Number(event.detail.value);
      this.report = null;
    },

    onTroopChange(event) {
      this.troopIndex = Number(event.detail.value);
      this.report = null;
      this.refreshSelection();
    },

    openGeneralPicker(slot) {
      const currentId = this.generals[this.selectedGeneralIndexes[slot]]?.id || "";
      this.pickerType = "generals";
      this.pickerSlot = slot;
      this.pickerSelectedId = currentId;
      this.pickerVisible = true;
    },

    openTacticPicker(slot) {
      const currentId = this.tactics[this.selectedTacticIndexes[slot]]?.id || "";
      this.pickerType = "tactics";
      this.pickerSlot = slot;
      this.pickerSelectedId = currentId;
      this.pickerVisible = true;
    },

    onPickerSelect(e) {
      const id = e.id;
      const slot = this.pickerSlot;
      const type = this.pickerType;

      if (type === "generals") {
        const index = this.generals.findIndex((g) => g.id === id);
        if (index < 0) return;
        const updated = [...this.selectedGeneralIndexes];
        updated[slot] = index;
        this.selectedGeneralIndexes = updated;
      } else {
        const index = this.tactics.findIndex((t) => t.id === id);
        if (index < 0) return;
        const updated = [...this.selectedTacticIndexes];
        updated[slot] = index;
        this.selectedTacticIndexes = updated;
      }

      this.pickerVisible = false;
      this.report = null;
      this.refreshSelection();
    },

    closePicker() {
      this.pickerVisible = false;
    },

    onRedChange(event, slot) {
      const updated = [...this.redLevels];
      updated[slot] = Number(event.detail.value);
      this.redLevels = updated;
      this.report = null;
      this.refreshSelection();
    },

    swapGenerals(a, b) {
      const gi = [...this.selectedGeneralIndexes];
      const rl = [...this.redLevels];
      const ti = [...this.selectedTacticIndexes];
      const tacticA = a * 2;
      const tacticB = b * 2;
      [gi[a], gi[b]] = [gi[b], gi[a]];
      [rl[a], rl[b]] = [rl[b], rl[a]];
      [ti[tacticA], ti[tacticB]] = [ti[tacticB], ti[tacticA]];
      [ti[tacticA + 1], ti[tacticB + 1]] = [ti[tacticB + 1], ti[tacticA + 1]];
      this.selectedGeneralIndexes = gi;
      this.redLevels = rl;
      this.selectedTacticIndexes = ti;
      this.report = null;
      this.refreshSelection();
    },

    analyze() {
      const scenario = this.scenarios[this.scenarioIndex].id;
      const troop = this.troops[this.troopIndex];
      const generalIds = this.selectedGeneralIndexes.map((index) => this.generals[index].id);
      const tacticIds = this.selectedTacticIndexes.map((index) => this.tactics[index].id);
      const payload = {
        scenario,
        troop,
        generalIds,
        tacticIds,
        redLevels: this.redLevels
      };
      this.isAnalyzing = true;
      this.apiStatus = "";
      this.savedMessage = "";

      analyzeLineupAsync(payload)
        .then((report) => {
          this.report = report;
          this.isAnalyzing = false;
          this.updateVisibleReplacements(report);
        })
        .catch(() => {
          const fallback = this.analyzeLineupLocal(payload);
          this.report = fallback;
          this.isAnalyzing = false;
          this.updateVisibleReplacements(fallback);
        });
    },

    analyzeLineupLocal(payload) {
      // Import scoring locally as fallback
      try {
        const scoring = require("../../utils/scoring");
        return scoring.analyzeLineup(payload);
      } catch (e) {
        return {
          totalScore: 0,
          scenarioName: payload.scenario,
          troop: payload.troop,
          confidence: "低",
          totalCost: 0,
          validation: ["本地评分引擎不可用"],
          dimensions: [],
          explanations: [],
          weaknesses: [],
          replacements: []
        };
      }
    },

    updateVisibleReplacements(report) {
      if (!report || !report.replacements) return;
      const limit = this.entitlements.canSeeAllReplacements ? report.replacements.length : 2;
      this.visibleReplacements = report.replacements.slice(0, limit);
    },

    saveLineup() {
      if (!this.report) return;
      const saved = getStorage(SAVED_LINEUPS_KEY) || [];
      if (!this.entitlements.canSaveUnlimitedLineups && saved.length >= 3) {
        this.savedMessage = "保存位已满";
        return;
      }
      const lineup = {
        id: `lineup_${Date.now()}`,
        createdAt: new Date().toISOString(),
        scenario: this.scenarios[this.scenarioIndex].name,
        troop: this.troops[this.troopIndex],
        score: this.report.totalScore,
        generals: this.selectedGeneralsView.map((item) => item.name),
        tactics: this.selectedTacticsView.map((item) => item.name)
      };
      setStorage(SAVED_LINEUPS_KEY, [lineup, ...saved.filter((item) => item.id !== lineup.id)]);
      this.savedMessage = "已保存";

      if (isRemoteMode()) {
        saveLineupAsync({ lineup }).catch(() => {});
      }
    },

    goToFeedback() {
      uni.navigateTo({ url: "/pages/feedback/index" });
    }
  }
};
</script>

<style scoped>
.analyze-page {
  min-height: 100vh;
  padding: var(--sp-lg);
  padding-bottom: 60rpx;
  background: linear-gradient(135deg, #0a0e1a 0%, #1a0a2e 50%, #0d1f3c 100%);
  position: relative;
}

.analyze-page::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.2) 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, rgba(59, 130, 246, 0.15) 0%, transparent 50%);
  pointer-events: none;
  z-index: -1;
}

.section {
  margin-bottom: var(--sp-lg);
}

.section:last-child {
  margin-bottom: 0;
}

/* H5 大屏：卡牌区域放大 */
@media screen and (min-width: 768px) {
  .lineup-row {
    gap: var(--sp-xl);
  }

  .general-card-img {
    border-radius: var(--r-md);
  }

  .tactic-innate,
  .tactic-manual {
    font-size: 24rpx;
    padding: var(--sp-sm) 14rpx;
  }

  .red-label {
    font-size: 22rpx;
  }

  .troop-chip {
    padding: 14rpx 28rpx;
    font-size: 28rpx;
  }

  .btn {
    font-size: 32rpx;
    padding: 22rpx 0;
  }
}

.pill {
  padding: 6rpx var(--sp-md);
  border-radius: var(--r-sm);
  font-size: 22rpx;
  color: #a5b4fc;
  border: 1rpx solid rgba(99, 102, 241, 0.4);
  background: rgba(99, 102, 241, 0.15);
  backdrop-filter: blur(5px);
}

.controls .ctrl-row {
  display: flex;
  gap: var(--sp-md);
  align-items: center;
}

.ctrl-field {
  flex: 1;
  padding: 14rpx var(--sp-md);
  border: 1rpx solid rgba(255, 255, 255, 0.12);
  border-radius: var(--r-md);
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-ink);
  font-size: 24rpx;
  backdrop-filter: blur(10px);
  transition: all var(--ease);
}

.ctrl-field:active {
  border-color: rgba(99, 102, 241, 0.5);
}

.muted {
  color: var(--text-stone);
  font-size: 22rpx;
}

/* 3 generals horizontal row */
.lineup-row {
  display: flex;
  gap: var(--sp-md);
  margin-bottom: 28rpx;
}

.general-col {
  flex: 1;
  min-width: 0;
  position: relative;
}

.general-card {
  position: relative;
  border: 2rpx solid rgba(201, 152, 58, 0.5);
  border-radius: var(--r-md);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
  transition: all var(--ease);
}

.general-card:active {
  transform: scale(0.98);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

.aptitudes {
  display: flex;
  justify-content: center;
  gap: 6rpx;
  padding: 8rpx 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
}

.aptitudes text {
  font-size: 18rpx;
  color: var(--gold-bright);
  padding: 2rpx var(--sp-xs);
}

.general-card-img {
  width: 100%;
  display: block;
}

.general-card-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40rpx 10rpx;
  min-height: 280rpx;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
}

.placeholder-initial {
  font-size: 64rpx;
  font-weight: 800;
  color: var(--gold-bright);
  text-shadow: 0 0 20px rgba(201, 152, 58, 0.5);
}

.placeholder-name {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--text-stone);
}

/* Tactics */
.tactic-section {
  margin-top: var(--sp-md);
}

.tactic-innate {
  font-size: 20rpx;
  color: var(--gold-bright);
  background: rgba(201, 152, 58, 0.15);
  border: 1rpx solid rgba(201, 152, 58, 0.4);
  border-radius: var(--r-sm);
  padding: var(--sp-xs) 10rpx;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tactic-manual {
  margin-top: 6rpx;
  font-size: 20rpx;
  color: var(--text-ink);
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: var(--r-sm);
  padding: var(--sp-xs) 10rpx;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(5px);
  transition: all var(--ease);
}

.tactic-manual:active {
  border-color: rgba(99, 102, 241, 0.5);
}

.tactic-name {
  color: var(--text-ink);
}

/* Red level */
.red-section {
  margin-top: 14rpx;
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.red-label {
  font-size: 18rpx;
  color: var(--text-stone);
  white-space: nowrap;
}

.red-slider {
  flex: 1;
}

/* Actions */
.action-row {
  display: flex;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.btn {
  flex: 1;
  color: #ffffff;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: var(--r-lg);
  font-size: 28rpx;
  font-weight: 700;
  border: none;
  padding: 18rpx 0;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
  transition: all var(--ease);
}

.btn:active {
  transform: scale(0.98);
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
}

.btn.secondary {
  color: var(--gold-bright);
  background: rgba(201, 152, 58, 0.15);
  border: 1rpx solid rgba(201, 152, 58, 0.4);
  box-shadow: none;
}

.btn.secondary:active {
  background: rgba(201, 152, 58, 0.25);
}

.btn[disabled] {
  opacity: 0.45;
  box-shadow: none;
}

.saved-message {
  color: var(--win);
  font-size: 24rpx;
}

.api-message {
  color: var(--gold-bright);
  font-size: 24rpx;
  line-height: 1.5;
}

/* Report */
.score-band {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx;
  border-radius: var(--r-lg);
  background: linear-gradient(135deg, rgba(201, 152, 58, 0.15) 0%, rgba(255, 255, 255, 0.06) 100%);
  border: 1rpx solid rgba(201, 152, 58, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
}

.score {
  color: var(--gold-bright);
  font-size: 80rpx;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 0 30px rgba(201, 152, 58, 0.5);
}

.cost {
  color: var(--gold-bright);
  font-size: 26rpx;
  background: rgba(201, 152, 58, 0.15);
  padding: 8rpx 16rpx;
  border-radius: var(--r-sm);
  border: 1rpx solid rgba(201, 152, 58, 0.3);
}

.band {
  padding: var(--sp-lg);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
  border-radius: var(--r-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  transition: all var(--ease);
  position: relative;
  overflow: hidden;
}

.band::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1rpx;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%);
}

.warning {
  margin-top: 18rpx;
  color: var(--loss);
  font-size: 24rpx;
  line-height: 1.7;
}

.report-block {
  margin-top: 18rpx;
}

.block-title {
  margin-bottom: 14rpx;
  color: var(--gold-bright);
  font-size: 28rpx;
  font-weight: 700;
  text-shadow: 0 0 10px rgba(201, 152, 58, 0.3);
}

.row-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dimension {
  margin-bottom: 18rpx;
}

.bar {
  height: 12rpx;
  margin: 10rpx 0;
  border-radius: var(--r-md);
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.bar-inner {
  height: 100%;
  border-radius: var(--r-md);
  background: linear-gradient(90deg, #6366f1, #8b5cf6, var(--gold-bright));
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
}

.dimension-reason,
.bullet,
.replacement {
  color: var(--text-ink);
  font-size: 24rpx;
  line-height: 1.55;
}

.bullet.danger {
  color: var(--loss);
}

.replacement {
  padding: 14rpx 0;
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
}

/* Troop type row */
.troop-row {
  display: flex;
  align-items: center;
  gap: var(--sp-md);
  padding: 18rpx var(--sp-lg);
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: var(--r-md);
  margin-bottom: var(--sp-xl);
  backdrop-filter: blur(10px);
}

.troop-label {
  font-size: 24rpx;
  color: var(--text-stone);
  white-space: nowrap;
}

.troop-options {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
}

.troop-chip {
  padding: 10rpx 20rpx;
  border-radius: var(--r-sm);
  font-size: 24rpx;
  color: var(--text-stone);
  background: transparent;
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  transition: all var(--ease);
}

.troop-chip.active {
  color: #ffffff;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.8) 0%, rgba(139, 92, 246, 0.8) 100%);
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  font-weight: 700;
}

/* Swap button */
.swap-btn {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  width: 42rpx;
  height: 42rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(180deg, rgba(255, 238, 169, 0.18), transparent 40%),
    linear-gradient(180deg, rgba(199, 143, 48, 0.95), rgba(60, 34, 10, 0.96));
  border: 1rpx solid rgba(255, 226, 148, 0.7);
  border-radius: 50%;
  box-shadow: 0 6rpx 16rpx rgba(0, 0, 0, 0.44), 0 0 18rpx rgba(222, 181, 94, 0.28);
}

.swap-btn.swap-0 {
  left: 33.333%;
}

.swap-btn.swap-1 {
  left: 66.666%;
}

.swap-icon {
  color: #fff2bd;
  font-size: 22rpx;
  font-weight: 900;
  line-height: 1;
}

.feedback-entry {
  text-align: center;
  color: var(--text-fade);
  font-size: 24rpx;
  padding: var(--sp-xl) 0 var(--sp-md);
}

.analyze-page {
  min-height: 100vh;
  padding: 64rpx 28rpx 148rpx;
  background:
    linear-gradient(180deg, rgba(5, 12, 26, 0.96), rgba(7, 16, 34, 0.98) 52%, #061122 100%),
    linear-gradient(120deg, #06111f 0%, #141037 48%, #052a4d 100%);
  position: relative;
  overflow: hidden;
}

.analyze-page::before {
  display: none;
}

.analyze-bg {
  position: fixed;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(32, 119, 230, 0.08) 1px, transparent 1px),
    linear-gradient(180deg, rgba(32, 119, 230, 0.06) 1px, transparent 1px),
    radial-gradient(circle at 20% 14%, rgba(45, 126, 255, 0.18), transparent 38%),
    radial-gradient(circle at 76% 18%, rgba(134, 57, 255, 0.2), transparent 34%);
  background-size: 54rpx 54rpx, 54rpx 54rpx, auto, auto;
  pointer-events: none;
  z-index: 0;
}

.lineup-header,
.selector-panel,
.section-title,
.lineup-cards,
.section-panel,
.action-row,
.report-panel,
.api-message,
.saved-message {
  position: relative;
  z-index: 1;
}

.lineup-header {
  min-height: 74rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 26rpx;
}

.back-btn {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 64rpx;
  color: #f4d58b;
  font-size: 58rpx;
  line-height: 1;
}

.header-center {
  width: 220rpx;
  text-align: center;
}

.page-title {
  color: #f2d8a0;
  font-size: 40rpx;
  font-weight: 900;
  text-shadow: 0 0 18rpx rgba(219, 169, 76, 0.22);
}

.page-subtitle {
  color: rgba(242, 216, 160, 0.64);
  font-size: 20rpx;
  margin-top: 4rpx;
}

.share-btn {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 160rpx;
  height: 52rpx;
  border-radius: 6rpx;
  border: 1rpx solid rgba(222, 181, 94, 0.44);
  color: #f2d58d;
  background: rgba(15, 21, 33, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
}

.selector-panel {
  display: grid;
  grid-template-columns: 190rpx 1fr;
  gap: 16rpx;
  margin-bottom: 22rpx;
  padding: 16rpx;
  border: 1rpx solid rgba(42, 128, 231, 0.34);
  background: rgba(5, 18, 39, 0.72);
  box-shadow: inset 0 0 30rpx rgba(26, 114, 226, 0.1);
}

.select-field {
  height: 62rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(222, 181, 94, 0.34);
  color: #f2d58d;
  background: rgba(222, 181, 94, 0.1);
  font-size: 24rpx;
}

.troop-options {
  display: flex;
  gap: 10rpx;
  flex-wrap: nowrap;
  overflow-x: auto;
}

.troop-chip {
  min-width: 82rpx;
  height: 62rpx;
  padding: 0 16rpx;
  border-radius: 4rpx;
  border: 1rpx solid rgba(67, 123, 188, 0.38);
  color: #8fa9ca;
  background: rgba(11, 26, 50, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  white-space: nowrap;
}

.troop-chip.active {
  color: #f3d58d;
  border-color: rgba(222, 181, 94, 0.62);
  background: linear-gradient(180deg, rgba(173, 119, 30, 0.46), rgba(22, 45, 82, 0.78));
  box-shadow: 0 0 16rpx rgba(222, 181, 94, 0.2);
}

.section-title {
  color: #e9eef7;
  font-size: 28rpx;
  font-weight: 800;
  margin: 24rpx 0 16rpx;
}

.section-title.inline {
  margin-top: 0;
}

.lineup-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18rpx;
  margin-bottom: 22rpx;
  position: relative;
}

.lineup-card {
  position: relative;
  min-height: 382rpx;
  overflow: hidden;
  border-radius: 8rpx;
  border: 2rpx solid rgba(78, 157, 255, 0.62);
  background: #071326;
  box-shadow: 0 14rpx 34rpx rgba(0, 0, 0, 0.42), 0 0 22rpx rgba(35, 129, 255, 0.16);
}

.lineup-card.slot-0 {
  border-color: rgba(232, 183, 78, 0.72);
  box-shadow: 0 14rpx 34rpx rgba(0, 0, 0, 0.42), 0 0 26rpx rgba(232, 183, 78, 0.2);
}

.lineup-card.slot-1 {
  border-color: rgba(188, 73, 255, 0.72);
}

.role-badge,
.cost-badge {
  position: absolute;
  z-index: 3;
  top: 0;
  height: 48rpx;
  padding: 0 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f7dda0;
  font-size: 22rpx;
  background: rgba(13, 18, 30, 0.86);
  border-bottom: 1rpx solid rgba(242, 216, 160, 0.22);
}

.role-badge {
  left: 0;
}

.cost-badge {
  right: 0;
}

.general-card-img,
.general-card-placeholder {
  width: 100%;
  height: 382rpx;
}

.general-card-img {
  object-fit: contain;
  background: radial-gradient(circle at 50% 40%, rgba(42, 118, 196, 0.2), rgba(3, 8, 16, 0.96));
}

.general-card-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #1b2a42, #070d17);
}

.placeholder-initial {
  color: #f2d58d;
  font-size: 72rpx;
  font-weight: 900;
}

.card-shade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 70rpx 10rpx 14rpx;
  text-align: center;
  background: linear-gradient(180deg, transparent, rgba(3, 7, 14, 0.92) 58%, #03070e);
}

.faction-line {
  color: #5be681;
  font-size: 22rpx;
}

.general-name {
  color: #f3d58d;
  font-size: 30rpx;
  font-weight: 900;
}

.star-row {
  color: #ffd45e;
  font-size: 20rpx;
}

.level-text,
.arms-row {
  color: #e4d9c2;
  font-size: 22rpx;
}

.arms-row {
  display: flex;
  justify-content: center;
  gap: 8rpx;
  margin-top: 8rpx;
}

.section-panel {
  margin-bottom: 22rpx;
  padding: 22rpx;
  border: 1rpx solid rgba(42, 128, 231, 0.42);
  background: rgba(5, 18, 39, 0.72);
  box-shadow: inset 0 0 32rpx rgba(31, 128, 255, 0.1);
}

.tactic-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18rpx;
}

.tactic-column {
  padding: 14rpx;
  border: 1rpx solid rgba(84, 142, 206, 0.35);
  background: rgba(4, 14, 30, 0.66);
}

.tactic-column:nth-child(1) {
  border-color: rgba(222, 181, 94, 0.42);
}

.tactic-column:nth-child(2) {
  border-color: rgba(174, 85, 244, 0.42);
}

.tactic-heading {
  text-align: center;
  color: #f3d58d;
  font-size: 24rpx;
  font-weight: 800;
  padding-bottom: 12rpx;
}

.tactic-row {
  min-height: 70rpx;
  display: grid;
  grid-template-columns: 42rpx 1fr 28rpx;
  align-items: center;
  gap: 8rpx;
  color: #e7edf6;
  font-size: 22rpx;
  border-top: 1rpx solid rgba(96, 146, 204, 0.18);
}

.tactic-row text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tactic-dot {
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  background: linear-gradient(145deg, #d8b765, #493415);
  border: 1rpx solid rgba(242, 216, 160, 0.5);
}

.grade {
  color: #f3d58d;
  font-weight: 900;
}

.bonus-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.bonus-item {
  min-height: 86rpx;
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 0 12rpx;
  border-right: 1rpx solid rgba(96, 146, 204, 0.2);
}

.bonus-item:last-child {
  border-right: 0;
}

.bonus-mark {
  width: 50rpx;
  height: 50rpx;
  border: 1rpx solid rgba(222, 181, 94, 0.58);
  color: #f3d58d;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.bonus-name {
  color: #f3d58d;
  font-size: 24rpx;
}

.bonus-status {
  color: #75879f;
  font-size: 22rpx;
}

.bonus-status.active {
  color: #52df75;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx 24rpx;
}

.overview-label {
  color: #8fa1ba;
  font-size: 22rpx;
}

.overview-value {
  color: #f3d58d;
  font-size: 28rpx;
  font-weight: 900;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 180rpx;
  gap: 18rpx;
  margin: 26rpx 0;
}

.primary-cta,
.save-cta {
  height: 90rpx;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(255, 231, 158, 0.58);
  font-weight: 900;
}

.primary-cta {
  color: #fff2c2;
  font-size: 38rpx;
  background: linear-gradient(180deg, #c89737 0%, #8a5816 100%);
  box-shadow: 0 0 28rpx rgba(242, 177, 45, 0.32);
}

.save-cta {
  color: #f3d58d;
  font-size: 26rpx;
  background: rgba(222, 181, 94, 0.12);
}

.api-message,
.saved-message {
  color: #f3d58d;
  font-size: 24rpx;
  margin-top: 14rpx;
}

.report-panel {
  padding: 24rpx;
  border: 1rpx solid rgba(222, 181, 94, 0.36);
  background: rgba(8, 17, 31, 0.82);
}

.report-score {
  color: #f3d58d;
  font-size: 72rpx;
  font-weight: 900;
}

.report-meta {
  color: #8fa1ba;
  font-size: 24rpx;
  margin-bottom: 18rpx;
}

.bar {
  height: 12rpx;
  margin: 8rpx 0 14rpx;
  background: rgba(62, 86, 120, 0.58);
  border-radius: 999rpx;
  overflow: hidden;
}

.bar-inner {
  height: 100%;
  background: linear-gradient(90deg, #3277ff, #f0c966);
}

.analyze-page {
  background:
    radial-gradient(circle at 50% -10%, rgba(72, 128, 255, 0.28), transparent 34%),
    radial-gradient(circle at 90% 18%, rgba(151, 77, 255, 0.2), transparent 28%),
    linear-gradient(180deg, rgba(5, 12, 26, 0.96), rgba(7, 16, 34, 0.98) 52%, #061122 100%),
    linear-gradient(120deg, #06111f 0%, #141037 48%, #052a4d 100%);
}

.page-title {
  color: transparent;
  background: linear-gradient(180deg, #fff0bd 0%, #d6a852 55%, #fff0bd 100%);
  -webkit-background-clip: text;
  background-clip: text;
  text-shadow: 0 0 18rpx rgba(242, 216, 160, 0.24), 0 8rpx 18rpx rgba(0, 0, 0, 0.52);
}

.selector-panel,
.section-panel,
.report-panel {
  position: relative;
  overflow: hidden;
  border: 0;
  background:
    linear-gradient(#06182f, #071326) padding-box,
    linear-gradient(135deg, rgba(61, 148, 255, 0.82), rgba(222, 181, 94, 0.36) 42%, rgba(125, 62, 255, 0.6) 100%) border-box;
  border: 2rpx solid transparent;
  box-shadow:
    0 16rpx 34rpx rgba(0, 0, 0, 0.42),
    inset 0 0 34rpx rgba(35, 116, 255, 0.14),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.12);
}

.selector-panel::before,
.section-panel::before,
.report-panel::before {
  content: "";
  position: absolute;
  inset: 8rpx;
  z-index: 2;
  pointer-events: none;
  background:
    linear-gradient(90deg, #42a1ff 0 30rpx, transparent 30rpx) left top / 90rpx 2rpx no-repeat,
    linear-gradient(#42a1ff 0 30rpx, transparent 30rpx) left top / 2rpx 90rpx no-repeat,
    linear-gradient(270deg, #42a1ff 0 30rpx, transparent 30rpx) right top / 90rpx 2rpx no-repeat,
    linear-gradient(#42a1ff 0 30rpx, transparent 30rpx) right top / 2rpx 90rpx no-repeat,
    linear-gradient(90deg, #42a1ff 0 30rpx, transparent 30rpx) left bottom / 90rpx 2rpx no-repeat,
    linear-gradient(0deg, #42a1ff 0 30rpx, transparent 30rpx) left bottom / 2rpx 90rpx no-repeat,
    linear-gradient(270deg, #42a1ff 0 30rpx, transparent 30rpx) right bottom / 90rpx 2rpx no-repeat,
    linear-gradient(0deg, #42a1ff 0 30rpx, transparent 30rpx) right bottom / 2rpx 90rpx no-repeat;
  opacity: 0.46;
}

.selector-panel::after,
.section-panel::after,
.report-panel::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 56rpx;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(92, 167, 255, 0.16), transparent);
}

.select-field,
.troop-chip,
.share-btn {
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.14), inset 0 -10rpx 18rpx rgba(0, 0, 0, 0.24);
}

.troop-chip.active {
  background:
    linear-gradient(180deg, rgba(255, 235, 169, 0.16), transparent 34%),
    linear-gradient(180deg, rgba(194, 135, 38, 0.62), rgba(22, 45, 82, 0.9));
  box-shadow: 0 0 18rpx rgba(222, 181, 94, 0.28), inset 0 1rpx 0 rgba(255, 241, 185, 0.4);
}

.lineup-card {
  border: 0;
  background:
    linear-gradient(#071326, #071326) padding-box,
    linear-gradient(145deg, #ffe59b 0%, #2b86ff 35%, #1c2240 52%, #8d45ff 100%) border-box;
  border: 2rpx solid transparent;
  box-shadow:
    0 18rpx 34rpx rgba(0, 0, 0, 0.52),
    0 0 24rpx rgba(49, 130, 255, 0.18),
    inset 0 0 0 1rpx rgba(255, 255, 255, 0.08);
}

.lineup-card::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background:
    linear-gradient(90deg, #f4d58b 0 20rpx, transparent 20rpx) left top / 60rpx 2rpx no-repeat,
    linear-gradient(#f4d58b 0 20rpx, transparent 20rpx) left top / 2rpx 60rpx no-repeat,
    linear-gradient(270deg, #f4d58b 0 20rpx, transparent 20rpx) right top / 60rpx 2rpx no-repeat,
    linear-gradient(#f4d58b 0 20rpx, transparent 20rpx) right top / 2rpx 60rpx no-repeat,
    linear-gradient(90deg, #f4d58b 0 20rpx, transparent 20rpx) left bottom / 60rpx 2rpx no-repeat,
    linear-gradient(0deg, #f4d58b 0 20rpx, transparent 20rpx) left bottom / 2rpx 60rpx no-repeat,
    linear-gradient(270deg, #f4d58b 0 20rpx, transparent 20rpx) right bottom / 60rpx 2rpx no-repeat,
    linear-gradient(0deg, #f4d58b 0 20rpx, transparent 20rpx) right bottom / 2rpx 60rpx no-repeat;
  opacity: 0.8;
}

.lineup-card::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(115deg, rgba(255, 255, 255, 0.15), transparent 28%, transparent 72%, rgba(87, 170, 255, 0.12));
  mix-blend-mode: screen;
}

.role-badge,
.cost-badge {
  box-shadow: inset 0 1rpx 0 rgba(255, 239, 180, 0.32), 0 4rpx 10rpx rgba(0, 0, 0, 0.32);
}

.tactic-column {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(18, 37, 65, 0.92), rgba(5, 14, 30, 0.96));
  box-shadow: inset 0 0 20rpx rgba(49, 130, 255, 0.1);
}

.tactic-column::before {
  content: "";
  position: absolute;
  inset: 4rpx;
  border: 1rpx solid rgba(91, 166, 255, 0.16);
  pointer-events: none;
}

.tactic-dot {
  box-shadow: 0 0 14rpx rgba(222, 181, 94, 0.32), inset 0 2rpx 5rpx rgba(255, 255, 255, 0.24);
}

.bonus-mark {
  box-shadow: 0 0 16rpx rgba(222, 181, 94, 0.22), inset 0 0 12rpx rgba(222, 181, 94, 0.12);
}

.primary-cta,
.save-cta {
  position: relative;
  overflow: hidden;
  border: 0;
  box-shadow:
    0 14rpx 30rpx rgba(0, 0, 0, 0.42),
    0 0 22rpx rgba(242, 177, 45, 0.28),
    inset 0 1rpx 0 rgba(255, 245, 190, 0.58),
    inset 0 -10rpx 18rpx rgba(61, 31, 6, 0.42);
}

.primary-cta {
  clip-path: polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%);
  background:
    linear-gradient(180deg, rgba(255, 246, 194, 0.22) 0%, transparent 36%),
    linear-gradient(180deg, #d6a13a 0%, #8b5516 58%, #4a2c10 100%);
  text-shadow: 0 3rpx 8rpx rgba(80, 40, 4, 0.72);
}

.primary-cta::before,
.save-cta::before {
  content: "";
  position: absolute;
  inset: 6rpx;
  border: 1rpx solid rgba(255, 230, 150, 0.34);
  pointer-events: none;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.share-btn {
  gap: 8rpx;
}

.tactic-dot {
  width: 42rpx;
  height: 42rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(239, 205, 127, 0.42);
  background:
    radial-gradient(circle at 35% 30%, #ffe6a1 0%, #c18a34 42%, #58330d 100%);
  box-shadow: 0 0 14rpx rgba(222, 181, 94, 0.32), inset 0 2rpx 5rpx rgba(255, 255, 255, 0.24);
}
</style>
