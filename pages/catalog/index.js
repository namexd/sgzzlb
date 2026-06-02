const catalog = require("../../utils/catalog");
const api = require("../../services/api");

const TABS = [
  { key: "generals", name: "武将" },
  { key: "tactics", name: "战法" },
  { key: "equipment", name: "装备" },
  { key: "troopTactics", name: "兵种" }
];

Page({
  data: {
    tabs: TABS,
    activeTab: "generals",
    keyword: "",
    records: [],
    recordsView: [],
    meta: {},
    dataSource: "本地快照",
    loadStatus: ""
  },

  onLoad() {
    this.setData({ meta: catalog.getMeta() }, () => this.refreshRecords());
  },

  onShow() {
    this.refreshRecords();
  },

  switchTab(event) {
    this.setData(
      {
        activeTab: event.currentTarget.dataset.key,
        keyword: ""
      },
      () => this.refreshRecords()
    );
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => this.refreshRecords());
  },

  refreshRecords() {
    const activeTab = this.data.activeTab;
    const keyword = this.data.keyword;
    const remote = api.isRemoteMode();
    this.setData({
      loadStatus: remote ? "正在读取远程资料..." : "",
      dataSource: remote ? "远程 API" : "本地快照"
    });

    const loader = api.getRecordsAsync(activeTab, { keyword });

    loader
      .then((records) => {
        const recordsView = records.slice(0, 80).map((record) => this.toView(record));
        this.setData({
          records,
          recordsView,
          loadStatus: remote ? "已同步远程资料。" : ""
        });
      })
      .catch((error) => {
        const fallback = catalog.searchRecords(activeTab, keyword);
        this.setData({
          records: fallback,
          recordsView: fallback.slice(0, 80).map((record) => this.toView(record)),
          dataSource: "本地快照",
          loadStatus: `远程资料读取失败，已回退本地快照：${error.message}`
        });
      });
  },

  toView(record) {
    if (this.data.activeTab === "generals") {
      return {
        id: record.id,
        title: record.name,
        badge: record.faction || "武将",
        line1: `${record.cost || "-"}御 · ${record.star || "-"} · ${record.tags.join(" / ") || "未标记"}`,
        line2: `骑${record.arms.cavalry || "-"} 盾${record.arms.shield || "-"} 弓${record.arms.bow || "-"} 枪${record.arms.spear || "-"}`,
        desc: `自带：${record.tactics.innate || "-"}；传承：${record.tactics.inherited || "-"}`,
        assetStatus: record.asset && record.asset.status === "needs_generation" ? "待生成原创卡" : "已审核"
      };
    }
    if (this.data.activeTab === "tactics" || this.data.activeTab === "troopTactics") {
      return {
        id: record.id,
        title: record.name,
        badge: record.quality || "战法",
        line1: `${record.type || "-"} · ${record.source || "-"} · 来源 ${record.sourceGeneral || "-"}`,
        line2: `限制：${record.troopLimit.join(" / ") || "不限"}`,
        desc: this.clip(record.description || "暂无描述"),
        assetStatus: record.asset && record.asset.status === "needs_generation" ? "待生成原创图标" : "已审核"
      };
    }
    return {
      id: record.id,
      title: record.name,
      badge: record.quality || "装备",
      line1: `${record.type || "-"} · ${record.effect || "暂无特技"}`,
      line2: "官方图片字段未进入小程序包",
      desc: "",
      assetStatus: "文字资料"
    };
  },

  clip(text) {
    const value = String(text || "");
    return value.length > 96 ? `${value.slice(0, 96)}...` : value;
  }
});
