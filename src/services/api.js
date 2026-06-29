import { getStorage, setStorage, removeStorage } from "../utils/storage";
import { analyzeLineup as localAnalyze, compareLineups } from "../utils/scoring";
import { optimizeLineups } from "../utils/optimizer";
import * as catalog from "../utils/catalog";

const PRODUCTION_API_BASE_URL = "https://sz.qihangwk.com";
const LOCAL_API_BASE_URL = "http://127.0.0.1:8787";
const DEFAULT_API_CONFIG = { mode: "remote", baseUrl: "", adminToken: "" };

function isLoopbackHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function isHostedBrowser() {
  return typeof window !== "undefined" && window.location && !isLoopbackHost(window.location.hostname);
}

function isLoopbackUrl(url) {
  try {
    return isLoopbackHost(new URL(url).hostname);
  } catch (e) {
    return false;
  }
}

function getDefaultApiBaseUrl() {
  if (typeof window !== "undefined" && window.location) {
    const { protocol, hostname, origin } = window.location;
    if (protocol === "http:" || protocol === "https:") {
      return isLoopbackHost(hostname) ? PRODUCTION_API_BASE_URL : origin;
    }
  }
  return LOCAL_API_BASE_URL;
}

function normalizeBaseUrl(baseUrl) {
  return (baseUrl || getDefaultApiBaseUrl()).replace(/\/$/, "");
}

export function getApiConfig() {
  const storedConfig = getStorage("apiConfig") || {};
  const config = { ...DEFAULT_API_CONFIG, ...storedConfig };
  config.mode = "remote";
  config.baseUrl = normalizeBaseUrl(config.baseUrl);

  if (isHostedBrowser() && isLoopbackUrl(config.baseUrl)) {
    config.baseUrl = getDefaultApiBaseUrl();
  }

  return config;
}

export function setApiConfig(nextConfig) {
  const config = { ...getApiConfig(), ...(nextConfig || {}), mode: "remote" };
  setStorage("apiConfig", config);
  return config;
}

export function isRemoteMode() {
  return true;
}

export function shouldUseRemote() {
  return true;
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
  removeStorage("currentUser");
}

function isPublicRequest(path) {
  return path.startsWith("/api/v1/auth/login") ||
    path.startsWith("/api/v1/auth/register") ||
    path.startsWith("/api/v1/auth/wechat-login") ||
    path.startsWith("/api/v1/catalog/");
}

function redirectToLogin() {
  try {
    const pages = getCurrentPages();
    const current = pages && pages[pages.length - 1];
    if (current && current.route === "pages/login/index") return;
  } catch (e) {}
  uni.navigateTo({ url: "/pages/login/index" });
}

function requestRemote(path, options = {}) {
  const config = getApiConfig();
  const method = options.method || "GET";
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  const authToken = getAuthToken();
  if (!authToken && !isPublicRequest(path)) {
    redirectToLogin();
    return Promise.reject(new Error("请先登录。"));
  }
  if (authToken) headers["authorization"] = `Bearer ${authToken}`;
  if (config.adminToken) headers["x-admin-token"] = config.adminToken;

  const buildUrl = (baseUrl) => `${normalizeBaseUrl(baseUrl)}${path.startsWith("/") ? path : "/" + path}`;
  const fallbackBaseUrl = isLoopbackUrl(config.baseUrl) ? getDefaultApiBaseUrl() : "";
  const canRetryWithFallback = (baseUrl, retried) => !retried && fallbackBaseUrl && fallbackBaseUrl !== baseUrl;
  const shouldRetryResponse = (response) => {
    if (response.statusCode >= 500) return true;
    return path.startsWith("/api/v1/auth/") && response.statusCode >= 400;
  };

  return new Promise((resolve, reject) => {
    const send = (baseUrl, retried = false) => {
      uni.request({
        url: buildUrl(baseUrl),
        method,
        data: options.data || {},
        header: headers,
        success(response) {
          const body = response.data || {};
          if (response.statusCode >= 200 && response.statusCode < 300 && body.ok !== false) {
            resolve(body.data !== undefined ? body.data : body);
          } else {
            if (response.statusCode === 401 && !isPublicRequest(path)) {
              logout();
              redirectToLogin();
            }
            if (canRetryWithFallback(baseUrl, retried) && shouldRetryResponse(response)) {
              send(fallbackBaseUrl, true);
              return;
            }
            reject(new Error(body.message || body.error || `请求失败：${response.statusCode}`));
          }
        },
        fail(error) {
          if (canRetryWithFallback(baseUrl, retried)) {
            send(fallbackBaseUrl, true);
            return;
          }
          reject(new Error(error.errMsg || "请求失败"));
        }
      });
    };

    send(config.baseUrl);
  });
}

