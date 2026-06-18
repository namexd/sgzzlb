import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8787";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000
});

// Request interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) {
    config.headers["x-admin-token"] = token;
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const msg = error.response?.data?.error || error.message || "请求失败";
    return Promise.reject(new Error(msg));
  }
);

// Auth
export const login = (token) => {
  localStorage.setItem("admin_token", token);
};

export const logout = () => {
  localStorage.removeItem("admin_token");
};

export const isLoggedIn = () => {
  return !!localStorage.getItem("admin_token");
};

// Dashboard
export const getDashboard = () => api.get("/api/admin/dashboard");

// Catalog
export const getCatalogSummary = () => api.get("/api/v1/catalog/summary");
export const getGenerals = (params) => api.get("/api/v1/catalog/generals", { params });
export const getTactics = (params) => api.get("/api/v1/catalog/tactics", { params });

// Lineups
export const getLineups = () => api.get("/api/admin/lineups");
export const deleteLineup = (id) => api.delete(`/api/v1/lineups/${id}`);

// Feedback
export const getFeedback = (params) => api.get("/api/v1/feedback", { params });
export const updateFeedbackStatus = (id, status) => api.put(`/api/v1/feedback/${id}/status`, { status });

// Audit log
export const getAuditLog = (params) => api.get("/api/admin/audit-log", { params });

// Rules
export const getRules = () => api.get("/api/admin/rules");
export const saveRules = (rules) => api.post("/api/admin/rules", { rules });

// Users (draw pools and records)
export const getDrawPools = () => api.get("/api/v1/draw-pools");
export const getDrawRecords = (poolId) => api.get("/api/v1/draw-records", { params: { poolId } });

// Users
export const getUsers = (params) => api.get("/api/admin/users", { params });
export const getUserDetail = (userId) => api.get(`/api/admin/users/${userId}`);
export const setUserTier = (userId, tier, expiresAt) => api.post("/api/v1/auth/set-tier", { userId, tier, expiresAt });

// Battle Reports
export const getBattleReports = (params) => api.get("/api/admin/battle-reports", { params });
export const deleteBattleReport = (id) => api.delete(`/api/v1/battle-reports/${id}`);
export const updateBattleReport = (id, data) => api.put(`/api/admin/battle-reports/${id}`, data);
export const getBattleReportStats = (params) => api.get("/api/v1/battle-reports/stats", { params });

// Feedback
export const getFeedbackById = (id) => api.get(`/api/v1/feedback/${id}`);
export const deleteFeedback = (id) => api.delete(`/api/admin/feedback/${id}`);

// Catalog
export const getEquipment = (params) => api.get("/api/v1/catalog/equipment", { params });
export const getTroopTactics = (params) => api.get("/api/v1/catalog/troop-tactics", { params });

// Catalog versions
export const getCatalogVersions = (params) => api.get("/api/admin/catalog/versions", { params });
export const getCatalogVersion = (id) => api.get(`/api/admin/catalog/versions/${id}`);
export const getCatalogVersionRecords = (id, params) => api.get(`/api/admin/catalog/versions/${id}/records`, { params });
export const uploadCatalogImportJob = (data) => api.post("/api/admin/catalog/import-jobs/upload", data);
export const createOfficialCatalogImportJob = (data) => api.post("/api/admin/catalog/import-jobs/official", data);
export const getOfficialCatalogImportStatus = () => api.get("/api/admin/catalog/import-jobs/official/status");
export const getCatalogImportJobs = (params) => api.get("/api/admin/catalog/import-jobs", { params });
export const getCatalogImportJob = (id) => api.get(`/api/admin/catalog/import-jobs/${id}`);
export const publishCatalogImportJob = (id) => api.post(`/api/admin/catalog/import-jobs/${id}/publish`);
export const discardCatalogImportJob = (id) => api.post(`/api/admin/catalog/import-jobs/${id}/discard`);
export const getCatalogRuleCoverage = (params) => api.get("/api/admin/catalog/rule-coverage", { params });
export const getCatalogRuleTodos = (params) => api.get("/api/admin/catalog/rule-todos", { params });
export const createCatalogRuleTodo = (data) => api.post("/api/admin/catalog/rule-todos", data);
export const updateCatalogRuleTodo = (id, data) => api.put(`/api/admin/catalog/rule-todos/${id}`, data);

// Asset Audits
export const getAssetAudits = () => api.get("/api/admin/assets/audit");
export const saveAssetAudit = (audit) => api.post("/api/admin/assets/audit", audit);

// Store
export const resetStore = () => api.post("/api/admin/store/reset");
export const exportStore = () => api.get("/api/admin/store/export");

export default api;
