import assert from "node:assert/strict";
import test from "node:test";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { simulateBattle, simulateBatch } = require("../utils/simulator");
const { createRandom } = require("../utils/simulator/random");
const { normalizeBattleInput } = require("../utils/simulator/normalize");
const { createInitialState, hasState } = require("../utils/simulator/state");
const { addOrRefreshState, applyDamage, applyState, applyRoundStartStates } = require("../utils/simulator/effects");
const { applyActiveTactics } = require("../utils/simulator/tactics");
const catalog = require("../utils/catalog");

const generals = catalog.getGenerals();
const tactics = catalog.getAllTactics();

const OWN = {
  troop: "枪兵",
  generalIds: generals.slice(0, 3).map((item) => item.id),
  tacticIds: tactics.slice(0, 6).map((item) => item.id)
};

const ENEMY = {
  troop: "骑兵",
  generalIds: generals.slice(3, 6).map((item) => item.id),
  tacticIds: tactics.slice(6, 12).map((item) => item.id)
};

function makeGeneral(name, stats = {}) {
  return {
    id: `test-${name}`,
    name,
    stats: {
      force: 95,
      intellect: 90,
      command: 88,
      speed: 70,
      ...stats
    },
    arms: {
      cavalry: "S",
      shield: "S",
      bow: "S",
      spear: "S",
      siege: "A"
    }
  };
}

function makeTactic(name, description, type = "被动") {
  return { id: `test-tactic-${name}`, name, type, description };
}

function makeCustomLineup(names, tacticList = [], overrides = {}) {
  return {
    troop: overrides.troop || "枪兵",
    generals: names.map((name, index) => makeGeneral(name, overrides.stats && overrides.stats[index])),
    tactics: tacticList,
    troops: overrides.troops || [10000, 10000, 10000]
  };
}

function createTestState({ ownTactics = [], enemyTactics = [], ownTroops, enemyTroops } = {}) {
  const normalized = normalizeBattleInput({
    own: makeCustomLineup(["甲", "乙", "丙"], ownTactics, { troop: "枪兵", troops: ownTroops }),
    enemy: makeCustomLineup(["丁", "戊", "己"], enemyTactics, { troop: "骑兵", troops: enemyTroops })
  });
  return createInitialState(normalized, { maxRounds: 2 });
}

function makePayload(overrides = {}) {
  return {
    ...overrides,
    seed: overrides.seed || 20260616
  };
}

test("PRNG 固定 seed 可复现", () => {
  const first = createRandom(42);
  const second = createRandom(42);
  const values = 10;
  for (let i = 0; i < values; i++) {
    assert.equal(first(), second(), `第 ${i + 1} 次随机值应相等`);
  }
});

test("单次模拟返回完整结构", () => {
  const result = simulateBattle(makePayload({ own: OWN, enemy: ENEMY }));
  assert.ok(result.summary, "应包含 summary");
  assert.ok(result.rounds, "应包含 rounds");
  assert.ok(result.metrics, "应包含 metrics");
  assert.ok(result.ruleCoverage, "应包含 ruleCoverage");
  assert.ok(Array.isArray(result.ruleCoverage.explicitTactics), "explicitTactics 应为数组");
  assert.ok(Array.isArray(result.ruleCoverage.fallbackTactics), "fallbackTactics 应为数组");
  assert.ok(Array.isArray(result.ruleCoverage.missedTactics), "missedTactics 应为数组");
  assert.ok(result.highlights, "应包含 highlights");
  assert.ok(result.highlights.ownTopDamage, "应包含我方最高伤害摘要");
  assert.ok(Array.isArray(result.highlights.ownKeyTactics), "ownKeyTactics 应为数组");
  assert.ok(Array.isArray(result.highlights.keyEvents), "keyEvents 应为数组");
  assert.ok(["win", "loss", "draw"].includes(result.summary.result), "result 应为胜负平");
  assert.ok(result.summary.rounds >= 1 && result.summary.rounds <= 8, "回合数应在 1-8");
  assert.ok(result.summary.ownRemaining >= 0, "我方剩余兵力应非负");
  assert.ok(result.summary.enemyRemaining >= 0, "敌方剩余兵力应非负");
});

