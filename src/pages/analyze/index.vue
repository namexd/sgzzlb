<template>
  <view class="page analyze-page">
    <!-- Controls -->
    <view class="section controls band">
      <view class="ctrl-row">
        <picker :range="scenarios" range-key="name" :value="scenarioIndex" @change="onScenarioChange">
          <view class="field ctrl-field">{{ scenarios[scenarioIndex].name }}</view>
        </picker>
        <picker :range="troops" :value="troopIndex" @change="onTroopChange">
          <view class="field ctrl-field">{{ troops[troopIndex] }}</view>
        </picker>
        <text class="pill">{{ entitlements.tier === 'premium' ? '高级' : '免费' }}</text>
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
  padding: 20rpx;
}

.pill {
  padding: 6rpx 16rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
  color: #d6a85d;
  border: 1rpx solid rgba(214, 168, 93, 0.35);
  background: rgba(214, 168, 93, 0.1);
}

.controls .ctrl-row {
  display: flex;
  gap: 12rpx;
  align-items: center;
}

.ctrl-field {
  flex: 1;
  padding: 14rpx 16rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.22);
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.045);
  color: #f4ead8;
  font-size: 24rpx;
}

.muted {
  color: #8d97a5;
  font-size: 22rpx;
}

/* 3 generals horizontal row */
.lineup-row {
  display: flex;
  gap: 12rpx;
}

.general-col {
  flex: 1;
  min-width: 0;
}

.general-card {
  border: 2rpx solid #d6a85d;
  border-radius: 10rpx;
  overflow: hidden;
  background: #1a2332;
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
  color: #d6a85d;
}

.placeholder-name {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #8d97a5;
}

/* Tactics */
.tactic-section {
  margin-top: 10rpx;
}

.tactic-innate {
  font-size: 20rpx;
  color: #d6a85d;
  background: rgba(214, 168, 93, 0.12);
  border: 1rpx solid rgba(214, 168, 93, 0.25);
  border-radius: 6rpx;
  padding: 8rpx 10rpx;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tactic-manual {
  margin-top: 6rpx;
  font-size: 20rpx;
  color: #b6c0cc;
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(255, 255, 255, 0.12);
  border-radius: 6rpx;
  padding: 8rpx 10rpx;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tactic-name {
  color: #b6c0cc;
}

/* Red level */
.red-section {
  margin-top: 8rpx;
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.red-label {
  font-size: 18rpx;
  color: #8d97a5;
  white-space: nowrap;
}

.red-slider {
  flex: 1;
}

/* Actions */
.action-row {
  display: flex;
  gap: 16rpx;
}

.btn {
  flex: 1;
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

/* Report */
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
