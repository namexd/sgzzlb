const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

function nowLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const catalog = require("../utils/catalog");
const api = require("../services/api");
const catalogVersionStore = require("./catalogVersionStore");
const {
  DEFAULT_STORE_FILE,
  createMemoryStore,
  createFileStore,
  saveStore,
  resetStore: resetAdminStore,
  exportStore: exportAdminStore
} = require("./store");
const dbModule = require("./db");
const { fetchOfficialCatalogSnapshot } = require("./officialCatalogFetcher");
const { normalizeSnapshot, diffCatalogs, countSnapshot, hashSnapshot } = require("./catalogDiff");

const DEFAULT_ADMIN_TOKEN = "";
const DEFAULT_TOKEN_SECRET = "sgzzlb-token-secret-dev";

function safeCompare(a, b) {
  if (!a) return false;
  if (!b) return true; // 未配置 ADMIN_TOKEN 时允许任意非空 token
  const crypto = require("node:crypto");
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function generateToken(userId, secret) {
  const payload = `${userId}:${Date.now()}`;
  const crypto = require("node:crypto");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

function verifyToken(token, secret) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length < 3) return null;
    const [userId, ts, sig] = [parts[0], parts[1], parts.slice(2).join(":")];
    const crypto = require("node:crypto");
    const expected = crypto.createHmac("sha256", secret).update(`${userId}:${ts}`).digest("hex").slice(0, 16);
    if (sig !== expected) return null;
    // Token expires after 30 days
    if (Date.now() - Number(ts) > 30 * 24 * 60 * 60 * 1000) return null;
    return { userId, createdAt: Number(ts) };
  } catch {
    return null;
  }
}
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sendJson(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    ...headers
  });
  res.end(JSON.stringify(body));
}

function sendText(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    ...headers
  });
  res.end(body);
}

function applyCors(res, origin) {
  res.setHeader("access-control-allow-origin", origin || "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,x-admin-token,authorization");
  res.setHeader("access-control-max-age", "86400");
}

function isSafeStaticPath(staticRoot, targetPath) {
  const root = path.resolve(staticRoot);
  const target = path.resolve(targetPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function serveStaticFile(res, staticRoot, requestPath, headOnly = false) {
  const relativePath = decodeURIComponent(requestPath.replace(/^\/admin\/?/, "")) || "index.html";
  const filePath = path.join(staticRoot, relativePath);
  const finalPath = filePath.endsWith(path.sep) ? path.join(filePath, "index.html") : filePath;

  if (!isSafeStaticPath(staticRoot, finalPath)) {
    sendText(res, 403, "禁止访问该静态资源。");
    return true;
  }

  if (!fs.existsSync(finalPath) || !fs.statSync(finalPath).isFile()) {
    return false;
  }

  const ext = path.extname(finalPath).toLowerCase();
  res.writeHead(200, {
    "content-type": MIME_TYPES[ext] || "application/octet-stream"
  });
  if (headOnly) {
    res.end();
    return true;
  }
  fs.createReadStream(finalPath).pipe(res);
  return true;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(Object.assign(new Error("请求体过大，最大支持 1MB。"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(Object.assign(new Error("请求体不是合法 JSON。"), { statusCode: 400 }));
      }
    });

    req.on("error", reject);
  });
}

function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error("请求体过大。"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipartFile(body, boundary) {
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const start = body.indexOf(boundaryBuf);
  if (start < 0) return null;
  const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), start);
  if (headerEnd < 0) return null;
  const headerStr = body.slice(start + boundaryBuf.length, headerEnd).toString("utf8");
  const filenameMatch = headerStr.match(/filename="([^"]+)"/);
  const mimeMatch = headerStr.match(/Content-Type:\s*(.+)/i);
  const dataStart = headerEnd + 4;
  const dataEnd = body.indexOf(Buffer.from(`\r\n--${boundary}`), dataStart);
  const data = body.slice(dataStart, dataEnd > 0 ? dataEnd : undefined);
  return {
    filename: filenameMatch ? filenameMatch[1] : "",
    mime: mimeMatch ? mimeMatch[1].trim() : "application/octet-stream",
    data
  };
}

function parsePositiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.min(number, max);
}

function paginate(records, searchParams) {
  const page = parsePositiveInteger(searchParams.get("page"), 1);
  const pageSize = parsePositiveInteger(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const total = records.length;
  const start = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: records.slice(start, start + pageSize)
  };
}

function getCatalogSummary(context = {}) {
  const meta = catalog.getMeta(context);
  const generals = catalog.getGenerals(context);
  const tactics = catalog.getTactics(context);
  const equipment = catalog.getEquipment(context);
  const troopTactics = catalog.getTroopTactics(context);

  return {
    meta,
    counts: {
      generals: generals.length,
      tactics: tactics.length,
      equipment: equipment.length,
      troopTactics: troopTactics.length
    },
    generatedAt: meta.generatedAt || null,
    source: meta.source || null
  };
}

function getCatalogQueryContext(searchParams) {
  return {
    season: searchParams.get("season") || searchParams.get("seasonKey") || "",
    catalogVersionId: searchParams.get("versionId") || searchParams.get("catalogVersionId") || ""
  };
}

function getBattleCatalogRequest(payload = {}) {
  const options = payload.options || {};
  const catalogVersionId = payload.catalogVersionId || payload.versionId || options.catalogVersionId || options.versionId || "";
  return {
    season: catalogVersionId ? "" : payload.season || payload.seasonKey || options.season || options.seasonKey || "",
    catalogVersionId
  };
}

function formatCatalogContext(version, fallback = {}) {
  if (!version) {
    const meta = catalog.getMeta();
    return {
      season: fallback.season || "default",
      seasonKey: fallback.season || "default",
      seasonLabel: fallback.seasonLabel || "默认赛季",
      catalogVersionId: null,
      versionKey: "static-baseline",
      status: "static",
      source: meta.source || "static",
      snapshotHash: "",
      publishedAt: null,
      generatedAt: meta.generatedAt || null
    };
  }
  return {
    season: version.seasonKey,
    seasonKey: version.seasonKey,
    seasonLabel: version.seasonLabel,
    catalogVersionId: version.id,
    versionKey: version.versionKey,
    status: version.status,
    source: version.source,
    snapshotHash: version.snapshotHash,
    publishedAt: version.publishedAt || null,
    generatedAt: (version.snapshot && version.snapshot.meta && version.snapshot.meta.generatedAt) || null
  };
}

function getDefaultCatalogSeason() {
  return process.env.DEFAULT_CATALOG_SEASON || process.env.OFFICIAL_CATALOG_SEASON || "pk";
}

function allowStaticCatalogFallback(request = {}) {
  if (request.allowStaticFallback === false) return false;
  if (process.env.ALLOW_STATIC_CATALOG_FALLBACK === "1") return true;
  return process.env.NODE_ENV !== "production";
}

function createCatalogUnavailableError(seasonKey) {
  return Object.assign(new Error(`赛季 ${seasonKey} 尚未发布资料版本，请先在后台发布资料后再访问。`), {
    statusCode: 503,
    expose: true
  });
}

function mapCatalogRecords(type, context) {
  const map = {
    generals: catalog.getGenerals,
    tactics: catalog.getTactics,
    equipment: catalog.getEquipment,
    troopTactics: catalog.getTroopTactics
  };
  const getter = map[type];
  return getter ? getter(context) : [];
}

