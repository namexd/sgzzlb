import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { request } from "node:http";
import test from "node:test";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createApp } = require("../server/app");
const dbModule = require("../server/db");
const catalog = require("../utils/catalog");

const ADMIN_TOKEN = "test-admin-token";
const LOCAL_DB_CONFIG = {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "",
  database: "sgzzlb_local"
};

function httpRequest(baseUrl, path, options = {}) {
  const url = new URL(path, baseUrl);
  const body = options.body ? JSON.stringify(options.body) : null;

  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: options.method || "GET",
        headers: {
          ...(body ? { "content-type": "application/json" } : {}),
          ...(options.headers || {})
        }
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const json = text ? JSON.parse(text) : null;
          resolve({ statusCode: res.statusCode, headers: res.headers, body: json });
        });
      }
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function startApp(options = {}) {
  const app = createApp({ adminToken: ADMIN_TOKEN, dbConfig: LOCAL_DB_CONFIG, ...options });
  await app.start(0);
  const address = app.address();
  return {
    app,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function withTempStore(fn) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "sgzzlb-server-"));
  const storeFile = path.join(tempDir, "admin-store.json");

  try {
    await fn(storeFile);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function withServer(fn) {
  await withTempStore(async (storeFile) => {
    const { app, baseUrl } = await startApp({ storeFile });

    try {
      await fn(baseUrl, storeFile);
    } finally {
      await app.stop();
    }
  });
}

const generals = catalog.getGenerals();
const tactics = catalog.getAllTactics();
const generalIds = generals.slice(0, 3).map((item) => item.id);
const tacticIds = tactics.slice(0, 6).map((item) => item.id);

function makeCatalogSnapshot(label) {
  return {
    meta: { source: "test" },
    generals: [
      { id: `${label}-g1`, name: `${label}甲`, stats: { force: 94, intellect: 80, command: 86, speed: 70 }, arms: { spear: "S", cavalry: "S", shield: "A", bow: "A" } },
      { id: `${label}-g2`, name: `${label}乙`, stats: { force: 88, intellect: 86, command: 84, speed: 72 }, arms: { spear: "S", cavalry: "A", shield: "S", bow: "A" } },
      { id: `${label}-g3`, name: `${label}丙`, stats: { force: 82, intellect: 92, command: 82, speed: 68 }, arms: { spear: "A", cavalry: "S", shield: "A", bow: "S" } },
      { id: `${label}-g4`, name: `${label}丁`, stats: { force: 91, intellect: 78, command: 87, speed: 69 }, arms: { spear: "A", cavalry: "S", shield: "A", bow: "A" } },
      { id: `${label}-g5`, name: `${label}戊`, stats: { force: 84, intellect: 88, command: 85, speed: 66 }, arms: { spear: "S", cavalry: "A", shield: "S", bow: "A" } },
      { id: `${label}-g6`, name: `${label}己`, stats: { force: 80, intellect: 90, command: 83, speed: 64 }, arms: { spear: "A", cavalry: "A", shield: "S", bow: "S" } }
    ],
    tactics: [
      { id: `${label}-explicit`, name: "神射", type: "被动", description: "获得连击状态" },
      { id: `${label}-fallback`, name: `${label}增伤`, type: "被动", description: "造成的伤害提高" },
      { id: `${label}-missed`, name: `${label}未知`, type: "被动", description: "没有可识别机制" }
    ],
    troopTactics: [],
    equipment: []
  };
}

const OWN_PAYLOAD = {
  troop: "枪兵",
  generalIds: generals.slice(0, 3).map((item) => item.id),
  tacticIds: tactics.slice(0, 6).map((item) => item.id)
};

const ENEMY_PAYLOAD = {
  troop: "骑兵",
  generalIds: generals.slice(3, 6).map((item) => item.id),
  tacticIds: tactics.slice(6, 12).map((item) => item.id)
};

function makeCatalogSnapshotForOptimization(label) {
  const snapshot = makeCatalogSnapshot(label);
  return {
    ...snapshot,
    tactics: [
      ...snapshot.tactics,
      { id: `${label}-damage`, name: `${label}兵刃`, type: "主动", description: "造成兵刃伤害" },
      { id: `${label}-heal`, name: `${label}治疗`, type: "指挥", description: "治疗我军" },
      { id: `${label}-defense`, name: `${label}减伤`, type: "被动", description: "受到伤害降低" }
    ]
  };
}

async function publishCatalogVersion(baseUrl, { seasonKey, seasonLabel, versionKey, snapshot }) {
  const headers = { "x-admin-token": ADMIN_TOKEN };
  const createRes = await httpRequest(baseUrl, "/api/admin/catalog/import-jobs/upload", {
    method: "POST",
    headers,
    body: {
      seasonKey,
      seasonLabel,
      versionKey,
      source: "test",
      snapshot
    }
  });
  assert.equal(createRes.statusCode, 200);
  const publishRes = await httpRequest(baseUrl, `/api/admin/catalog/import-jobs/${createRes.body.job.id}/publish`, {
    method: "POST",
    headers
  });
  assert.equal(publishRes.statusCode, 200);
  assert.equal(publishRes.body.version.status, "published");
  return publishRes.body.version;
}

async function withTemporaryEnv(values, fn) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function withStaticCatalogFallback(fn) {
  return withTemporaryEnv(
    {
      DEFAULT_CATALOG_SEASON: `static-fallback-${Date.now()}`,
      ALLOW_STATIC_CATALOG_FALLBACK: "1"
    },
    fn
  );
}

test("GET /health 返回健康状态", async () => {
  await withServer(async (baseUrl) => {
    const res = await httpRequest(baseUrl, "/health");
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, "ok");
    assert.ok(res.body.timestamp);
  });
});

