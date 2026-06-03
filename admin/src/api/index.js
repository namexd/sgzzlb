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

export default api;
