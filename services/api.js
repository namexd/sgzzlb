const catalog = require("../utils/catalog");
const scoring = require("../utils/scoring");
const optimizer = require("../utils/optimizer");
const simulator = require("../utils/simulator");

const DEFAULT_API_CONFIG = {
  mode: "local",
  baseUrl: "http://127.0.0.1:8787",
  adminToken: ""
};

function hasWxRuntime() {
  return typeof wx !== "undefined" && typeof wx.request === "function";
}

function getApiConfig() {
  if (!hasWxRuntime() || typeof wx.getStorageSync !== "function") {
    return { ...DEFAULT_API_CONFIG };
  }
  return {
    ...DEFAULT_API_CONFIG,
    ...(wx.getStorageSync("apiConfig") || {})
  };
}

function setApiConfig(nextConfig) {
  const config = {
    ...getApiConfig(),
    ...(nextConfig || {})
  };
  if (hasWxRuntime() && typeof wx.setStorageSync === "function") {
    wx.setStorageSync("apiConfig", config);
  }
  return config;
}

function shouldUseRemote() {
  const config = getApiConfig();
  return config.mode === "remote" && hasWxRuntime();
}

function isRemoteMode() {
  return getApiConfig().mode === "remote";
}

function getAuthToken() {
  if (!hasWxRuntime() || typeof wx.getStorageSync !== "function") return "";
  return wx.getStorageSync("authToken") || "";
}

function setAuthToken(token) {
  if (hasWxRuntime() && typeof wx.setStorageSync === "function") {
    wx.setStorageSync("authToken", token);
  }
}

function clearAuthToken() {
  if (hasWxRuntime() && typeof wx.removeStorageSync === "function") {
    wx.removeStorageSync("authToken");
  }
}

function requestRemote(path, options = {}) {
  const config = getApiConfig();
  const method = options.method || "GET";
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {})
  };
  if (config.adminToken) headers["x-admin-token"] = config.adminToken;
  const authToken = getAuthToken();
  if (authToken) headers["authorization"] = `Bearer ${authToken}`;

  return new Promise((resolve, reject) => {
    if (!hasWxRuntime()) {
      reject(new Error("当前运行环境不支持 wx.request。"));
      return;
    }
    wx.request({
      url: `${config.baseUrl}${path}`,
      method,
      data: options.data || {},
      header: headers,
      success(response) {
        const body = response.data || {};
        if (response.statusCode >= 200 && response.statusCode < 300 && body.ok !== false) {
          resolve(body.data !== undefined ? body.data : body);
          return;
        }
        reject(new Error(body.message || `接口请求失败：${response.statusCode}`));
      },
      fail(error) {
        reject(new Error(error && error.errMsg ? error.errMsg : "接口请求失败。"));
      }
    });
  });
}

function withQuery(path, params = {}) {
  const pairs = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
  return pairs.length ? `${path}?${pairs.join("&")}` : path;
}

function normalizePagedList(response) {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response.items)) return response.items;
  return [];
}

function fetchAllPagedRemote(path, params = {}) {
  const pageSize = 100;
  const firstParams = { ...params, page: 1, pageSize };
  return requestRemote(withQuery(path, firstParams)).then((first) => {
    const firstItems = normalizePagedList(first);
    const totalPages = Number(first && first.totalPages) || 1;
    if (totalPages <= 1) return firstItems;

    const tasks = [];
    for (let page = 2; page <= totalPages; page += 1) {
      tasks.push(requestRemote(withQuery(path, { ...params, page, pageSize })));
    }
    return Promise.all(tasks).then((pages) =>
      pages.reduce((items, pageResult) => items.concat(normalizePagedList(pageResult)), firstItems)
    );
  });
}

function getCatalogSummary() {
  const meta = catalog.getMeta();
  return normalizeCatalogSummary({
    generalsCount: meta.generalsCount || catalog.getGenerals().length,
    tacticsCount: meta.tacticsCount || catalog.getTactics().length,
    equipmentCount: meta.equipmentCount || catalog.getEquipment().length,
    troopTacticsCount: meta.troopTacticsCount || catalog.getTroopTactics().length,
    source: meta.source,
    fetchedAt: meta.fetchedAt,
    officialMediaUrlsExcluded: meta.officialMediaUrlsExcluded === true
  });
}

