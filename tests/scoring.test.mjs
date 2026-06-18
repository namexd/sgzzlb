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

function getDimensionLabels(report) {
  return report.dimensions.map((item) => item.label);
}

const report = scoring.analyzeLineup({
  scenario: "pk",
  troop: "骑兵",
  generalIds,
  tacticIds,
  redLevels: [1, 2, 0]
});

assert.ok(report.totalScore >= 0 && report.totalScore <= 100, "评分必须在 0-100");
for (const label of ["属性基础", "兵种适性", "战法协同", "阵营标签", "环境适配", "规则可信度"]) {
  assert.ok(getDimensionLabels(report).includes(label), `必须输出${label}维度`);
}
assert.ok(report.analysisSignals.ruleCoverage.summary.total >= 0, "必须输出规则覆盖摘要");
assert.ok(Number.isFinite(report.analysisSignals.ruleCoverage.coverageRate), "必须输出规则覆盖率");
assert.equal(report.analysisSignals.simulation, null, "无模拟摘要时 simulation 必须为空");
assert.ok(report.explanations.length >= 4, "必须输出至少四条解释");
assert.ok(report.weaknesses.length >= 1, "必须输出至少一条短板");
assert.ok(Array.isArray(report.replacements), "必须输出替代战法数组");

const simulated = scoring.analyzeLineup({
  scenario: "pk",
  troop: "骑兵",
  generalIds,
  tacticIds,
  redLevels: [1, 2, 0],
  simulationStats: {
    winRate: 62.4,
    stability: 78.2,
    averageRemaining: 9345,
    iterations: 50,
    scoreSuggestion: 72
  }
});
assert.ok(getDimensionLabels(simulated).includes("模拟复核"), "有模拟摘要时必须输出模拟复核维度");
assert.equal(simulated.analysisSignals.simulation.winRate, 62, "模拟胜率应规范化为整数");
assert.ok(["中", "中高", "高"].includes(simulated.confidence), "模拟摘要应参与可信度判断");

const snapshot = {
  meta: { source: "test", generatedAt: "2026-06-17T00:00:00.000Z" },
  generals: [
    {
      id: "snapshot-general-a",
      name: "快照武将甲",
      faction: "魏",
      cost: 6,
      stats: { force: 90, intellect: 86, command: 88 },
      arms: { cavalry: "S", shield: "A", bow: "B", spear: "A" },
      tags: ["控", "辅"],
      tactics: { innate: "快照自带甲" }
    },
    {
      id: "snapshot-general-b",
      name: "快照武将乙",
      faction: "魏",
      cost: 6,
      stats: { force: 84, intellect: 92, command: 86 },
      arms: { cavalry: "S", shield: "S", bow: "A", spear: "B" },
      tags: ["谋"],
      tactics: { innate: "快照自带乙" }
    },
    {
      id: "snapshot-general-c",
      name: "快照武将丙",
      faction: "魏",
      cost: 5,
      stats: { force: 82, intellect: 80, command: 90 },
      arms: { cavalry: "A", shield: "S", bow: "A", spear: "A" },
      tags: ["盾"],
      tactics: { innate: "快照自带丙" }
    }
  ],
  tactics: [
    { id: "snapshot-tactic-1", name: "快照输出", quality: "S", type: "主动", description: "造成兵刃伤害", troopLimit: [] },
    { id: "snapshot-tactic-2", name: "快照控制", quality: "S", type: "主动", description: "造成缴械", troopLimit: [] },
    { id: "snapshot-tactic-3", name: "快照治疗", quality: "A", type: "指挥", description: "治疗我军", troopLimit: [] },
    { id: "snapshot-tactic-4", name: "快照减伤", quality: "A", type: "被动", description: "降低受到伤害", troopLimit: [] },
    { id: "snapshot-tactic-5", name: "快照谋略", quality: "S", type: "主动", description: "造成谋略伤害", troopLimit: [] },
    { id: "snapshot-tactic-6", name: "快照速度", quality: "A", type: "指挥", description: "提升速度并获得先攻", troopLimit: [] }
  ],
  troopTactics: [],
  equipment: []
};
const snapshotReport = scoring.analyzeLineup({
  scenario: "pk",
  troop: "骑兵",
  generalIds: snapshot.generals.map((item) => item.id),
  tacticIds: snapshot.tactics.map((item) => item.id),
  catalogSnapshot: snapshot,
  catalogContext: { season: "test", seasonLabel: "测试赛季", catalogVersionId: 99, versionKey: "snapshot-test", source: "manual" }
});
assert.ok(snapshotReport.totalScore > 0, "评分必须能读取传入的数据库快照");
assert.equal(snapshotReport.catalogContext.versionKey, "snapshot-test", "评分结果必须透传资料版本上下文");

const invalid = scoring.analyzeLineup({
  scenario: "pk",
  troop: "骑兵",
  generalIds: [generalIds[0]],
  tacticIds: [],
  redLevels: [0]
});
assert.ok(invalid.validation.length >= 1, "残缺阵容必须有校验提示");

const preview = api.previewMatchup({
  catalogSnapshot: snapshot,
  catalogContext: { season: "test", seasonLabel: "测试赛季", catalogVersionId: 99, versionKey: "snapshot-test", source: "manual" },
  own: { scenario: "pk", troop: "骑兵", generalIds: snapshot.generals.map((item) => item.id), tacticIds: snapshot.tactics.map((item) => item.id), redLevels: [0, 0, 0] },
  enemy: { scenario: "pk", troop: "盾兵", generalIds: snapshot.generals.map((item) => item.id), tacticIds: snapshot.tactics.map((item) => item.id), redLevels: [0, 0, 0] }
});
assert.ok(preview.result.summary, "对位预览必须有摘要");
assert.equal(preview.own.catalogContext.versionKey, "snapshot-test", "对位本方评分必须使用共享资料上下文");
assert.equal(preview.enemy.catalogContext.versionKey, "snapshot-test", "对位敌方评分必须使用共享资料上下文");

console.log("scoring.test.mjs 通过");
