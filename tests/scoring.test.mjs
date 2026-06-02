import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const catalog = require("../utils/catalog");
const scoring = require("../utils/scoring");
const api = require("../services/api");

const generals = catalog.getGenerals();
const tactics = catalog.getAllTactics();

const generalIds = ["曹操", "刘备", "孙权"].map((name, index) => {
  const found = generals.find((item) => item.name === name);
  return found ? found.id : generals[index].id;
});

const tacticIds = tactics.slice(0, 6).map((item) => item.id);

const report = scoring.analyzeLineup({
  scenario: "pk",
  troop: "骑兵",
  generalIds,
  tacticIds,
  redLevels: [1, 2, 0]
});

assert.ok(report.totalScore >= 0 && report.totalScore <= 100, "评分必须在 0-100");
assert.equal(report.dimensions.length, 5, "必须输出五个评分维度");
assert.ok(report.explanations.length >= 3, "必须输出至少三条解释");
assert.ok(report.weaknesses.length >= 1, "必须输出至少一条短板");
assert.ok(Array.isArray(report.replacements), "必须输出替代战法数组");

const invalid = scoring.analyzeLineup({
  scenario: "pk",
  troop: "骑兵",
  generalIds: [generalIds[0]],
  tacticIds: [],
  redLevels: [0]
});
assert.ok(invalid.validation.length >= 1, "残缺阵容必须有校验提示");

const preview = api.previewMatchup({
  own: { scenario: "pk", troop: "骑兵", generalIds, tacticIds, redLevels: [0, 0, 0] },
  enemy: { scenario: "pk", troop: "盾兵", generalIds, tacticIds, redLevels: [0, 0, 0] }
});
assert.ok(preview.result.summary, "对位预览必须有摘要");

console.log("scoring.test.mjs 通过");