function normalizeCatalogSummary(summary = {}) {
  const counts = summary.counts || {};
  const meta = summary.meta || {};
  return {
    ...summary,
    generalsCount: summary.generalsCount || counts.generals || meta.generalsCount || 0,
    tacticsCount: summary.tacticsCount || counts.tactics || meta.tacticsCount || 0,
    equipmentCount: summary.equipmentCount || counts.equipment || meta.equipmentCount || 0,
    troopTacticsCount: summary.troopTacticsCount || counts.troopTactics || meta.troopTacticsCount || 0,
    source: summary.source || meta.source,
    fetchedAt: summary.fetchedAt || meta.fetchedAt,
    officialMediaUrlsExcluded:
      summary.officialMediaUrlsExcluded === true || meta.officialMediaUrlsExcluded === true
  };
}

function getGenerals(params = {}) {
  return catalog.searchRecords("generals", params.keyword || "");
}

function getTactics(params = {}) {
  return catalog.searchRecords("tactics", params.keyword || "");
}

function getEquipment(params = {}) {
  return catalog.searchRecords("equipment", params.keyword || "");
}

function getTroopTactics(params = {}) {
  return catalog.searchRecords("troopTactics", params.keyword || "");
}

function getRecords(type, params = {}) {
  const map = {
    generals: getGenerals,
    tactics: getTactics,
    equipment: getEquipment,
    troopTactics: getTroopTactics
  };
  return (map[type] || (() => []))(params);
}

function analyzeLineup(payload) {
  return scoring.analyzeLineup(payload);
}

function previewMatchup(payload) {
  const sharedContext = {
    catalogSnapshot: payload.catalogSnapshot,
    catalogContext: payload.catalogContext,
    catalogVersionId: payload.catalogVersionId,
    season: payload.season
  };
  let simulation = null;
  let ownSimulationStats = null;
  let enemySimulationStats = null;
  if (payload.simulate) {
    simulation = simulator.simulate(payload);
    ownSimulationStats = scoring.buildSimulationStats(simulation, "own");
    enemySimulationStats = scoring.buildSimulationStats(simulation, "enemy");
  }
  const own = scoring.analyzeLineup({ ...sharedContext, ...(payload.own || {}), simulationStats: ownSimulationStats || payload.own?.simulationStats });
  const enemy = scoring.analyzeLineup({ ...sharedContext, ...(payload.enemy || {}), simulationStats: enemySimulationStats || payload.enemy?.simulationStats });
  const result = scoring.compareLineups(own, enemy);
  if (simulation) {
    result.simulation = ownSimulationStats;
  }
  return {
    own,
    enemy,
    result,
    catalogContext: payload.catalogContext || null
  };
}

function simulateBattle(payload) {
  return simulator.simulate(payload);
}

function optimizeAccount(payload = {}) {
  return optimizer.optimizeLineups(payload);
}

function importBattleReport(payload = {}) {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/battle-reports", {
      method: "POST",
      data: payload
    });
  }
  return {
    status: "ok",
    sourceType: payload.sourceType || "manual",
    message: "战报已记录（本地模式不会持久化）。"
  };
}

function getLocalSavedLineups() {
  if (!hasWxRuntime() || typeof wx.getStorageSync !== "function") return [];
  return wx.getStorageSync("savedLineups") || [];
}

function saveLocalLineup(payload = {}) {
  const item = payload.lineup || payload;
  return {
    ok: true,
    item
  };
}

function deleteLocalLineup(id) {
  if (!hasWxRuntime() || typeof wx.getStorageSync !== "function" || typeof wx.setStorageSync !== "function") {
    return { ok: true, deleted: 0 };
  }
  const saved = getLocalSavedLineups();
  const next = saved.filter((item) => item.id !== id);
  wx.setStorageSync("savedLineups", next);
  return { ok: true, deleted: saved.length - next.length };
}

