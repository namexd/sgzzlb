const baselineCatalog = require("../data/catalog");
const { classifyTacticCoverage } = require("../utils/simulator/tactics");
const {
  normalizeSnapshot,
  diffCatalogs,
  countSnapshot,
  hashSnapshot
} = require("./catalogDiff");

const VALID_VERSION_STATUSES = new Set(["draft", "published", "archived", "discarded"]);
const VALID_JOB_STATUSES = new Set(["draft", "published", "discarded", "failed"]);
const VALID_TODO_STATUSES = new Set(["open", "done", "ignored"]);
const VALID_PRIORITIES = new Set(["high", "medium", "low"]);

function nowLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value, fallback = "", maxLength = 120) {
  const text = String(value || fallback || "").trim();
  return text.slice(0, maxLength);
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeVersion(row = {}) {
  const snapshot = typeof row.snapshot === "string" ? safeParse(row.snapshot, {}) : row.snapshot;
  const diff = typeof row.diff === "string" ? safeParse(row.diff, {}) : row.diff;
  const counts = typeof row.counts === "string" ? safeParse(row.counts, {}) : row.counts;
  return {
    id: row.id,
    seasonKey: row.seasonKey || row.season_key || "default",
    seasonLabel: row.seasonLabel || row.season_label || "默认赛季",
    versionKey: row.versionKey || row.version_key || row.id,
    status: row.status || "draft",
    source: row.source || "manual",
    snapshot: snapshot || {},
    diff: diff || {},
    counts: counts || {},
    snapshotHash: row.snapshotHash || row.snapshot_hash || "",
    createdAt: row.createdAt || row.created_at || "",
    publishedAt: row.publishedAt || row.published_at || null,
    importedBy: row.importedBy || row.imported_by || "admin"
  };
}

function normalizeImportJob(row = {}) {
  const diff = typeof row.diff === "string" ? safeParse(row.diff, {}) : row.diff;
  return {
    id: row.id,
    seasonKey: row.seasonKey || row.season_key || "default",
    seasonLabel: row.seasonLabel || row.season_label || "默认赛季",
    versionId: row.versionId || row.version_id || "",
    versionKey: row.versionKey || row.version_key || "",
    status: row.status || "draft",
    source: row.source || "manual",
    diff: diff || {},
    error: row.error || null,
    createdAt: row.createdAt || row.created_at || "",
    finishedAt: row.finishedAt || row.finished_at || null,
    importedBy: row.importedBy || row.imported_by || "admin"
  };
}

function normalizeRuleTodo(row = {}) {
  return {
    id: row.id,
    tacticId: row.tacticId || row.tactic_id || "",
    tacticName: row.tacticName || row.tactic_name || "未命名战法",
    tacticType: row.tacticType || row.tactic_type || "战法",
    coverageStatus: row.coverageStatus || row.coverage_status || "missed",
    priority: row.priority || "medium",
    status: row.status || "open",
    note: row.note || "",
    seasonKey: row.seasonKey || row.season_key || "",
    catalogVersionId: row.catalogVersionId || row.catalog_version_id || "",
    createdAt: row.createdAt || row.created_at || "",
    updatedAt: row.updatedAt || row.updated_at || ""
  };
}

function safeParse(text, fallback) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function omitSnapshot(version) {
  const { snapshot, ...rest } = version;
  return rest;
}

function getComparableBaseline(store, seasonKey) {
  const published = (store.catalogVersions || [])
    .map(normalizeVersion)
    .filter((item) => item.seasonKey === seasonKey && item.status === "published")
    .sort((a, b) => String(b.publishedAt || b.createdAt).localeCompare(String(a.publishedAt || a.createdAt)))[0];
  return published ? published.snapshot : baselineCatalog;
}

function ensureStoreCollections(store) {
  store.catalogVersions = Array.isArray(store.catalogVersions) ? store.catalogVersions : [];
  store.catalogImportJobs = Array.isArray(store.catalogImportJobs) ? store.catalogImportJobs : [];
  store.tacticRuleTodos = Array.isArray(store.tacticRuleTodos) ? store.tacticRuleTodos : [];
}

function saveStore(store) {
  if (store && typeof store.save === "function") store.save();
}

function listVersionsFromStore(store, filters = {}) {
  ensureStoreCollections(store);
  const seasonKey = normalizeText(filters.season || filters.seasonKey, "", 80);
  const status = normalizeText(filters.status, "", 40);
  return store.catalogVersions
    .map(normalizeVersion)
    .filter((item) => !seasonKey || item.seasonKey === seasonKey)
    .filter((item) => !status || item.status === status)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(omitSnapshot);
}

function getVersionFromStore(store, id) {
  ensureStoreCollections(store);
  const version = store.catalogVersions.map(normalizeVersion).find((item) => item.id === id) || null;
  return version;
}

function getPublishedVersionFromStore(store, seasonKey) {
  ensureStoreCollections(store);
  return store.catalogVersions
    .map(normalizeVersion)
    .filter((item) => item.seasonKey === seasonKey && item.status === "published")
    .sort((a, b) => String(b.publishedAt || b.createdAt).localeCompare(String(a.publishedAt || a.createdAt)))[0] || null;
}

function createImportJobFromStore(store, payload = {}) {
  ensureStoreCollections(store);
  const seasonKey = normalizeText(payload.seasonKey || payload.season, "default", 80) || "default";
  const seasonLabel = normalizeText(payload.seasonLabel, seasonKey === "default" ? "默认赛季" : seasonKey, 120);
  const source = normalizeText(payload.source, "manual", 80) || "manual";
  const importedBy = normalizeText(payload.importedBy, "admin", 80) || "admin";
  const snapshot = normalizeSnapshot(payload.snapshot || payload.catalog || payload);
  const now = nowLocal();
  const id = payload.versionId || makeId("cv");
  const versionKey = normalizeText(payload.versionKey, `${seasonKey}-${now.replace(/[-: ]/g, "")}`, 120);
  const before = getComparableBaseline(store, seasonKey);
  const diff = diffCatalogs(before, snapshot);
  const version = {
    id,
    seasonKey,
    seasonLabel,
    versionKey,
    status: "draft",
    source,
    snapshot,
    diff,
    counts: countSnapshot(snapshot),
    snapshotHash: hashSnapshot(snapshot),
    createdAt: now,
    publishedAt: null,
    importedBy
  };
  const job = {
    id: makeId("cij"),
    seasonKey,
    seasonLabel,
    versionId: id,
    versionKey,
    status: "draft",
    source,
    diff,
    error: null,
    createdAt: now,
    finishedAt: null,
    importedBy
  };
  store.catalogVersions.unshift(version);
  store.catalogImportJobs.unshift(job);
  saveStore(store);
  return { job: normalizeImportJob(job), version: omitSnapshot(normalizeVersion(version)) };
}

function listImportJobsFromStore(store, filters = {}) {
  ensureStoreCollections(store);
  const status = normalizeText(filters.status, "", 40);
  return store.catalogImportJobs
    .map(normalizeImportJob)
    .filter((item) => !status || item.status === status)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function getImportJobFromStore(store, id) {
  ensureStoreCollections(store);
  return store.catalogImportJobs.map(normalizeImportJob).find((item) => item.id === id) || null;
}

function upsertRuleTodosForSnapshot(store, version) {
  const tactics = [...(version.snapshot.tactics || []), ...(version.snapshot.troopTactics || [])];
  const existingKeys = new Set((store.tacticRuleTodos || [])
    .filter((item) => (item.catalogVersionId || item.catalog_version_id || "") === version.id)
    .map((item) => item.tacticId || item.tactic_id || item.tacticName || item.tactic_name));
  const created = [];
  const now = nowLocal();
  for (const tactic of tactics) {
    const id = tactic.id || tactic.name;
    if (!id || existingKeys.has(id)) continue;
    const coverage = classifyTacticCoverage(tactic);
    if (coverage.status !== "missed") continue;
    const todo = {
      id: makeId("trt"),
      tacticId: tactic.id || "",
      tacticName: tactic.name || "未命名战法",
      tacticType: tactic.type || "战法",
      coverageStatus: coverage.status,
      priority: "medium",
      status: "open",
      note: "发布资料时自动生成，待补充战法规则。",
      seasonKey: version.seasonKey,
      catalogVersionId: version.id,
      createdAt: now,
      updatedAt: now
    };
    store.tacticRuleTodos.unshift(todo);
    existingKeys.add(id);
    created.push(normalizeRuleTodo(todo));
  }
  return created;
}

function publishImportJobFromStore(store, jobId) {
  ensureStoreCollections(store);
  const job = getImportJobFromStore(store, jobId);
  if (!job) throw Object.assign(new Error("导入任务不存在。"), { statusCode: 404 });
  if (job.status !== "draft") throw Object.assign(new Error("只有草稿导入任务可以发布。"), { statusCode: 400 });
  const version = getVersionFromStore(store, job.versionId);
  if (!version) throw Object.assign(new Error("导入任务关联的资料版本不存在。"), { statusCode: 404 });
  if (version.status !== "draft") throw Object.assign(new Error("只有草稿资料版本可以发布。"), { statusCode: 400 });

  const now = nowLocal();
  store.catalogVersions = store.catalogVersions.map((item) => {
    const current = normalizeVersion(item);
    if (current.id === version.id) return { ...item, status: "published", publishedAt: now };
    if (current.seasonKey === version.seasonKey && current.status === "published") return { ...item, status: "archived" };
    return item;
  });
  store.catalogImportJobs = store.catalogImportJobs.map((item) =>
    item.id === job.id ? { ...item, status: "published", finishedAt: now } : item
  );
  const published = getVersionFromStore(store, version.id);
  const todos = upsertRuleTodosForSnapshot(store, published);
  saveStore(store);
  return { job: getImportJobFromStore(store, job.id), version: omitSnapshot(published), createdTodos: todos.length };
}

function discardImportJobFromStore(store, jobId) {
  ensureStoreCollections(store);
  const job = getImportJobFromStore(store, jobId);
  if (!job) throw Object.assign(new Error("导入任务不存在。"), { statusCode: 404 });
  if (job.status !== "draft") throw Object.assign(new Error("只有草稿导入任务可以丢弃。"), { statusCode: 400 });
  const now = nowLocal();
  store.catalogImportJobs = store.catalogImportJobs.map((item) =>
    item.id === job.id ? { ...item, status: "discarded", finishedAt: now } : item
  );
  store.catalogVersions = store.catalogVersions.map((item) =>
    item.id === job.versionId ? { ...item, status: "discarded" } : item
  );
  saveStore(store);
  return { job: getImportJobFromStore(store, job.id), version: getVersionFromStore(store, job.versionId) };
}

function listRuleTodosFromStore(store, filters = {}) {
  ensureStoreCollections(store);
  const status = normalizeText(filters.status, "", 40);
  const seasonKey = normalizeText(filters.season || filters.seasonKey, "", 80);
  const versionId = normalizeText(filters.catalogVersionId || filters.versionId, "", 64);
  return store.tacticRuleTodos
    .map(normalizeRuleTodo)
    .filter((item) => !status || item.status === status)
    .filter((item) => !seasonKey || item.seasonKey === seasonKey)
    .filter((item) => !versionId || item.catalogVersionId === versionId)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
}

function createRuleTodoFromStore(store, payload = {}) {
  ensureStoreCollections(store);
  const now = nowLocal();
  const priority = VALID_PRIORITIES.has(payload.priority) ? payload.priority : "medium";
  const status = VALID_TODO_STATUSES.has(payload.status) ? payload.status : "open";
  const todo = {
    id: payload.id || makeId("trt"),
    tacticId: normalizeText(payload.tacticId, "", 120),
    tacticName: normalizeText(payload.tacticName || payload.name, "未命名战法", 120),
    tacticType: normalizeText(payload.tacticType || payload.type, "战法", 40),
    coverageStatus: normalizeText(payload.coverageStatus, "missed", 40),
    priority,
    status,
    note: normalizeText(payload.note, "", 500),
    seasonKey: normalizeText(payload.seasonKey || payload.season, "", 80),
    catalogVersionId: normalizeText(payload.catalogVersionId, "", 120),
    createdAt: now,
    updatedAt: now
  };
  store.tacticRuleTodos.unshift(todo);
  saveStore(store);
  return normalizeRuleTodo(todo);
}

function updateRuleTodoFromStore(store, id, payload = {}) {
  ensureStoreCollections(store);
  const existing = store.tacticRuleTodos.find((item) => item.id === id);
  if (!existing) throw Object.assign(new Error("规则待办不存在。"), { statusCode: 404 });
  if (payload.priority && !VALID_PRIORITIES.has(payload.priority)) {
    throw Object.assign(new Error("无效的优先级。"), { statusCode: 400 });
  }
  if (payload.status && !VALID_TODO_STATUSES.has(payload.status)) {
    throw Object.assign(new Error("无效的待办状态。"), { statusCode: 400 });
  }
  const now = nowLocal();
  Object.assign(existing, {
    tacticId: payload.tacticId !== undefined ? normalizeText(payload.tacticId, "", 120) : existing.tacticId,
    tacticName: payload.tacticName !== undefined ? normalizeText(payload.tacticName, "未命名战法", 120) : existing.tacticName,
    tacticType: payload.tacticType !== undefined ? normalizeText(payload.tacticType, "战法", 40) : existing.tacticType,
    coverageStatus: payload.coverageStatus !== undefined ? normalizeText(payload.coverageStatus, "missed", 40) : existing.coverageStatus,
    priority: payload.priority || existing.priority,
    status: payload.status || existing.status,
    note: payload.note !== undefined ? normalizeText(payload.note, "", 500) : existing.note,
    updatedAt: now
  });
  saveStore(store);
  return normalizeRuleTodo(existing);
}

module.exports = {
  VALID_VERSION_STATUSES,
  VALID_JOB_STATUSES,
  VALID_TODO_STATUSES,
  normalizeVersion,
  normalizeImportJob,
  normalizeRuleTodo,
  listVersionsFromStore,
  getVersionFromStore,
  getPublishedVersionFromStore,
  createImportJobFromStore,
  listImportJobsFromStore,
  getImportJobFromStore,
  publishImportJobFromStore,
  discardImportJobFromStore,
  listRuleTodosFromStore,
  createRuleTodoFromStore,
  updateRuleTodoFromStore
};