test("POST /api/v1/auth/register 注册后可以直接登录", async () => {
  await withServer(async (baseUrl) => {
    const username = `test_user_${Date.now()}`;
    const password = "testpass123";
    const registerRes = await httpRequest(baseUrl, "/api/v1/auth/register", {
      method: "POST",
      body: { username, password, nickname: "注册验证" }
    });
    assert.equal(registerRes.statusCode, 200);
    assert.equal(registerRes.body.ok, true);
    assert.equal(registerRes.body.user.username, username);

    const loginRes = await httpRequest(baseUrl, "/api/v1/auth/login", {
      method: "POST",
      body: { username, password }
    });
    assert.equal(loginRes.statusCode, 200);
    assert.equal(loginRes.body.ok, true);
    assert.equal(loginRes.body.user.username, username);
    assert.ok(loginRes.body.token);
  });
});

test("POST /api/v1/auth/register 可以修复历史截断密码账号", async () => {
  await withServer(async (baseUrl) => {
    const username = `broken_user_${Date.now()}`;
    const password = "testpass123";
    const pool = await dbModule.createDatabase(LOCAL_DB_CONFIG);
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const brokenHash = `${"a".repeat(32)}:${"b".repeat(95)}`;
    await pool.execute(
      "INSERT INTO users (id, username, password, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      [`broken_${Date.now()}`, username, brokenHash, "损坏账号", now, now]
    );

    const repairRes = await httpRequest(baseUrl, "/api/v1/auth/register", {
      method: "POST",
      body: { username, password, nickname: "修复账号" }
    });
    assert.equal(repairRes.statusCode, 200);
    assert.equal(repairRes.body.ok, true);
    assert.equal(repairRes.body.user.username, username);

    const loginRes = await httpRequest(baseUrl, "/api/v1/auth/login", {
      method: "POST",
      body: { username, password }
    });
    assert.equal(loginRes.statusCode, 200);
    assert.equal(loginRes.body.ok, true);
  });
});

test("GET /api/v1/catalog/summary 返回目录摘要", async () => {
  await withStaticCatalogFallback(() => withServer(async (baseUrl) => {
    const res = await httpRequest(baseUrl, "/api/v1/catalog/summary");
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.counts.generals, catalog.getGenerals().length);
    assert.equal(res.body.counts.tactics, catalog.getTactics().length);
    assert.equal(res.body.catalogContext.status, "static");
    assert.ok(res.body.generatedAt);
  }));
});

