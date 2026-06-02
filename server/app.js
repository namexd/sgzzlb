const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const catalog = require("../utils/catalog");
const api = require("../services/api");
const {
  DEFAULT_STORE_FILE,
  createMemoryStore,
  createFileStore,
  saveStore,
  resetStore: resetAdminStore,
  exportStore: exportAdminStore
} = require("./store");
const dbModule = require("./db");

const DEFAULT_ADMIN_TOKEN = "dev-admin-token";
const DEFAULT_TOKEN_SECRET = "sgzzlb-token-secret-dev";

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
  res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,x-admin-token");
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

function getCatalogSummary() {
  const meta = catalog.getMeta();
  const generals = catalog.getGenerals();
  const tactics = catalog.getTactics();
  const equipment = catalog.getEquipment();
  const troopTactics = catalog.getTroopTactics();

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

function addAuditLog(store, action, detail = {}) {
  const item = {
    id: `${Date.now()}-${store.auditLog.length + 1}`,
    action,
    detail,
    createdAt: new Date().toISOString()
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
  const now = new Date().toISOString();
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
      return { items: store.rules };
    },

    saveRules(payload) {
      const nextRules = Array.isArray(payload.rules) ? payload.rules : null;
      if (!nextRules) {
        throw Object.assign(new Error("rules 必须是数组。"), { statusCode: 400 });
      }
      store.rules = nextRules.map((item, index) => ({
        id: item.id || `rule-${index + 1}`,
        name: item.name || `规则 ${index + 1}`,
        enabled: item.enabled !== false,
        description: item.description || ""
      }));
      addAuditLog(store, "rules.updated", { count: store.rules.length });
      saveStore(store);
      return { ok: true, items: store.rules };
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
        createdAt: new Date().toISOString()
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

  // Initialize SQLite database
  const db = dbModule.createDatabase(options.dbPath);

  // Get or create user from request (openid from header or query)
  function getUser(req, url) {
    const openid = req.headers["x-user-id"] || url.searchParams.get("userId") || "anonymous";
    return dbModule.getOrCreateUser(db, openid);
  }

  // Extract authenticated user from Bearer token
  function getAuthUser(req) {
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return null;
    const tokenSecret = process.env.TOKEN_SECRET || DEFAULT_TOKEN_SECRET;
    const payload = verifyToken(token, tokenSecret);
    if (!payload) return null;
    return dbModule.getOrCreateUser(db, payload.userId);
  }

  async function handle(req, res) {
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
        sendJson(res, 200, { status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
        return;
      }

      // --- Auth endpoints ---

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

        const user = dbModule.getOrCreateUser(db, openid);
        const tokenSecret = process.env.TOKEN_SECRET || DEFAULT_TOKEN_SECRET;
        const token = generateToken(user.id, tokenSecret);
        sendJson(res, 200, { ok: true, token, userId: user.id });
        return;
      }

      if (req.method === "POST" && path === "/api/v1/auth/anonymous-login") {
        const body = await readJsonBody(req);
        const userId = body.userId || "anonymous_" + Date.now();
        const user = dbModule.getOrCreateUser(db, userId);
        const tokenSecret = process.env.TOKEN_SECRET || DEFAULT_TOKEN_SECRET;
        const token = generateToken(user.id, tokenSecret);
        sendJson(res, 200, { ok: true, token, userId: user.id });
        return;
      }

      if (req.method === "GET" && path === "/api/v1/auth/profile") {
        const user = getAuthUser(req);
        if (!user) {
          sendJson(res, 401, { ok: false, message: "未登录或 token 已过期。" });
          return;
        }
        const lineupCount = db.prepare("SELECT COUNT(*) as cnt FROM lineups WHERE user_id = ?").get(user.id).cnt;
        const drawCount = db.prepare("SELECT COUNT(*) as cnt FROM draw_records WHERE user_id = ?").get(user.id).cnt;
        const tierInfo = dbModule.getUserTier(db, user.id);
        sendJson(res, 200, {
          ok: true,
          user: {
            id: user.id,
            nickname: user.nickname,
            createdAt: user.created_at,
            lineupCount,
            drawCount
          },
          entitlements: dbModule.getEntitlements(tierInfo.tier)
        });
        return;
      }

      if (req.method === "GET" && path === "/api/v1/auth/entitlements") {
        const user = getAuthUser(req);
        if (!user) {
          sendJson(res, 200, { ok: true, entitlements: dbModule.getEntitlements("free") });
          return;
        }
        const tierInfo = dbModule.getUserTier(db, user.id);
        sendJson(res, 200, { ok: true, entitlements: dbModule.getEntitlements(tierInfo.tier) });
        return;
      }

      if (req.method === "POST" && path === "/api/v1/auth/set-tier") {
        const user = getAuthUser(req);
        if (!user) {
          sendJson(res, 401, { ok: false, message: "未登录。" });
          return;
        }
        const body = await readJsonBody(req);
        const tier = body.tier === "premium" ? "premium" : "free";
        const expiresAt = tier === "premium" && body.days
          ? new Date(Date.now() + body.days * 86400000).toISOString()
          : null;
        const result = dbModule.setUserTier(db, user.id, tier, expiresAt);
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

      if (req.method === "GET" && path === "/api/v1/catalog/summary") {
        sendJson(res, 200, getCatalogSummary());
        return;
      }

      if (req.method === "GET" && path === "/api/v1/catalog/generals") {
        const records = api.getGenerals({ keyword: url.searchParams.get("keyword") || "" });
        sendJson(res, 200, paginate(records, url.searchParams));
        return;
      }

      if (req.method === "GET" && path === "/api/v1/catalog/tactics") {
        const records = api.getTactics({ keyword: url.searchParams.get("keyword") || "" });
        sendJson(res, 200, paginate(records, url.searchParams));
        return;
      }

      if (req.method === "GET" && path === "/api/v1/catalog/equipment") {
        const records = api.getEquipment({ keyword: url.searchParams.get("keyword") || "" });
        sendJson(res, 200, paginate(records, url.searchParams));
        return;
      }

      if (req.method === "GET" && path === "/api/v1/catalog/troop-tactics") {
        const records = api.getTroopTactics({ keyword: url.searchParams.get("keyword") || "" });
        sendJson(res, 200, paginate(records, url.searchParams));
        return;
      }

      if (req.method === "POST" && path === "/api/v1/lineups/analyze") {
        sendJson(res, 200, api.analyzeLineup(await readJsonBody(req)));
        return;
      }

      if (req.method === "GET" && path === "/api/v1/lineups") {
        sendJson(res, 200, listLineups(store, url.searchParams));
        return;
      }

      if (req.method === "POST" && path === "/api/v1/lineups") {
        sendJson(res, 200, saveLineup(store, await readJsonBody(req)));
        return;
      }

      const lineupDeleteMatch = path.match(/^\/api\/v1\/lineups\/([^/]+)$/);
      if (req.method === "DELETE" && lineupDeleteMatch) {
        sendJson(res, 200, deleteLineup(store, decodeURIComponent(lineupDeleteMatch[1]), url.searchParams.get("userId") || ""));
        return;
      }

      if (req.method === "POST" && path === "/api/v1/matchups/preview") {
        sendJson(res, 200, api.previewMatchup(await readJsonBody(req)));
        return;
      }

      if (req.method === "POST" && path === "/api/v1/accounts/optimize") {
        sendJson(res, 200, api.optimizeAccount(await readJsonBody(req)));
        return;
      }

      if (req.method === "POST" && path === "/api/v1/battle-reports") {
        const user = getAuthUser(req) || getUser(req, url);
        const body = await readJsonBody(req);
        if (!body.result || !["win", "loss", "draw"].includes(body.result)) {
          sendJson(res, 400, { ok: false, message: "result 必须是 win/loss/draw。" });
          return;
        }
        const saved = dbModule.addBattleReport(db, user.id, body);
        addAuditLog(store, "battleReports.created", { id: saved.id, result: body.result, userId: user.id });
        sendJson(res, 200, { ok: true, item: saved });
        return;
      }

      if (req.method === "GET" && path === "/api/v1/battle-reports") {
        const user = getAuthUser(req) || getUser(req, url);
        const limit = parsePositiveInteger(url.searchParams.get("limit"), 50, 200);
        const offset = parsePositiveInteger(url.searchParams.get("offset"), 0);
        const reports = dbModule.getBattleReports(db, user.id, limit, offset);
        sendJson(res, 200, { items: reports });
        return;
      }

      if (req.method === "GET" && path === "/api/v1/battle-reports/stats") {
        const user = getAuthUser(req) || getUser(req, url);
        const stats = dbModule.getBattleReportStats(db, user.id);
        sendJson(res, 200, { ok: true, stats });
        return;
      }

      const battleReportDeleteMatch = path.match(/^\/api\/v1\/battle-reports\/([^/]+)$/);
      if (req.method === "DELETE" && battleReportDeleteMatch) {
        const user = getAuthUser(req) || getUser(req, url);
        const reportId = decodeURIComponent(battleReportDeleteMatch[1]);
        const result = dbModule.deleteBattleReport(db, reportId, user.id);
        sendJson(res, 200, { ok: true, deleted: result.deleted });
        return;
      }

      if (req.method === "POST" && path === "/api/v1/battle-reports/import") {
        sendJson(res, 200, api.importBattleReport(await readJsonBody(req)));
        return;
      }

      // --- Draw pools (SQLite) ---

      if (req.method === "GET" && path === "/api/v1/draw-pools") {
        const user = getUser(req, url);
        const pools = dbModule.getDrawPools(db, user.id);
        sendJson(res, 200, { items: pools });
        return;
      }

      if (req.method === "POST" && path === "/api/v1/draw-pools") {
        const user = getUser(req, url);
        const body = await readJsonBody(req);
        const name = normalizeText(body.name, "新卡池", 60);
        const pool = dbModule.createDrawPool(db, user.id, name);
        addAuditLog(store, "drawPools.created", { id: pool.id, name: pool.name, userId: user.id });
        sendJson(res, 200, { ok: true, item: pool });
        return;
      }

      const drawPoolDeleteMatch = path.match(/^\/api\/v1\/draw-pools\/([^/]+)$/);
      if (req.method === "DELETE" && drawPoolDeleteMatch) {
        const user = getUser(req, url);
        const poolId = decodeURIComponent(drawPoolDeleteMatch[1]);
        const result = dbModule.deleteDrawPool(db, poolId, user.id);
        if (result.deleted > 0) {
          addAuditLog(store, "drawPools.deleted", { id: poolId, recordsDeleted: result.recordsDeleted, userId: user.id });
        }
        sendJson(res, 200, { ok: true, deleted: result.deleted, recordsDeleted: result.recordsDeleted });
        return;
      }

      // --- Draw records (SQLite) ---

      if (req.method === "GET" && path === "/api/v1/draw-records") {
        const user = getUser(req, url);
        const poolId = url.searchParams.get("poolId");
        let records;
        if (poolId) {
          records = dbModule.getDrawRecords(db, poolId, user.id);
        } else {
          records = dbModule.getAllDrawRecords(db, user.id);
        }
        sendJson(res, 200, { items: records });
        return;
      }

      if (req.method === "POST" && path === "/api/v1/draw-records") {
        const user = getUser(req, url);
        const body = await readJsonBody(req);
        const record = {
          poolId: body.poolId || "default",
          date: body.date || new Date().toISOString().slice(0, 10),
          time: body.time || new Date().toISOString().slice(11, 16),
          quality: body.quality || "blue",
          generalName: normalizeText(body.generalName, "", 40),
          drawType: body.drawType || "free",
          group: body.group || 1
        };
        const saved = dbModule.addDrawRecord(db, user.id, record);
        sendJson(res, 200, { ok: true, item: saved });
        return;
      }

      const drawRecordDeleteMatch = path.match(/^\/api\/v1\/draw-records\/([^/]+)$/);
      if (req.method === "DELETE" && drawRecordDeleteMatch) {
        const user = getUser(req, url);
        const recordId = decodeURIComponent(drawRecordDeleteMatch[1]);
        const result = dbModule.deleteDrawRecord(db, recordId, user.id);
        sendJson(res, 200, { ok: true, deleted: result.deleted });
        return;
      }

      // --- Draw records sync (batch upload, SQLite) ---

      if (req.method === "POST" && path === "/api/v1/draw-records/sync") {
        const user = getUser(req, url);
        const body = await readJsonBody(req);
        const records = Array.isArray(body.records) ? body.records : [];
        const result = dbModule.syncDrawRecords(db, user.id, records);
        if (result.added > 0) {
          addAuditLog(store, "drawRecords.synced", { added: result.added, total: result.total, userId: user.id });
        }
        sendJson(res, 200, { ok: true, added: result.added, total: result.total });
        return;
      }

      if (path.startsWith("/api/admin/")) {
        const token = req.headers["x-admin-token"];
        if (token !== adminToken) {
          sendJson(res, 401, { error: "缺少或无效的管理后台令牌。" });
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

        if (req.method === "POST" && path === "/api/admin/store/reset") {
          sendJson(res, 200, admin.resetStore());
          return;
        }

        if (req.method === "GET" && path === "/api/admin/store/export") {
          sendJson(res, 200, admin.exportStore());
          return;
        }
      }

      sendJson(res, 404, { error: "接口不存在。" });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      sendJson(res, statusCode, {
        error: statusCode >= 500 ? "服务端处理失败。" : error.message
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
          resolve(this);
        });
      });
    },
    stop() {
      return new Promise((resolve, reject) => {
        if (!server.listening) {
          resolve();
          return;
        }
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
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