test("固定 seed 模拟结果完全可复现", () => {
  const payload = makePayload({ own: OWN, enemy: ENEMY, seed: "复现测试" });
  const first = simulateBattle(payload);
  const second = simulateBattle(payload);
  assert.deepEqual(first.summary, second.summary, "summary 应完全一致");
  assert.deepEqual(first.metrics, second.metrics, "metrics 应完全一致");
  assert.equal(first.rounds.length, second.rounds.length, "回合数应完全一致");
});

test("兵种克制影响模拟结果", () => {
  const spearVsCavalry = simulateBattle(makePayload({ own: OWN, enemy: ENEMY, seed: 100 }));
  const cavalryVsSpear = simulateBattle(makePayload({ own: ENEMY, enemy: OWN, seed: 100 }));
  if (spearVsCavalry.summary.result === "win") {
    assert.equal(cavalryVsSpear.summary.result, "loss", "枪兵胜则骑兵应负");
  }
});

test("批量模拟返回聚合指标", () => {
  const result = simulateBatch(makePayload({ own: OWN, enemy: ENEMY, iterations: 10 }));
  assert.equal(result.summary.iterations, 10, "应执行 10 次");
  assert.ok(result.summary.winRate >= 0 && result.summary.winRate <= 100, "胜率应在 0-100");
  assert.ok(result.samples.length <= 3, "样本最多 3 个");
  assert.ok(result.aggregate.scoreSuggestion >= 0 && result.aggregate.scoreSuggestion <= 100, "评分建议应在 0-100");
  assert.ok(Array.isArray(result.aggregate.stabilityReasons), "应包含稳定性原因");
  assert.ok(result.aggregate.distribution, "应包含样本分布");
  assert.ok(result.bestSample, "应包含最佳样本");
  assert.ok(result.worstSample, "应包含最差样本");
});

test("最少需要 3 名武将", () => {
  assert.throws(
    () => simulateBattle({ own: { troop: "枪兵", generalIds: [generals[0].id], tacticIds: [] }, enemy: ENEMY }),
    /至少需要 3 名武将/
  );
});

test("战法不足时记录假设", () => {
  const result = simulateBattle(makePayload({
    own: { troop: "枪兵", generalIds: OWN.generalIds, tacticIds: [tactics[0].id] },
    enemy: ENEMY
  }));
  assert.ok(result.assumptions.some((item) => item.includes("战法不足")), "应记录战法不足假设");
});

test("洞察会免疫控制状态并记录抵抗", () => {
  const state = createTestState();
  const actor = state.teams.own.members[0];
  const target = state.teams.enemy.members[0];
  addOrRefreshState(target, { type: "洞察", value: 1, remaining: 2, count: 1, source: "测试" });

  const applied = applyState(state, 1, "主动", actor, target, { type: "缴械", value: 1, remaining: 1, source: "测试控制" }, { source: "测试控制" });

  assert.equal(applied, null);
  assert.equal(hasState(target, "缴械"), false);
  assert.equal(state.metrics.enemyStateResists, 1);
});

test("抵御与规避会在伤害前抵消伤害", () => {
  const state = createTestState();
  const actor = state.teams.own.members[0];
  const guardTarget = state.teams.enemy.members[0];
  const evadeTarget = state.teams.enemy.members[1];
  addOrRefreshState(guardTarget, { type: "抵御", value: 1, remaining: 2, count: 1, source: "测试" });
  addOrRefreshState(evadeTarget, { type: "规避", value: 1, remaining: 2, source: "测试" });

  assert.equal(applyDamage(state, 1, "主动", actor, guardTarget, { rate: 200, random: () => 0.5 }), 0);
  assert.equal(applyDamage(state, 1, "主动", actor, evadeTarget, { rate: 200, random: () => 0.5 }), 0);
  assert.equal(state.metrics.enemyGuards, 1);
  assert.equal(state.metrics.enemyEvades, 1);
});

test("会心和奇谋会提高对应类型伤害", () => {
  const normalState = createTestState();
  const criticalState = createTestState();
  const normalActor = normalState.teams.own.members[0];
  const normalTarget = normalState.teams.enemy.members[0];
  const criticalActor = criticalState.teams.own.members[0];
  const criticalTarget = criticalState.teams.enemy.members[0];
  addOrRefreshState(criticalActor, { type: "会心", value: 1, multiplier: 1.5, remaining: 2, source: "测试" });

  const normalDamage = applyDamage(normalState, 1, "主动", normalActor, normalTarget, { rate: 120, damageType: "兵刃", random: () => 0.5 });
  const criticalDamage = applyDamage(criticalState, 1, "主动", criticalActor, criticalTarget, { rate: 120, damageType: "兵刃", random: () => 0.5 });

  assert.ok(criticalDamage > normalDamage);
  assert.equal(criticalState.metrics.ownCriticals, 1);
});

