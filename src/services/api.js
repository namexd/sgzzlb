import { getStorage, setStorage, removeStorage } from "../utils/storage";
import { analyzeLineup as localAnalyze, compareLineups } from "../utils/scoring";
import { optimizeLineups } from "../utils/optimizer";
import * as catalog from "../utils/catalog";

const DEFAULT_API_CONFIG = { mode: "local", baseUrl: "http://127.0.0.1:8787", adminToken: "" };

export function getApiConfig() {
  return { ...DEFAULT_API_CONFIG, ...(getStorage("apiConfig") || {}) };
}

export function setApiConfig(nextConfig) {
  const config = { ...getApiConfig(), ...(nextConfig || {}) };
  setStorage("apiConfig", config);
  return config;
}

export function isRemoteMode() {
  return getApiConfig().mode === "remote";
}

export function shouldUseRemote() {
  return isRemoteMode();
}

export function getAuthToken() {
  return getStorage("authToken") || "";
}

export function setAuthToken(token) {
  setStorage("authToken", token);
}

export function clearAuthToken() {
  removeStorage("authToken");
}

export function isLoggedIn() {
  return !!getAuthToken();
}

export function logout() {
  clearAuthToken();
}

function requestRemote(path, options = {}) {
  const config = getApiConfig();
  const method = options.method || "GET";
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  const authToken = getAuthToken();
  if (authToken) headers["authorization"] = `Bearer ${authToken}`;
  if (config.adminToken) headers["x-admin-token"] = config.adminToken;

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${config.baseUrl}${path}`,
      method,
      data: options.data || {},
      header: headers,
      success(response) {
        const body = response.data || {};
        if (response.statusCode >= 200 && response.statusCode < 300 && body.ok !== false) {
          resolve(body.data !== undefined ? body.data : body);
        } else {
          reject(new Error(body.message || `请求失败：${response.statusCode}`));
        }
      },
      fail(error) {
        reject(new Error(error.errMsg || "请求失败"));
      }
    });
  });
}

export { requestRemote };

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

// --- Auth ---
export function wxLogin() {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    uni.login({
      provider: "weixin",
      success(loginRes) {
        if (!loginRes.code) { reject(new Error("登录失败")); return; }
        requestRemote("/api/v1/auth/wechat-login", { method: "POST", data: { code: loginRes.code } })
          .then((data) => { if (data.token) setAuthToken(data.token); resolve(data); })
          .catch(reject);
      },
      fail(err) { reject(new Error(err.errMsg || "登录失败")); }
    });
    // #endif
    // #ifdef H5
    const anonymousId = getStorage("anonymousId") || "h5_" + Date.now();
    setStorage("anonymousId", anonymousId);
    requestRemote("/api/v1/auth/anonymous-login", { method: "POST", data: { userId: anonymousId } })
      .then((data) => { if (data.token) setAuthToken(data.token); resolve(data); })
      .catch(reject);
    // #endif
  });
}

export function getProfile() {
  return requestRemote("/api/v1/auth/profile");
}

// --- Catalog (local + remote) ---
export function getCatalogSummary() {
  if (shouldUseRemote()) return requestRemote("/api/v1/catalog/summary");
  const meta = catalog.getMeta();
  return Promise.resolve({ generalsCount: meta.generalsCount || catalog.getGenerals().length, tacticsCount: meta.tacticsCount || catalog.getTactics().length, equipmentCount: meta.equipmentCount || catalog.getEquipment().length, troopTacticsCount: meta.troopTacticsCount || catalog.getTroopTactics().length, source: meta.source, fetchedAt: meta.fetchedAt });
}

export function getGenerals(params = {}) {
  if (shouldUseRemote()) return requestRemote("/api/v1/catalog/generals", { data: params });
  return Promise.resolve(catalog.searchRecords("generals", params.keyword || ""));
}

export function getTactics(params = {}) {
  if (shouldUseRemote()) return requestRemote("/api/v1/catalog/tactics", { data: params });
  return Promise.resolve(catalog.searchRecords("tactics", params.keyword || ""));
}

export function getEquipment(params = {}) {
  if (shouldUseRemote()) return requestRemote("/api/v1/catalog/equipment", { data: params });
  return Promise.resolve(catalog.searchRecords("equipment", params.keyword || ""));
}

export function getTroopTactics(params = {}) {
  if (shouldUseRemote()) return requestRemote("/api/v1/catalog/troop-tactics", { data: params });
  return Promise.resolve(catalog.searchRecords("troopTactics", params.keyword || ""));
}

export function getRecords(type, params = {}) {
  const map = { generals: getGenerals, tactics: getTactics, equipment: getEquipment, troopTactics: getTroopTactics };
  return (map[type] || (() => Promise.resolve([])))(params);
}

// --- Lineups ---
export function analyzeLineupAsync(payload) {
  if (shouldUseRemote()) return requestRemote("/api/v1/lineups/analyze", { method: "POST", data: payload });
  return Promise.resolve(localAnalyze(payload));
}

export function previewMatchupAsync(payload) {
  if (shouldUseRemote()) return requestRemote("/api/v1/matchups/preview", { method: "POST", data: payload });
  const own = localAnalyze(payload.own || {});
  const enemy = localAnalyze(payload.enemy || {});
  return Promise.resolve({ own, enemy, result: compareLineups(own, enemy) });
}

export function optimizeAccountAsync(payload) {
  if (shouldUseRemote()) return requestRemote("/api/v1/accounts/optimize", { method: "POST", data: payload });
  return Promise.resolve(optimizeLineups(payload));
}

export function getLineupsAsync(params = {}) {
  if (shouldUseRemote()) return requestRemote("/api/v1/lineups", { data: params });
  return Promise.resolve(getStorage("savedLineups") || []);
}

export function saveLineupAsync(payload = {}) {
  if (shouldUseRemote()) return requestRemote("/api/v1/lineups", { method: "POST", data: payload });
  const item = payload.lineup || payload;
  return Promise.resolve({ ok: true, item });
}

export function deleteLineupAsync(id) {
  if (shouldUseRemote()) return requestRemote(`/api/v1/lineups/${encodeURIComponent(id)}`, { method: "DELETE" });
  const saved = getStorage("savedLineups") || [];
  const next = saved.filter((item) => item.id !== id);
  setStorage("savedLineups", next);
  return Promise.resolve({ ok: true, deleted: saved.length - next.length });
}

// --- Battle Reports ---
export function addBattleReportAsync(report) {
  if (shouldUseRemote()) return requestRemote("/api/v1/battle-reports", { method: "POST", data: report });
  return Promise.resolve({ ok: true, item: report });
}

export function getBattleReportsAsync(params = {}) {
  if (shouldUseRemote()) {
    const query = {};
    if (params.limit) query.limit = params.limit;
    if (params.offset) query.offset = params.offset;
    return requestRemote(withQuery("/api/v1/battle-reports", query));
  }
  return Promise.resolve({ items: [] });
}

export function getBattleReportStatsAsync() {
  if (shouldUseRemote()) return requestRemote("/api/v1/battle-reports/stats");
  return Promise.resolve({ ok: true, stats: { total: 0, wins: 0, losses: 0, draws: 0, winRate: 0, byTroop: [], recentTrend: "0/0" } });
}

export function deleteBattleReportAsync(id) {
  if (shouldUseRemote()) return requestRemote(`/api/v1/battle-reports/${encodeURIComponent(id)}`, { method: "DELETE" });
  return Promise.resolve({ ok: true, deleted: 1 });
}

// --- Draw Pools & Records ---
export function getDrawPoolsAsync() {
  if (shouldUseRemote()) return requestRemote("/api/v1/draw-pools").then((res) => Array.isArray(res) ? res : (res.items || []));
  return Promise.resolve(require("../utils/drawStorage").getPools());
}

export function createDrawPoolAsync(pool) {
  if (shouldUseRemote()) return requestRemote("/api/v1/draw-pools", { method: "POST", data: pool });
  return Promise.resolve({ ok: true, item: require("../utils/drawStorage").createPool(pool.name) });
}

export function deleteDrawPoolAsync(poolId) {
  if (shouldUseRemote()) return requestRemote("/api/v1/draw-pools/" + encodeURIComponent(poolId), { method: "DELETE" });
  require("../utils/drawStorage").deletePool(poolId);
  return Promise.resolve({ ok: true });
}

export function getDrawRecordsAsync(poolId) {
  if (shouldUseRemote()) return requestRemote("/api/v1/draw-records?poolId=" + encodeURIComponent(poolId)).then((res) => Array.isArray(res) ? res : (res.items || []));
  return Promise.resolve(require("../utils/drawStorage").getRecords(poolId));
}

export function addDrawRecordAsync(record) {
  if (shouldUseRemote()) return requestRemote("/api/v1/draw-records", { method: "POST", data: record });
  return Promise.resolve({ ok: true, item: require("../utils/drawStorage").addRecord(record.poolId, record) });
}

export function deleteDrawRecordAsync(poolId, recordId) {
  if (shouldUseRemote()) return requestRemote("/api/v1/draw-records/" + encodeURIComponent(recordId), { method: "DELETE" });
  require("../utils/drawStorage").deleteRecord(poolId, recordId);
  return Promise.resolve({ ok: true });
}

export function syncDrawRecordsAsync(records) {
  if (shouldUseRemote()) return requestRemote("/api/v1/draw-records/sync", { method: "POST", data: { records } });
  return Promise.resolve({ ok: true, added: 0, total: records.length });
}

// Aliases without "Async" suffix for drawStorage compatibility
export const getDrawPools = getDrawPoolsAsync;
export const getDrawRecords = getDrawRecordsAsync;
export const syncDrawRecords = syncDrawRecordsAsync;

export default {
  getApiConfig, setApiConfig, isRemoteMode, shouldUseRemote, requestRemote,
  getAuthToken, setAuthToken, clearAuthToken, isLoggedIn, logout,
  wxLogin, getProfile,
  getCatalogSummary, getGenerals, getTactics, getEquipment, getTroopTactics, getRecords,
  analyzeLineupAsync, previewMatchupAsync, optimizeAccountAsync,
  getLineupsAsync, saveLineupAsync, deleteLineupAsync,
  addBattleReportAsync, getBattleReportsAsync, getBattleReportStatsAsync, deleteBattleReportAsync,
  getDrawPoolsAsync, createDrawPoolAsync, deleteDrawPoolAsync,
  getDrawRecordsAsync, addDrawRecordAsync, deleteDrawRecordAsync, syncDrawRecordsAsync,
  getDrawPools, getDrawRecords, syncDrawRecords
};
