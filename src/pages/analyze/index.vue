<template>
  <view class="page analyze-page">
    <!-- Hero -->
    <view class="section hero">
      <view>
        <view class="title">可解释阵容评分</view>
        <view class="subtitle">不是只给分数。每次评分都会说明强点、短板、对位风险和替代战法。</view>
      </view>
      <view class="meta">
        <text class="pill">{{ entitlements.tier === 'premium' ? '高级订阅' : '免费层' }}</text>
      </view>
    </view>

    <!-- Controls: scenario + troop pickers -->
    <view class="section controls band">
      <view class="grid-2">
        <picker :range="scenarios" range-key="name" :value="scenarioIndex" @change="onScenarioChange">
          <view class="field">场景：{{ scenarios[scenarioIndex].name }}</view>
        </picker>
        <picker :range="troops" :value="troopIndex" @change="onTroopChange">
          <view class="field">兵种：{{ troops[troopIndex] }}</view>
        </picker>
      </view>
    </view>

    <!-- Lineup panels -->
    <view class="section lineup">
      <view v-for="(general, slot) in selectedGeneralsView" :key="general.id" class="general-panel">
        <!-- General card -->
        <view
          class="general-card"
          :style="{ background: general.card.background, borderColor: general.card.borderColor }"
          @tap="openGeneralPicker(slot)"
        >
          <image v-if="general.cardImageUrl" class="general-card-img" :src="general.cardImageUrl" mode="aspectFill" />
          <view class="general-top">
            <text class="general-role">{{ slot === 0 ? '主将' : '副将' }}</text>
            <text class="general-cost">{{ general.cost || '-' }}御</text>
          </view>
          <view v-if="!general.cardImageUrl" class="general-initial">{{ general.card.initial }}</view>
          <view class="general-name">{{ general.name }}</view>
          <view class="general-info">{{ general.faction }} · {{ general.tagText }}</view>
          <view class="aptitudes">
            <text>骑{{ general.arms.cavalry || '-' }}</text>
            <text>盾{{ general.arms.shield || '-' }}</text>
            <text>弓{{ general.arms.bow || '-' }}</text>
            <text>枪{{ general.arms.spear || '-' }}</text>
          </view>
        </view>

        <!-- Tactic slots -->
        <view class="tactic-list">
          <view
            v-for="tacticSlot in general.tacticSlots"
            :key="tacticSlot.slot"
            class="field tactic-field"
            @tap="openTacticPicker(tacticSlot.slot)"
          >
            {{ tacticSlot.tactic.name }}
          </view>
        </view>

        <!-- Red level slider -->
        <view class="red-row">
          <text class="muted">红度 {{ general.red }}</text>
          <slider
            :min="0"
            :max="5"
            :step="1"
            :value="general.red"
            activeColor="#d6a85d"
            backgroundColor="#35404d"
            :block-size="18"
            @change="onRedChange($event, slot)"
          />
        </view>
      </view>
    </view>

    <!-- Action buttons -->
    <view class="section action-row">
      <button class="btn" :loading="isAnalyzing" :disabled="isAnalyzing" @tap="analyze">生成评分报告</button>
      <button class="btn secondary" :disabled="!report" @tap="saveLineup">保存阵容</button>
    </view>
    <view v-if="apiStatus" class="section api-message">{{ apiStatus }}</view>
    <view v-if="savedMessage" class="section saved-message">{{ savedMessage }}</view>

    <!-- Scoring report -->
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

      <!-- Dimensions -->
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

      <!-- Explanations -->
      <view class="band report-block">
        <view class="block-title">为什么这么评</view>
        <view v-for="(item, idx) in report.explanations" :key="idx" class="bullet">· {{ item }}</view>
      </view>

      <!-- Weaknesses -->
      <view class="band report-block">
        <view class="block-title">短板和风险</view>
        <view v-for="(item, idx) in report.weaknesses" :key="idx" class="bullet danger">· {{ item }}</view>
      </view>

      <!-- Replacements -->
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
      const names = ["曹操", "刘备", "孙权"];
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
      this.selectedGeneralsView = selectedGeneralsView;
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
      const remote = isRemoteMode();
      this.isAnalyzing = true;
      this.apiStatus = remote ? "正在请求远程评分服务..." : "使用本地评分规则生成报告。";
      this.savedMessage = "";

      analyzeLineupAsync(payload)
        .then((report) => {
          this.report = report;
          this.isAnalyzing = false;
          this.apiStatus = remote ? "评分报告来自远程 API。" : "评分报告来自本地规则。";
          this.updateVisibleReplacements(report);
        })
        .catch((error) => {
          // fallback: synchronous local analysis
          const fallback = this.analyzeLineupLocal(payload);
          this.report = fallback;
          this.isAnalyzing = false;
          this.apiStatus = `远程评分失败，已回退本地规则：${error.message}`;
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

      if (!isRemoteMode()) {
        this.savedMessage = '已保存到本地，可在"我的"里查看。';
        return;
      }

      this.savedMessage = "本地已保存，正在同步到远程服务端...";
      saveLineupAsync({ userId: "local-demo", lineup })
        .then(() => {
          this.savedMessage = "本地已保存，远程服务端同步成功。";
        })
        .catch((error) => {
          this.savedMessage = `远程同步失败，本地阵容已保留：${error.message}`;
        });
    }
  }
};
</script>