export { requestRemote };

function normalizeDrawPool(row = {}) {
  return {
    ...row,
    createdAt: row.createdAt || row.created_at
  };
}

function normalizeDrawSeason(row = {}) {
  return {
    ...row,
    startDate: row.startDate || row.start_date,
    endDate: row.endDate !== undefined ? row.endDate : row.end_date,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at
  };
}

function normalizeDrawRecord(row = {}) {
  return {
    ...row,
    poolId: row.poolId || row.pool_id,
    seasonId: row.seasonId !== undefined ? row.seasonId : row.season_id,
    generalName: row.generalName !== undefined ? row.generalName : row.general_name,
    drawType: row.drawType || row.draw_type,
    group: row.group !== undefined ? Number(row.group) : Number(row.group_num || 1),
    createdAt: row.createdAt || row.created_at
  };
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
    reject(new Error("请使用账号密码登录。"));
    // #endif
  });
}

export function getProfile() {
  return requestRemote("/api/v1/auth/profile");
}

// --- Catalog (local + remote) ---
export function getCatalogSummary(params = {}) {
  if (shouldUseRemote()) return requestRemote(withQuery("/api/v1/catalog/summary", params));
  const meta = catalog.getMeta();
  return Promise.resolve({ generalsCount: meta.generalsCount || catalog.getGenerals().length, tacticsCount: meta.tacticsCount || catalog.getTactics().length, equipmentCount: meta.equipmentCount || catalog.getEquipment().length, troopTacticsCount: meta.troopTacticsCount || catalog.getTroopTactics().length, source: meta.source, fetchedAt: meta.fetchedAt });
}

export function getGenerals(params = {}) {
  if (shouldUseRemote()) return requestRemote(withQuery("/api/v1/catalog/generals", params));
  return Promise.resolve(catalog.searchRecords("generals", params.keyword || ""));
}

export function getTactics(params = {}) {
  if (shouldUseRemote()) return requestRemote(withQuery("/api/v1/catalog/tactics", params));
  return Promise.resolve(catalog.searchRecords("tactics", params.keyword || ""));
}

export function getEquipment(params = {}) {
  if (shouldUseRemote()) return requestRemote(withQuery("/api/v1/catalog/equipment", params));
  return Promise.resolve(catalog.searchRecords("equipment", params.keyword || ""));
}

export function getTroopTactics(params = {}) {
  if (shouldUseRemote()) return requestRemote(withQuery("/api/v1/catalog/troop-tactics", params));
  return Promise.resolve(catalog.searchRecords("troopTactics", params.keyword || ""));
}

