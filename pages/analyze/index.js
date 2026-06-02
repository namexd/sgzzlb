const catalog = require("../../utils/catalog");
const subscription = require("../../utils/subscription");
const assetPolicy = require("../../utils/assetPolicy");
const api = require("../../services/api");

const SCENARIOS = [
  { id: "pk", name: "PK赛季" },
  { id: "war", name: "打架" },
  { id: "pioneer", name: "开荒" }
];

Page({
  data: {
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
  },

  onLoad() {
    const generals = catalog.getGenerals();
    const tactics = catalog.getAllTactics();
    const selectedGeneralIndexes = this.makeDefaultGeneralIndexes(generals);
    const selectedTacticIndexes = this.makeDefaultTacticIndexes(tactics, generals, selectedGeneralIndexes);
    this.setData(
      {
        generals,
        tactics,
        selectedGeneralIndexes,
        selectedTacticIndexes,
        entitlements: subscription.getEntitlements()
      },
      () => this.refreshSelection()
    );
  },

  onShow() {
    this.setData({ entitlements: subscription.getEntitlements() }, () => {
      if (this.data.report) this.updateVisibleReplacements(this.data.report);
    });
  },

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
    const selectedTacticsView = this.data.selectedTacticIndexes.map((index) => this.data.tactics[index]);
    const selectedGeneralsView = this.data.selectedGeneralIndexes.map((index, slot) => {
      const general = this.data.generals[index];
      return {
        ...general,
        slot,
        red: this.data.redLevels[slot],
        tagText: general.tags && general.tags.length ? general.tags.join(" / ") : "未标记",
        card: assetPolicy.getOriginalCardStyle(general),
        tacticSlots: [0, 1].map((offset) => {
          const tacticSlot = slot * 2 + offset;
          return {
            slot: tacticSlot,
            selectedIndex: this.data.selectedTacticIndexes[tacticSlot],
            tactic: selectedTacticsView[tacticSlot]
          };
        })
      };
    });
    this.setData({ selectedGeneralsView, selectedTacticsView });
  },

  onScenarioChange(event) {
    this.setData({ scenarioIndex: Number(event.detail.value), report: null });
  },

  onTroopChange(event) {
    this.setData({ troopIndex: Number(event.detail.value), report: null }, () => this.refreshSelection());
  },

  openGeneralPicker(e) {
    const slot = Number(e.currentTarget.dataset.slot);
    const currentId = this.data.generals[this.data.selectedGeneralIndexes[slot]]?.id || "";
    this.setData({ pickerVisible: true, pickerType: "generals", pickerSlot: slot, pickerSelectedId: currentId });
  },

  openTacticPicker(e) {
    const slot = Number(e.currentTarget.dataset.slot);
    const currentId = this.data.tactics[this.data.selectedTacticIndexes[slot]]?.id || "";
    this.setData({ pickerVisible: true, pickerType: "tactics", pickerSlot: slot, pickerSelectedId: currentId });
  },

  onPickerSelect(e) {
    const id = e.detail.id;
    const slot = this.data.pickerSlot;
    const type = this.data.pickerType;

    if (type === "generals") {
      const index = this.data.generals.findIndex((g) => g.id === id);
      if (index < 0) return;
      const selectedGeneralIndexes = [...this.data.selectedGeneralIndexes];
      selectedGeneralIndexes[slot] = index;
      this.setData({ selectedGeneralIndexes, pickerVisible: false, report: null }, () => this.refreshSelection());
    } else {
      const index = this.data.tactics.findIndex((t) => t.id === id);
      if (index < 0) return;
      const selectedTacticIndexes = [...this.data.selectedTacticIndexes];
      selectedTacticIndexes[slot] = index;
      this.setData({ selectedTacticIndexes, pickerVisible: false, report: null }, () => this.refreshSelection());
    }
  },

  closePicker() {
    this.setData({ pickerVisible: false });
  },

  onRedChange(event) {
    const slot = Number(event.currentTarget.dataset.slot);
    const redLevels = [...this.data.redLevels];
    redLevels[slot] = Number(event.detail.value);
    this.setData({ redLevels, report: null });
  },

  analyze() {
    const scenario = this.data.scenarios[this.data.scenarioIndex].id;
    const troop = this.data.troops[this.data.troopIndex];
    const generalIds = this.data.selectedGeneralIndexes.map((index) => this.data.generals[index].id);
    const tacticIds = this.data.selectedTacticIndexes.map((index) => this.data.tactics[index].id);
    const payload = {
      scenario,
      troop,
      generalIds,
      tacticIds,
      redLevels: this.data.redLevels
    };
    const remote = api.isRemoteMode();
    this.setData({
      isAnalyzing: true,
      apiStatus: remote ? "正在请求远程评分服务..." : "使用本地评分规则生成报告。",
      savedMessage: ""
    });
    api
      .analyzeLineupAsync(payload)
      .then((report) => {
        this.setData(
          {
            report,
            isAnalyzing: false,
            apiStatus: remote ? "评分报告来自远程 API。" : "评分报告来自本地规则。"
          },
          () => this.updateVisibleReplacements(report)
        );
      })
      .catch((error) => {
        const fallback = api.analyzeLineup(payload);
        this.setData(
          {
            report: fallback,
            isAnalyzing: false,
            apiStatus: `远程评分失败，已回退本地规则：${error.message}`
          },
          () => this.updateVisibleReplacements(fallback)
        );
      });
  },

  updateVisibleReplacements(report) {
    const entitlements = this.data.entitlements;
    const limit = entitlements.canSeeAllReplacements ? report.replacements.length : 2;
    this.setData({ visibleReplacements: report.replacements.slice(0, limit) });
  },

  saveLineup() {
    if (!this.data.report) return;
    const app = getApp();
    const key = app.globalData.savedLineupsKey;
    const saved = wx.getStorageSync(key) || [];
    if (!this.data.entitlements.canSaveUnlimitedLineups && saved.length >= 3) {
      this.setData({ savedMessage: "免费层最多保存 3 套阵容。高级订阅可无限保存。" });
      return;
    }
    const lineup = {
      id: `lineup_${Date.now()}`,
      createdAt: new Date().toISOString(),
      scenario: this.data.scenarios[this.data.scenarioIndex].name,
      troop: this.data.troops[this.data.troopIndex],
      score: this.data.report.totalScore,
      generals: this.data.selectedGeneralsView.map((item) => item.name),
      tactics: this.data.selectedTacticsView.map((item) => item.name)
    };
    wx.setStorageSync(key, [lineup, ...saved.filter((item) => item.id !== lineup.id)]);

    if (!api.isRemoteMode()) {
      this.setData({ savedMessage: "已保存到本地，可在“我的”里查看。" });
      return;
    }

    this.setData({ savedMessage: "本地已保存，正在同步到远程服务端..." });
    api
      .saveLineupAsync({
        userId: "local-demo",
        lineup
      })
      .then(() => {
        this.setData({ savedMessage: "本地已保存，远程服务端同步成功。" });
      })
      .catch((error) => {
        this.setData({ savedMessage: `远程同步失败，本地阵容已保留：${error.message}` });
      });
  }
});