<style scoped>
.analyze-page {
  min-height: 100vh;
  padding: 24rpx;
}

.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20rpx;
}

.meta {
  flex: 0 0 auto;
}

.title {
  font-size: 36rpx;
  font-weight: 700;
  color: #f7e4bc;
}

.subtitle {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #98a3b3;
}

.pill {
  padding: 6rpx 18rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
  color: #d6a85d;
  border: 1rpx solid rgba(214, 168, 93, 0.35);
  background: rgba(214, 168, 93, 0.1);
}

.controls {
  margin-top: 8rpx;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.field {
  padding: 18rpx 20rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.22);
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.045);
  color: #f4ead8;
  font-size: 26rpx;
}

.muted {
  color: #8d97a5;
  font-size: 24rpx;
}

.lineup {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18rpx;
}

.general-panel {
  padding: 18rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.18);
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.045);
}

.general-card {
  position: relative;
  min-height: 300rpx;
  padding: 20rpx;
  border: 2rpx solid #d6a85d;
  border-radius: 8rpx;
  overflow: hidden;
}

.general-card::after {
  content: "";
  position: absolute;
  inset: 22rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.14);
  border-radius: 6rpx;
  pointer-events: none;
}

.general-card-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  border-radius: 8rpx;
  opacity: 0.85;
}

.general-top {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  color: #f8deb1;
  font-size: 22rpx;
}

.general-initial {
  position: relative;
  z-index: 1;
  margin: 34rpx auto 18rpx;
  width: 116rpx;
  height: 116rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(246, 217, 163, 0.8);
  color: #f8deb1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60rpx;
  font-weight: 800;
  background: rgba(0, 0, 0, 0.16);
}

.general-name {
  position: relative;
  z-index: 1;
  text-align: center;
  color: #fff4da;
  font-size: 34rpx;
  font-weight: 700;
}

.general-info {
  position: relative;
  z-index: 1;
  margin-top: 8rpx;
  text-align: center;
  color: #c8d0da;
  font-size: 22rpx;
}

.aptitudes {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8rpx;
  margin-top: 20rpx;
}

.aptitudes text {
  height: 44rpx;
  border-radius: 6rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f1d29a;
  background: rgba(0, 0, 0, 0.22);
  font-size: 22rpx;
}

.tactic-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 14rpx;
}

.tactic-field {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.red-row {
  display: grid;
  grid-template-columns: 120rpx 1fr;
  align-items: center;
  margin-top: 10rpx;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.btn {
  color: #1a1409;
  background: linear-gradient(135deg, #f0ca7f, #bd823d);
  border-radius: 8rpx;
  font-size: 28rpx;
  font-weight: 700;
  border: none;
}

.btn.secondary {
  color: #f7e4bc;
  background: rgba(214, 168, 93, 0.18);
  border: 1rpx solid rgba(214, 168, 93, 0.35);
}

.btn[disabled] {
  opacity: 0.45;
}

.saved-message {
  color: #9bd08f;
  font-size: 24rpx;
}

.api-message {
  color: #d6a85d;
  font-size: 24rpx;
  line-height: 1.5;
}

.score-band {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 26rpx;
  border-radius: 8rpx;
  background: linear-gradient(135deg, rgba(214, 168, 93, 0.22), rgba(255, 255, 255, 0.06));
  border: 1rpx solid rgba(214, 168, 93, 0.28);
}

.score {
  color: #f4ca78;
  font-size: 72rpx;
  font-weight: 800;
  line-height: 1;
}

.cost {
  color: #f7e4bc;
  font-size: 26rpx;
}

.band {
  padding: 24rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.22);
  background: rgba(249, 239, 216, 0.06);
  border-radius: 8rpx;
}

.warning {
  margin-top: 18rpx;
  color: #e68973;
  font-size: 24rpx;
  line-height: 1.7;
}

.report-block {
  margin-top: 18rpx;
}

.block-title {
  margin-bottom: 14rpx;
  color: #f7e4bc;
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
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.bar-inner {
  height: 100%;
  border-radius: 8rpx;
  background: linear-gradient(90deg, #bd823d, #f0ca7f);
}

.dimension-reason,
.bullet,
.replacement {
  color: #b6c0cc;
  font-size: 24rpx;
  line-height: 1.55;
}

.bullet.danger {
  color: #e68973;
}

.replacement {
  padding: 14rpx 0;
  border-top: 1rpx solid rgba(255, 255, 255, 0.08);
}
</style>