test("持续伤害和休整会在回合开始结算", () => {
  const state = createTestState();
  const source = state.teams.own.members[0];
  const healerTarget = state.teams.own.members[0];
  const damageTarget = state.teams.enemy.members[0];
  healerTarget.troops = 8000;
  applyState(state, 0, "准备阶段", source, damageTarget, { type: "灼烧", value: 80, remaining: 2, source: "测试灼烧" }, { source: "测试灼烧" });
  applyState(state, 0, "准备阶段", source, healerTarget, { type: "休整", value: 80, remaining: 2, source: "测试休整" }, { source: "测试休整" });

  applyRoundStartStates(state, 1, () => 0.5);

  assert.ok(state.metrics.ownOngoingDamage > 0);
  assert.ok(state.metrics.ownOngoingHealing > 0);
  assert.ok(damageTarget.troops < damageTarget.maxTroops);
  assert.ok(healerTarget.troops > 8000);
});

test("连击状态会追加普攻并触发更多普攻日志", () => {
  const own = makeCustomLineup(["甲", "乙", "丙"], [makeTactic("测试连击", "获得连击状态", "被动")]);
  const enemy = makeCustomLineup(["丁", "戊", "己"], [], { troop: "骑兵" });
  const result = simulateBattle(makePayload({ own, enemy, seed: "连击测试", options: { maxRounds: 1 } }));
  const basicAttackLogs = result.rounds
    .flatMap((round) => round.actions)
    .filter((action) => action.type === "普攻");

  assert.ok(result.rounds.flatMap((round) => round.actions).some((action) => action.type === "连击"));
  assert.ok(basicAttackLogs.length >= 4);
});

test("阵容输入支持属性加点、装备、缘分和战场选项", () => {
  const sharedBond = { name: "测试缘分", description: "全体武力和速度提高，并获得先攻" };
  const own = {
    troop: "枪兵",
    generals: ["甲", "乙", "丙"].map((name) => ({
      ...makeGeneral(name, { intelligence: 82, intellect: undefined }),
      bonds: [sharedBond]
    })),
    tactics: [],
    attributePoints: [{ force: 20, intelligence: 10, command: 5, speed: 3 }],
    equipment: [[{ id: "eq-test", name: "援护甲", type: "防具", effect: "武力+4，速度+2，获得抵御" }]],
    bondEnabled: true,
    battleOptions: { morale: 90, terrain: "山地" }
  };
  const enemy = makeCustomLineup(["丁", "戊", "己"], [], { troop: "骑兵" });
  const normalized = normalizeBattleInput({ own, enemy });
  const member = normalized.own.members[0];

  assert.ok(member.stats.force > 95 + 20, "属性加点、装备和缘分应提高武力");
  assert.ok(member.stats.intellect > 82, "应兼容 intelligence 字段和智力加点");
  assert.ok(member.stats.command > 88, "统率加点应生效");
  assert.ok(member.stats.speed > 70, "速度加点、装备和缘分应生效");
  assert.ok(member.initialStates.some((state) => state.type === "抵御"), "装备关键词应生成抵御状态");
  assert.ok(normalized.own.appliedBonds.some((bond) => bond.name === "测试缘分"), "共同缘分应被识别");
  assert.equal(normalized.own.battleOptions.morale, 90);
  assert.ok(normalized.assumptions.some((item) => item.includes("援护甲")));
  assert.ok(normalized.assumptions.some((item) => item.includes("测试缘分")));
  assert.ok(normalized.assumptions.some((item) => item.includes("山地")));
});