function filterCatalogRecords(records, keyword) {
  const text = String(keyword || "").trim().toLowerCase();
  if (!text) return records;
  return records.filter((item) => {
    const body = [
      item.name,
      item.faction,
      item.quality,
      item.type,
      item.source,
      item.sourceGeneral,
      item.description,
      item.tactics && item.tactics.innate,
      item.tactics && item.tactics.inherited,
      Array.isArray(item.tags) ? item.tags.join(" ") : "",
      Array.isArray(item.troopLimit) ? item.troopLimit.join(" ") : ""
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return body.includes(text);
  });
}

function addAuditLog(store, action, detail = {}) {
  const item = {
    id: `${Date.now()}-${store.auditLog.length + 1}`,
    action,
    detail,
    createdAt: nowLocal()
  };
  store.auditLog.unshift(item);
  return item;
}

function normalizeText(value, fallback, maxLength = 80) {
  const text = String(value || fallback || "").trim();
  return text.slice(0, maxLength);
}

function normalizeTextList(value, maxItems) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeLineupPayload(payload = {}) {
  const source = payload.lineup && typeof payload.lineup === "object" ? payload.lineup : payload;
  const now = nowLocal();
  const id = normalizeText(source.id || payload.id || `lineup_${Date.now()}`, "lineup", 120);
  const userId = normalizeText(payload.userId || source.userId || "local-demo", "local-demo", 80);

  if (!source || typeof source !== "object") {
    throw Object.assign(new Error("lineup 必须是对象。"), { statusCode: 400 });
  }

  const generals = normalizeTextList(source.generals || payload.generals, 3);
  const tactics = normalizeTextList(source.tactics || payload.tactics, 6);
  if (generals.length !== 3) {
    throw Object.assign(new Error("阵容必须包含 3 名武将。"), { statusCode: 400 });
  }

  return {
    id,
    userId,
    createdAt: normalizeText(source.createdAt, now, 40),
    updatedAt: now,
    scenario: normalizeText(source.scenario || payload.scenario, "未标注场景", 60),
    troop: normalizeText(source.troop || payload.troop, "未标注兵种", 40),
    score: normalizeScore(source.score ?? payload.score),
    generals,
    tactics,
    source: normalizeText(payload.source || source.source || "mini-program", "mini-program", 40)
  };
}

function listLineups(store, searchParams) {
  const userId = searchParams.get("userId");
  const records = store.lineups
    .filter((item) => !userId || item.userId === userId)
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  return paginate(records, searchParams);
}

function saveLineup(store, payload) {
  const record = normalizeLineupPayload(payload);
  store.lineups = [record, ...store.lineups.filter((item) => item.id !== record.id)];
  addAuditLog(store, "lineups.saved", {
    id: record.id,
    userId: record.userId,
    generals: record.generals
  });
  saveStore(store);
  return { ok: true, item: record };
}

function deleteLineup(store, lineupId, userId = "") {
  const before = store.lineups.length;
  store.lineups = store.lineups.filter((item) => item.id !== lineupId || (userId && item.userId !== userId));
  const deleted = before - store.lineups.length;
  if (deleted > 0) {
    addAuditLog(store, "lineups.deleted", { id: lineupId, userId: userId || "any", deleted });
    saveStore(store);
  }
  return { ok: true, deleted };
}

function createAdminHandlers({ store }) {
  return {
    dashboard() {
      const summary = getCatalogSummary();
      return {
        status: "ok",
        catalog: summary.counts,
        rules: {
          total: store.rules.length,
          enabled: store.rules.filter((item) => item.enabled !== false).length
        },
        assets: {
          pendingAudit: catalog
            .getGenerals()
            .filter((item) => item.asset && item.asset.status === "needs_generation").length,
          auditRecords: store.assetAudits.length
        },
        lineups: {
          total: store.lineups.length,
          latest: store.lineups.slice(0, 5)
        },
        auditLog: {
          total: store.auditLog.length,
          latest: store.auditLog.slice(0, 10)
        }
      };
    },

    getRules() {
      return {
        items: store.rules,
        version: store.rulesVersion || "1.0.0"
      };
    },

    saveRules(payload) {
      const nextRules = Array.isArray(payload.rules) ? payload.rules : (Array.isArray(payload) ? payload : null);
      if (!nextRules) {
        throw Object.assign(new Error("rules 必须是数组。"), { statusCode: 400 });
      }
      store.rules = nextRules.map((item, index) => ({
        id: item.id || `rule-${index + 1}`,
        name: item.name || item.label || `规则 ${index + 1}`,
        dimension: item.dimension || "",
        label: item.label || "",
        weight: item.weight || 1,
        threshold: item.threshold || 0,
        enabled: item.enabled !== false,
        description: item.description || "",
        targetUsers: Array.isArray(item.targetUsers) ? item.targetUsers : []
      }));
      store.rulesVersion = payload.version || store.rulesVersion || "1.0.0";
      addAuditLog(store, "rules.updated", { count: store.rules.length, version: store.rulesVersion });
      saveStore(store);
      return { ok: true, items: store.rules, version: store.rulesVersion };
    },

    getAssetAudits() {
      return { items: store.assetAudits };
    },

    saveAssetAudit(payload) {
      const record = {
        id: payload.id || `asset-audit-${Date.now()}`,
        targetId: payload.targetId || "",
        targetType: payload.targetType || "general",
        status: payload.status || "pending",
        note: payload.note || "",
        createdAt: nowLocal()
      };
      store.assetAudits.unshift(record);
      addAuditLog(store, "assets.audit.created", { id: record.id, targetId: record.targetId });
      saveStore(store);
      return { ok: true, item: record };
    },

    getAuditLog() {
      return { items: store.auditLog };
    },

    getLineups() {
      return {
        total: store.lineups.length,
        items: store.lineups.slice(0, 100)
      };
    },

    resetStore() {
      resetAdminStore(store);
      addAuditLog(store, "store.reset", { message: "管理后台存储已恢复默认状态。" });
      saveStore(store);
      return { ok: true, store: exportAdminStore(store) };
    },

    exportStore() {
      return exportAdminStore(store);
    }
  };
}

function createApp(options = {}) {
  const store =
    options.store ||
    (options.storeFile === false
      ? createMemoryStore(options.initialState)
      : createFileStore(options.storeFile || DEFAULT_STORE_FILE, options.initialState));
  const adminToken = options.adminToken || process.env.ADMIN_TOKEN || DEFAULT_ADMIN_TOKEN;
  const staticRoot = options.staticRoot || path.join(__dirname, "..", "admin");
  const admin = createAdminHandlers({ store });
  const officialCatalogFetchStatus = {
    running: false,
    lastStartedAt: null,
    lastFinishedAt: null,
    lastResult: null,
    lastError: null
  };
  let officialCatalogTimer = null;

  // Startup warnings for missing config
  if (!adminToken) {
    console.warn("[WARN] ADMIN_TOKEN 未设置，管理后台将无法访问。请设置环境变量 ADMIN_TOKEN。");
  }
  if (!process.env.TOKEN_SECRET) {
    console.warn("[WARN] TOKEN_SECRET 未设置，使用默认签名密钥。请在生产环境设置 TOKEN_SECRET。");
  }
  if ((process.env.NODE_ENV === "production" || process.env.MYSQL_USER) && !process.env.MYSQL_PASSWORD) {
    console.warn("[WARN] MYSQL_PASSWORD 未设置，数据库连接可能失败。");
  }
  if (process.env.NODE_ENV === "production" && !process.env.MYSQL_DATABASE) {
    console.warn("[WARN] MYSQL_DATABASE 未设置，生产环境不应使用本地默认库。");
  }

  // Initialize MySQL database (returns pool)
  let db = null;
  const dbReady = dbModule.createDatabase(options.dbConfig).then((pool) => { db = pool; });

  // Get or create user from request (openid from header or query)
  async function getUser(req, url) {
    const openid = req.headers["x-user-id"] || url.searchParams.get("userId") || "anonymous";
    return dbModule.getOrCreateUser(db, openid);
  }

  // Extract authenticated user from Bearer token
  async function getAuthUser(req) {
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return null;
    const tokenSecret = process.env.TOKEN_SECRET || DEFAULT_TOKEN_SECRET;
    const payload = verifyToken(token, tokenSecret);
    if (!payload) return null;
    return dbModule.getOrCreateUser(db, payload.userId);
  }

  // Unified user resolution: Bearer token > x-user-id > anonymous
  async function resolveUser(req, url) {
    const authUser = await getAuthUser(req);
    if (authUser) return authUser;
    return getUser(req, url);
  }

  // Database health check
  async function checkDatabaseHealth() {
    try {
      await dbReady;
      const start = Date.now();
      await db.execute("SELECT 1");
      const latency = Date.now() - start;
      const [poolRows] = await db.execute("SHOW STATUS WHERE Variable_name IN ('Threads_connected', 'Max_used_connections')");
      const poolStatus = {};
      for (const row of poolRows) {
        poolStatus[row.Variable_name] = Number(row.Value);
      }
      return {
        ok: true,
        latency,
        connections: poolStatus.Threads_connected || 0,
        maxConnections: poolStatus.Max_used_connections || 0
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async function withCatalogStore(dbFn, storeFn) {
    try {
      if (db) return await dbFn(db);
    } catch (error) {
      if (process.env.NODE_ENV === "production") throw error;
    }
    return storeFn(store);
  }

  async function listCatalogVersions(filters = {}) {
    return withCatalogStore(
      (pool) => dbModule.listCatalogVersions(pool, filters),
      (fallbackStore) => catalogVersionStore.listVersionsFromStore(fallbackStore, filters)
    );
  }

  async function getCatalogVersion(id) {
    return withCatalogStore(
      (pool) => dbModule.getCatalogVersion(pool, id),
      (fallbackStore) => catalogVersionStore.getVersionFromStore(fallbackStore, id)
    );
  }

  async function getPublishedCatalogVersion(seasonKey) {
    return withCatalogStore(
      (pool) => dbModule.getPublishedCatalogVersion(pool, seasonKey),
      (fallbackStore) => catalogVersionStore.getPublishedVersionFromStore(fallbackStore, seasonKey)
    );
  }

  async function createCatalogImportJob(payload = {}) {
    return withCatalogStore(
      (pool) => dbModule.createCatalogImportJob(pool, payload),
      (fallbackStore) => catalogVersionStore.createImportJobFromStore(fallbackStore, payload)
    );
  }

  function hasCatalogDiffChanges(diff = {}) {
    return ["generals", "tactics", "troopTactics", "equipment"].some((key) => {
      const counts = diff[key] && diff[key].counts ? diff[key].counts : {};
      return (counts.added || 0) + (counts.changed || 0) + (counts.removed || 0) > 0;
    });
  }

  async function getOfficialCatalogBaseline(seasonKey) {
    try {
      const published = seasonKey ? await getPublishedCatalogVersion(seasonKey) : null;
      return published && published.snapshot ? published.snapshot : catalog.getCatalog();
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        console.warn(`[WARN] 官方采集未找到赛季 ${seasonKey} 的已发布资料，使用静态基线。`);
      }
      return catalog.getCatalog();
    }
  }

  async function createOfficialCatalogImportJob(payload = {}) {
    const seasonKey = normalizeText(payload.seasonKey || payload.season, process.env.OFFICIAL_CATALOG_SEASON || "pk", 80) || "pk";
    const seasonLabel = normalizeText(payload.seasonLabel, seasonKey === "default" ? "默认赛季" : seasonKey, 120);
    const importedBy = normalizeText(payload.importedBy, payload.scheduled ? "official-scheduler" : "admin", 80);
    const versionPrefix = normalizeText(payload.versionPrefix, process.env.OFFICIAL_CATALOG_VERSION_PREFIX || "official", 40) || "official";
    const versionKey = normalizeText(payload.versionKey, `${versionPrefix}-${seasonKey}-${nowLocal().replace(/[-: ]/g, "")}`, 120);
    const fetchSnapshot = options.officialCatalogFetcher || fetchOfficialCatalogSnapshot;
    const snapshot = normalizeSnapshot(await fetchSnapshot({
      ...(options.officialCatalogFetchOptions || {}),
      fetchedBy: importedBy
    }));
    const baseline = await getOfficialCatalogBaseline(seasonKey);
    const diff = diffCatalogs(baseline, snapshot);
    const counts = countSnapshot(snapshot);
    const snapshotHash = hashSnapshot(snapshot);

    if (!hasCatalogDiffChanges(diff)) {
      return {
        ok: true,
        skipped: true,
        reason: "官方公开资料与当前基线无差异。",
        seasonKey,
        seasonLabel,
        counts,
        snapshotHash,
        diff
      };
    }

    const result = await createCatalogImportJob({
      seasonKey,
      seasonLabel,
      versionKey,
      source: "official",
      importedBy,
      snapshot
    });

    return {
      ok: true,
      skipped: false,
      job: result.job,
      version: result.version,
      diff: result.version.diff || diff,
      counts: result.version.counts || counts,
      snapshotHash: result.version.snapshotHash || snapshotHash
    };
  }

  async function runOfficialCatalogFetch(payload = {}) {
    if (officialCatalogFetchStatus.running) {
      return {
        ok: true,
        skipped: true,
        reason: "官方资料采集正在执行中。",
        status: officialCatalogFetchStatus
      };
    }

    officialCatalogFetchStatus.running = true;
    officialCatalogFetchStatus.lastStartedAt = nowLocal();
    officialCatalogFetchStatus.lastError = null;
    try {
      const result = await createOfficialCatalogImportJob(payload);
      officialCatalogFetchStatus.lastResult = {
        skipped: result.skipped,
        reason: result.reason || "",
        jobId: result.job && result.job.id,
        versionId: result.version && result.version.id,
        seasonKey: result.seasonKey || (result.version && result.version.seasonKey) || payload.seasonKey || payload.season || "pk",
        counts: result.counts || (result.version && result.version.counts) || {}
      };
      officialCatalogFetchStatus.lastFinishedAt = nowLocal();
      addAuditLog(store, result.skipped ? "catalog.import.official.skipped" : "catalog.import.official.created", officialCatalogFetchStatus.lastResult);
      saveStore(store);
      return result;
    } catch (error) {
      officialCatalogFetchStatus.lastError = error.message;
      officialCatalogFetchStatus.lastFinishedAt = nowLocal();
      addAuditLog(store, "catalog.import.official.failed", {
        error: error.message,
        seasonKey: payload.seasonKey || payload.season || process.env.OFFICIAL_CATALOG_SEASON || "pk"
      });
      saveStore(store);
      throw error;
    } finally {
      officialCatalogFetchStatus.running = false;
    }
  }

  function startOfficialCatalogScheduler() {
    const enabled = options.officialCatalogScheduleEnabled ?? process.env.OFFICIAL_CATALOG_FETCH_ENABLED === "true";
    if (!enabled || officialCatalogTimer) return;
    const intervalHours = Number(options.officialCatalogScheduleHours || process.env.OFFICIAL_CATALOG_FETCH_INTERVAL_HOURS || 24);
    const intervalMs = Math.max(1, Number.isFinite(intervalHours) ? intervalHours : 24) * 60 * 60 * 1000;
    officialCatalogTimer = setInterval(() => {
      runOfficialCatalogFetch({
        scheduled: true,
        seasonKey: options.officialCatalogSeason || process.env.OFFICIAL_CATALOG_SEASON || "pk",
        versionPrefix: options.officialCatalogVersionPrefix || process.env.OFFICIAL_CATALOG_VERSION_PREFIX || "official"
      }).catch((error) => {
        console.error("[ERROR] 官方资料定时采集失败：", error.message);
      });
    }, intervalMs);
    if (officialCatalogTimer.unref) officialCatalogTimer.unref();
  }

  async function listCatalogImportJobs(filters = {}) {
    return withCatalogStore(
      (pool) => dbModule.listCatalogImportJobs(pool, filters),
      (fallbackStore) => catalogVersionStore.listImportJobsFromStore(fallbackStore, filters)
    );
  }

  async function getCatalogImportJob(id) {
    return withCatalogStore(
      (pool) => dbModule.getCatalogImportJob(pool, id),
      (fallbackStore) => catalogVersionStore.getImportJobFromStore(fallbackStore, id)
    );
  }

  async function publishCatalogImportJob(jobId) {
    return withCatalogStore(
      (pool) => dbModule.publishCatalogImportJob(pool, jobId),
      (fallbackStore) => catalogVersionStore.publishImportJobFromStore(fallbackStore, jobId)
    );
  }

  async function discardCatalogImportJob(jobId) {
    return withCatalogStore(
      (pool) => dbModule.discardCatalogImportJob(pool, jobId),
      (fallbackStore) => catalogVersionStore.discardImportJobFromStore(fallbackStore, jobId)
    );
  }

  async function listTacticRuleTodos(filters = {}) {
    return withCatalogStore(
      (pool) => dbModule.listTacticRuleTodos(pool, filters),
      (fallbackStore) => catalogVersionStore.listRuleTodosFromStore(fallbackStore, filters)
    );
  }

  async function createTacticRuleTodo(payload = {}) {
    return withCatalogStore(
      (pool) => dbModule.createTacticRuleTodo(pool, payload),
      (fallbackStore) => catalogVersionStore.createRuleTodoFromStore(fallbackStore, payload)
    );
  }

  async function updateTacticRuleTodo(id, payload = {}) {
    return withCatalogStore(
      (pool) => dbModule.updateTacticRuleTodo(pool, id, payload),
      (fallbackStore) => catalogVersionStore.updateRuleTodoFromStore(fallbackStore, id, payload)
    );
  }

  async function resolveCatalogContext(request = {}) {
    const catalogVersionId = request.catalogVersionId || request.versionId || "";
    const requestedSeason = request.season || request.seasonKey || "";
    const seasonKey = requestedSeason || getDefaultCatalogSeason();
    let version = null;
    if (catalogVersionId) {
      version = await getCatalogVersion(catalogVersionId);
      if (!version) throw Object.assign(new Error("资料版本不存在。"), { statusCode: 404 });
    } else {
      version = await getPublishedCatalogVersion(seasonKey);
      if (!version) {
        if (!allowStaticCatalogFallback(request)) throw createCatalogUnavailableError(seasonKey);
        return {
          season: seasonKey,
          catalogVersionId: null,
          catalogSnapshot: null,
          catalogContext: formatCatalogContext(null, {
            season: seasonKey,
            seasonLabel: requestedSeason ? requestedSeason : "开发静态基线"
          })
        };
      }
    }
    return {
      season: version.seasonKey,
      catalogVersionId: version.id,
      catalogSnapshot: version.snapshot,
      catalogContext: formatCatalogContext(version, { season: seasonKey })
    };
  }

  async function listCatalogRecords(type, searchParams) {
    const context = await resolveCatalogContext(getCatalogQueryContext(searchParams));
    const records = filterCatalogRecords(mapCatalogRecords(type, context), searchParams.get("keyword") || "");
    return {
      ...paginate(records, searchParams),
      catalogContext: context.catalogContext
    };
  }

  async function getRuleCoverage(filters = {}) {
    const context = await resolveCatalogContext(filters);
    const snapshotContext = context.catalogSnapshot ? { catalogSnapshot: context.catalogSnapshot } : {};
    const tactics = catalog.getAllTactics(snapshotContext);
    const todos = await listTacticRuleTodos(filters);
    const todoMap = new Map(todos.map((item) => [item.tacticId || item.tacticName, item]));
    const { classifyTacticCoverage } = require("../utils/simulator/tactics");
    const items = tactics.map((tactic) => {
      const coverage = classifyTacticCoverage(tactic);
      const todo = todoMap.get(tactic.id || tactic.name) || null;
      return {
        ...coverage,
        todo,
        todoStatus: todo ? todo.status : ""
      };
    });
    return {
      catalogContext: context.catalogContext,
      summary: items.reduce(
        (result, item) => {
          result.total += 1;
          result[item.status] = (result[item.status] || 0) + 1;
          if (item.todo) result.todo += 1;
          return result;
        },
        { total: 0, explicit: 0, fallback: 0, missed: 0, todo: 0 }
      ),
      items
    };
  }

  async function simulateBattleWithCatalog(payload) {
    const context = await resolveCatalogContext(getBattleCatalogRequest(payload));
    return api.simulateBattle({
      ...payload,
      season: context.season,
      catalogVersionId: context.catalogVersionId,
      catalogSnapshot: context.catalogSnapshot,
      catalogContext: context.catalogContext
    });
  }

  async function handle(req, res) {
    // Wait for DB pool to be ready
    await dbReady;

    // Request logging
    const requestStart = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const clientIp = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket.remoteAddress;

    res.on("finish", () => {
      const duration = Date.now() - requestStart;
      const logEntry = {
        requestId,
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration,
        ip: clientIp,
        userAgent: req.headers["user-agent"]
      };
      // Log slow requests (>1s) or errors
      if (duration > 1000 || res.statusCode >= 400) {
        console.log(`[WARN] ${JSON.stringify(logEntry)}`);
      }
    });

    applyCors(res, req.headers.origin);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", "http://127.0.0.1");
    const path = url.pathname;

    try {
      if (req.method === "GET" && path === "/health") {
        const dbStatus = await checkDatabaseHealth();
        sendJson(res, 200, {
          status: dbStatus.ok ? "ok" : "degraded",
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || "0.1.0",
          database: dbStatus
        });
        return;
      }

      // --- Auth endpoints ---

      // Register with username/password
      if (req.method === "POST" && path === "/api/v1/auth/register") {
        const body = await readJsonBody(req);
        const username = (body.username || "").trim();
        const password = body.password || "";
        const nickname = (body.nickname || "").trim();

        if (!username || username.length < 3) {
          sendJson(res, 400, { ok: false, message: "用户名至少 3 个字符。" });
          return;
        }
        if (!password || password.length < 6) {
          sendJson(res, 400, { ok: false, message: "密码至少 6 个字符。" });
          return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          sendJson(res, 400, { ok: false, message: "用户名只能包含字母、数字和下划线。" });
          return;
        }

        const result = await dbModule.registerUser(db, username, password, nickname);
        if (result.error) {
          sendJson(res, 400, { ok: false, message: result.error });
          return;
        }

        const tokenSecret = process.env.TOKEN_SECRET || DEFAULT_TOKEN_SECRET;
        const token = generateToken(result.user.id, tokenSecret);
        sendJson(res, 200, { ok: true, token, user: result.user });
        return;
      }

      // Login with username/password
      if (req.method === "POST" && path === "/api/v1/auth/login") {
        const body = await readJsonBody(req);
        const username = (body.username || "").trim();
        const password = body.password || "";

        if (!username || !password) {
          sendJson(res, 400, { ok: false, message: "请输入用户名和密码。" });
          return;
        }

        const result = await dbModule.loginUser(db, username, password);
        if (result.error) {
          sendJson(res, 401, { ok: false, message: result.error });
          return;
        }

        const tokenSecret = process.env.TOKEN_SECRET || DEFAULT_TOKEN_SECRET;
        const token = generateToken(result.user.id, tokenSecret);
        sendJson(res, 200, { ok: true, token, user: result.user });
        return;
      }

      if (req.method === "POST" && path === "/api/v1/auth/wechat-login") {
        const body = await readJsonBody(req);
        const code = body.code;
        if (!code) {
          sendJson(res, 400, { ok: false, message: "缺少 code 参数" });
          return;
        }

        const appid = process.env.WX_APPID;
        const secret = process.env.WX_SECRET;
        let openid;

        if (appid && secret) {
          try {
            const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
            const wxRes = await fetch(wxUrl);
            const wxData = await wxRes.json();
            if (wxData.errcode) {
              sendJson(res, 400, { ok: false, message: `微信登录失败：${wxData.errmsg || wxData.errcode}` });
              return;
            }
            openid = wxData.openid;
            if (!openid) {
              sendJson(res, 500, { ok: false, message: "微信未返回 openid。" });
              return;
            }
          } catch (err) {
            sendJson(res, 502, { ok: false, message: `微信接口调用失败：${err.message}` });
            return;
          }
        } else {
          // Development fallback: use code as openid
          openid = "dev_" + code;
        }

        const user = await dbModule.getOrCreateUser(db, openid);
        const tokenSecret = process.env.TOKEN_SECRET || DEFAULT_TOKEN_SECRET;
        const token = generateToken(user.id, tokenSecret);
        sendJson(res, 200, { ok: true, token, userId: user.id });
        return;
      }

      if (req.method === "POST" && path === "/api/v1/auth/anonymous-login") {
        const body = await readJsonBody(req);
        const userId = body.userId || "anonymous_" + Date.now();
        const user = await dbModule.getOrCreateUser(db, userId);
        const tokenSecret = process.env.TOKEN_SECRET || DEFAULT_TOKEN_SECRET;
        const token = generateToken(user.id, tokenSecret);
        sendJson(res, 200, { ok: true, token, userId: user.id });
        return;
      }

      if (req.method === "GET" && path === "/api/v1/auth/profile") {
        const user = await getAuthUser(req);
        if (!user) {
          sendJson(res, 401, { ok: false, message: "未登录或 token 已过期。" });
          return;
        }
        const [lineupCountRows] = await db.execute("SELECT COUNT(*) as cnt FROM lineups WHERE user_id = ?", [user.id]);
        const [drawCountRows] = await db.execute("SELECT COUNT(*) as cnt FROM draw_records WHERE user_id = ?", [user.id]);
        const tierInfo = await dbModule.getUserTier(db, user.id);
        sendJson(res, 200, {
          ok: true,
          user: {
            id: user.id,
            nickname: user.nickname,
            createdAt: user.created_at,
            lineupCount: lineupCountRows[0].cnt,
            drawCount: drawCountRows[0].cnt
          },
          entitlements: dbModule.getEntitlements(tierInfo.tier)
        });
        return;
      }

      if (req.method === "GET" && path === "/api/v1/auth/entitlements") {
        const user = await getAuthUser(req);
        if (!user) {
          sendJson(res, 200, { ok: true, entitlements: dbModule.getEntitlements("free") });
          return;
        }
        const tierInfo = await dbModule.getUserTier(db, user.id);
        sendJson(res, 200, { ok: true, entitlements: dbModule.getEntitlements(tierInfo.tier) });
        return;
      }

      if (req.method === "POST" && path === "/api/v1/auth/set-tier") {
        const token = req.headers["x-admin-token"];
        if (!safeCompare(token, adminToken)) {
          sendJson(res, 401, { error: "需要管理员权限。" });
          return;
        }
        const body = await readJsonBody(req);
        const targetUserId = (body.userId || "").trim();
        if (!targetUserId) {
          sendJson(res, 400, { ok: false, message: "缺少 userId 参数。" });
          return;
        }
        const tier = body.tier === "premium" ? "premium" : "free";
        const expiresAt = tier === "premium" && body.days
          ? new Date(Date.now() + body.days * 86400000).toISOString()
          : null;
        const result = await dbModule.setUserTier(db, targetUserId, tier, expiresAt);
        addAuditLog(store, "tier.changed", { targetUserId, tier, expiresAt, admin: true });
        sendJson(res, 200, { ok: true, tier: result.tier, expiresAt: result.expiresAt });
        return;
      }

      if ((req.method === "GET" || req.method === "HEAD") && path === "/") {
        res.writeHead(302, { location: "/admin/" });
        res.end();
        return;
      }

      if ((req.method === "GET" || req.method === "HEAD") && path.startsWith("/admin")) {
        if (!fs.existsSync(staticRoot) || !serveStaticFile(res, staticRoot, path, req.method === "HEAD")) {
          sendText(res, 404, "管理后台静态资源不存在。");
        }
        return;
      }

      if (req.method === "GET" && path === "/api/v1/catalog/versions") {
        const items = await listCatalogVersions({
          season: url.searchParams.get("season") || url.searchParams.get("seasonKey") || "",
          status: url.searchParams.get("status") || "published"
        });
        sendJson(res, 200, { items });
        return;
      }

      if (req.method === "GET" && path === "/api/v1/catalog/summary") {
        const context = await resolveCatalogContext(getCatalogQueryContext(url.searchParams));
        sendJson(res, 200, { ...getCatalogSummary(context), catalogContext: context.catalogContext });
        return;
      }

      if (req.method === "GET" && path === "/api/v1/catalog/generals") {
        sendJson(res, 200, await listCatalogRecords("generals", url.searchParams));
        return;
      }

      if (req.method === "GET" && path === "/api/v1/catalog/tactics") {
        sendJson(res, 200, await listCatalogRecords("tactics", url.searchParams));
        return;
      }

      if (req.method === "GET" && path === "/api/v1/catalog/equipment") {
        sendJson(res, 200, await listCatalogRecords("equipment", url.searchParams));
        return;
      }

      if (req.method === "GET" && path === "/api/v1/catalog/troop-tactics") {
        sendJson(res, 200, await listCatalogRecords("troopTactics", url.searchParams));
        return;
      }

      if (req.method === "POST" && path === "/api/v1/lineups/analyze") {
        const body = await readJsonBody(req);
        const context = await resolveCatalogContext(getBattleCatalogRequest(body));
        const report = api.analyzeLineup({
          ...body,
          season: context.season,
          catalogVersionId: context.catalogVersionId,
          catalogSnapshot: context.catalogSnapshot,
          catalogContext: context.catalogContext
        });
        if (body.lineupId) {
          const battleStats = await dbModule.getLineupBattleStats(db, body.lineupId);
          report.battleStats = battleStats;
        }
        sendJson(res, 200, report);
        return;
      }

      if (req.method === "GET" && path === "/api/v1/lineups") {
        const user = await resolveUser(req, url);
        const rows = await dbModule.getLineups(db, user.id);
        sendJson(res, 200, { items: rows });
        return;
      }

      if (req.method === "POST" && path === "/api/v1/lineups") {
        const user = await resolveUser(req, url);
        const body = await readJsonBody(req);
        const record = normalizeLineupPayload(body);
        const saved = await dbModule.saveLineup(db, user.id, record);
        addAuditLog(store, "lineups.saved", { id: saved.id, userId: user.id });
        sendJson(res, 200, { ok: true, item: saved });
        return;
      }

      const lineupDeleteMatch = path.match(/^\/api\/v1\/lineups\/([^/]+)$/);
      if (req.method === "DELETE" && lineupDeleteMatch) {
        const user = await resolveUser(req, url);
        const lineupId = decodeURIComponent(lineupDeleteMatch[1]);
        const result = await dbModule.deleteLineup(db, lineupId, user.id);
        if (result.deleted > 0) {
          addAuditLog(store, "lineups.deleted", { id: lineupId, userId: user.id });
        }
        sendJson(res, 200, { ok: true, deleted: result.deleted });
        return;
      }

      // Sync lineups from local to server
      if (req.method === "POST" && path === "/api/v1/lineups/sync") {
        const user = await getUser(req, url);
        const body = await readJsonBody(req);
        const lineups = Array.isArray(body.lineups) ? body.lineups : [];
        let added = 0;
        let failed = 0;
        const errors = [];
        for (const l of lineups) {
          try {
            await dbModule.saveLineup(db, user.id, {
              id: l.id,
              scenario: l.scenario,
              troop: l.troop,
              score: l.score,
              generals: l.generals,
              tactics: l.tactics,
              source: "h5-local"
            });
            added++;
          } catch (e) {
            failed++;
            if (errors.length < 5) errors.push({ id: l.id, error: e.message });
          }
        }
        if (failed > 0) {
          addAuditLog(store, "lineups.sync.partial", { added, failed, userId: user.id });
        }
        sendJson(res, 200, { ok: true, added, failed, errors: errors.length > 0 ? errors : undefined });
        return;
      }

      if (req.method === "POST" && path === "/api/v1/matchups/preview") {
        const body = await readJsonBody(req);
        const context = await resolveCatalogContext(getBattleCatalogRequest(body));
        sendJson(res, 200, api.previewMatchup({
          ...body,
          season: context.season,
          catalogVersionId: context.catalogVersionId,
          catalogSnapshot: context.catalogSnapshot,
          catalogContext: context.catalogContext
        }));
        return;
      }

      if (req.method === "POST" && path === "/api/v1/battles/simulate") {
        sendJson(res, 200, await simulateBattleWithCatalog(await readJsonBody(req)));
        return;
      }

      if (req.method === "POST" && path === "/api/v1/accounts/optimize") {
        const body = await readJsonBody(req);
        const context = await resolveCatalogContext(getBattleCatalogRequest(body));
        sendJson(res, 200, api.optimizeAccount({
          ...body,
          season: context.season,
          catalogVersionId: context.catalogVersionId,
          catalogSnapshot: context.catalogSnapshot,
          catalogContext: context.catalogContext
        }));
        return;
      }

      if (req.method === "POST" && path === "/api/v1/battle-reports") {
        const user = await resolveUser(req, url);
        const body = await readJsonBody(req);
        if (!body.result || !["win", "loss", "draw"].includes(body.result)) {
          sendJson(res, 400, { ok: false, message: "result 必须是 win/loss/draw。" });
          return;
        }
        const saved = await dbModule.addBattleReport(db, user.id, body);
        addAuditLog(store, "battleReports.created", { id: saved.id, result: body.result, userId: user.id });
        sendJson(res, 200, { ok: true, item: saved });
        return;
      }

      if (req.method === "GET" && path === "/api/v1/battle-reports") {
        const user = await resolveUser(req, url);
        const limit = parsePositiveInteger(url.searchParams.get("limit"), 50, 200);
        const offset = parsePositiveInteger(url.searchParams.get("offset"), 0);
        const reports = await dbModule.getBattleReports(db, user.id, limit, offset);
        sendJson(res, 200, { items: reports });
        return;
      }

      if (req.method === "GET" && path === "/api/v1/battle-reports/stats") {
        const user = await resolveUser(req, url);
        const stats = await dbModule.getBattleReportStats(db, user.id);
        sendJson(res, 200, { ok: true, stats });
        return;
      }

      const battleReportDeleteMatch = path.match(/^\/api\/v1\/battle-reports\/([^/]+)$/);
      if (req.method === "DELETE" && battleReportDeleteMatch) {
        const user = await resolveUser(req, url);
        const reportId = decodeURIComponent(battleReportDeleteMatch[1]);
        const result = await dbModule.deleteBattleReport(db, reportId, user.id);
        sendJson(res, 200, { ok: true, deleted: result.deleted });
        return;
      }

      if (req.method === "POST" && path === "/api/v1/battle-reports/import") {
        sendJson(res, 200, api.importBattleReport(await readJsonBody(req)));
        return;
      }

      // --- Feedback ---

      if (req.method === "POST" && path === "/api/v1/feedback") {
        const body = await readJsonBody(req);
        const content = (body.content || "").trim();
        if (!content || content.length < 5) {
          sendJson(res, 400, { ok: false, message: "反馈内容至少 5 个字。" });
          return;
        }
        if (content.length > 1000) {
          sendJson(res, 400, { ok: false, message: "反馈内容不能超过 1000 字。" });
          return;
        }
        const contact = (body.contact || "").trim().slice(0, 128);
        const user = await getAuthUser(req);
        const saved = await dbModule.addFeedback(db, user ? user.id : null, content, contact);
        sendJson(res, 200, { ok: true, item: saved });
        return;
      }

      if (req.method === "GET" && path === "/api/v1/feedback") {
        const token = req.headers["x-admin-token"];
        if (!safeCompare(token, adminToken)) {
          sendJson(res, 401, { error: "需要管理员权限。" });
          return;
        }
        const limit = parsePositiveInteger(url.searchParams.get("limit"), 50, 200);
        const offset = parsePositiveInteger(url.searchParams.get("offset"), 0);
        const items = await dbModule.getFeedbackList(db, limit, offset);
        sendJson(res, 200, { items });
        return;
      }

      const feedbackStatusMatch = path.match(/^\/api\/v1\/feedback\/([^/]+)\/status$/);
      if (req.method === "PUT" && feedbackStatusMatch) {
        const token = req.headers["x-admin-token"];
        if (!safeCompare(token, adminToken)) {
          sendJson(res, 401, { error: "需要管理员权限。" });
          return;
        }
        const body = await readJsonBody(req);
        const validStatuses = ["pending", "read", "resolved", "rejected"];
        if (!validStatuses.includes(body.status)) {
          sendJson(res, 400, { ok: false, message: "无效状态。" });
          return;
        }
        const feedbackId = decodeURIComponent(feedbackStatusMatch[1]);
        const updated = await dbModule.updateFeedbackStatus(db, feedbackId, body.status);
        sendJson(res, 200, { ok: true, item: updated });
        return;
      }

      // --- Draw pools (MySQL) ---

      if (req.method === "GET" && path === "/api/v1/draw-pools") {
        const user = await getUser(req, url);
        const pools = await dbModule.getDrawPools(db, user.id);
        sendJson(res, 200, { items: pools });
        return;
      }

      if (req.method === "POST" && path === "/api/v1/draw-pools") {
        const user = await getUser(req, url);
        const body = await readJsonBody(req);
        const name = normalizeText(body.name, "新卡池", 60);
        const pool = await dbModule.createDrawPool(db, user.id, name);
        addAuditLog(store, "drawPools.created", { id: pool.id, name: pool.name, userId: user.id });
        sendJson(res, 200, { ok: true, item: pool });
        return;
      }

      const drawPoolDeleteMatch = path.match(/^\/api\/v1\/draw-pools\/([^/]+)$/);
      if (req.method === "DELETE" && drawPoolDeleteMatch) {
        const user = await getUser(req, url);
        const poolId = decodeURIComponent(drawPoolDeleteMatch[1]);
        const result = await dbModule.deleteDrawPool(db, poolId, user.id);
        if (result.deleted > 0) {
          addAuditLog(store, "drawPools.deleted", { id: poolId, recordsDeleted: result.recordsDeleted, userId: user.id });
        }
        sendJson(res, 200, { ok: true, deleted: result.deleted, recordsDeleted: result.recordsDeleted });
        return;
      }

      // --- Draw records (MySQL) ---

      if (req.method === "GET" && path === "/api/v1/draw-records") {
        const user = await getUser(req, url);
        const poolId = url.searchParams.get("poolId");
        let records;
        if (poolId) {
          records = await dbModule.getDrawRecords(db, poolId, user.id);
        } else {
          records = await dbModule.getAllDrawRecords(db, user.id);
        }
        sendJson(res, 200, { items: records });
        return;
      }

      if (req.method === "POST" && path === "/api/v1/draw-records") {
        const user = await getUser(req, url);
        const body = await readJsonBody(req);
        const record = {
          poolId: body.poolId || "default",
          date: body.date || nowLocal().slice(0, 10),
          time: body.time || nowLocal().slice(11, 16),
          quality: body.quality || "blue",
          generalName: normalizeText(body.generalName, "", 40),
          drawType: body.drawType || "free",
          group: body.group || 1
        };
        const saved = await dbModule.addDrawRecord(db, user.id, record);
        sendJson(res, 200, { ok: true, item: saved });
        return;
      }

      const drawRecordDeleteMatch = path.match(/^\/api\/v1\/draw-records\/([^/]+)$/);
      if (req.method === "DELETE" && drawRecordDeleteMatch) {
        const user = await getUser(req, url);
        const recordId = decodeURIComponent(drawRecordDeleteMatch[1]);
        const result = await dbModule.deleteDrawRecord(db, recordId, user.id);
        sendJson(res, 200, { ok: true, deleted: result.deleted });
        return;
      }

      // --- Draw records sync (batch upload, MySQL) ---

      if (req.method === "POST" && path === "/api/v1/draw-records/sync") {
        const user = await getUser(req, url);
        const body = await readJsonBody(req);
        const records = Array.isArray(body.records) ? body.records : [];
        const result = await dbModule.syncDrawRecords(db, user.id, records);
        if (result.added > 0) {
          addAuditLog(store, "drawRecords.synced", { added: result.added, total: result.total, userId: user.id });
        }
        sendJson(res, 200, { ok: true, added: result.added, total: result.total });
        return;
      }

      if (path.startsWith("/api/admin/")) {
        const token = req.headers["x-admin-token"];
        if (!safeCompare(token, adminToken)) {
          sendJson(res, 401, { error: "缺少或无效的管理后台令牌。" });
          return;
        }

        if (req.method === "GET" && path === "/api/admin/catalog/versions") {
          const items = await listCatalogVersions({
            season: url.searchParams.get("season") || url.searchParams.get("seasonKey") || "",
            status: url.searchParams.get("status") || ""
          });
          sendJson(res, 200, { items });
          return;
        }

        const catalogVersionRecordsMatch = path.match(/^\/api\/admin\/catalog\/versions\/([^/]+)\/records$/);
        if (req.method === "GET" && catalogVersionRecordsMatch) {
          const versionId = decodeURIComponent(catalogVersionRecordsMatch[1]);
          const context = await resolveCatalogContext({ catalogVersionId: versionId });
          const type = url.searchParams.get("type") || "generals";
          const records = filterCatalogRecords(mapCatalogRecords(type, context), url.searchParams.get("keyword") || "");
          sendJson(res, 200, {
            catalogContext: context.catalogContext,
            type,
            ...paginate(records, url.searchParams)
          });
          return;
        }

        const catalogVersionDetailMatch = path.match(/^\/api\/admin\/catalog\/versions\/([^/]+)$/);
        if (req.method === "GET" && catalogVersionDetailMatch) {
          const versionId = decodeURIComponent(catalogVersionDetailMatch[1]);
          const version = await getCatalogVersion(versionId);
          if (!version) {
            sendJson(res, 404, { error: "资料版本不存在。" });
            return;
          }
          sendJson(res, 200, { item: version });
          return;
        }

        if (req.method === "POST" && path === "/api/admin/catalog/import-jobs/upload") {
          const body = await readJsonBody(req);
          const result = await createCatalogImportJob({ ...body, importedBy: body.importedBy || "admin" });
          addAuditLog(store, "catalog.import.created", {
            jobId: result.job.id,
            versionId: result.version.id,
            seasonKey: result.version.seasonKey
          });
          saveStore(store);
          sendJson(res, 200, { ok: true, ...result });
          return;
        }

        if (req.method === "POST" && path === "/api/admin/catalog/import-jobs/official") {
          const body = await readJsonBody(req);
          const result = await runOfficialCatalogFetch({ ...body, importedBy: body.importedBy || "admin" });
          sendJson(res, 200, { ...result, status: officialCatalogFetchStatus });
          return;
        }

        if (req.method === "GET" && path === "/api/admin/catalog/import-jobs/official/status") {
          sendJson(res, 200, { ok: true, status: officialCatalogFetchStatus });
          return;
        }

        if (req.method === "GET" && path === "/api/admin/catalog/import-jobs") {
          const items = await listCatalogImportJobs({ status: url.searchParams.get("status") || "" });
          sendJson(res, 200, { items });
          return;
        }

        const catalogImportPublishMatch = path.match(/^\/api\/admin\/catalog\/import-jobs\/([^/]+)\/publish$/);
        if (req.method === "POST" && catalogImportPublishMatch) {
          const jobId = decodeURIComponent(catalogImportPublishMatch[1]);
          const result = await publishCatalogImportJob(jobId);
          addAuditLog(store, "catalog.import.published", {
            jobId,
            versionId: result.version.id,
            seasonKey: result.version.seasonKey,
            createdTodos: result.createdTodos || 0
          });
          saveStore(store);
          sendJson(res, 200, { ok: true, ...result });
          return;
        }

        const catalogImportDiscardMatch = path.match(/^\/api\/admin\/catalog\/import-jobs\/([^/]+)\/discard$/);
        if (req.method === "POST" && catalogImportDiscardMatch) {
          const jobId = decodeURIComponent(catalogImportDiscardMatch[1]);
          const result = await discardCatalogImportJob(jobId);
          addAuditLog(store, "catalog.import.discarded", {
            jobId,
            versionId: result.version && result.version.id,
            seasonKey: result.job && result.job.seasonKey
          });
          saveStore(store);
          sendJson(res, 200, { ok: true, ...result });
          return;
        }

        const catalogImportDetailMatch = path.match(/^\/api\/admin\/catalog\/import-jobs\/([^/]+)$/);
        if (req.method === "GET" && catalogImportDetailMatch) {
          const jobId = decodeURIComponent(catalogImportDetailMatch[1]);
          const job = await getCatalogImportJob(jobId);
          if (!job) {
            sendJson(res, 404, { error: "导入任务不存在。" });
            return;
          }
          const version = job.versionId ? await getCatalogVersion(job.versionId) : null;
          sendJson(res, 200, { item: job, version });
          return;
        }

        if (req.method === "GET" && path === "/api/admin/catalog/rule-coverage") {
          const result = await getRuleCoverage({
            season: url.searchParams.get("season") || url.searchParams.get("seasonKey") || "",
            catalogVersionId: url.searchParams.get("versionId") || url.searchParams.get("catalogVersionId") || "",
            status: url.searchParams.get("todoStatus") || ""
          });
          sendJson(res, 200, result);
          return;
        }

        if (req.method === "GET" && path === "/api/admin/catalog/rule-todos") {
          const items = await listTacticRuleTodos({
            season: url.searchParams.get("season") || url.searchParams.get("seasonKey") || "",
            status: url.searchParams.get("status") || ""
          });
          sendJson(res, 200, { items });
          return;
        }

        if (req.method === "POST" && path === "/api/admin/catalog/rule-todos") {
          const item = await createTacticRuleTodo(await readJsonBody(req));
          addAuditLog(store, "catalog.ruleTodo.created", { id: item.id, tacticName: item.tacticName });
          saveStore(store);
          sendJson(res, 200, { ok: true, item });
          return;
        }

        const catalogRuleTodoMatch = path.match(/^\/api\/admin\/catalog\/rule-todos\/([^/]+)$/);
        if (req.method === "PUT" && catalogRuleTodoMatch) {
          const id = decodeURIComponent(catalogRuleTodoMatch[1]);
          const item = await updateTacticRuleTodo(id, await readJsonBody(req));
          addAuditLog(store, "catalog.ruleTodo.updated", { id: item.id, status: item.status, priority: item.priority });
          saveStore(store);
          sendJson(res, 200, { ok: true, item });
          return;
        }

        if (req.method === "GET" && path === "/api/admin/dashboard") {
          sendJson(res, 200, admin.dashboard());
          return;
        }

        if (req.method === "GET" && path === "/api/admin/rules") {
          sendJson(res, 200, admin.getRules());
          return;
        }

        if (req.method === "POST" && path === "/api/admin/rules") {
          sendJson(res, 200, admin.saveRules(await readJsonBody(req)));
          return;
        }

        if (req.method === "GET" && path === "/api/admin/assets/audit") {
          sendJson(res, 200, admin.getAssetAudits());
          return;
        }

        if (req.method === "POST" && path === "/api/admin/assets/audit") {
          sendJson(res, 200, admin.saveAssetAudit(await readJsonBody(req)));
          return;
        }

        if (req.method === "GET" && path === "/api/admin/audit-log") {
          sendJson(res, 200, admin.getAuditLog());
          return;
        }

        if (req.method === "GET" && path === "/api/admin/lineups") {
          sendJson(res, 200, admin.getLineups());
          return;
        }

        if (req.method === "GET" && path === "/api/admin/users") {
          const limit = parsePositiveInteger(url.searchParams.get("limit"), 50, 200);
          const offset = parsePositiveInteger(url.searchParams.get("offset"), 0);
          const items = await dbModule.getUsers(db, limit, offset);
          const total = await dbModule.getUserCount(db);
          sendJson(res, 200, { items, total });
          return;
        }

        if (req.method === "GET" && /^\/api\/admin\/users\/[^/]+$/.test(path)) {
          const userId = path.split("/").pop();
          const user = await dbModule.getUserById(db, userId);
          if (!user) {
            sendJson(res, 404, { error: "用户不存在。" });
            return;
          }
          const lineups = await dbModule.getLineups(db, userId);
          const drawRecords = await dbModule.getAllDrawRecords(db, userId);
          const battleReports = await dbModule.getBattleReports(db, userId, 50, 0);
          sendJson(res, 200, { user, lineups, drawRecords, battleReports });
          return;
        }

        if (req.method === "GET" && path === "/api/admin/battle-reports") {
          const limit = parsePositiveInteger(url.searchParams.get("limit"), 50, 200);
          const offset = parsePositiveInteger(url.searchParams.get("offset"), 0);
          const items = await dbModule.getAdminBattleReports(db, limit, offset);
          sendJson(res, 200, { items });
          return;
        }

        if (req.method === "DELETE" && /^\/api\/admin\/feedback\/[^/]+$/.test(path)) {
          const feedbackId = path.split("/").pop();
          const existing = await dbModule.getFeedbackById(db, feedbackId);
          if (!existing) {
            sendJson(res, 404, { error: "反馈不存在。" });
            return;
          }
          const result = await dbModule.deleteFeedback(db, feedbackId);
          addAuditLog(store, "feedback.deleted", { feedbackId });
          sendJson(res, 200, { ok: true, deleted: result.deleted });
          return;
        }

        if (req.method === "PUT" && /^\/api\/admin\/battle-reports\/[^/]+$/.test(path)) {
          const reportId = path.split("/").pop();
          const body = await readJsonBody(req);
          const existing = await dbModule.getBattleReportById(db, reportId);
          if (!existing) {
            sendJson(res, 404, { error: "战报不存在。" });
            return;
          }
          if (body.note !== undefined) {
            await db.execute("UPDATE battle_reports SET note = ? WHERE id = ?", [body.note, reportId]);
          }
          const updated = await dbModule.getBattleReportById(db, reportId);
          sendJson(res, 200, updated);
          return;
        }

        if (req.method === "POST" && path === "/api/admin/store/reset") {
          sendJson(res, 200, admin.resetStore());
          return;
        }

        if (req.method === "GET" && path === "/api/admin/store/export") {
          sendJson(res, 200, admin.exportStore());
          return;
        }

        if (req.method === "POST" && path === "/api/admin/cards/upload") {
          const contentType = req.headers["content-type"] || "";
          const boundaryMatch = contentType.match(/boundary=(.+)/);
          if (!boundaryMatch) {
            sendJson(res, 400, { error: "缺少 multipart boundary。" });
            return;
          }
          const boundary = boundaryMatch[1];
          const body = await readRawBody(req, 10 * 1024 * 1024);
          const file = parseMultipartFile(body, boundary);
          if (!file || !file.filename) {
            sendJson(res, 400, { error: "未找到文件。" });
            return;
          }
          const ossModule = require("./oss");
          const result = await ossModule.uploadBuffer(file.data, file.filename, file.mime);
          sendJson(res, 200, { ok: true, url: result.url, ossKey: result.ossKey });
          return;
        }
      }

      sendJson(res, 404, { error: "接口不存在。" });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error(`[ERROR] ${req.method} ${path}:`, error.message);
      sendJson(res, statusCode, {
        error: statusCode >= 500 && !error.expose ? "服务端处理失败。" : error.message
      });
    }
  }

  const server = http.createServer(handle);

  return {
    server,
    store,
    handle,
    start(port = 8787, host = "127.0.0.1") {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          startOfficialCatalogScheduler();
          resolve(this);
        });
      });
    },
    async stop() {
      if (officialCatalogTimer) {
        clearInterval(officialCatalogTimer);
        officialCatalogTimer = null;
      }
      if (server.listening) {
        await new Promise((resolve, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }
      await dbModule.closePool();
    },
    address() {
      return server.address();
    }
  };
}

function createServer(options = {}) {
  return createApp(options);
}

module.exports = {
  createApp,
  createServer,
  createMemoryStore
};