export function getCatalogVersions(params = {}) {
  if (shouldUseRemote()) return requestRemote(withQuery("/api/v1/catalog/versions", params));
  return Promise.resolve({ items: [] });
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

export function simulateBattleAsync(payload) {
  if (shouldUseRemote()) return requestRemote("/api/v1/battles/simulate", { method: "POST", data: payload });
  return Promise.reject(new Error("战报模拟器需要切换到远程 API 模式。"));
}

export function optimizeAccountAsync(payload) {
  if (shouldUseRemote()) return requestRemote("/api/v1/accounts/optimize", { method: "POST", data: payload });
  return Promise.resolve(optimizeLineups(payload));
}

export function getLineupsAsync(params = {}) {
  return requestRemote(withQuery("/api/v1/lineups", params)).then((res) => normalizePagedList(res));
}


export function submitRecommendationFeedbackAsync(payload = {}) {
  const content = payload.content || [
    "[推荐反馈]",
    `评价：${payload.metadata && payload.metadata.rating === "good" ? "有帮助" : "不适合"}`,
    `原因：${payload.metadata && payload.metadata.reason || "未填写"}`
  ].join("\n");
  const data = {
    type: "recommendation",
    content,
    contact: payload.contact || "",
    metadata: payload.metadata || {}
  };
  if (shouldUseRemote()) return requestRemote("/api/v1/feedback", { method: "POST", data });
  return Promise.reject(new Error("推荐反馈需要切换到远程 API 模式。"));
}

export function saveLineupAsync(payload = {}) {
  return requestRemote("/api/v1/lineups", { method: "POST", data: payload });
}

export function deleteLineupAsync(id) {
  return requestRemote(`/api/v1/lineups/${encodeURIComponent(id)}`, { method: "DELETE" });
}

function normalizeRecommendationHistory(item = {}) {
  return {
    ...item,
    targetLineupCount: item.targetLineupCount || item.target_lineup_count || 0,
    createdAt: item.createdAt || item.created_at,
    updatedAt: item.updatedAt || item.updated_at
  };
}

export function getRecommendationHistoryAsync(params = {}) {
  return requestRemote(withQuery("/api/v1/recommendation-history", params))
    .then((res) => normalizePagedList(res).map(normalizeRecommendationHistory));
}

export function saveRecommendationHistoryAsync(snapshot = {}) {
  return requestRemote("/api/v1/recommendation-history", { method: "POST", data: { snapshot } })
    .then((res) => ({ ...res, item: normalizeRecommendationHistory(res.item) }));
}

// --- Battle Reports ---
export function addBattleReportAsync(report) {
  return requestRemote("/api/v1/battle-reports", { method: "POST", data: report });
}

export function getBattleReportsAsync(params = {}) {
  const query = {};
  if (params.limit) query.limit = params.limit;
  if (params.offset) query.offset = params.offset;
  return requestRemote(withQuery("/api/v1/battle-reports", query));
}

export function getBattleReportStatsAsync() {
  return requestRemote("/api/v1/battle-reports/stats");
}

export function deleteBattleReportAsync(id) {
  return requestRemote(`/api/v1/battle-reports/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// --- Draw Pools & Records ---
export function getDrawPoolsAsync() {
  return requestRemote("/api/v1/draw-pools").then((res) => normalizePagedList(res).map(normalizeDrawPool));
}

export function createDrawPoolAsync(pool) {
  return requestRemote("/api/v1/draw-pools", { method: "POST", data: pool })
    .then((res) => ({ ...res, item: normalizeDrawPool(res.item) }));
}

export function deleteDrawPoolAsync(poolId) {
  return requestRemote("/api/v1/draw-pools/" + encodeURIComponent(poolId), { method: "DELETE" });
}

export function getDrawSeasonsAsync() {
  return requestRemote("/api/v1/draw-seasons").then((res) => normalizePagedList(res).map(normalizeDrawSeason));
}

export function createDrawSeasonAsync(season = {}) {
  return requestRemote("/api/v1/draw-seasons", { method: "POST", data: season })
    .then((res) => ({ ...res, item: normalizeDrawSeason(res.item) }));
}

export function updateDrawSeasonAsync(seasonId, patch = {}) {
  return requestRemote("/api/v1/draw-seasons/" + encodeURIComponent(seasonId), { method: "PATCH", data: patch })
    .then((res) => ({ ...res, item: normalizeDrawSeason(res.item) }));
}

export function endDrawSeasonAsync(seasonId, endDate) {
  return requestRemote("/api/v1/draw-seasons/" + encodeURIComponent(seasonId) + "/end", { method: "POST", data: { endDate } })
    .then((res) => ({ ...res, item: normalizeDrawSeason(res.item) }));
}

export function syncDrawSeasonsAsync(seasons = []) {
  return requestRemote("/api/v1/draw-seasons/sync", { method: "POST", data: { seasons } });
}

export function getDrawRecordsAsync(poolId) {
  return requestRemote("/api/v1/draw-records?poolId=" + encodeURIComponent(poolId))
    .then((res) => normalizePagedList(res).map(normalizeDrawRecord).sort((a, b) => {
      const left = `${a.date || ""} ${a.time || ""} ${a.createdAt || ""}`;
      const right = `${b.date || ""} ${b.time || ""} ${b.createdAt || ""}`;
      return left.localeCompare(right);
    }));
}

export function addDrawRecordAsync(record) {
  return requestRemote("/api/v1/draw-records", { method: "POST", data: record })
    .then((res) => ({ ...res, item: normalizeDrawRecord(res.item) }));
}

export function deleteDrawRecordAsync(poolId, recordId) {
  return requestRemote("/api/v1/draw-records/" + encodeURIComponent(recordId), { method: "DELETE" });
}

export function syncDrawRecordsAsync(records) {
  return requestRemote("/api/v1/draw-records/sync", { method: "POST", data: { records } });
}

export async function migrateLocalUserDataToRemote() {
  if (!isLoggedIn()) return { ok: false, skipped: true };
  const drawStorage = await import("../utils/drawStorage");
  const lineups = getStorage("savedLineups") || [];
  const recommendationHistory = getStorage("recommendationHistory") || [];
  const pools = drawStorage.getPools ? drawStorage.getPools() : [];
  const seasons = drawStorage.getSeasons ? drawStorage.getSeasons() : [];
  const drawRecords = [];

  for (const pool of pools) {
    if (pool && pool.name) {
      await createDrawPoolAsync(pool).catch(() => null);
    }
    const records = drawStorage.getRecords ? drawStorage.getRecords(pool.id) : [];
    drawRecords.push(...records);
  }

  if (seasons.length > 0) await syncDrawSeasonsAsync(seasons).catch(() => null);
  if (drawRecords.length > 0) await syncDrawRecordsAsync(drawRecords).catch(() => null);
  for (const lineup of lineups) {
    await saveLineupAsync({ lineup }).catch(() => null);
  }
  for (const item of recommendationHistory) {
    await saveRecommendationHistoryAsync(item).catch(() => null);
  }

  setStorage("remoteMigrationDone", true);
  return {
    ok: true,
    lineups: lineups.length,
    recommendationHistory: recommendationHistory.length,
    pools: pools.length,
    seasons: seasons.length,
    drawRecords: drawRecords.length
  };
}

// Aliases without "Async" suffix for drawStorage compatibility
export const getDrawPools = getDrawPoolsAsync;
export const getDrawRecords = getDrawRecordsAsync;
export const syncDrawRecords = syncDrawRecordsAsync;
export const getDrawSeasons = getDrawSeasonsAsync;
export const syncDrawSeasons = syncDrawSeasonsAsync;

export default {
  getApiConfig, setApiConfig, isRemoteMode, shouldUseRemote, requestRemote,
  getAuthToken, setAuthToken, clearAuthToken, isLoggedIn, logout,
  wxLogin, getProfile, migrateLocalUserDataToRemote,
  getCatalogSummary, getGenerals, getTactics, getEquipment, getTroopTactics, getRecords,
  analyzeLineupAsync, previewMatchupAsync, optimizeAccountAsync,
  getLineupsAsync, saveLineupAsync, deleteLineupAsync,
  getRecommendationHistoryAsync, saveRecommendationHistoryAsync,
  addBattleReportAsync, getBattleReportsAsync, getBattleReportStatsAsync, deleteBattleReportAsync,
  getDrawPoolsAsync, createDrawPoolAsync, deleteDrawPoolAsync,
  getDrawSeasonsAsync, createDrawSeasonAsync, updateDrawSeasonAsync, endDrawSeasonAsync, syncDrawSeasonsAsync,
  getDrawRecordsAsync, addDrawRecordAsync, deleteDrawRecordAsync, syncDrawRecordsAsync,
  getDrawPools, getDrawRecords, syncDrawRecords, getDrawSeasons, syncDrawSeasons
};
