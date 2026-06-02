import { getStorage, setStorage } from "../utils/storage";

const DEFAULT_API_CONFIG = {
  mode: "local",
  baseUrl: "http://127.0.0.1:8787",
  adminToken: ""
};

function getApiConfig() {
  return {
    ...DEFAULT_API_CONFIG,
    ...(getStorage("apiConfig") || {})
  };
}

function setApiConfig(nextConfig) {
  const config = { ...getApiConfig(), ...(nextConfig || {}) };
  setStorage("apiConfig", config);
  return config;
}

function isRemoteMode() {
  return getApiConfig().mode === "remote";
}

function getToken() {
  return getStorage("userToken") || "";
}

function setToken(token) {
  setStorage("userToken", token);
}

function requestRemote(path, options = {}) {
  const config = getApiConfig();
  const method = options.method || "GET";
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {})
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
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

// WeChat Login
export function wxLogin() {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    uni.login({
      provider: "weixin",
      success(loginRes) {
        if (loginRes.code) {
          requestRemote("/api/v1/auth/wechat-login", {
            method: "POST",
            data: { code: loginRes.code }
          }).then(res => {
            setToken(res.token);
            resolve(res);
          }).catch(reject);
        } else {
          reject(new Error("登录失败"));
        }
      },
      fail: reject
    });
    // #endif

    // #ifdef H5
    // H5 mode - use anonymous user
    const anonymousId = getStorage("anonymousId") || "h5_" + Date.now();
    setStorage("anonymousId", anonymousId);
    requestRemote("/api/v1/auth/anonymous-login", {
      method: "POST",
      data: { userId: anonymousId }
    }).then(res => {
      setToken(res.token);
      resolve(res);
    }).catch(reject);
    // #endif
  });
}

// Catalog
export function getCatalogSummary() {
  return requestRemote("/api/v1/catalog/summary");
}

export function getGenerals(params = {}) {
  return requestRemote("/api/v1/catalog/generals", { data: params });
}

export function getTactics(params = {}) {
  return requestRemote("/api/v1/catalog/tactics", { data: params });
}

export function getEquipment(params = {}) {
  return requestRemote("/api/v1/catalog/equipment", { data: params });
}

export function getTroopTactics(params = {}) {
  return requestRemote("/api/v1/catalog/troop-tactics", { data: params });
}

// Lineups
export function analyzeLineup(payload) {
  return requestRemote("/api/v1/lineups/analyze", { method: "POST", data: payload });
}

export function getLineups(params = {}) {
  return requestRemote("/api/v1/lineups", { data: params });
}

export function saveLineup(payload) {
  return requestRemote("/api/v1/lineups", { method: "POST", data: payload });
}

export function deleteLineup(id) {
  return requestRemote(`/api/v1/lineups/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// Draw Pools
export function getDrawPools() {
  return requestRemote("/api/v1/draw-pools");
}

export function createDrawPool(pool) {
  return requestRemote("/api/v1/draw-pools", { method: "POST", data: pool });
}

export function deleteDrawPool(poolId) {
  return requestRemote(`/api/v1/draw-pools/${encodeURIComponent(poolId)}`, { method: "DELETE" });
}

// Draw Records
export function getDrawRecords(poolId) {
  return requestRemote(`/api/v1/draw-records?poolId=${encodeURIComponent(poolId)}`);
}

export function addDrawRecord(record) {
  return requestRemote("/api/v1/draw-records", { method: "POST", data: record });
}

export function deleteDrawRecord(recordId) {
  return requestRemote(`/api/v1/draw-records/${encodeURIComponent(recordId)}`, { method: "DELETE" });
}

export function syncDrawRecords(records) {
  return requestRemote("/api/v1/draw-records/sync", { method: "POST", data: { records } });
}

// Matchup
export function previewMatchup(payload) {
  return requestRemote("/api/v1/matchups/preview", { method: "POST", data: payload });
}

export {
  getApiConfig,
  setApiConfig,
  isRemoteMode,
  getToken,
  setToken
};