test("GET /api/v1/catalog/equipment 和 troop-tactics 返回分页资料", async () => {
  await withStaticCatalogFallback(() => withServer(async (baseUrl) => {
    const equipmentRes = await httpRequest(baseUrl, "/api/v1/catalog/equipment?pageSize=100");
    assert.equal(equipmentRes.statusCode, 200);
    assert.equal(equipmentRes.body.total, 57);
    assert.equal(equipmentRes.body.items.length, 57);
    assert.equal(equipmentRes.body.catalogContext.status, "static");

    const troopRes = await httpRequest(baseUrl, "/api/v1/catalog/troop-tactics?pageSize=100");
    assert.equal(troopRes.statusCode, 200);
    assert.equal(troopRes.body.total, 12);
    assert.equal(troopRes.body.items.length, 12);
    assert.equal(troopRes.body.catalogContext.status, "static");
  }));
});

test("POST /api/v1/lineups/analyze 返回评分报告", async () => {
  await withStaticCatalogFallback(() => withServer(async (baseUrl) => {
    const res = await httpRequest(baseUrl, "/api/v1/lineups/analyze", {
      method: "POST",
      body: {
        scenario: "pk",
        troop: "骑兵",
        generalIds,
        tacticIds,
        redLevels: [0, 1, 2]
      }
    });

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.totalScore >= 0 && res.body.totalScore <= 100);
    assert.ok(res.body.dimensions.some((item) => item.label === "规则可信度"));
    assert.ok(res.body.analysisSignals.ruleCoverage);
    assert.equal(res.body.catalogContext.status, "static");
    assert.ok(Array.isArray(res.body.weaknesses));
  }));
});

test("POST /api/v1/battles/simulate 单次模拟返回完整战报", async () => {
  await withStaticCatalogFallback(() => withServer(async (baseUrl) => {
    const res = await httpRequest(baseUrl, "/api/v1/battles/simulate", {
      method: "POST",
      body: { own: OWN_PAYLOAD, enemy: ENEMY_PAYLOAD, seed: 20260616 }
    });
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.summary);
    assert.ok(["win", "loss", "draw"].includes(res.body.summary.result));
    assert.ok(res.body.summary.rounds >= 1 && res.body.summary.rounds <= 8);
    assert.ok(res.body.rounds.length >= 1);
    assert.ok(res.body.metrics.ownDamage >= 0);
    assert.ok(res.body.metrics.enemyDamage >= 0);
    assert.ok(res.body.ruleCoverage);
    assert.ok(Array.isArray(res.body.ruleCoverage.explicitTactics));
    assert.ok(Array.isArray(res.body.ruleCoverage.fallbackTactics));
    assert.ok(Array.isArray(res.body.ruleCoverage.missedTactics));
    assert.ok(Array.isArray(res.body.assumptions));
    assert.ok(res.body.highlights);
    assert.ok(Array.isArray(res.body.highlights.ownKeyTactics));
    assert.equal(res.body.catalogContext.status, "static");
  }));
});