test("初始状态会进入战斗并影响模拟报告", () => {
  const own = makeCustomLineup(["甲", "乙", "丙"], [], {
    troop: "枪兵",
    stats: [{ force: 95 }, null, null]
  });
  own.equipment = [[{ id: "eq-guard", name: "测试抵御甲", effect: "战斗开始获得抵御" }]];
  const enemy = makeCustomLineup(["丁", "戊", "己"], [], { troop: "骑兵" });
  const result = simulateBattle(makePayload({ own, enemy, seed: "装备抵御", options: { maxRounds: 1 } }));

  assert.ok(result.assumptions.some((item) => item.includes("测试抵御甲")));
  assert.ok(result.metrics.ownGuards >= 1 || result.highlights.keyEvents.some((item) => item.type === "抵御"));
});
test("显式规则、fallback 和未命中战法会记录 ruleCoverage", () => {
  const own = makeCustomLineup(["甲", "乙", "丙"], [
    makeTactic("神射", "获得连击状态", "被动"),
    makeTactic("测试增伤", "造成的伤害提高", "被动"),
    makeTactic("测试未知", "没有可识别机制", "被动")
  ]);
  const enemy = makeCustomLineup(["丁", "戊", "己"], [], { troop: "骑兵" });
  const result = simulateBattle(makePayload({ own, enemy, seed: "覆盖率测试", options: { maxRounds: 1 } }));

  assert.ok(result.ruleCoverage.explicit >= 1);
  assert.ok(result.ruleCoverage.fallback >= 1);
  assert.ok(result.ruleCoverage.missed >= 1);
  assert.ok(result.ruleCoverage.explicitTactics.includes("神射"));
  assert.ok(result.ruleCoverage.fallbackTactics.includes("测试增伤"));
  assert.ok(result.ruleCoverage.missedTactics.includes("测试未知"));
  assert.ok(result.ruleCoverage.estimatedRate > 0);
  assert.ok(result.assumptions.some((item) => item.includes("测试未知")));
});

test("指定 catalog snapshot 时按版本资料解析并输出上下文", () => {
  const snapshot = {
    meta: { source: "test-version" },
    generals: [
      makeGeneral("版本甲"),
      makeGeneral("版本乙"),
      makeGeneral("版本丙"),
      makeGeneral("版本丁"),
      makeGeneral("版本戊"),
      makeGeneral("版本己")
    ],
    tactics: [
      makeTactic("神射", "获得连击状态", "被动"),
      makeTactic("版本增伤", "造成的伤害提高", "被动"),
      makeTactic("版本未知", "没有可识别机制", "被动")
    ],
    troopTactics: [],
    equipment: []
  };
  const result = simulateBattle(makePayload({
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
    catalogSnapshot: snapshot,
    catalogContext: { seasonKey: "test", catalogVersionId: "cv-test", versionKey: "test-v1" },
    options: { maxRounds: 1 }
  }));

  assert.equal(result.catalogContext.catalogVersionId, "cv-test");
  assert.ok(result.rounds.length >= 1);
  assert.ok(result.ruleCoverage.coverageByTactic.some((item) => item.tacticName === "神射" && item.status === "explicit"));
  assert.ok(result.ruleCoverage.coverageByTactic.some((item) => item.tacticName === "版本增伤" && item.status === "fallback"));
  assert.ok(result.ruleCoverage.coverageByTactic.some((item) => item.tacticName === "版本未知" && item.status === "missed"));
});


test("被动战法应按常驻状态在准备阶段生效", () => {
  const own = makeCustomLineup(["甲", "乙", "丙"], [makeTactic("测试常驻洞察", "战斗中自身获得洞察，并造成的伤害提高", "被动")]);
  const enemy = makeCustomLineup(["丁", "戊", "己"], [], { troop: "骑兵" });
  const result = simulateBattle(makePayload({ own, enemy, seed: "被动常驻", options: { maxRounds: 3 } }));
  const actions = getActions(result);

  assert.ok(actions.some((action) => action.round === 0 && action.phase === "准备阶段" && action.state === "洞察" && action.tactic === "测试常驻洞察"), "准备阶段应记录被动洞察来源");
  assert.ok(actions.some((action) => action.round === 0 && action.phase === "准备阶段" && action.state === "增伤" && action.tactic === "测试常驻洞察"), "准备阶段应记录被动增伤来源");
  assert.ok(result.ruleCoverage.coverageByTactic.some((item) => item.tacticName === "测试常驻洞察" && item.status === "fallback"), "类型感知被动应进入 fallback 覆盖");
});

