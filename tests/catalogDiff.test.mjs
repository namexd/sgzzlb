import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  diffCatalogs,
  countSnapshot,
  hashSnapshot,
  normalizeSnapshot
} = require("../server/catalogDiff");

function makeSnapshot(overrides = {}) {
  return normalizeSnapshot({
    meta: { source: "test", generatedAt: "2026-01-01T00:00:00.000Z" },
    generals: [{ id: "g1", name: "甲", faction: "魏", updatedAt: "old" }],
    tactics: [{ id: "t1", name: "战法一", description: "造成兵刃伤害" }],
    troopTactics: [{ id: "tt1", name: "兵种一", description: "获得先攻" }],
    equipment: [{ id: "e1", name: "装备一", effect: "武力+2" }],
    ...overrides
  });
}

test("catalog diff 能识别新增、变更、下架并忽略波动时间字段", () => {
  const before = makeSnapshot();
  const after = makeSnapshot({
    generals: [
      { id: "g1", name: "甲", faction: "蜀", updatedAt: "new" },
      { id: "g2", name: "乙", faction: "吴" }
    ],
    tactics: [],
    troopTactics: [{ id: "tt1", name: "兵种一", description: "获得先攻", fetchedAt: "new" }],
    equipment: [{ id: "e1", name: "装备一", effect: "武力+2", publishedAt: "new" }]
  });

  const diff = diffCatalogs(before, after);

  assert.equal(diff.generals.counts.added, 1);
  assert.equal(diff.generals.counts.changed, 1);
  assert.deepEqual(diff.generals.changed[0].changedFields, ["faction"]);
  assert.equal(diff.tactics.counts.removed, 1);
  assert.equal(diff.troopTactics.counts.unchanged, 1);
  assert.equal(diff.equipment.counts.unchanged, 1);
  assert.deepEqual(diff.summary.generals, { added: 1, changed: 1, removed: 0, unchanged: 0 });
});

test("catalog snapshot 计数和 hash 对时间字段稳定", () => {
  const first = makeSnapshot();
  const second = makeSnapshot({
    meta: { source: "test", generatedAt: "2026-02-01T00:00:00.000Z" },
    generals: [{ id: "g1", name: "甲", faction: "魏", updatedAt: "new" }]
  });

  assert.deepEqual(countSnapshot(first), { generals: 1, tactics: 1, troopTactics: 1, equipment: 1 });
  assert.equal(hashSnapshot(first), hashSnapshot(second));
});