test("POST /api/v1/battles/simulate 批量模拟返回聚合指标", async () => {
  await withStaticCatalogFallback(() => withServer(async (baseUrl) => {
    const res = await httpRequest(baseUrl, "/api/v1/battles/simulate", {
      method: "POST",
      body: { own: OWN_PAYLOAD, enemy: ENEMY_PAYLOAD, seed: 20260616, iterations: 5 }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.summary.iterations, 5);
    assert.ok(res.body.summary.winRate >= 0 && res.body.summary.winRate <= 100);
    assert.ok(res.body.aggregate);
    assert.ok(res.body.aggregate.scoreSuggestion >= 0 && res.body.aggregate.scoreSuggestion <= 100);
    assert.ok(res.body.ruleCoverage);
    assert.ok(Array.isArray(res.body.ruleCoverage.explicitTactics));
    assert.ok(res.body.samples.length <= 3);
    assert.ok(Array.isArray(res.body.aggregate.stabilityReasons));
    assert.ok(res.body.aggregate.distribution);
    assert.ok(res.body.bestSample);
    assert.ok(res.body.worstSample);
    assert.equal(res.body.catalogContext.status, "static");
  }));
});

test("POST /api/v1/battles/simulate 固定 seed 可复现", async () => {
  await withStaticCatalogFallback(() => withServer(async (baseUrl) => {
    const payload = { own: OWN_PAYLOAD, enemy: ENEMY_PAYLOAD, seed: "复现" };
    const first = await httpRequest(baseUrl, "/api/v1/battles/simulate", { method: "POST", body: payload });
    const second = await httpRequest(baseUrl, "/api/v1/battles/simulate", { method: "POST", body: payload });
    assert.deepEqual(first.body.summary, second.body.summary);
    assert.deepEqual(first.body.metrics, second.body.metrics);
    assert.equal(first.body.catalogContext.status, "static");
  }));
});

test("POST /api/v1/battles/simulate 缺少阵容返回 400", async () => {
  await withStaticCatalogFallback(() => withServer(async (baseUrl) => {
    const res = await httpRequest(baseUrl, "/api/v1/battles/simulate", {
      method: "POST",
      body: { own: OWN_PAYLOAD }
    });
    assert.equal(res.statusCode, 400);
    const message = res.body.message || res.body.error || "";
    assert.ok(message.includes("模拟需要同时提供"));
  }));
});

test("保存阵容后重建 app 仍能按用户读到（MySQL）", async () => {
  await withTempStore(async (storeFile) => {
    const lineupId = "lineup-persist-test-" + Date.now();

    const first = await startApp({ storeFile });
    try {
      const saveRes = await httpRequest(first.baseUrl, "/api/v1/lineups", {
        method: "POST",
        headers: { "x-user-id": "tester" },
        body: {
          lineup: {
            id: lineupId,
            createdAt: "2026-05-19T10:00:00.000Z",
            scenario: "PK赛季",
            troop: "骑兵",
            score: 86,
            generals: ["曹操", "刘备", "孙权"],
            tactics: ["战法一", "战法二", "战法三", "战法四", "战法五", "战法六"]
          }
        }
      });

      assert.equal(saveRes.statusCode, 200);
      assert.equal(saveRes.body.item.id, lineupId);

      const listRes = await httpRequest(first.baseUrl, "/api/v1/lineups", {
        headers: { "x-user-id": "tester" }
      });
      assert.equal(listRes.statusCode, 200);
      const found = listRes.body.items.find((item) => item.id === lineupId);
      assert.ok(found, "保存的阵容应能查询到");
      assert.equal(found.score, 86);
    } finally {
      await first.app.stop();
    }

    const second = await startApp({ storeFile });
    try {
      const listRes = await httpRequest(second.baseUrl, "/api/v1/lineups", {
        headers: { "x-user-id": "tester" }
      });
      assert.equal(listRes.statusCode, 200);
      const found = listRes.body.items.find((item) => item.id === lineupId);
      assert.ok(found, "重建 app 后阵容应仍存在");
      assert.equal(found.generals.length, 3);
    } finally {
      await second.app.stop();
    }
  });
});

test("管理接口缺少令牌时返回 401", async () => {
  await withServer(async (baseUrl) => {
    const res = await httpRequest(baseUrl, "/api/admin/dashboard");
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "缺少或无效的管理后台令牌。");

    const catalogRes = await httpRequest(baseUrl, "/api/admin/catalog/versions");
    assert.equal(catalogRes.statusCode, 401);
    assert.equal(catalogRes.body.error, "缺少或无效的管理后台令牌。");
  });
});

test("P8 catalog 版本 API 支持导入、发布、按版本查询和模拟", async () => {
  await withServer(async (baseUrl) => {
    const snapshot = makeCatalogSnapshot("p8api");
    const headers = { "x-admin-token": ADMIN_TOKEN };
    const version = await publishCatalogVersion(baseUrl, {
      seasonKey: "p8-test",
      seasonLabel: "P8测试赛季",
      versionKey: `p8-test-v1-${Date.now()}`,
      snapshot
    });
    assert.equal(version.counts.generals, 6);

    const versionId = version.id;
    const publicVersionsRes = await httpRequest(baseUrl, "/api/v1/catalog/versions?season=p8-test");
    assert.equal(publicVersionsRes.statusCode, 200);
    assert.ok(publicVersionsRes.body.items.some((item) => item.id === versionId));

    const generalsRes = await httpRequest(baseUrl, `/api/v1/catalog/generals?catalogVersionId=${encodeURIComponent(versionId)}&pageSize=10`);
    assert.equal(generalsRes.statusCode, 200);
    assert.ok(generalsRes.body.items.some((item) => item.name === "p8api甲"));
    assert.equal(generalsRes.body.catalogContext.catalogVersionId, versionId);

    const coverageRes = await httpRequest(baseUrl, `/api/admin/catalog/rule-coverage?catalogVersionId=${encodeURIComponent(versionId)}`, { headers });
    assert.equal(coverageRes.statusCode, 200);
    assert.equal(coverageRes.body.summary.total, 3);
    assert.equal(coverageRes.body.summary.missed, 1);
    assert.equal(coverageRes.body.summary.todo, 1);

    const simulateRes = await httpRequest(baseUrl, "/api/v1/battles/simulate", {
      method: "POST",
      body: {
        catalogVersionId: versionId,
        seed: "p8-api-sim",
        own: {
          troop: "枪兵",
          generalIds: snapshot.generals.slice(0, 3).map((item) => item.id),
          tacticIds: snapshot.tactics.map((item) => item.id)
        },
        enemy: {
          troop: "骑兵",
          generalIds: snapshot.generals.slice(3, 6).map((item) => item.id),
          tacticIds: []
        },
        options: { maxRounds: 1 }
      }
    });
    assert.equal(simulateRes.statusCode, 200);
    assert.equal(simulateRes.body.catalogContext.catalogVersionId, versionId);
    assert.ok(simulateRes.body.ruleCoverage.coverageByTactic.some((item) => item.tacticName === "神射" && item.status === "explicit"));
    assert.ok(simulateRes.body.ruleCoverage.coverageByTactic.some((item) => item.tacticName === "p8api增伤" && item.status === "fallback"));
    assert.ok(simulateRes.body.ruleCoverage.coverageByTactic.some((item) => item.tacticName === "p8api未知" && item.status === "missed"));
  });
});