function getCatalogSummaryAsync() {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/catalog/summary").then((summary) => normalizeCatalogSummary(summary));
  }
  return Promise.resolve(getCatalogSummary());
}

function getGeneralsAsync(params = {}) {
  if (shouldUseRemote()) return fetchAllPagedRemote("/api/v1/catalog/generals", params);
  return Promise.resolve(getGenerals(params));
}

function getTacticsAsync(params = {}) {
  if (shouldUseRemote()) return fetchAllPagedRemote("/api/v1/catalog/tactics", params);
  return Promise.resolve(getTactics(params));
}

function getEquipmentAsync(params = {}) {
  if (shouldUseRemote()) return fetchAllPagedRemote("/api/v1/catalog/equipment", params);
  return Promise.resolve(getEquipment(params));
}

function getTroopTacticsAsync(params = {}) {
  if (shouldUseRemote()) return fetchAllPagedRemote("/api/v1/catalog/troop-tactics", params);
  return Promise.resolve(getTroopTactics(params));
}

function getRecordsAsync(type, params = {}) {
  const map = {
    generals: getGeneralsAsync,
    tactics: getTacticsAsync,
    equipment: getEquipmentAsync,
    troopTactics: getTroopTacticsAsync
  };
  return (map[type] || (() => Promise.resolve([])))(params);
}

function analyzeLineupAsync(payload) {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/lineups/analyze", {
      method: "POST",
      data: payload
    });
  }
  return Promise.resolve(analyzeLineup(payload));
}

function getLineupsAsync(params = {}) {
  if (shouldUseRemote()) {
    return fetchAllPagedRemote("/api/v1/lineups", params);
  }
  return Promise.resolve(getLocalSavedLineups());
}

function saveLineup(payload = {}) {
  return saveLocalLineup(payload);
}

function saveLineupAsync(payload = {}) {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/lineups", {
      method: "POST",
      data: payload
    });
  }
  return Promise.resolve(saveLineup(payload));
}

function deleteLineupAsync(id, params = {}) {
  if (shouldUseRemote()) {
    return requestRemote(withQuery(`/api/v1/lineups/${encodeURIComponent(id)}`, params), {
      method: "DELETE"
    });
  }
  return Promise.resolve(deleteLocalLineup(id));
}

function previewMatchupAsync(payload) {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/matchups/preview", {
      method: "POST",
      data: payload
    });
  }
  return Promise.resolve(previewMatchup(payload));
}

function simulateBattleAsync(payload) {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/battles/simulate", {
      method: "POST",
      data: payload
    });
  }
  return Promise.resolve(simulateBattle(payload));
}

function optimizeAccountAsync(payload) {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/accounts/optimize", {
      method: "POST",
      data: payload
    });
  }
  return Promise.resolve(optimizeAccount(payload));
}

function importBattleReportAsync(payload) {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/battle-reports/import", {
      method: "POST",
      data: payload
    });
  }
  return Promise.resolve(importBattleReport(payload));
}

// --- Draw pools & records (remote) ---

function getDrawPoolsAsync() {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/draw-pools").then(function (res) {
      return Array.isArray(res) ? res : (res.items || []);
    });
  }
  return Promise.resolve(require("../utils/drawStorage").getPools());
}

function createDrawPoolAsync(pool) {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/draw-pools", { method: "POST", data: pool });
  }
  return Promise.resolve({ ok: true, item: require("../utils/drawStorage").createPool(pool.name) });
}

function deleteDrawPoolAsync(poolId) {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/draw-pools/" + encodeURIComponent(poolId), { method: "DELETE" });
  }
  require("../utils/drawStorage").deletePool(poolId);
  return Promise.resolve({ ok: true });
}

function getDrawRecordsAsync(poolId) {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/draw-records?poolId=" + encodeURIComponent(poolId)).then(function (res) {
      return Array.isArray(res) ? res : (res.items || []);
    });
  }
  return Promise.resolve(require("../utils/drawStorage").getRecords(poolId));
}

