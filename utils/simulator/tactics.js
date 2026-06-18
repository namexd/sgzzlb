const {
  applyDamage,
  applyHealing,
  applyState,
  addOrRefreshState,
  getLowestTroopMember,
  getRandomTargets,
  cleanseNegative
} = require("./effects");
const { getEnemyTeam, getTeam, getAliveMembers, hasState, addRoundLog } = require("./state");

const PREPARE_TYPES = new Set(["被动", "阵法", "兵种", "指挥", "战前"]);
const TROOP_TACTIC_TYPES = new Set(["骑兵", "盾兵", "弓兵", "枪兵", "器械"]);
const CONTROL_STATES = ["缴械", "计穷", "震慑", "虚弱", "混乱", "禁疗"];

function getTacticText(tactic) {
  return `${tactic.name || ""} ${tactic.type || ""} ${tactic.description || ""}`;
}

function getAllTactics(member) {
  return [member.innateTactic, ...(member.tactics || [])].filter(Boolean);
}

function getTacticName(tactic) {
  return tactic.name || "未知战法";
}

function recordActivation(state, actor, tactic, round, phase) {
  const name = getTacticName(tactic);
  actor.tacticActivations[name] = (actor.tacticActivations[name] || 0) + 1;
  state.metrics.tacticActivations.push({ side: actor.side, actor: actor.name, tactic: name, round, phase });
}