test("P9 默认公开接口优先使用数据库已发布资料版本", async () => {
  await withServer(async (baseUrl) => {
    const label = `p9default${Date.now()}`;
    const seasonKey = `p9-default-${Date.now()}`;
    const snapshot = makeCatalogSnapshotForOptimization(label);
    const version = await publishCatalogVersion(baseUrl, {
      seasonKey,
      seasonLabel: "P9默认赛季",
      versionKey: `${seasonKey}-v1`,
      snapshot
    });
    const versionId = version.id;
    const own = {
      troop: "枪兵",
      generalIds: snapshot.generals.slice(0, 3).map((item) => item.id),
      tacticIds: snapshot.tactics.map((item) => item.id)
    };
    const enemy = {
      troop: "骑兵",
      generalIds: snapshot.generals.slice(3, 6).map((item) => item.id),
      tacticIds: snapshot.tactics.slice(0, 3).map((item) => item.id)
    };

    await withTemporaryEnv(
      {
        DEFAULT_CATALOG_SEASON: seasonKey,
        ALLOW_STATIC_CATALOG_FALLBACK: undefined
      },
      async () => {
        const summaryRes = await httpRequest(baseUrl, "/api/v1/catalog/summary");
        assert.equal(summaryRes.statusCode, 200);
        assert.equal(summaryRes.body.counts.generals, 6);
        assert.equal(summaryRes.body.counts.tactics, 6);
        assert.equal(summaryRes.body.catalogContext.catalogVersionId, versionId);
        assert.equal(summaryRes.body.catalogContext.source, "test");

        const generalsRes = await httpRequest(baseUrl, "/api/v1/catalog/generals?pageSize=10");
        assert.equal(generalsRes.statusCode, 200);
        assert.equal(generalsRes.body.catalogContext.catalogVersionId, versionId);
        assert.ok(generalsRes.body.items.some((item) => item.name === `${label}甲`));

        const analyzeRes = await httpRequest(baseUrl, "/api/v1/lineups/analyze", {
          method: "POST",
          body: {
            scenario: "pk",
            troop: "枪兵",
            generalIds: own.generalIds,
            tacticIds: own.tacticIds,
            redLevels: [0, 0, 0]
          }
        });
        assert.equal(analyzeRes.statusCode, 200);
        assert.equal(analyzeRes.body.catalogContext.catalogVersionId, versionId);
        assert.ok(analyzeRes.body.dimensions.some((item) => item.label === "规则可信度"));
        assert.equal(analyzeRes.body.analysisSignals.ruleCoverage.summary.total, 6);

        const previewRes = await httpRequest(baseUrl, "/api/v1/matchups/preview", {
          method: "POST",
          body: { scenario: "pk", own, enemy }
        });
        assert.equal(previewRes.statusCode, 200);
        assert.equal(previewRes.body.catalogContext.catalogVersionId, versionId);
        assert.equal(previewRes.body.own.catalogContext.catalogVersionId, versionId);
        assert.equal(previewRes.body.enemy.catalogContext.catalogVersionId, versionId);

        const simulateRes = await httpRequest(baseUrl, "/api/v1/battles/simulate", {
          method: "POST",
          body: {
            seed: "p9-default-sim",
            own,
            enemy,
            options: { maxRounds: 1 }
          }
        });
        assert.equal(simulateRes.statusCode, 200);
        assert.equal(simulateRes.body.catalogContext.catalogVersionId, versionId);
        assert.ok(simulateRes.body.ruleCoverage.coverageByTactic.some((item) => item.tacticName === `${label}增伤`));

        const optimizeRes = await httpRequest(baseUrl, "/api/v1/accounts/optimize", {
          method: "POST",
          body: {
            scenario: "pk",
            generalIds: snapshot.generals.map((item) => item.id),
            tacticIds: snapshot.tactics.map((item) => item.id)
          }
        });
        assert.equal(optimizeRes.statusCode, 200);
        assert.equal(optimizeRes.body.catalogContext.catalogVersionId, versionId);
        assert.equal(optimizeRes.body.status, "ok");
        assert.ok(optimizeRes.body.lineups[0].generals.some((name) => name.startsWith(label)));
      }
    );
  });
});