test("指挥战法应稳定施加队伍光环且不走主动概率", () => {
  const own = makeCustomLineup(["甲", "乙", "丙"], [makeTactic("测试指挥光环", "战斗开始后，我军全体造成的伤害提高，并使我军全体受到伤害降低", "指挥")]);
  const enemy = makeCustomLineup(["丁", "戊", "己"], [], { troop: "骑兵" });
  const result = simulateBattle(makePayload({ own, enemy, seed: "指挥光环", options: { maxRounds: 1 } }));
  const actions = getActions(result);

  assert.equal(actions.some((action) => action.tactic === "测试指挥光环" && action.type === "未发动"), false, "指挥战法不应记录主动未发动");
  assert.ok(actions.filter((action) => action.round === 0 && action.phase === "准备阶段" && action.tactic === "测试指挥光环" && action.state === "增伤").length >= 3, "指挥增伤应覆盖我军全体");
  assert.ok(actions.filter((action) => action.round === 0 && action.phase === "准备阶段" && action.tactic === "测试指挥光环" && action.state === "减伤").length >= 3, "指挥减伤应覆盖我军全体");
});

test("阵法战法应按队伍光环记录准备阶段效果", () => {
  const own = makeCustomLineup(["甲", "乙", "丙"], [makeTactic("测试锋矢阵", "阵法：主将造成的伤害提高，副将受到伤害降低", "阵法")]);
  const enemy = makeCustomLineup(["丁", "戊", "己"], [], { troop: "骑兵" });
  const result = simulateBattle(makePayload({ own, enemy, seed: "阵法光环", options: { maxRounds: 1 } }));
  const actions = getActions(result);

  assert.ok(actions.some((action) => action.round === 0 && action.phase === "准备阶段" && action.tactic === "测试锋矢阵" && action.target === "甲" && action.state === "增伤"), "阵法应给主将记录增伤");
  assert.ok(actions.filter((action) => action.round === 0 && action.phase === "准备阶段" && action.tactic === "测试锋矢阵" && action.state === "减伤").length >= 2, "阵法应给副将记录减伤");
});

test("兵种战法只在兵种条件匹配时生效", () => {
  const tactic = makeTactic("测试枪兵兵种", "枪兵专属：我军全体获得先攻，并造成的伤害提高", "兵种");
  const matched = simulateBattle(makePayload({
    own: makeCustomLineup(["甲", "乙", "丙"], [tactic], { troop: "枪兵" }),
    enemy: makeCustomLineup(["丁", "戊", "己"], [], { troop: "骑兵" }),
    seed: "兵种匹配",
    options: { maxRounds: 1 }
  }));
  const mismatched = simulateBattle(makePayload({
    own: makeCustomLineup(["甲", "乙", "丙"], [tactic], { troop: "骑兵" }),
    enemy: makeCustomLineup(["丁", "戊", "己"], [], { troop: "骑兵" }),
    seed: "兵种不匹配",
    options: { maxRounds: 1 }
  }));

  assert.ok(getActions(matched).some((action) => action.tactic === "测试枪兵兵种" && action.state === "先攻"), "兵种匹配时应施加先攻");
  assert.equal(getActions(mismatched).some((action) => action.tactic === "测试枪兵兵种" && action.state === "先攻"), false, "兵种不匹配时不应施加效果");
  assert.ok(mismatched.assumptions.some((item) => item.includes("测试枪兵兵种") && item.includes("兵种不匹配")), "兵种不匹配应记录假设说明");
});

test("兵种分类类型的象兵应按兵种战法在准备阶段生效", () => {
  const tactic = makeTactic("象兵", "象兵：骑兵专属，我军全体受到伤害降低，延后结算部分伤害", "骑兵");
  const matched = simulateBattle(makePayload({
    own: makeCustomLineup(["甲", "乙", "丙"], [tactic], { troop: "骑兵" }),
    enemy: makeCustomLineup(["丁", "戊", "己"], [], { troop: "枪兵" }),
    seed: "象兵骑兵匹配",
    options: { maxRounds: 1 }
  }));
  const mismatched = simulateBattle(makePayload({
    own: makeCustomLineup(["甲", "乙", "丙"], [tactic], { troop: "盾兵" }),
    enemy: makeCustomLineup(["丁", "戊", "己"], [], { troop: "枪兵" }),
    seed: "象兵骑兵不匹配",
    options: { maxRounds: 1 }
  }));
  const matchedActions = getActions(matched);
  const mismatchedActions = getActions(mismatched);

  assert.ok(matchedActions.filter((action) => action.round === 0 && action.phase === "准备阶段" && action.tactic === "象兵" && action.state === "减伤").length >= 3, "type=骑兵 的象兵应在准备阶段给全队施加减伤");
  assert.ok(matched.ruleCoverage.coverageByTactic.some((item) => item.tacticName === "象兵" && item.tacticType === "骑兵" && item.status === "explicit"), "type=骑兵 的象兵应标记 explicit");
  assert.equal(mismatchedActions.some((action) => action.tactic === "象兵" && action.state === "减伤"), false, "兵种不匹配时象兵不应生效");
  assert.ok(mismatched.assumptions.some((item) => item.includes("象兵") && item.includes("兵种不匹配") && item.includes("需要骑兵")), "兵种不匹配应记录骑兵要求");
});


