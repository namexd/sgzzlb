const subscription = require("../../utils/subscription");
const catalog = require("../../utils/catalog");
const assetPolicy = require("../../utils/assetPolicy");
const api = require("../../services/api");

Page({
  data: {
    entitlements: { tier: "free" },
    savedLineups: [],
    savedLineupsView: [],
    inventory: { generals: [], tactics: [] },
    meta: {},
    policy: {},
    apiConfig: {},
    apiDraftBaseUrl: "",
    apiStatus: "",
    apiRemoteSummary: null,
    inventorySummary: "",
    optimizeHint: "",
    optimizeLoading: false,
    optimizeResult: null,
    isLoggedIn: false,
    userProfile: null,
    loginLoading: false
  },

  onShow() {
    this.refresh();
    this.checkLoginState();
  },

  formatSavedLineups(savedLineups) {
    return savedLineups.map((item) => ({
      ...item,
      generalsText: (item.generals || []).join(" / "),
      tacticsText: (item.tactics || []).join(" / ")
    }));
  },

  mergeSavedLineups(localLineups, remoteLineups) {
    const byId = new Map();
    [...localLineups, ...remoteLineups].forEach((item) => {
      if (!item || !item.id) return;
      byId.set(item.id, item);
    });
    return Array.from(byId.values()).sort((a, b) =>
      String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))
    );
  },

  refresh() {
    const app = getApp();
    const savedLineups = wx.getStorageSync(app.globalData.savedLineupsKey) || [];
    const inventory = wx.getStorageSync(app.globalData.inventoryKey) || { generals: [], tactics: [] };
    this.setData(
      {
        entitlements: subscription.getEntitlements(),
        savedLineups,
        savedLineupsView: this.formatSavedLineups(savedLineups),
        inventory,
        meta: catalog.getMeta(),
        policy: assetPolicy.getGenerationPolicy(),
        apiConfig: api.getApiConfig(),
        apiDraftBaseUrl: api.getApiConfig().baseUrl
      },
      () => {
        this.updateInventorySummary();
        this.syncSavedLineupsIfRemote(savedLineups);
      }
    );
  },

  syncSavedLineupsIfRemote(localLineups) {
    if (!api.isRemoteMode()) return;
    api
      .getLineupsAsync({ userId: "local-demo" })
      .then((remoteLineups) => {
        const merged = this.mergeSavedLineups(localLineups, remoteLineups);
        wx.setStorageSync(getApp().globalData.savedLineupsKey, merged);
        this.setData({
          savedLineups: merged,
          savedLineupsView: this.formatSavedLineups(merged),
          apiStatus: `已同步远程保存阵容：${remoteLineups.length} 套，当前本地共 ${merged.length} 套。`
        });
      })
      .catch((error) => {
        this.setData({
          apiStatus: `远程阵容同步失败，本地保存不受影响：${error.message}`
        });
      });
  },

  togglePremium(event) {
    const tier = event.detail.value ? "premium" : "free";
    subscription.setTier(tier);
    if (api.isRemoteMode() && api.isLoggedIn()) {
      api.requestRemote("/api/v1/auth/set-tier", {
        method: "POST",
        data: { tier }
      }).then(() => {
        return subscription.syncEntitlements();
      }).then((entitlements) => {
        this.setData({ entitlements });
      }).catch(() => {});
    }
    this.refresh();
  },

  clearSaved() {
    wx.setStorageSync(getApp().globalData.savedLineupsKey, []);
    if (api.isRemoteMode()) {
      this.setData({
        savedLineups: [],
        savedLineupsView: [],
        apiStatus: "已清空本地保存；远程历史样本仍在后台保留。"
      });
      return;
    }
    this.refresh();
  },

  seedInventory() {
    const generals = catalog.getGenerals().slice(0, 18).map((item) => item.id);
    const tactics = catalog.getAllTactics().slice(0, 36).map((item) => item.id);
    wx.setStorageSync(getApp().globalData.inventoryKey, { generals, tactics });
    this.refresh();
  },

  updateInventorySummary() {
    const generals = this.data.inventory.generals || [];
    const tactics = this.data.inventory.tactics || [];
    this.setData({
      inventorySummary: `${generals.length} 名武将，${tactics.length} 个战法`
    });
  },

  toggleApiMode(event) {
    const mode = event.detail.value ? "remote" : "local";
    const nextConfig = api.setApiConfig({ mode, baseUrl: this.data.apiDraftBaseUrl });
    this.setData({
      apiConfig: nextConfig,
      apiStatus: mode === "remote" ? "已切换为远程 API，建议先检测连接。" : "已切回本地快照模式。",
      apiRemoteSummary: null
    });
  },

  onApiBaseUrlInput(event) {
    this.setData({ apiDraftBaseUrl: event.detail.value });
  },

  saveApiConfig() {
    const nextConfig = api.setApiConfig({ baseUrl: this.data.apiDraftBaseUrl });
    this.setData({
      apiConfig: nextConfig,
      apiStatus: `API 地址已保存：${nextConfig.baseUrl}`
    });
  },

  pingApi() {
    const nextConfig = api.setApiConfig({
      mode: "remote",
      baseUrl: this.data.apiDraftBaseUrl
    });
    this.setData({
      apiConfig: nextConfig,
      apiStatus: "正在检测服务端..."
    });
    api
      .getCatalogSummaryAsync()
      .then((summary) => {
        this.setData({
          apiRemoteSummary: summary,
          apiStatus: "服务端连接正常，已读取远程资料摘要。"
        });
      })
      .catch((error) => {
        api.setApiConfig({ mode: "local" });
        this.setData({
          apiConfig: api.getApiConfig(),
          apiRemoteSummary: null,
          apiStatus: `连接失败，已回退本地快照：${error.message}`
        });
      });
  },

  previewOptimize() {
    const generals = this.data.inventory.generals || [];
    const tactics = this.data.inventory.tactics || [];
    if (generals.length < 3 || tactics.length < 6) {
      this.setData({ optimizeHint: "库存不足。至少录入 3 名武将和 6 个战法才能组建一队。", optimizeResult: null });
      return;
    }
    const remote = api.isRemoteMode();
    this.setData({
      optimizeLoading: true,
      optimizeHint: remote ? "正在请求远程共存分析..." : "正在本地计算多队共存方案...",
      optimizeResult: null
    });
    api
      .optimizeAccountAsync({ generalIds: generals, tacticIds: tactics })
      .then((result) => {
        this.setData({
          optimizeLoading: false,
          optimizeHint: result.message,
          optimizeResult: result
        });
      })
      .catch((error) => {
        const fallback = api.optimizeAccount({ generalIds: generals, tacticIds: tactics });
        this.setData({
          optimizeLoading: false,
          optimizeHint: `远程分析失败，已回退本地：${error.message}`,
          optimizeResult: fallback
        });
      });
  },

  saveOptimizeLineup(event) {
    const index = Number(event.currentTarget.dataset.index);
    const result = this.data.optimizeResult;
    if (!result || !result.lineups || !result.lineups[index]) return;
    const lineup = result.lineups[index];
    const app = getApp();
    const key = app.globalData.savedLineupsKey;
    const saved = wx.getStorageSync(key) || [];
    const item = {
      id: `opt_${Date.now()}`,
      createdAt: new Date().toISOString(),
      scenario: lineup.scenario === "pk" ? "PK赛季" : lineup.scenario === "war" ? "打架" : "开荒",
      troop: lineup.troop,
      score: lineup.score,
      generals: lineup.generals,
      tactics: lineup.tactics,
      source: "optimize"
    };
    wx.setStorageSync(key, [item, ...saved.filter((s) => s.id !== item.id)]);
    this.setData({ optimizeHint: `已保存${lineup.role}阵容到本地。` });
  },

  clearOptimizeResult() {
    this.setData({ optimizeResult: null, optimizeHint: "" });
  },

  deleteLineup(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const app = getApp();
    const key = app.globalData.savedLineupsKey;
    const saved = wx.getStorageSync(key) || [];
    const next = saved.filter((item) => item.id !== id);
    wx.setStorageSync(key, next);

    if (api.isRemoteMode()) {
      api.deleteLineupAsync(id).catch(() => {});
    }
    this.setData({
      savedLineups: next,
      savedLineupsView: this.formatSavedLineups(next)
    });
  },

  goRoadmap() {
    wx.navigateTo({ url: "/pages/roadmap/index" });
  },

  checkLoginState() {
    if (!api.isRemoteMode()) {
      this.setData({ isLoggedIn: false, userProfile: null });
      subscription.clearCachedEntitlements();
      return;
    }
    const loggedIn = api.isLoggedIn();
    this.setData({ isLoggedIn: loggedIn });
    if (loggedIn) {
      Promise.all([
        api.getProfile(),
        subscription.syncEntitlements()
      ]).then(([profileData, entitlements]) => {
        this.setData({
          userProfile: profileData.user || null,
          entitlements
        });
      }).catch(() => {
        this.setData({ isLoggedIn: false, userProfile: null });
      });
    } else {
      subscription.clearCachedEntitlements();
      this.setData({ entitlements: subscription.getEntitlements() });
    }
  },

  doLogin() {
    if (!api.isRemoteMode()) {
      this.setData({ apiStatus: "请先切换为远程 API 模式再登录。" });
      return;
    }
    this.setData({ loginLoading: true, apiStatus: "正在登录..." });
    api.wxLogin().then((data) => {
      this.setData({
        loginLoading: false,
        isLoggedIn: true,
        apiStatus: "登录成功。"
      });
      this.checkLoginState();
    }).catch((err) => {
      this.setData({
        loginLoading: false,
        apiStatus: `登录失败：${err.message}`
      });
    });
  },

  doLogout() {
    api.logout();
    this.setData({
      isLoggedIn: false,
      userProfile: null,
      apiStatus: "已退出登录。"
    });
  }
});
