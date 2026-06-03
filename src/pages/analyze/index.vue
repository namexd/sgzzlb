<template>
  <view class="page analyze-page">
    <!-- Controls -->
    <view class="section controls band">
      <view class="ctrl-row">
        <picker :range="scenarios" range-key="name" :value="scenarioIndex" @change="onScenarioChange">
          <view class="field ctrl-field">{{ scenarios[scenarioIndex].name }}</view>
        </picker>
        <text class="pill">{{ entitlements.tier === 'premium' ? '高级' : '免费' }}</text>
      </view>
    </view>

    <!-- Team troop type -->
    <view class="section troop-row">
      <text class="troop-label">队伍兵种</text>
      <view class="troop-options">
        <view
          v-for="(t, idx) in troops"
          :key="t"
          :class="['troop-chip', { active: troopIndex === idx }]"
          @tap="onTroopChange({ detail: { value: idx } })"
        >{{ t }}</view>
      </view>
    </view>

    <!-- 3 Generals horizontal -->
    <view class="section lineup-row">
      <view v-for="(general, slot) in selectedGeneralsView" :key="general.id" class="general-col">
        <!-- Card -->
        <view class="general-card" @tap="openGeneralPicker(slot)">
          <image v-if="general.cardImageUrl" class="general-card-img" :src="general.cardImageUrl" mode="widthFix" />
          <view v-else class="general-card-placeholder">
            <text class="placeholder-initial">{{ general.name[0] }}</text>
            <text class="placeholder-name">{{ general.name }}</text>
          </view>
          <view class="aptitudes">
            <text>骑{{ general.arms.cavalry || '-' }}</text>
            <text>盾{{ general.arms.shield || '-' }}</text>
            <text>弓{{ general.arms.bow || '-' }}</text>
            <text>枪{{ general.arms.spear || '-' }}</text>
          </view>
        </view>

        <!-- Swap buttons -->
        <view v-if="slot < 2" class="swap-btn" @tap="swapGenerals(slot, slot + 1)">
          <text class="swap-icon">⇄</text>
        </view>

        <!-- Tactics: innate + 2 manual -->
        <view class="tactic-section">
          <view class="tactic-innate">{{ general.tactics.innate || '自带战法' }}</view>
          <view
            v-for="tacticSlot in general.tacticSlots"
            :key="tacticSlot.slot"
            class="tactic-manual"
            @tap="openTacticPicker(tacticSlot.slot)"
          >
            <text class="tactic-name">{{ tacticSlot.tactic ? tacticSlot.tactic.name : '选择战法' }}</text>
          </view>
        </view>

        <!-- Red level -->
        <view class="red-section">
          <text class="red-label">红度 {{ general.red }}</text>
          <slider
            class="red-slider"
            :min="0"
            :max="5"
            :step="1"
            :value="general.red"
            activeColor="#d6a85d"
            backgroundColor="#35404d"
            :block-size="16"
            @change="onRedChange($event, slot)"
          />
        </view>
      </view>
    </view>

    <!-- Actions -->
    <view class="section action-row">
      <button class="btn" :loading="isAnalyzing" :disabled="isAnalyzing" @tap="analyze">生成评分报告</button>
      <button class="btn secondary" :disabled="!report" @tap="saveLineup">保存阵容</button>
    </view>
    <view v-if="apiStatus" class="section api-message">{{ apiStatus }}</view>
    <view v-if="savedMessage" class="section saved-message">{{ savedMessage }}</view>

    <!-- Report -->
    <view v-if="report" class="section report">
      <view class="score-band">
        <view>
          <view class="score">{{ report.totalScore }}</view>
          <view class="subtitle">{{ report.scenarioName }} · {{ report.troop }} · 可信度 {{ report.confidence }}</view>
        </view>
        <view class="cost">统御 {{ report.totalCost }}</view>
      </view>

      <view v-if="report.validation && report.validation.length" class="band warning">
        <view v-for="(item, idx) in report.validation" :key="idx">⚠ {{ item }}</view>
      </view>

      <view class="band report-block">
        <view class="block-title">维度拆解</view>
        <view v-for="(dim, idx) in report.dimensions" :key="idx" class="dimension">
          <view class="row-between">
            <text>{{ dim.label }}</text>
            <text>{{ dim.score }}</text>
          </view>
          <view class="bar">
            <view class="bar-inner" :style="{ width: dim.score + '%' }"></view>
          </view>
          <view class="dimension-reason">{{ dim.reason }}</view>
        </view>
      </view>

      <view class="band report-block">
        <view class="block-title">为什么这么评</view>
        <view v-for="(item, idx) in report.explanations" :key="idx" class="bullet">· {{ item }}</view>
      </view>

      <view class="band report-block">
        <view class="block-title">短板和风险</view>
        <view v-for="(item, idx) in report.weaknesses" :key="idx" class="bullet danger">· {{ item }}</view>
      </view>

      <view class="band report-block">
        <view class="row-between">
          <view class="block-title">替代战法</view>
          <text v-if="!entitlements.canSeeAllReplacements" class="pill">高级解锁完整列表</text>
        </view>
        <view v-for="item in visibleReplacements" :key="item.id" class="replacement">
          <view>{{ item.name }}</view>
          <view class="muted">{{ item.quality }} · {{ item.type }} · {{ item.reason }}</view>
        </view>
      </view>
    </view>

    <!-- Search picker -->
    <search-picker
      :type="pickerType"
      :selected-id="pickerSelectedId"
      :visible="pickerVisible"
      @select="onPickerSelect"
      @close="closePicker"
    />

    <view class="feedback-entry" @tap="goToFeedback">对功能有意见？去反馈 →</view>
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
      [gi[a], gi[b]] = [gi[b], gi[a]];
      [rl[a], rl[b]] = [rl[b], rl[a]];
      this.selectedGeneralIndexes = gi;
      this.redLevels = rl;
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
        this.savedMessage = "免费层最多保存 3 套阵容。高级订阅可无限保存。";
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
      this.savedMessage = '已保存，可在"我的"里查看。';

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
  color: var(--gold);
  border: 1rpx solid var(--border-accent);
  background: var(--gold-ghost);
}

