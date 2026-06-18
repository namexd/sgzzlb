const { randomBetween } = require("./random");
const {
  CONTROL_STATE_TYPES,
  getEnemySide,
  getAliveMembers,
  addRoundLog,
  getStateValue,
  getPrimaryState,
  consumeState
} = require("./state");

const COUNTER = {
  骑兵: "弓兵",
  弓兵: "枪兵",
  枪兵: "骑兵"
};

const ONGOING_DAMAGE_STATES = new Set(["灼烧", "叛逃", "持续伤害"]);
const ONGOING_HEALING_STATES = new Set(["急救", "休整", "持续治疗"]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addMetric(state, side, suffix, amount = 1) {
  const key = `${side}${suffix}`;
  state.metrics[key] = (state.metrics[key] || 0) + amount;
}

function getTroopCounterFactor(attackerTroop, defenderTroop) {
  if (COUNTER[attackerTroop] === defenderTroop) return 1.12;
  if (COUNTER[defenderTroop] === attackerTroop) return 0.9;
  return 1;
}

function addOrRefreshState(target, nextState) {
  const existing = target.states.find((state) => state.type === nextState.type);
  if (existing) {
    existing.value = Math.max(Number(existing.value) || 0, Number(nextState.value) || 0);
    existing.remaining = Math.max(existing.remaining, nextState.remaining);
    existing.source = nextState.source || existing.source;
    existing.sourceSide = nextState.sourceSide || existing.sourceSide;
    existing.sourceActorId = nextState.sourceActorId || existing.sourceActorId;
    if (nextState.count !== undefined) {
      existing.count = Math.max(Number(existing.count) || 0, Number(nextState.count) || 0);
    }
    if (nextState.multiplier !== undefined) {
      existing.multiplier = Math.max(Number(existing.multiplier) || 0, Number(nextState.multiplier) || 0);
    }
    return existing;
  }
  target.states.push({ ...nextState });
  return nextState;
}

function getDamageAttribute(attacker, damageType) {
  return damageType === "谋略" ? attacker.stats.intellect : attacker.stats.force;
}

function getDefenseAttribute(defender, damageType) {
  return damageType === "谋略" ? defender.stats.intellect : defender.stats.command;
}

function calculateDamage({ attacker, defender, rate = 100, damageType = "兵刃", random }) {
  const attackStat = getDamageAttribute(attacker, damageType);
  const defenseStat = getDefenseAttribute(defender, damageType);
  const attributeFactor = clamp(1 + (attackStat - defenseStat) / 260, 0.55, 1.65);
  const strengthFactor = clamp(0.48 + (attacker.troops / attacker.maxTroops) * 0.52, 0.35, 1);
  const counterFactor = getTroopCounterFactor(attacker.troop, defender.troop);
  const damageBonus = getStateValue(attacker, "增伤") + getStateValue(defender, "易伤");
  const damageReduction = getStateValue(defender, "减伤");
  const randomFactor = randomBetween(random, 0.9, 1.1);
  const raw = rate * 8.5 * attributeFactor * attacker.aptitudeFactor * counterFactor * strengthFactor;
  return Math.max(1, Math.round(raw * (1 + damageBonus) * (1 - damageReduction) * randomFactor));
}

function getStateChance(state, fallback = 1) {
  const value = Number(state && state.value);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return clamp(value > 1 ? value / 100 : value, 0, 1);
}

function tryEvade(state, round, phase, attacker, defender, random) {
  const evadeState = getPrimaryState(defender, "规避");
  if (!evadeState || random() >= getStateChance(evadeState, 1)) return false;
  if (evadeState.count !== undefined) consumeState(defender, "规避", evadeState);
  addMetric(state, defender.side, "Evades");
  addRoundLog(state, round, phase, {
    actor: defender.name,
    target: attacker.name,
    type: "规避",
    text: `${defender.name}触发规避，免疫了${attacker.name}的本次伤害。`
  });
  return true;
}

function tryGuard(state, round, phase, attacker, defender) {
  const guardState = getPrimaryState(defender, "抵御");
  if (!guardState) return false;
  consumeState(defender, "抵御", guardState);
  addMetric(state, defender.side, "Guards");
  addRoundLog(state, round, phase, {
    actor: defender.name,
    target: attacker.name,
    type: "抵御",
    text: `${defender.name}触发抵御，抵消了${attacker.name}的本次伤害。`
  });
  return true;
}

function applyCritical(state, attacker, damageType, amount, random) {
  const criticalType = damageType === "谋略" ? "奇谋" : "会心";
  const criticalState = getPrimaryState(attacker, criticalType);
  if (!criticalState || random() >= getStateChance(criticalState, 0)) return { amount, criticalType: null };
  const multiplier = Math.max(1, Number(criticalState.multiplier) || 1.35);
  addMetric(state, attacker.side, criticalType === "奇谋" ? "StrategicCriticals" : "Criticals");
  return { amount: Math.max(1, Math.round(amount * multiplier)), criticalType };
}

function applyDamage(state, round, phase, attacker, defender, options = {}) {
  if (!attacker || !defender || attacker.troops <= 0 || defender.troops <= 0) return 0;
  const random = options.random || (() => 0.5);
  const damageType = options.damageType || "兵刃";
  if (getStateValue(attacker, "虚弱") > 0) {
    addRoundLog(state, round, phase, {
      actor: attacker.name,
      target: defender.name,
      type: "控制",
      text: `${attacker.name}处于虚弱状态，本次伤害未生效。`
    });
    return 0;
  }
  if (tryEvade(state, round, phase, attacker, defender, random)) return 0;
  if (tryGuard(state, round, phase, attacker, defender)) return 0;

  const calculated = calculateDamage({ attacker, defender, rate: options.rate, damageType, random });
  const critical = applyCritical(state, attacker, damageType, calculated, random);
  const amount = Math.min(defender.troops, critical.amount);
  defender.troops -= amount;
  attacker.damageDealt += amount;
  defender.damageTaken += amount;
  state.metrics[attacker.side === "own" ? "ownDamage" : "enemyDamage"] += amount;
  addRoundLog(state, round, phase, {
    actor: attacker.name,
    target: defender.name,
    type: options.actionType || "伤害",
    damageType,
    amount,
    text: `${attacker.name}${options.source ? `发动${options.source}` : "发起攻击"}${critical.criticalType ? `并触发${critical.criticalType}` : ""}，对${defender.name}造成 ${amount} ${damageType}伤害。`
  });
  return amount;
}

function calculateHealing({ healer, target, rate = 100, random }) {
  const intellectFactor = clamp(0.72 + (healer.stats.intellect || 70) / 180, 0.75, 1.55);
  const strengthFactor = clamp(0.55 + (healer.troops / healer.maxTroops) * 0.45, 0.4, 1);
  return Math.max(1, Math.round(rate * 7.2 * intellectFactor * strengthFactor * randomBetween(random, 0.9, 1.1)));
}

function applyHealing(state, round, phase, healer, target, options = {}) {
  if (!healer || !target || healer.troops <= 0 || target.troops <= 0) return 0;
  const actionType = options.actionType || "治疗";
  if (getStateValue(target, "禁疗") > 0) {
    addRoundLog(state, round, phase, {
      actor: healer.name,
      target: target.name,
      type: actionType,
      text: `${target.name}处于禁疗状态，未获得治疗。`
    });
    return 0;
  }
  const amount = Math.min(
    target.maxTroops - target.troops,
    calculateHealing({ healer, target, rate: options.rate, random: options.random })
  );
  if (amount <= 0) return 0;
  target.troops += amount;
  healer.healingDone += amount;
  state.metrics[healer.side === "own" ? "ownHealing" : "enemyHealing"] += amount;
  addRoundLog(state, round, phase, {
    actor: healer.name,
    target: target.name,
    type: actionType,
    amount,
    text: `${healer.name}${options.source ? `发动${options.source}` : "进行治疗"}，为${target.name}恢复 ${amount} 兵力。`
  });
  return amount;
}

function applyState(state, round, phase, actor, target, nextState, options = {}) {
  if (!target || target.troops <= 0) return null;
  const actorSide = actor && actor.side ? actor.side : nextState.sourceSide || getEnemySide(target.side);
  const sourceActorId = actor && actor.id ? actor.id : nextState.sourceActorId;
  const stateToApply = { ...nextState, sourceSide: actorSide, sourceActorId };
  if (CONTROL_STATE_TYPES.has(nextState.type) && getPrimaryState(target, "洞察")) {
    const insightState = getPrimaryState(target, "洞察");
    if (insightState.count !== undefined) consumeState(target, "洞察", insightState);
    addMetric(state, target.side, "StateResists");
    addRoundLog(state, round, phase, {
      actor: actor ? actor.name : stateToApply.source || "状态",
      target: target.name,
      type: "洞察",
      state: nextState.type,
      text: `${target.name}凭借洞察免疫了${nextState.type}。`
    });
    return null;
  }
  const applied = addOrRefreshState(target, stateToApply);
  addMetric(state, actorSide, "StateHits");
  if (CONTROL_STATE_TYPES.has(nextState.type)) {
    if (actor) actor.controlTurnsApplied += nextState.remaining;
    state.metrics[actorSide === "own" ? "ownControlTurns" : "enemyControlTurns"] += nextState.remaining;
  }
  addRoundLog(state, round, phase, {
    actor: actor ? actor.name : stateToApply.source || "状态",
    target: target.name,
    type: "状态",
    state: nextState.type,
    text: `${actor ? actor.name : stateToApply.source || "状态"}${options.source ? `发动${options.source}` : "施加状态"}，使${target.name}获得${nextState.type}${nextState.remaining}回合。`
  });
  return applied;
}

function getLowestTroopMember(team) {
  return getAliveMembers(team).sort((a, b) => a.troops / a.maxTroops - b.troops / b.maxTroops)[0] || null;
}

function getRandomTargets(random, team, count) {
  const alive = getAliveMembers(team);
  const picked = [];
  const pool = [...alive];
  while (pool.length && picked.length < count) {
    const index = Math.floor(random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function cleanseNegative(target) {
  const negative = new Set(["缴械", "计穷", "震慑", "虚弱", "混乱", "禁疗", "易伤", "灼烧", "叛逃", "持续伤害"]);
  const before = target.states.length;
  target.states = target.states.filter((state) => !negative.has(state.type));
  return before - target.states.length;
}

function getAllMembers(state) {
  return [...state.teams.own.members, ...state.teams.enemy.members];
}

function findSourceMember(state, effect) {
  if (!effect.sourceActorId) return null;
  return getAllMembers(state).find((member) => member.id === effect.sourceActorId) || null;
}

function applyOngoingDamage(state, round, phase, target, effect, random) {
  if (!target || target.troops <= 0) return 0;
  const source = findSourceMember(state, effect);
  const sourceSide = effect.sourceSide || getEnemySide(target.side);
  const sourceName = source && source.troops > 0 ? source.name : effect.source || effect.type;
  const rate = Number(effect.value) || 60;
  const damageType = effect.damageType || (effect.type === "叛逃" ? "兵刃" : "谋略");
  const calculated = source && source.troops > 0
    ? calculateDamage({ attacker: source, defender: target, rate, damageType, random })
    : Math.max(1, Math.round(rate * 5.2 * randomBetween(random, 0.9, 1.1)));
  const amount = Math.min(target.troops, calculated);
  if (amount <= 0) return 0;
  target.troops -= amount;
  if (source && source.side === sourceSide) source.damageDealt += amount;
  target.damageTaken += amount;
  addMetric(state, sourceSide, "Damage", amount);
  addMetric(state, sourceSide, "OngoingDamage", amount);
  addRoundLog(state, round, phase, {
    actor: sourceName,
    target: target.name,
    type: effect.type,
    damageType,
    amount,
    text: `${target.name}受到${sourceName}的${effect.type}影响，损失 ${amount} 兵力。`
  });
  return amount;
}

function applyOngoingHealing(state, round, phase, target, effect, random) {
  if (!target || target.troops <= 0) return 0;
  const source = findSourceMember(state, effect);
  const healer = source && source.troops > 0 ? source : target;
  const amount = applyHealing(state, round, phase, healer, target, {
    rate: Number(effect.value) || 80,
    random,
    source: effect.source || effect.type,
    actionType: effect.type
  });
  if (amount > 0) addMetric(state, healer.side, "OngoingHealing", amount);
  return amount;
}

function applyRoundStartStates(state, round, random) {
  getAllMembers(state).forEach((member) => {
    if (member.troops <= 0) return;
    const activeStates = [...member.states].filter((effect) => effect.remaining > 0);
    activeStates.forEach((effect) => {
      if (member.troops <= 0) return;
      if (ONGOING_DAMAGE_STATES.has(effect.type)) {
        applyOngoingDamage(state, round, "回合开始", member, effect, random);
      } else if (ONGOING_HEALING_STATES.has(effect.type)) {
        applyOngoingHealing(state, round, "回合开始", member, effect, random);
      }
    });
  });
}

module.exports = {
  clamp,
  getTroopCounterFactor,
  addOrRefreshState,
  calculateDamage,
  applyDamage,
  applyHealing,
  applyState,
  applyRoundStartStates,
  getLowestTroopMember,
  getRandomTargets,
  cleanseNegative
};
