import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const catalog = require("../data/catalog.json");

assert.equal(catalog.meta.generalsCount, 112, "武将数量应与官方快照一致");
assert.equal(catalog.meta.tacticsCount, 209, "战法数量应与官方快照一致");
assert.equal(catalog.meta.equipmentCount, 57, "装备数量应与官方快照一致");
assert.equal(catalog.meta.troopTacticsCount, 12, "兵种数量应与官方快照一致");
assert.equal(catalog.meta.officialMediaUrlsExcluded, true, "必须剔除官方图片 URL");

for (const general of catalog.generals) {
  assert.ok(general.id, "武将必须有 id");
  assert.ok(general.name, "武将必须有名称");
  assert.ok(general.asset, "武将必须有原创资产状态");
  assert.equal(general.asset.policy, "original_style_only", "武将资产必须标记原创策略");
}

for (const tactic of catalog.tactics) {
  assert.ok(tactic.id, "战法必须有 id");
  assert.ok(tactic.name, "战法必须有名称");
}

const serialized = JSON.stringify(catalog);
assert.equal(/image\.aligames\.com|cloud\.lingxigames\.com|cdn-cn\.lingxigames\.com\/wukongbuild/.test(serialized), false, "小程序数据不能包含官方图片域名");

console.log("catalog.test.mjs 通过");