test("P9 指定 catalogVersionId 优先于默认赛季", async () => {
  await withServer(async (baseUrl) => {
    const defaultSeason = `p9-priority-default-${Date.now()}`;
    const overrideSeason = `p9-priority-override-${Date.now()}`;
    const defaultSnapshot = makeCatalogSnapshot("p9prioritydefault");
    const overrideSnapshot = makeCatalogSnapshot("p9priorityoverride");
    await publishCatalogVersion(baseUrl, {
      seasonKey: defaultSeason,
      seasonLabel: "P9默认优先级",
      versionKey: `${defaultSeason}-v1`,
      snapshot: defaultSnapshot
    });
    const overrideVersion = await publishCatalogVersion(baseUrl, {
      seasonKey: overrideSeason,
      seasonLabel: "P9指定优先级",
      versionKey: `${overrideSeason}-v1`,
      snapshot: overrideSnapshot
    });

    await withTemporaryEnv({ DEFAULT_CATALOG_SEASON: defaultSeason }, async () => {
      const summaryRes = await httpRequest(baseUrl, `/api/v1/catalog/summary?catalogVersionId=${encodeURIComponent(overrideVersion.id)}`);
      assert.equal(summaryRes.statusCode, 200);
      assert.equal(summaryRes.body.catalogContext.catalogVersionId, overrideVersion.id);
      assert.equal(summaryRes.body.catalogContext.season, overrideSeason);

      const generalsRes = await httpRequest(baseUrl, `/api/v1/catalog/generals?catalogVersionId=${encodeURIComponent(overrideVersion.id)}&pageSize=10`);
      assert.equal(generalsRes.statusCode, 200);
      assert.ok(generalsRes.body.items.some((item) => item.name === "p9priorityoverride甲"));
      assert.equal(generalsRes.body.items.some((item) => item.name === "p9prioritydefault甲"), false);
    });
  });
});

test("P9 生产环境无已发布资料版本时不回退静态 catalog", async () => {
  await withTemporaryEnv(
    {
      NODE_ENV: "production",
      DEFAULT_CATALOG_SEASON: `p9-missing-${Date.now()}`,
      ALLOW_STATIC_CATALOG_FALLBACK: undefined
    },
    () => withServer(async (baseUrl) => {
      const res = await httpRequest(baseUrl, "/api/v1/catalog/summary");
      assert.equal(res.statusCode, 503);
      const message = res.body.message || res.body.error || "";
      assert.ok(message.includes("尚未发布资料版本"));
    })
  );
});