function addDrawRecordAsync(record) {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/draw-records", { method: "POST", data: record });
  }
  return Promise.resolve({ ok: true, item: require("../utils/drawStorage").addRecord(record.poolId, record) });
}

function deleteDrawRecordAsync(poolId, recordId) {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/draw-records/" + encodeURIComponent(recordId), { method: "DELETE" });
  }
  require("../utils/drawStorage").deleteRecord(poolId, recordId);
  return Promise.resolve({ ok: true });
}

function syncDrawRecordsAsync(records) {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/draw-records/sync", { method: "POST", data: { records: records } });
  }
  return Promise.resolve({ ok: true, added: 0, total: records.length });
}

// --- Battle Reports ---

function addBattleReportAsync(report) {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/battle-reports", {
      method: "POST",
      data: report
    });
  }
  return Promise.resolve({ ok: true, item: report });
}

function getBattleReportsAsync(params = {}) {
  if (shouldUseRemote()) {
    const query = {};
    if (params.limit) query.limit = params.limit;
    if (params.offset) query.offset = params.offset;
    return requestRemote(withQuery("/api/v1/battle-reports", query));
  }
  return Promise.resolve({ items: [] });
}

function getBattleReportStatsAsync() {
  if (shouldUseRemote()) {
    return requestRemote("/api/v1/battle-reports/stats");
  }
  return Promise.resolve({
    ok: true,
    stats: { total: 0, wins: 0, losses: 0, draws: 0, winRate: 0, byTroop: [], recentTrend: "0/0" }
  });
}

function deleteBattleReportAsync(id) {
  if (shouldUseRemote()) {
    return requestRemote(`/api/v1/battle-reports/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
  return Promise.resolve({ ok: true, deleted: 1 });
}

// --- Auth ---

function wxLogin() {
  return new Promise((resolve, reject) => {
    if (!hasWxRuntime()) {
      reject(new Error("当前运行环境不支持 wx.login。"));
      return;
    }
    wx.login({
      success(loginRes) {
        if (!loginRes.code) {
          reject(new Error("wx.login 未返回 code。"));
          return;
        }
        requestRemote("/api/v1/auth/wechat-login", {
          method: "POST",
          data: { code: loginRes.code }
        })
          .then((data) => {
            if (data.token) setAuthToken(data.token);
            resolve(data);
          })
          .catch(reject);
      },
      fail(err) {
        reject(new Error(err.errMsg || "wx.login 调用失败。"));
      }
    });
  });
}

function getProfile() {
  return requestRemote("/api/v1/auth/profile");
}

function isLoggedIn() {
  return !!getAuthToken();
}

function logout() {
  clearAuthToken();
}

module.exports = {
  getApiConfig,
  setApiConfig,
  isRemoteMode,
  requestRemote,
  normalizeCatalogSummary,
  getCatalogSummary,
  getGenerals,
  getTactics,
  getEquipment,
  getTroopTactics,
  getRecords,
  analyzeLineup,
  previewMatchup,
  simulateBattle,
  optimizeAccount,
  importBattleReport,
  saveLineup,
  getCatalogSummaryAsync,
  getGeneralsAsync,
  getTacticsAsync,
  getEquipmentAsync,
  getTroopTacticsAsync,
  getRecordsAsync,
  analyzeLineupAsync,
  getLineupsAsync,
  saveLineupAsync,
  deleteLineupAsync,
  previewMatchupAsync,
  simulateBattleAsync,
  optimizeAccountAsync,
  importBattleReportAsync,
  getDrawPoolsAsync,
  createDrawPoolAsync,
  deleteDrawPoolAsync,
  getDrawRecordsAsync,
  addDrawRecordAsync,
  deleteDrawRecordAsync,
  syncDrawRecordsAsync,
  addBattleReportAsync,
  getBattleReportsAsync,
  getBattleReportStatsAsync,
  deleteBattleReportAsync,
  wxLogin,
  getProfile,
  isLoggedIn,
  logout,
  getAuthToken
};
