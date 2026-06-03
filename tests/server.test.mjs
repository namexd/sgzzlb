import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { request } from "node:http";
import test from "node:test";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createApp } = require("../server/app");
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

test("GET /health 返回健康状态", async () => {
  await withServer(async (baseUrl) => {
    const res = await httpRequest(baseUrl, "/health");
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, "ok");
    assert.ok(res.body.timestamp);
  });
});

test("GET /api/v1/catalog/summary 返回目录摘要", async () => {
  await withServer(async (baseUrl) => {
    const res = await httpRequest(baseUrl, "/api/v1/catalog/summary");
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.counts.generals, catalog.getGenerals().length);
    assert.equal(res.body.counts.tactics, catalog.getTactics().length);
    assert.ok(res.body.generatedAt);
  });
});

test("GET /api/v1/catalog/equipment 和 troop-tactics 返回分页资料", async () => {
  await withServer(async (baseUrl) => {
    const equipmentRes = await httpRequest(baseUrl, "/api/v1/catalog/equipment?pageSize=100");
    assert.equal(equipmentRes.statusCode, 200);
    assert.equal(equipmentRes.body.total, 57);
    assert.equal(equipmentRes.body.items.length, 57);

    const troopRes = await httpRequest(baseUrl, "/api/v1/catalog/troop-tactics?pageSize=100");
    assert.equal(troopRes.statusCode, 200);
    assert.equal(troopRes.body.total, 12);
    assert.equal(troopRes.body.items.length, 12);
  });
});

test("POST /api/v1/lineups/analyze 返回评分报告", async () => {
  await withServer(async (baseUrl) => {
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
    assert.equal(res.body.dimensions.length, 5);
    assert.ok(Array.isArray(res.body.weaknesses));
  });
});

test("保存阵容后重建 app 仍能按用户读到", async () => {
  await withTempStore(async (storeFile) => {
    const lineupId = "lineup-persist-test";

    const first = await startApp({ storeFile });
    try {
      const saveRes = await httpRequest(first.baseUrl, "/api/v1/lineups", {
        method: "POST",
        body: {
          userId: "tester",
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
      assert.equal(saveRes.body.item.userId, "tester");

      const listRes = await httpRequest(first.baseUrl, "/api/v1/lineups?userId=tester");
      assert.equal(listRes.statusCode, 200);
      assert.equal(listRes.body.total, 1);
      assert.equal(listRes.body.items[0].score, 86);

      const adminRes = await httpRequest(first.baseUrl, "/api/admin/lineups", {
        headers: {
          "x-admin-token": ADMIN_TOKEN
        }
      });
      assert.equal(adminRes.statusCode, 200);
      assert.equal(adminRes.body.items[0].id, lineupId);
    } finally {
      await first.app.stop();
    }

    const second = await startApp({ storeFile });
    try {
      const listRes = await httpRequest(second.baseUrl, "/api/v1/lineups?userId=tester");
      assert.equal(listRes.statusCode, 200);
      assert.equal(listRes.body.total, 1);
      assert.equal(listRes.body.items[0].id, lineupId);
      assert.equal(listRes.body.items[0].generals.length, 3);
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
  });
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

test("POST /api/admin/store/reset 恢复默认规则", async () => {
  await withServer(async (baseUrl) => {
    const lineupRes = await httpRequest(baseUrl, "/api/v1/lineups", {
      method: "POST",
      body: {
        userId: "tester",
        lineup: {
          id: "lineup-reset-test",
          scenario: "打架",
          troop: "弓兵",
          score: 70,
          generals: ["张角", "于吉", "左慈"],
          tactics: ["战法一", "战法二"]
        }
      }
    });
    assert.equal(lineupRes.statusCode, 200);

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
    assert.equal(resetRes.body.store.lineups.length, 0);
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
