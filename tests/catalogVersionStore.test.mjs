import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  createImportJobFromStore,
  getPublishedVersionFromStore,
  listRuleTodosFromStore,
  listVersionsFromStore,
  publishImportJobFromStore,
  updateRuleTodoFromStore
} = require("../server/catalogVersionStore");

function createStore() {
  return {
    catalogVersions: [],
    catalogImportJobs: [],
    tacticRuleTodos: [],
    save() {}
  };
}

function makeSnapshot(label) {
  return {
    meta: { source: "test" },
    generals: [
      { id: `${label}-g1`, name: `${label}甲`, stats: { force: 90, intellect: 80, command: 85, speed: 70 } },
      { id: `${label}-g2`, name: `${label}乙`, stats: { force: 88, intellect: 82, command: 84, speed: 68 } },
      { id: `${label}-g3`, name: `${label}丙`, stats: { force: 86, intellect: 84, command: 82, speed: 66 } }
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

test("catalog version fallback store 支持创建、发布和归档同赛季旧版本", () => {
  const store = createStore();
  const first = createImportJobFromStore(store, {
    seasonKey: "pk",
    seasonLabel: "PK赛季",
    versionKey: "pk-1",
    snapshot: makeSnapshot("first")
  });
  const firstPublish = publishImportJobFromStore(store, first.job.id);

  assert.equal(firstPublish.version.status, "published");
  assert.equal(getPublishedVersionFromStore(store, "pk").id, first.version.id);

  const second = createImportJobFromStore(store, {
    seasonKey: "pk",
    seasonLabel: "PK赛季",
    versionKey: "pk-2",
    snapshot: makeSnapshot("second")
  });
  publishImportJobFromStore(store, second.job.id);

  const versions = listVersionsFromStore(store, { season: "pk" });
  assert.equal(getPublishedVersionFromStore(store, "pk").id, second.version.id);
  assert.equal(versions.find((item) => item.id === first.version.id).status, "archived");
});

test("发布 catalog version 只为 missed 战法自动生成规则待办", () => {
  const store = createStore();
  const created = createImportJobFromStore(store, {
    seasonKey: "s2",
    seasonLabel: "S2赛季",
    versionKey: "s2-1",
    snapshot: makeSnapshot("todo")
  });

  const published = publishImportJobFromStore(store, created.job.id);
  const todos = listRuleTodosFromStore(store, { season: "s2" });

  assert.equal(published.createdTodos, 1);
  assert.equal(todos.length, 1);
  assert.equal(todos[0].tacticName, "todo未知");
  assert.equal(todos[0].coverageStatus, "missed");

  const updated = updateRuleTodoFromStore(store, todos[0].id, { status: "done", priority: "high" });
  assert.equal(updated.status, "done");
  assert.equal(updated.priority, "high");
});
