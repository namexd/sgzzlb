const catalog = require("../../utils/catalog");
const subscription = require("../../utils/subscription");
const api = require("../../services/api");

const ENEMY_TEMPLATES = [
  {
    name: "太尉盾",
    troop: "盾兵",
    scenario: "pk",
    generals: ["司马懿", "曹操", "满宠"],
    tactics: ["士别三日", "用武通神", "魅惑", "抚辑军民", "锋矢阵", "刮骨疗毒"]
  },
  {
    name: "吴骑",
    troop: "骑兵",
    scenario: "war",
    generals: ["孙尚香", "凌统", "周泰"],
    tactics: ["裸衣血战", "虎踞鹰扬", "卧薪尝胆", "横扫千军", "盛气凌敌", "西凉铁骑"]
  },
  {
    name: "麒麟弓",
    troop: "弓兵",
    scenario: "pk",
    generals: ["姜维", "庞统", "诸葛亮"],
    tactics: ["夺魂挟魄", "杯蛇鬼车", "太平道法", "士别三日", "八门金锁阵", "婴城自守"]
  },
  {
    name: "关关张",
    troop: "枪兵",
    scenario: "war",
    generals: ["关羽", "关银屏", "张飞"],
    tactics: ["威谋靡亢", "箕形阵", "据水断桥", "青州兵", "横扫千军", "盛气凌敌"]
  },
  {
    name: "虎臣弓",
    troop: "弓兵",
    scenario: "pk",
    generals: ["甘宁", "太史慈", "程普"],
    tactics: ["万箭齐发", "避实击虚", "折冲御侮", "白马义从", "当锋摧决", "弯弓饮羽"]
  },
  {
    name: "三势吕",
    troop: "骑兵",
    scenario: "pk",
    generals: ["吕布", "郭嘉", "黄月英"],
    tactics: ["一骑当千", "暴戾无仁", "虎豹骑", "铁骑驱驰", "三势阵", "横戈跃马"]
  },
  {
    name: "桃园盾",
    troop: "盾兵",
    scenario: "war",
    generals: ["刘备", "关羽", "张飞"],
    tactics: ["陷阵营", "暂避其锋", "落凤", "横扫千军", "盛气凌敌", "刮骨疗毒"]
  },
  {
    name: "蜀智",
    troop: "弓兵",
    scenario: "pk",
    generals: ["诸葛亮", "庞统", "法正"],
    tactics: ["夺魂挟魄", "杯蛇鬼车", "太平道法", "无当飞军", "八门金锁阵", "婴城自守"]
  },
  {
    name: "魏骑",
    troop: "骑兵",
    scenario: "pk",
    generals: ["曹操", "夏侯惇", "程昱"],
    tactics: ["锋矢阵", "抚辑军民", "刮骨疗毒", "士别三日", "用武通神", "焰逐风飞"]
  },
  {
    name: "群弓",
    troop: "弓兵",
    scenario: "war",
    generals: ["袁绍", "朱儁", "陈宫"],
    tactics: ["万箭齐发", "无当飞军", "焰逐风飞", "暂避其锋", "八门金锁阵", "婴城自守"]
  },
  {
    name: "吴枪",
    troop: "枪兵",
    scenario: "pk",
    generals: ["孙权", "鲁肃", "周瑜"],
    tactics: ["兵无常势", "焰逐风飞", "刮骨疗毒", "当锋摧决", "折冲御侮", "白马义从"]
  },
  {
    name: "碰瓷骑",
    troop: "骑兵",
    scenario: "war",
    generals: ["马超", "马云禄", "庞德"],
    tactics: ["裸衣血战", "虎踞鹰扬", "西凉铁骑", "铁骑驱驰", "横戈跃马", "暴戾无仁"]
  }
];