.controls .ctrl-row {
  display: flex;
  gap: var(--sp-md);
  align-items: center;
}

.ctrl-field {
  flex: 1;
  padding: 14rpx var(--sp-md);
  border: 1rpx solid var(--border-accent);
  border-radius: var(--r-md);
  background: var(--ink-surface);
  color: var(--text-ink);
  font-size: 24rpx;
  transition: border-color var(--ease);
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
  border: 2rpx solid var(--gold);
  border-radius: var(--r-sm);
  overflow: hidden;
  background: var(--ink-mid);
  box-shadow: var(--shadow-sm);
}

.aptitudes {
  display: flex;
  justify-content: center;
  gap: 6rpx;
  padding: 6rpx 0;
  background: rgba(0, 0, 0, 0.6);
}

.aptitudes text {
  font-size: 18rpx;
  color: var(--gold);
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
}

.placeholder-initial {
  font-size: 64rpx;
  font-weight: 800;
  color: var(--gold);
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
  color: var(--gold);
  background: var(--gold-ghost);
  border: 1rpx solid var(--border-accent);
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
  background: var(--ink-surface);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--r-sm);
  padding: var(--sp-xs) 10rpx;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: border-color var(--ease);
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
  color: var(--ink-deepest);
  background: linear-gradient(135deg, var(--gold-bright), var(--gold-dim));
  border-radius: var(--r-sm);
  font-size: 28rpx;
  font-weight: 700;
  border: none;
  padding: 18rpx 0;
  transition: opacity var(--ease);
}

.btn.secondary {
  color: var(--gold-bright);
  background: var(--gold-ghost);
  border: 1rpx solid var(--border-accent);
}

.btn[disabled] {
  opacity: 0.45;
}

.saved-message {
  color: var(--win);
  font-size: 24rpx;
}

.api-message {
  color: var(--gold);
  font-size: 24rpx;
  line-height: 1.5;
}

/* Report */
.score-band {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 26rpx;
  border-radius: var(--r-md);
  background: linear-gradient(135deg, var(--gold-ghost), var(--ink-surface));
  border: 1rpx solid var(--border-accent);
  box-shadow: var(--shadow-sm);
}

.score {
  color: var(--gold-bright);
  font-size: 72rpx;
  font-weight: 800;
  line-height: 1;
}

.cost {
  color: var(--gold-bright);
  font-size: 26rpx;
}

.band {
  padding: var(--sp-lg);
  border: 1rpx solid var(--border-accent);
  background: var(--ink-surface);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--ease);
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
  background: var(--border-subtle);
  overflow: hidden;
}

.bar-inner {
  height: 100%;
  border-radius: var(--r-md);
  background: linear-gradient(90deg, var(--gold-dim), var(--gold-bright));
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
  border-top: 1rpx solid var(--border-faint);
}

/* Troop type row */
.troop-row {
  display: flex;
  align-items: center;
  gap: var(--sp-md);
  padding: 18rpx var(--sp-lg);
  background: var(--ink-surface);
  border: 1rpx solid var(--border-faint);
  border-radius: var(--r-sm);
  margin-bottom: var(--sp-xl);
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
  background: var(--ink-surface);
  border: 1rpx solid var(--border-faint);
  transition: all var(--ease);
}

.troop-chip.active {
  color: var(--ink-deepest);
  background: var(--gold);
  border-color: var(--gold);
  font-weight: 700;
}

/* Swap button */
.swap-btn {
  position: absolute;
  right: -24rpx;
  top: 40%;
  transform: translateY(-50%);
  z-index: 10;
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gold);
  border-radius: 50%;
  box-shadow: var(--shadow-md);
}

.swap-icon {
  font-size: 24rpx;
  color: var(--ink-deepest);
  font-weight: 700;
}

.feedback-entry {
  text-align: center;
  color: var(--text-fade);
  font-size: 24rpx;
  padding: var(--sp-xl) 0 var(--sp-md);
}
</style>