test("GET /api/admin/dashboard 使用令牌返回后台摘要", async () => {
  await withServer(async (baseUrl) => {
    const res = await httpRequest(baseUrl, "/api/admin/dashboard", {
      headers: {
        "x-admin-token": ADMIN_TOKEN
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, "ok");
    assert.equal(res.body.catalog.generals, 112);
    assert.ok(res.body.rules.total >= 1);
    assert.ok(Number.isInteger(res.body.assets.pendingAudit));
  });
});

test("保存资产审核后重建 app 仍能读到", async () => {
  await withTempStore(async (storeFile) => {
    const auditId = "asset-audit-persist-test";

    const first = await startApp({ storeFile });
    try {
      const saveRes = await httpRequest(first.baseUrl, "/api/admin/assets/audit", {
        method: "POST",
        headers: {
          "x-admin-token": ADMIN_TOKEN
        },
        body: {
          id: auditId,
          targetId: generalIds[0],
          targetType: "general",
          status: "approved",
          note: "持久化测试"
        }
      });

      assert.equal(saveRes.statusCode, 200);
      assert.equal(saveRes.body.item.id, auditId);
    } finally {
      await first.app.stop();
    }

    const second = await startApp({ storeFile });
    try {
      const listRes = await httpRequest(second.baseUrl, "/api/admin/assets/audit", {
        headers: {
          "x-admin-token": ADMIN_TOKEN
        }
      });

      assert.equal(listRes.statusCode, 200);
      assert.equal(listRes.body.items[0].id, auditId);
      assert.equal(listRes.body.items[0].targetId, generalIds[0]);
    } finally {
      await second.app.stop();
    }
  });
});

test("阵容 API 使用 MySQL 存储：保存、查询、删除", async () => {
  await withServer(async (baseUrl) => {
    const lineupId = "lineup-mysql-test-" + Date.now();

    // 保存阵容
    const saveRes = await httpRequest(baseUrl, "/api/v1/lineups", {
      method: "POST",
      headers: { "x-user-id": "mysql-tester" },
      body: {
        lineup: {
          id: lineupId,
          scenario: "PK赛季",
          troop: "骑兵",
          score: 88,
          generals: ["曹操", "刘备", "孙权"],
          tactics: ["战法一", "战法二", "战法三", "战法四", "战法五", "战法六"]
        }
      }
    });
    assert.equal(saveRes.statusCode, 200);
    assert.equal(saveRes.body.ok, true);
    assert.equal(saveRes.body.item.id, lineupId);

    // 查询阵容
    const listRes = await httpRequest(baseUrl, "/api/v1/lineups", {
      headers: { "x-user-id": "mysql-tester" }
    });
    assert.equal(listRes.statusCode, 200);
    assert.ok(Array.isArray(listRes.body.items));
    const found = listRes.body.items.find((item) => item.id === lineupId);
    assert.ok(found, "保存的阵容应能查询到");
    assert.equal(found.score, 88);

    // 删除阵容
    const deleteRes = await httpRequest(baseUrl, `/api/v1/lineups/${lineupId}`, {
      method: "DELETE",
      headers: { "x-user-id": "mysql-tester" }
    });
    assert.equal(deleteRes.statusCode, 200);
    assert.equal(deleteRes.body.ok, true);
    assert.equal(deleteRes.body.deleted, 1);

    // 再次查询应为空
    const listRes2 = await httpRequest(baseUrl, "/api/v1/lineups", {
      headers: { "x-user-id": "mysql-tester" }
    });
    const found2 = listRes2.body.items.find((item) => item.id === lineupId);
    assert.equal(found2, undefined, "删除后不应再查到");
  });
});


test("POST /api/admin/store/reset 恢复默认规则", async () => {
  await withServer(async (baseUrl) => {
    const customRulesRes = await httpRequest(baseUrl, "/api/admin/rules", {
      method: "POST",
      headers: {
        "x-admin-token": ADMIN_TOKEN
      },
      body: {
        rules: [
          {
            id: "custom-rule",
            name: "自定义规则",
            enabled: false,
            description: "用于验证 reset。"
          }
        ]
      }
    });

    assert.equal(customRulesRes.statusCode, 200);
    assert.equal(customRulesRes.body.items[0].id, "custom-rule");

    const resetRes = await httpRequest(baseUrl, "/api/admin/store/reset", {
      method: "POST",
      headers: {
        "x-admin-token": ADMIN_TOKEN
      }
    });

    assert.equal(resetRes.statusCode, 200);
    assert.equal(resetRes.body.store.rules[0].id, "default-score-policy");
    assert.equal(resetRes.body.store.auditLog[0].action, "store.reset");

    const rulesRes = await httpRequest(baseUrl, "/api/admin/rules", {
      headers: {
        "x-admin-token": ADMIN_TOKEN
      }
    });

    assert.equal(rulesRes.statusCode, 200);
    assert.equal(rulesRes.body.items.length, 1);
    assert.equal(rulesRes.body.items[0].id, "default-score-policy");
  });
});

test("P9 官方采集接口需要管理令牌", async () => {
  await withServer(async (baseUrl) => {
    const res = await httpRequest(baseUrl, "/api/admin/catalog/import-jobs/official", {
      method: "POST",
      body: { seasonKey: "p9-official-auth" }
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "缺少或无效的管理后台令牌。");
  });
});

test("P9 官方采集有差异时生成草稿且不自动发布", async () => {
  await withTempStore(async (storeFile) => {
    const snapshot = makeCatalogSnapshot("p9official");
    const { app, baseUrl } = await startApp({
      storeFile,
      officialCatalogFetcher: async () => snapshot
    });

    try {
      const headers = { "x-admin-token": ADMIN_TOKEN };
      const seasonKey = `p9-official-${Date.now()}`;
      const res = await httpRequest(baseUrl, "/api/admin/catalog/import-jobs/official", {
        method: "POST",
        headers,
        body: {
          seasonKey,
          seasonLabel: "P9官方采集",
          versionKey: `${seasonKey}-v1`
        }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.skipped, false);
      assert.equal(res.body.job.status, "draft");
      assert.equal(res.body.job.source, "official");
      assert.equal(res.body.version.status, "draft");
      assert.equal(res.body.version.source, "official");
      assert.equal(res.body.version.seasonKey, seasonKey);
      assert.equal(res.body.version.counts.generals, 6);
      assert.ok(res.body.diff.summary.generals.added > 0);
      assert.equal(res.body.status.running, false);
      assert.equal(res.body.status.lastResult.versionId, res.body.version.id);

      const versionsRes = await httpRequest(baseUrl, `/api/admin/catalog/versions?season=${seasonKey}`, { headers });
      assert.equal(versionsRes.statusCode, 200);
      assert.ok(versionsRes.body.items.some((item) => item.id === res.body.version.id && item.status === "draft"));

      const publicVersionsRes = await httpRequest(baseUrl, `/api/v1/catalog/versions?season=${seasonKey}`);
      assert.equal(publicVersionsRes.statusCode, 200);
      assert.equal(publicVersionsRes.body.items.some((item) => item.id === res.body.version.id), false);
    } finally {
      await app.stop();
    }
  });
});

test("P9 官方采集无差异时跳过创建草稿", async () => {
  await withTempStore(async (storeFile) => {
    const snapshot = makeCatalogSnapshot("p9same");
    const { app, baseUrl } = await startApp({
      storeFile,
      officialCatalogFetcher: async () => snapshot
    });

    try {
      const headers = { "x-admin-token": ADMIN_TOKEN };
      const seasonKey = `p9-same-${Date.now()}`;
      const createRes = await httpRequest(baseUrl, "/api/admin/catalog/import-jobs/upload", {
        method: "POST",
        headers,
        body: {
          seasonKey,
          seasonLabel: "P9无差异",
          versionKey: `${seasonKey}-v1`,
          source: "test",
          snapshot
        }
      });
      assert.equal(createRes.statusCode, 200);

      const publishRes = await httpRequest(baseUrl, `/api/admin/catalog/import-jobs/${createRes.body.job.id}/publish`, {
        method: "POST",
        headers
      });
      assert.equal(publishRes.statusCode, 200);
      assert.equal(publishRes.body.version.status, "published");

      const officialRes = await httpRequest(baseUrl, "/api/admin/catalog/import-jobs/official", {
        method: "POST",
        headers,
        body: {
          seasonKey,
          seasonLabel: "P9无差异",
          versionKey: `${seasonKey}-v2`
        }
      });

      assert.equal(officialRes.statusCode, 200);
      assert.equal(officialRes.body.ok, true);
      assert.equal(officialRes.body.skipped, true);
      assert.equal(officialRes.body.reason, "官方公开资料与当前基线无差异。");

      const jobsRes = await httpRequest(baseUrl, "/api/admin/catalog/import-jobs", { headers });
      assert.equal(jobsRes.statusCode, 200);
      assert.equal(
        jobsRes.body.items.filter((item) => item.source === "official" && item.seasonKey === seasonKey).length,
        0
      );
    } finally {
      await app.stop();
    }
  });
});