Page({
  data: {
    entitlements: { tier: "free" },
    enemyTemplates: ENEMY_TEMPLATES,
    enemyIndex: 0,
    enemySource: "template",
    savedLineups: [],
    savedEnemyIndex: 0,
    ownSummary: null,
    enemySummary: null,
    result: null,
    savedCount: 0,
    isLoading: false,
    apiStatus: "",
    showBattleForm: false,
    battleForm: null,
    battleStats: null,
    showStats: false,
    battleRecords: []
  },

  onShow() {
    const saved = wx.getStorageSync(getApp().globalData.savedLineupsKey) || [];
    const savedView = saved.map((item) => ({
      ...item,
      generalsText: (item.generals || []).join(" / ")
    }));
    this.setData({
      entitlements: subscription.getEntitlements(),
      savedLineups: savedView
    }, () => this.refresh());
  },

  onEnemyChange(event) {
    this.setData({ enemyIndex: Number(event.detail.value) }, () => this.refresh());
  },

  onEnemySourceChange(event) {
    const val = event.currentTarget.dataset.value;
    const source = val === "1" ? "saved" : "template";
    this.setData({ enemySource: source }, () => this.refresh());
  },

  onSavedEnemyChange(event) {
    this.setData({ savedEnemyIndex: Number(event.detail.value) }, () => this.refresh());
  },

  refresh() {
    const saved = wx.getStorageSync(getApp().globalData.savedLineupsKey) || [];
    const ownInput = saved.length ? this.savedToInput(saved[0]) : this.defaultOwnInput();

    let enemyInput;
    let enemyName;
    if (this.data.enemySource === "saved" && this.data.savedLineups.length > 0) {
      const idx = Math.min(this.data.savedEnemyIndex, this.data.savedLineups.length - 1);
      const enemySaved = this.data.savedLineups[idx];
      enemyInput = this.savedToInput(enemySaved);
      enemyName = enemySaved.generals ? enemySaved.generals.join(" / ") : "自选阵容";
    } else {
      const template = this.data.enemyTemplates[this.data.enemyIndex];
      enemyInput = this.templateToInput(template);
      enemyName = template.name;
    }

    const payload = { own: ownInput, enemy: enemyInput };
    const remote = api.isRemoteMode();
    this.setData({
      savedCount: saved.length,
      isLoading: true,
      apiStatus: remote ? "正在请求远程对位服务..." : "使用本地规则预览对位。"
    });
    api
      .previewMatchupAsync(payload)
      .then((preview) => this.applyPreview(saved[0], ownInput, enemyInput, preview, remote ? "对位结果来自远程 API。" : "对位结果来自本地规则。", enemyName))
      .catch((error) => {
        const fallback = api.previewMatchup(payload);
        this.applyPreview(saved[0], ownInput, enemyInput, fallback, `远程对位失败，已回退本地规则：${error.message}`, enemyName);
      });
  },

  applyPreview(saved, ownInput, enemyInput, preview, statusText, enemyName) {
    this.setData({
      isLoading: false,
      apiStatus: statusText,
      ownSummary: this.toSummary(saved, ownInput, preview.own),
      enemySummary: this.toSummary({ name: enemyName }, enemyInput, preview.enemy),
      result: preview.result
    });
  },

  defaultOwnInput() {
    return this.templateToInput({
      troop: "盾兵",
      scenario: "pk",
      generals: ["曹操", "刘备", "孙权"],
      tactics: ["乱世奸雄", "梦中弑臣", "义心昭烈", "义心昭烈", "坐断东南", "卧薪尝胆"]
    });
  },

  savedToInput(saved) {
    const generals = saved.generals || [];
    const tactics = saved.tactics || [];
    return {
      troop: saved.troop || "骑兵",
      scenario: saved.scenario === "开荒" ? "pioneer" : saved.scenario === "打架" ? "war" : "pk",
      generalIds: this.namesToGeneralIds(generals),
      tacticIds: this.namesToTacticIds(tactics),
      redLevels: [0, 0, 0]
    };
  },

  templateToInput(template) {
    return {
      troop: template.troop,
      scenario: template.scenario,
      generalIds: this.namesToGeneralIds(template.generals),
      tacticIds: this.namesToTacticIds(template.tactics),
      redLevels: [0, 0, 0]
    };
  },

  namesToGeneralIds(names) {
    const generals = catalog.getGenerals();
    return names.map((name, index) => {
      const found = generals.find((item) => item.name === name);
      return found ? found.id : generals[index].id;
    });
  },

  namesToTacticIds(names) {
    const tactics = catalog.getAllTactics();
    return names.map((name, index) => {
      const found = tactics.find((item) => item.name === name);
      return found ? found.id : tactics[index].id;
    });
  },

  toSummary(source, input, report) {
    const generals = (input.generalIds || []).map((id) => catalog.findGeneralById(id)).filter(Boolean);
    return {
      name: source && source.name ? source.name : "我的最近保存阵容",
      troop: input.troop,
      score: report.totalScore,
      confidence: report.confidence,
      generalsText: generals.map((item) => item.name).join(" / "),
      topWeakness: report.weaknesses[0]
    };
  },

  showBattleForm() {
    if (!this.data.ownSummary || !this.data.enemySummary) return;
    this.setData({
      showBattleForm: true,
      battleForm: {
        result: "win",
        damageTaken: 0,
        damageDealt: 0,
        rounds: 0,
        note: ""
      }
    });
  },

  closeBattleForm() {
    this.setData({ showBattleForm: false, battleForm: null });
  },

  setBattleResult(e) {
    const form = { ...this.data.battleForm };
    form.result = e.currentTarget.dataset.result;
    this.setData({ battleForm: form });
  },

  onBattleInput(e) {
    const field = e.currentTarget.dataset.field;
    const form = { ...this.data.battleForm };
    form[field] = field === "note" ? e.detail.value : Number(e.detail.value) || 0;
    this.setData({ battleForm: form });
  },

  submitBattleReport() {
    const form = this.data.battleForm;
    if (!form || !this.data.ownSummary || !this.data.enemySummary) return;

    const report = {
      ownGenerals: this.data.ownSummary.generalsText.split(" / "),
      ownTactics: [],
      ownTroop: this.data.ownSummary.troop,
      ownScore: this.data.ownSummary.score,
      enemyGenerals: this.data.enemySummary.generalsText.split(" / "),
      enemyTactics: [],
      enemyTroop: this.data.enemySummary.troop,
      enemyScore: this.data.enemySummary.score,
      result: form.result,
      damageTaken: form.damageTaken,
      damageDealt: form.damageDealt,
      rounds: form.rounds,
      note: form.note
    };

    this.setData({ apiStatus: "正在记录战报..." });
    api
      .addBattleReportAsync(report)
      .then(() => {
        this.setData({
          showBattleForm: false,
          battleForm: null,
          apiStatus: "战报已记录。"
        });
      })
      .catch((err) => {
        this.setData({ apiStatus: `战报记录失败：${err.message}` });
      });
  },

  loadBattleStats() {
    this.setData({ apiStatus: "正在加载战报统计..." });
    Promise.all([
      api.getBattleReportStatsAsync(),
      api.getBattleReportsAsync({ limit: 20 })
    ])
      .then(([statsRes, reportsRes]) => {
        this.setData({
          battleStats: statsRes.stats || statsRes,
          battleRecords: reportsRes.items || [],
          showStats: true,
          apiStatus: ""
        });
      })
      .catch((err) => {
        this.setData({ apiStatus: `加载战报失败：${err.message}` });
      });
  },

  closeStats() {
    this.setData({ showStats: false });
  },

  deleteBattleRecord(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    api.deleteBattleReportAsync(id).then(() => {
      const records = this.data.battleRecords.filter((r) => r.id !== id);
      this.setData({ battleRecords: records });
    });
  },

  noop() {}
});