test("非主动回合钩子效果应在回合开始结算", () => {
  const own = makeCustomLineup(["甲", "乙", "丙"], [makeTactic("测试军民休整", "战斗开始后，使我军全体获得休整，持续治疗2回合", "指挥")]);
  const enemy = makeCustomLineup(["丁", "戊", "己"], [makeTactic("测试毒阵", "阵法：使敌军全体进入叛逃状态，持续伤害2回合", "阵法")], { troop: "骑兵" });
  const result = simulateBattle(makePayload({ own, enemy, seed: "回合钩子", options: { maxRounds: 2 } }));
  const actions = getActions(result);

  assert.ok(actions.some((action) => action.phase === "回合开始" && ["休整", "持续治疗"].includes(action.type) && action.amount > 0), "休整或持续治疗应在回合开始恢复兵力");
  assert.ok(actions.some((action) => action.phase === "回合开始" && action.type === "叛逃" && action.amount > 0), "叛逃持续伤害应在回合开始结算");
});

test("P12 代表性显式规则应标记 explicit", () => {
  const own = makeCustomLineup(["甲", "乙", "丙"], [
    makeTactic("测试象兵", "象兵：受到伤害降低，延后结算部分伤害", "兵种"),
    makeTactic("测试锋矢阵", "主将造成伤害提高，副将受到伤害降低", "阵法"),
    makeTactic("测试未知机制", "没有可识别机制", "指挥")
  ]);
  const enemy = makeCustomLineup(["丁", "戊", "己"], [], { troop: "骑兵" });
  const result = simulateBattle(makePayload({ own, enemy, seed: "P12覆盖", options: { maxRounds: 1 } }));

  assert.ok(result.ruleCoverage.coverageByTactic.some((item) => item.tacticName === "测试象兵" && item.status === "explicit"), "象兵规则应标记 explicit");
  assert.ok(result.ruleCoverage.coverageByTactic.some((item) => item.tacticName === "测试锋矢阵" && item.status === "explicit"), "锋矢阵规则应标记 explicit");
  assert.ok(result.ruleCoverage.coverageByTactic.some((item) => item.tacticName === "测试未知机制" && item.status === "missed"), "未知机制应保持 missed");
});

function getActions(result) {
  return result.rounds.flatMap((round) => round.actions.map((action) => ({ ...action, round: round.round, phase: round.phase })));
}

function makePrepareDamageTactic(name, prepareText = "需要准备1回合", probability = 100) {
  return makeTactic(name, `${probability}%概率发动，${prepareText}，对敌军单体造成伤害率120%的兵刃伤害`, "主动");
}

test("准备 1 回合主动战法发动后不会在当回合直接生效", () => {
  const own = makeCustomLineup(["甲", "乙", "丙"], [makePrepareDamageTactic("一回合准备")]);
  const enemy = makeCustomLineup(["丁", "戊", "己"], [], { troop: "骑兵" });
  const result = simulateBattle(makePayload({ own, enemy, seed: "准备一回合", options: { maxRounds: 1 } }));
  const actions = getActions(result);

  assert.ok(actions.some((action) => action.type === "开始准备" && action.tactic === "一回合准备"), "应记录开始准备");
  assert.equal(actions.some((action) => action.text && action.text.includes("发动一回合准备") && action.amount > 0), false, "准备当回合不应造成战法伤害");
});