function addUnique(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

function recordRuleCoverage(state, tactic, kind) {
  if (!state.ruleCoverage) return;
  const name = getTacticName(tactic);
  state.ruleCoverage[kind] = (state.ruleCoverage[kind] || 0) + 1;
  if (kind === "fallback") state.ruleCoverage.estimated = (state.ruleCoverage.estimated || 0) + 1;
  const listKey = `${kind}Tactics`;
  if (!Array.isArray(state.ruleCoverage[listKey])) state.ruleCoverage[listKey] = [];
  addUnique(state.ruleCoverage[listKey], name);
  if (!Array.isArray(state.ruleCoverage.coverageByTactic)) state.ruleCoverage.coverageByTactic = [];
  const coverage = classifyTacticCoverage(tactic);
  const existing = state.ruleCoverage.coverageByTactic.find((item) => item.tacticId === coverage.tacticId && item.tacticName === coverage.tacticName);
  if (!existing) state.ruleCoverage.coverageByTactic.push({ ...coverage, status: kind });
}

function parseDamageRate(tactic, fallback) {
  const text = getTacticText(tactic);
  const match = text.match(/伤害率\s*(\d+)%/);
  if (match) return Number(match[1]);
  return fallback;
}

function getDamageType(tactic) {
  const text = getTacticText(tactic);
  return /谋略|智力/.test(text) ? "谋略" : "兵刃";
}

function getTargetCount(tactic, fallback = 1) {
  const text = getTacticText(tactic);
  if (/全体|群体\（?3人/.test(text)) return 3;
  if (/群体|2人|二人/.test(text)) return 2;
  return fallback;
}

function getDuration(tactic, fallback = 2) {
  const text = getTacticText(tactic);
  const match = text.match(/持续(\d+)回合/);
  if (match) return Number(match[1]);
  return fallback;
}

function shouldTrigger(tactic, random) {
  const text = getTacticText(tactic);
  const match = text.match(/(\d+)%概率/);
  const probability = match ? Number(match[1]) / 100 : tactic.type === "主动" ? 0.38 : 0.45;
  return random() < probability;
}

function parseRoundNumber(value) {
  if (value === "一") return 1;
  if (value === "二" || value === "两") return 2;
  if (value === "三") return 3;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getPrepareRounds(tactic) {
  const structured = tactic.prepareRounds !== undefined ? tactic.prepareRounds : tactic.prepareTurns !== undefined ? tactic.prepareTurns : tactic.prepareRound;
  const structuredRounds = parseRoundNumber(structured);
  if (structuredRounds > 0) return structuredRounds;

  const text = getTacticText(tactic);
  const afterPrepare = text.match(/准备\s*(\d+|一|二|两|三)\s*回合/);
  if (afterPrepare) return parseRoundNumber(afterPrepare[1]);
  const beforePrepare = text.match(/(\d+|一|二|两|三)\s*回合[^，。；]*准备/);
  if (beforePrepare) return parseRoundNumber(beforePrepare[1]);
  return /准备/.test(text) ? 1 : 0;
}

function getTacticKey(tactic) {
  return tactic.id || tactic.name || "未知战法";
}

function getPendingPrepares(actor) {
  if (!Array.isArray(actor.pendingPrepareTactics)) actor.pendingPrepareTactics = [];
  return actor.pendingPrepareTactics;
}

function isActiveBlocked(actor) {
  return actor.disabledTactics || hasState(actor, "计穷") || hasState(actor, "震慑");
}

function addTacticStatusLog(state, actor, tactic, round, phase, type, text, extra = {}) {
  addRoundLog(state, round, phase, {
    actor: actor.name,
    type,
    tactic: getTacticName(tactic),
    text,
    ...extra
  });
}

function removePendingPrepare(actor, pending) {
  actor.pendingPrepareTactics = getPendingPrepares(actor).filter((item) => item !== pending);
}

function getPrepareModifier(actor) {
  const modifiers = Array.isArray(actor.prepareModifiers) ? actor.prepareModifiers : [actor.prepareModifiers].filter(Boolean);
  return modifiers.reduce(
    (result, modifier) => {
      result.reducePrepareTurns = Math.max(result.reducePrepareTurns, Number(modifier.reducePrepareTurns) || 0);
      result.skipPrepareChance = Math.max(result.skipPrepareChance, Number(modifier.skipPrepareChance) || 0);
      (modifier.sources || []).forEach((source) => addUnique(result.sources, source));
      return result;
    },
    { reducePrepareTurns: 0, skipPrepareChance: 0, sources: [] }
  );
}

function getEffectivePrepare(actor, tactic, prepareRounds, random) {
  const modifier = getPrepareModifier(actor);
  const reducedRounds = Math.max(0, prepareRounds - modifier.reducePrepareTurns);
  const skipByChance = modifier.skipPrepareChance >= 1 || (modifier.skipPrepareChance > 0 && random() < modifier.skipPrepareChance);
  return {
    rounds: skipByChance ? 0 : reducedRounds,
    skipped: skipByChance || reducedRounds <= 0,
    sources: modifier.sources
  };
}

function cancelPendingPrepares(state, actor, round, phase, reason) {
  const pendingList = [...getPendingPrepares(actor)];
  pendingList.forEach((pending) => {
    removePendingPrepare(actor, pending);
    addTacticStatusLog(
      state,
      actor,
      pending.tactic,
      round,
      phase,
      "准备取消",
      `${actor.name}的${pending.tacticName}因${reason}未能释放，准备取消。`,
      { reason }
    );
  });
}

function applyPendingPrepares(state, actor, round, phase, random) {
  const released = new Set();
  const pendingList = [...getPendingPrepares(actor)];
  if (!pendingList.length) return released;

  if (actor.troops <= 0 || isActiveBlocked(actor)) {
    cancelPendingPrepares(state, actor, round, phase, actor.troops <= 0 ? "兵力归零" : "控制或禁用");
    return released;
  }

  pendingList.forEach((pending) => {
    if (pending.remaining > 1) {
      pending.remaining -= 1;
      addTacticStatusLog(state, actor, pending.tactic, round, phase, "准备中", `${actor.name}的${pending.tacticName}仍在准备中。`, {
        remaining: pending.remaining
      });
      return;
    }

    removePendingPrepare(actor, pending);
    released.add(pending.tacticKey);
    addTacticStatusLog(state, actor, pending.tactic, round, phase, "准备完成", `${actor.name}的${pending.tacticName}准备完成，开始释放。`);
    applyTacticRule({ state, actor, tactic: pending.tactic, round, phase, random });
  });

  return released;
}

function startPrepare(state, actor, tactic, round, phase, prepareRounds) {
  const pending = {
    tactic,
    tacticKey: getTacticKey(tactic),
    tacticName: getTacticName(tactic),
    prepareRounds,
    remaining: prepareRounds,
    startedRound: round
  };
  getPendingPrepares(actor).push(pending);
  addTacticStatusLog(state, actor, tactic, round, phase, "开始准备", `${actor.name}发动${getTacticName(tactic)}，需要准备${prepareRounds}回合。`, {
    prepareRounds
  });
}

function applyTriggeredActiveTactic(state, actor, tactic, round, phase, random) {
  recordActivation(state, actor, tactic, round, phase);
  const prepareRounds = getPrepareRounds(tactic);
  if (prepareRounds <= 0) {
    applyTacticRule({ state, actor, tactic, round, phase, random });
    return;
  }

  const effective = getEffectivePrepare(actor, tactic, prepareRounds, random);
  if (effective.skipped) {
    addTacticStatusLog(
      state,
      actor,
      tactic,
      round,
      phase,
      "跳过准备",
      `${actor.name}发动${getTacticName(tactic)}，${effective.sources.length ? `因${effective.sources.join("、")}` : "因准备修正"}跳过准备并立即释放。`,
      { sources: effective.sources }
    );
    applyTacticRule({ state, actor, tactic, round, phase, random });
    return;
  }

  startPrepare(state, actor, tactic, round, phase, effective.rounds);
}

function getExplicitRuleEntry(tactic) {
  const name = tactic.name || "";
  return EXPLICIT_RULES.find((rule) => rule.names.some((item) => name.includes(item))) || null;
}

function getExplicitRule(tactic) {
  const matched = getExplicitRuleEntry(tactic);
  return matched ? matched.apply : null;
}

function hasGenericCoverage(tactic) {
  const text = getTacticText(tactic);
  return /治疗|恢复|急救|减伤|受到.*伤害降低|分担|伤害率|兵刃|谋略|攻击|缴械|计穷|震慑|虚弱|混乱|禁疗|先攻|连击|洞察|规避|抵御|会心|奇谋|灼烧|叛逃|持续伤害|休整|持续治疗|增伤|造成.*伤害提高|伤害提高/.test(text);
}

function getRuleRegistry() {
  return EXPLICIT_RULES.map((rule, index) => ({
    key: rule.key || `explicit-${index + 1}`,
    names: [...rule.names],
    description: rule.description || "显式规则"
  }));
}

function classifyTacticCoverage(tactic = {}) {
  const explicitRule = getExplicitRuleEntry(tactic);
  if (explicitRule) {
    return {
      tacticId: tactic.id || "",
      tacticName: tactic.name || "未命名战法",
      tacticType: tactic.type || "战法",
      status: "explicit",
      source: "explicit-rule",
      ruleKey: explicitRule.key || explicitRule.names[0],
      ruleNames: [...explicitRule.names],
      message: "已接入显式战法规则。"
    };
  }
  if (hasGenericCoverage(tactic)) {
    return {
      tacticId: tactic.id || "",
      tacticName: tactic.name || "未命名战法",
      tacticType: tactic.type || "战法",
      status: "fallback",
      source: "generic-estimation",
      ruleKey: "generic-tactic-estimation",
      ruleNames: [],
      message: "命中通用估算规则，结果用于方向判断。"
    };
  }
  return {
    tacticId: tactic.id || "",
    tacticName: tactic.name || "未命名战法",
    tacticType: tactic.type || "战法",
    status: "missed",
    source: "uncovered",
    ruleKey: "",
    ruleNames: [],
    message: "暂未命中显式或通用规则，需补充战法规则。"
  };
}

function applyTacticRule(context) {
  const rule = getExplicitRule(context.tactic);
  if (rule) {
    recordRuleCoverage(context.state, context.tactic, "explicit");
    return rule(context) !== false;
  }
  const acted = applyGenericTactic(context);
  recordRuleCoverage(context.state, context.tactic, acted ? "fallback" : "missed");
  return acted;
}

function addBuffLog(state, round, phase, actor, tactic, target, stateType) {
  addRoundLog(state, round, phase, {
    actor: actor.name,
    target: target.name,
    type: "状态",
    state: stateType,
    tactic: tactic.name,
    text: `${actor.name}发动${tactic.name}，使${target.name}获得${stateType}。`
  });
}

function addAssumptionOnce(state, text) {
  if (!state.assumptions.includes(text)) state.assumptions.push(text);
}

function isTroopTactic(tactic) {
  return tactic.type === "兵种" || TROOP_TACTIC_TYPES.has(tactic.type);
}

function isPrepareType(tactic) {
  return PREPARE_TYPES.has(tactic.type) || isTroopTactic(tactic);
}

function getStateDuration(tactic, fallback = 2) {
  return getDuration(tactic, isPrepareType(tactic) ? 8 : fallback);
}

function getRequiredTroop(tactic) {
  if (TROOP_TACTIC_TYPES.has(tactic.type)) return tactic.type;
  const text = getTacticText(tactic);
  const direct = ["骑兵", "盾兵", "弓兵", "枪兵", "器械"].find((troop) => text.includes(troop));
  if (direct) return direct;
  if (/象兵|虎豹骑|西凉铁骑/.test(text)) return "骑兵";
  if (/白马义从|锦帆军|无当飞军/.test(text)) return "弓兵";
  if (/藤甲兵|陷阵营/.test(text)) return "盾兵";
  if (/大戟士|青州兵|白毦兵/.test(text)) return "枪兵";
  return null;
}

function isTroopRequirementMatched(state, actor, tactic) {
  if (!isTroopTactic(tactic)) return true;
  const required = getRequiredTroop(tactic);
  if (!required || actor.troop === required) return true;
  addAssumptionOnce(state, `${getTacticName(tactic)} 兵种不匹配：当前${actor.troop}，需要${required}，本场未套用该兵种战法效果。`);
  return false;
}

function applyTacticState(state, round, phase, actor, tactic, target, nextState) {
  if (!target || target.troops <= 0) return false;
  addOrRefreshState(target, {
    ...nextState,
    source: tactic.name,
    sourceSide: actor.side,
    sourceActorId: actor.id
  });
  addBuffLog(state, round, phase, actor, tactic, target, nextState.type);
  return true;
}

function getCommander(team) {
  return getAliveMembers(team).find((member) => member.position === 0) || getAliveMembers(team)[0] || null;
}

function getDeputies(team) {
  return getAliveMembers(team).filter((member) => member.position > 0);
}

function getFriendlyTargets(state, actor, tactic, fallbackCount = 1) {
  const text = getTacticText(tactic);
  const team = getTeam(state, actor.side);
  const alive = getAliveMembers(team);
  if (/自身|自己/.test(text)) return [actor];
  if (/我军全体|友军全体|全体/.test(text)) return alive;
  if (/副将/.test(text) && !/主将/.test(text)) return getDeputies(team);
  if (/主将/.test(text) && !/副将/.test(text)) return [getCommander(team)].filter(Boolean);
  if (isPrepareType(tactic) && /我军|友军/.test(text)) return alive.slice(0, getTargetCount(tactic, 3));
  if (tactic.type === "被动") return [actor];
  return alive.slice(0, getTargetCount(tactic, fallbackCount));
}

function getEnemyTargetsForTactic(state, actor, tactic, random, fallbackCount = 1) {
  const text = getTacticText(tactic);
  const enemy = getEnemyTeam(state, actor.side);
  if (/敌军全体|敌方全体|敌人全体|全体/.test(text)) return getAliveMembers(enemy);
  return getRandomTargets(random, enemy, getTargetCount(tactic, fallbackCount));
}

function isInstantDamageText(tactic) {
  const text = getTacticText(tactic);
  if (/增伤|伤害提高|造成的伤害提高|造成.*伤害提高|受到.*伤害降低/.test(text)) return false;
  return /伤害率|对[^，。；]*造成|造成[^，。；]*(兵刃|谋略)伤害|攻击/.test(text);
}

function isActionTactic(tactic) {
  return tactic.type === "主动" || tactic.type === "突击" || tactic.type === "自带";
}

function applyShengqi(context) {
  const { state, actor, tactic, round, phase } = context;
  const enemy = getEnemyTeam(state, actor.side);
  getAliveMembers(enemy).slice(0, 2).forEach((target) => {
    applyState(state, round, phase, actor, target, { type: "缴械", value: 1, remaining: 2, source: tactic.name }, { source: tactic.name });
  });
}

function applyHengsao(context) {
  const { state, actor, tactic, round, phase, random } = context;
  const enemy = getEnemyTeam(state, actor.side);
  getAliveMembers(enemy).forEach((target) => {
    applyDamage(state, round, phase, actor, target, { rate: 100, damageType: "兵刃", random, source: tactic.name, actionType: "主动" });
    if (hasState(target, "缴械") && random() < 0.3) {
      applyState(state, round, phase, actor, target, { type: "震慑", value: 1, remaining: 1, source: tactic.name }, { source: tactic.name });
    }
  });
}

function applyZanbi(context) {
  const { state, actor, tactic, round, phase } = context;
  const team = getTeam(state, actor.side);
  const alive = getAliveMembers(team);
  const lowForce = [...alive].sort((a, b) => a.stats.force - b.stats.force)[0];
  const lowIntellect = [...alive].sort((a, b) => a.stats.intellect - b.stats.intellect)[0];
  if (lowForce) addOrRefreshState(lowForce, { type: "减伤", value: 0.18, remaining: 3, source: tactic.name });
  if (lowIntellect) addOrRefreshState(lowIntellect, { type: "减伤", value: 0.18, remaining: 3, source: tactic.name });
  addRoundLog(state, round, phase, {
    actor: actor.name,
    type: "状态",
    text: `${actor.name}发动${tactic.name}，为友军提供前期减伤。`
  });
}

function applyCaochuan(context) {
  const { state, actor, tactic, round, phase, random } = context;
  const team = getTeam(state, actor.side);
  getAliveMembers(team).slice(0, 2).forEach((target) => {
    cleanseNegative(target);
    applyHealing(state, round, phase, actor, target, { rate: 92, random, source: tactic.name });
  });
}

function applyTaiping(context) {
  const { state, actor, tactic, round, phase } = context;
  addOrRefreshState(actor, { type: "增伤", value: 0.14, remaining: 8, source: tactic.name });
  addOrRefreshState(actor, { type: "奇谋", value: 0.18, multiplier: 1.35, remaining: 8, source: tactic.name });
  addBuffLog(state, round, phase, actor, tactic, actor, "奇谋");
}

function applyShibie(context) {
  const { state, actor, tactic, round, phase, random } = context;
  if (round <= 3) {
    addOrRefreshState(actor, { type: "规避", value: 0.35, remaining: 1, source: tactic.name });
    addBuffLog(state, round, phase, actor, tactic, actor, "规避");
    return;
  }
  const enemy = getEnemyTeam(state, actor.side);
  getAliveMembers(enemy).forEach((target) => {
    applyDamage(state, round, phase, actor, target, { rate: 110, damageType: "谋略", random, source: tactic.name, actionType: "被动" });
  });
}

function applyDangfeng(context) {
  const { state, actor, tactic, round, phase, random } = context;
  const enemy = getEnemyTeam(state, actor.side);
  const target = getRandomTargets(random, enemy, 1)[0];
  if (!target) return false;
  applyDamage(state, round, phase, actor, target, { rate: 182, damageType: "兵刃", random, source: tactic.name, actionType: "突击" });
  applyState(state, round, phase, actor, target, { type: "计穷", value: 1, remaining: 1, source: tactic.name }, { source: tactic.name });
}

function applyGuagu(context) {
  const { state, actor, tactic, round, phase, random } = context;
  const team = getTeam(state, actor.side);
  const target = getLowestTroopMember(team);
  if (!target) return false;
  cleanseNegative(target);
  applyHealing(state, round, phase, actor, target, { rate: 256, random, source: tactic.name });
}

function applyZuoduan(context) {
  const { state, actor, tactic, round, phase, random } = context;
  const team = getTeam(state, actor.side);
  const target = getRandomTargets(random, team, 1)[0] || actor;
  const stateType = random() < 0.5 ? "连击" : "洞察";
  addOrRefreshState(target, { type: stateType, value: 1, remaining: getDuration(tactic, 2), source: tactic.name });
  addBuffLog(state, round, phase, actor, tactic, target, stateType);
}

function applyComboRule(context) {
  const { state, actor, tactic, round, phase } = context;
  const remaining = isPrepareType(tactic) ? 8 : getDuration(tactic, 2);
  addOrRefreshState(actor, { type: "连击", value: 1, remaining, source: tactic.name });
  addBuffLog(state, round, phase, actor, tactic, actor, "连击");
}

function applyInsightRule(context) {
  const { state, actor, tactic, round, phase } = context;
  const remaining = isPrepareType(tactic) ? 8 : getDuration(tactic, 2);
  addOrRefreshState(actor, { type: "洞察", value: 1, remaining, source: tactic.name });
  addBuffLog(state, round, phase, actor, tactic, actor, "洞察");
}

function applyGuardRule(context) {
  const { state, actor, tactic, round, phase, random } = context;
  const team = getTeam(state, actor.side);
  if (tactic.type === "突击") {
    const target = getRandomTargets(random, getEnemyTeam(state, actor.side), 1)[0];
    if (target) applyDamage(state, round, phase, actor, target, { rate: 120, damageType: "兵刃", random, source: tactic.name, actionType: "突击" });
  }
  const commander = getAliveMembers(team).find((member) => member.position === 0) || actor;
  [commander, actor].filter((target, index, list) => target && list.indexOf(target) === index).forEach((target) => {
    addOrRefreshState(target, { type: "抵御", value: 1, remaining: getDuration(tactic, 2), count: 1, source: tactic.name });
    addBuffLog(state, round, phase, actor, tactic, target, "抵御");
  });
}

function applyEmergencyHealing(context) {
  const { state, actor, tactic, round, phase } = context;
  const team = getTeam(state, actor.side);
  getAliveMembers(team).slice(0, getTargetCount(tactic, 2)).forEach((target) => {
    applyState(state, round, phase, actor, target, {
      type: "急救",
      value: parseDamageRate(tactic, 80),
      remaining: getDuration(tactic, 2),
      source: tactic.name
    }, { source: tactic.name });
  });
}

function applyJindan(context) {
  const { state, actor, tactic, round, phase } = context;
  const team = getTeam(state, actor.side);
  const healTarget = getLowestTroopMember(team) || actor;
  addOrRefreshState(actor, { type: "规避", value: 0.35, remaining: getDuration(tactic, 2), source: tactic.name });
  addBuffLog(state, round, phase, actor, tactic, actor, "规避");
  applyState(state, round, phase, actor, healTarget, {
    type: "休整",
    value: parseDamageRate(tactic, 80),
    remaining: getDuration(tactic, 2),
    source: tactic.name
  }, { source: tactic.name });
}

function applyHantian(context) {
  const { state, actor, tactic, round, phase, random } = context;
  const enemy = getEnemyTeam(state, actor.side);
  getRandomTargets(random, enemy, getTargetCount(tactic, 2)).forEach((target) => {
    applyDamage(state, round, phase, actor, target, { rate: 70, damageType: "谋略", random, source: tactic.name, actionType: tactic.type || "主动" });
    applyState(state, round, phase, actor, target, {
      type: "灼烧",
      value: parseDamageRate(tactic, 60),
      remaining: getDuration(tactic, 2),
      source: tactic.name,
      damageType: "谋略"
    }, { source: tactic.name });
  });
}

function applyShimian(context) {
  const { state, actor, tactic, round, phase, random } = context;
  const enemy = getEnemyTeam(state, actor.side);
  getRandomTargets(random, enemy, getTargetCount(tactic, 2)).forEach((target) => {
    applyDamage(state, round, phase, actor, target, { rate: 80, damageType: "谋略", random, source: tactic.name, actionType: tactic.type || "主动" });
    applyState(state, round, phase, actor, target, {
      type: "叛逃",
      value: parseDamageRate(tactic, 70),
      remaining: getDuration(tactic, 2),
      source: tactic.name,
      damageType: "兵刃"
    }, { source: tactic.name });
  });
}

function applyJinfan(context) {
  const { state, actor, tactic, round, phase } = context;
  addOrRefreshState(actor, { type: "会心", value: 0.18, multiplier: 1.35, remaining: 8, source: tactic.name });
  addBuffLog(state, round, phase, actor, tactic, actor, "会心");
}

function applyAssaultStrike(context) {
  const { state, actor, tactic, round, phase, random } = context;
  const enemy = getEnemyTeam(state, actor.side);
  const rate = tactic.name && tactic.name.includes("一骑当千") ? 108 : tactic.name && tactic.name.includes("百骑劫营") ? 162 : 180;
  getRandomTargets(random, enemy, getTargetCount(tactic, tactic.name && tactic.name.includes("一骑当千") ? 3 : 1)).forEach((target) => {
    applyDamage(state, round, phase, actor, target, { rate, damageType: "兵刃", random, source: tactic.name, actionType: "突击" });
  });
}

function applyHengge(context) {
  const { state, actor, tactic, round, phase } = context;
  const team = getTeam(state, actor.side);
  getAliveMembers(team).forEach((target) => {
    addOrRefreshState(target, { type: "增伤", value: 0.12, remaining: getDuration(tactic, 3), source: tactic.name });
    addBuffLog(state, round, phase, actor, tactic, target, "增伤");
  });
}

function applyFengshi(context) {
  const { state, actor, tactic, round, phase } = context;
  const team = getTeam(state, actor.side);
  const commander = getCommander(team);
  if (commander) applyTacticState(state, round, phase, actor, tactic, commander, { type: "增伤", value: 0.18, remaining: 8 });
  getDeputies(team).forEach((target) => {
    applyTacticState(state, round, phase, actor, tactic, target, { type: "减伤", value: 0.12, remaining: 8 });
  });
}

function applyXiangbing(context) {
  const { state, actor, tactic, round, phase } = context;
  if (!isTroopRequirementMatched(state, actor, tactic)) return false;
  getAliveMembers(getTeam(state, actor.side)).forEach((target) => {
    applyTacticState(state, round, phase, actor, tactic, target, { type: "减伤", value: 0.15, remaining: 8 });
  });
  addAssumptionOnce(state, `${getTacticName(tactic)} 的延后伤害结算按全队减伤近似处理。`);
}

const EXPLICIT_RULES = [
  { names: ["盛气凌敌"], apply: applyShengqi },
  { names: ["横扫千军"], apply: applyHengsao },
  { names: ["暂避其锋"], apply: applyZanbi },
  { names: ["草船借箭"], apply: applyCaochuan },
  { names: ["太平道法"], apply: applyTaiping },
  { names: ["士别三日"], apply: applyShibie },
  { names: ["当锋摧决"], apply: applyDangfeng },
  { names: ["刮骨疗毒"], apply: applyGuagu },
  { names: ["锋矢阵"], apply: applyFengshi },
  { names: ["象兵"], apply: applyXiangbing },
  { names: ["坐断东南"], apply: applyZuoduan },
  { names: ["神射", "兵锋", "裸衣血战"], apply: applyComboRule },
  { names: ["一身是胆"], apply: applyInsightRule },
  { names: ["白衣渡江", "折冲御侮"], apply: applyGuardRule },
  { names: ["青囊"], apply: applyEmergencyHealing },
  { names: ["金丹秘术"], apply: applyJindan },
  { names: ["熯天炽地"], apply: applyHantian },
  { names: ["十面埋伏"], apply: applyShimian },
  { names: ["锦帆百翎"], apply: applyJinfan },
  { names: ["勇冠三军", "一骑当千", "百骑劫营"], apply: applyAssaultStrike },
  { names: ["横戈跃马"], apply: applyHengge }
];

function applyGenericTactic(context) {
  const { state, actor, tactic, round, phase, random } = context;
  const text = getTacticText(tactic);
  const prepareType = isPrepareType(tactic);
  const team = getTeam(state, actor.side);
  const duration = getStateDuration(tactic);
  let acted = false;

  const applyFriendlyState = (stateType, value, options = {}, fallbackCount = prepareType ? 3 : 1) => {
    getFriendlyTargets(state, actor, tactic, fallbackCount).forEach((target) => {
      acted = applyTacticState(state, round, phase, actor, tactic, target, {
        type: stateType,
        value,
        remaining: options.remaining || duration,
        ...options
      }) || acted;
    });
  };

  const applyEnemyState = (stateType, value, options = {}, fallbackCount = 1) => {
    getEnemyTargetsForTactic(state, actor, tactic, random, fallbackCount).forEach((target) => {
      const applied = applyState(state, round, phase, actor, target, {
        type: stateType,
        value,
        remaining: options.remaining || getDuration(tactic, 2),
        source: tactic.name,
        ...options
      }, { source: tactic.name });
      acted = Boolean(applied) || acted;
    });
  };

  if (/治疗|恢复/.test(text) && !/急救|休整|持续治疗/.test(text)) {
    const targets = prepareType && /我军全体|友军全体|全体/.test(text)
      ? getFriendlyTargets(state, actor, tactic, 3)
      : [getLowestTroopMember(team)].filter(Boolean);
    targets.forEach((target) => {
      const amount = applyHealing(state, round, phase, actor, target, { rate: parseDamageRate(tactic, 110), random, source: tactic.name });
      acted = amount > 0 || acted;
    });
  }

  if (/减伤|受到.*伤害降低|分担/.test(text)) {
    applyFriendlyState("减伤", 0.12, {}, prepareType ? 3 : 2);
  }

  if (isInstantDamageText(tactic) && (isActionTactic(tactic) || /伤害率|对[^，。；]*造成|造成[^，。；]*(兵刃|谋略)伤害/.test(text))) {
    const targets = getEnemyTargetsForTactic(state, actor, tactic, random, 1);
    targets.forEach((target) => {
      const amount = applyDamage(state, round, phase, actor, target, {
        rate: parseDamageRate(tactic, tactic.type === "突击" ? 150 : 120),
        damageType: getDamageType(tactic),
        random,
        source: tactic.name,
        actionType: tactic.type || "战法"
      });
      acted = amount > 0 || acted;
    });
  }

  CONTROL_STATES.forEach((stateType) => {
    if (text.includes(stateType)) applyEnemyState(stateType, 1, { remaining: /持续2回合/.test(text) ? 2 : 1 });
  });

  if (/先攻/.test(text)) applyFriendlyState("先攻", 1);
  if (/连击/.test(text)) applyFriendlyState("连击", 1, {}, prepareType ? 1 : 1);
  if (/洞察/.test(text)) applyFriendlyState("洞察", 1);
  if (/规避/.test(text)) applyFriendlyState("规避", 0.35);
  if (/抵御/.test(text)) applyFriendlyState("抵御", 1, { count: 1 });
  if (/会心/.test(text)) applyFriendlyState("会心", 0.18, { multiplier: 1.35 }, prepareType ? 1 : 1);
  if (/奇谋/.test(text)) applyFriendlyState("奇谋", 0.18, { multiplier: 1.35 }, prepareType ? 1 : 1);

  if (/灼烧|叛逃|持续伤害/.test(text)) {
    const stateType = text.includes("叛逃") ? "叛逃" : text.includes("灼烧") ? "灼烧" : "持续伤害";
    applyEnemyState(stateType, parseDamageRate(tactic, 60), {
      damageType: stateType === "叛逃" ? "兵刃" : "谋略"
    });
  }

  if (/休整|持续治疗/.test(text)) {
    applyFriendlyState(text.includes("持续治疗") ? "持续治疗" : "休整", parseDamageRate(tactic, 80));
  }

  if (/急救/.test(text)) {
    applyFriendlyState("急救", parseDamageRate(tactic, 80));
  }

  if (/增伤|造成.*伤害提高|伤害提高/.test(text)) {
    applyFriendlyState("增伤", 0.12);
  }

  if (!acted) {
    addAssumptionOnce(state, `${tactic.name || "未知战法"} 暂未命中具体规则，本场按普攻体系估算。`);
  }
  return acted;
}

function applyPrepareTactics(state, phase, random) {
  const actors = [...getAliveMembers(state.teams.own), ...getAliveMembers(state.teams.enemy)];
  actors.forEach((actor) => {
    getAllTactics(actor)
      .filter((tactic) => isPrepareType(tactic))
      .forEach((tactic) => {
        recordActivation(state, actor, tactic, 0, phase);
        if (!isTroopRequirementMatched(state, actor, tactic)) {
          recordRuleCoverage(state, tactic, getExplicitRule(tactic) ? "explicit" : hasGenericCoverage(tactic) ? "fallback" : "missed");
          return;
        }
        applyTacticRule({ state, actor, tactic, round: 0, phase, random });
      });
  });
}

function applyActiveTactics(state, actor, round, phase, random) {
  const released = applyPendingPrepares(state, actor, round, phase, random);
  if (actor.disabledTactics || hasState(actor, "计穷") || hasState(actor, "震慑")) return;
  getAllTactics(actor)
    .filter((tactic) => tactic.type === "主动" || tactic.type === "自带")
    .forEach((tactic) => {
      if (released.has(getTacticKey(tactic))) return;
      if (getPendingPrepares(actor).some((pending) => pending.tacticKey === getTacticKey(tactic))) return;
      if (!shouldTrigger(tactic, random)) {
        addTacticStatusLog(state, actor, tactic, round, phase, "未发动", `${actor.name}尝试发动${getTacticName(tactic)}，本次未发动。`);
        return;
      }
      applyTriggeredActiveTactic(state, actor, tactic, round, phase, random);
    });
}

function applyAssaultTactics(state, actor, round, phase, random) {
  if (actor.disabledTactics || hasState(actor, "震慑")) return;
  getAllTactics(actor)
    .filter((tactic) => tactic.type === "突击")
    .forEach((tactic) => {
      if (!shouldTrigger(tactic, random)) return;
      recordActivation(state, actor, tactic, round, phase);
      applyTacticRule({ state, actor, tactic, round, phase, random });
    });
}

module.exports = {
  getAllTactics,
  applyPrepareTactics,
  applyActiveTactics,
  applyAssaultTactics,
  getRuleRegistry,
  classifyTacticCoverage,
  getExplicitRule,
  applyTacticRule,
  applyGenericTactic
};