test("准备 1 回合主动战法在下一次主动阶段释放且不二次判定概率", () => {
  const own = makeCustomLineup(["甲", "乙", "丙"], [makePrepareDamageTactic("下回合释放")]);
  const enemy = makeCustomLineup(["丁", "戊", "己"], [], { troop: "骑兵" });
  const result = simulateBattle(makePayload({ own, enemy, seed: "准备下回合", options: { maxRounds: 2 } }));
  const actions = getActions(result);

  assert.ok(actions.some((action) => action.round === 1 && action.type === "开始准备" && action.tactic === "下回合释放"), "第 1 回合应开始准备");
  assert.ok(actions.some((action) => action.round === 2 && action.type === "准备完成" && action.tactic === "下回合释放"), "第 2 回合应准备完成");
  assert.ok(actions.some((action) => action.round === 2 && action.text && action.text.includes("发动下回合释放") && action.amount > 0), "准备完成后应释放伤害");
});

test("准备 2 回合主动战法会延后到第三次主动阶段释放", () => {
  const own = makeCustomLineup(["甲", "乙", "丙"], [makePrepareDamageTactic("两回合准备", "需要准备2回合")]);
  const enemy = makeCustomLineup(["丁", "戊", "己"], [], { troop: "骑兵" });
  const result = simulateBattle(makePayload({ own, enemy, seed: "准备两回合", options: { maxRounds: 3 } }));
  const actions = getActions(result);

  assert.ok(actions.some((action) => action.round === 1 && action.type === "开始准备" && action.tactic === "两回合准备"), "第 1 回合应开始准备");
  assert.ok(actions.some((action) => action.round === 2 && action.type === "准备中" && action.tactic === "两回合准备"), "第 2 回合应仍在准备中");
  assert.ok(actions.some((action) => action.round === 3 && action.type === "准备完成" && action.tactic === "两回合准备"), "第 3 回合应准备完成");
});

test("0% 概率主动战法不会发动并记录未发动日志", () => {
  const own = makeCustomLineup(["甲", "乙", "丙"], [makePrepareDamageTactic("零概率准备", "需要准备1回合", 0)]);
  const enemy = makeCustomLineup(["丁", "戊", "己"], [], { troop: "骑兵" });
  const result = simulateBattle(makePayload({ own, enemy, seed: "零概率", options: { maxRounds: 1 } }));
  const actions = getActions(result);

  assert.ok(actions.some((action) => action.type === "未发动" && action.tactic === "零概率准备"), "应记录未发动");
  assert.equal(actions.some((action) => action.type === "开始准备" && action.tactic === "零概率准备"), false, "未发动不应进入准备");
});

test("兵书配置可让准备战法跳过准备并当回合释放", () => {
  const own = makeCustomLineup(["甲", "乙", "丙"], [makePrepareDamageTactic("跳过准备")]);
  own.prepareModifiers = [{ skipPrepareChance: 1, sources: ["测试兵书"] }];
  const enemy = makeCustomLineup(["丁", "戊", "己"], [], { troop: "骑兵" });
  const result = simulateBattle(makePayload({ own, enemy, seed: "跳过准备", options: { maxRounds: 1 } }));
  const actions = getActions(result);

  assert.ok(actions.some((action) => action.type === "跳过准备" && action.tactic === "跳过准备"), "应记录跳过准备");
  assert.ok(actions.some((action) => action.text && action.text.includes("发动跳过准备") && action.amount > 0), "跳过准备后应当回合释放");
  assert.ok(result.assumptions.some((item) => item.includes("测试兵书") && item.includes("跳过准备")), "应记录兵书估算来源");
});

test("准备完成前被计穷会取消 pending 准备战法", () => {
  const state = createTestState({ ownTactics: [makePrepareDamageTactic("被打断准备")] });
  const actor = state.teams.own.members[0];
  applyActiveTactics(state, actor, 1, "主动", () => 0);
  addOrRefreshState(actor, { type: "计穷", value: 1, remaining: 1, source: "测试打断" });
  applyActiveTactics(state, actor, 2, "主动", () => 0);
  const actions = state.rounds.flatMap((round) => round.actions.map((action) => ({ ...action, round: round.round, phase: round.phase })));

  assert.ok(actions.some((action) => action.round === 1 && action.type === "开始准备" && action.tactic === "被打断准备"), "第 1 回合应开始准备");
  assert.ok(actions.some((action) => action.round === 2 && action.type === "准备取消" && action.tactic === "被打断准备"), "第 2 回合应取消准备");
  assert.equal(actions.some((action) => action.round === 2 && action.text && action.text.includes("发动被打断准备") && action.amount > 0), false, "被打断后不应释放伤害");
});
