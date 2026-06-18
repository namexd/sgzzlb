const { createRandom } = require("./random");
const { normalizeBattleInput } = require("./normalize");
const {
  createInitialState,
  getTeam,
  getEnemyTeam,
  getAliveMembers,
  getActionOrder,
  battleEnded,
  tickStates,
  hasState,
  getPrimaryState,
  consumeState,
  addRoundLog
} = require("./state");
const { applyDamage, applyRoundStartStates, getRandomTargets } = require("./effects");
const { applyPrepareTactics, applyActiveTactics, applyAssaultTactics } = require("./tactics");
const { buildBattleReport, buildAggregate } = require("./report");

function getIterationSeed(seed, index) {
  return `${seed === undefined || seed === null ? "sgzzlb" : seed}:${index}`;
}

function normalizeIterations(value) {
  const iterations = Number(value) || 1;
  return Math.max(1, Math.min(Math.round(iterations), 100));
}

function normalizeChance(value, fallback = 1) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.max(0, Math.min(1, number > 1 ? number / 100 : number));
}

function getBasicAttackTarget(state, actor, random) {
  const enemy = getEnemyTeam(state, actor.side);
  return getRandomTargets(random, enemy, 1)[0] || null;
}

function canBasicAttack(actor) {
  return actor && actor.troops > 0 && !hasState(actor, "震慑") && !hasState(actor, "缴械");
}

function applyBasicAttack(state, actor, round, random) {
  if (!canBasicAttack(actor)) return 0;
  const target = getBasicAttackTarget(state, actor, random);
  if (!target) return 0;
  return applyDamage(state, round, "普攻", actor, target, {
    rate: 82,
    damageType: "兵刃",
    random,
    actionType: "普攻"
  });
}

function applyBasicAttackWithAssault(state, actor, round, random) {
  const damage = applyBasicAttack(state, actor, round, random);
  if (damage > 0 && !battleEnded(state)) {
    applyAssaultTactics(state, actor, round, "突击", random);
  }
  return damage;
}

function applyComboAttack(state, actor, round, random) {
  const comboState = getPrimaryState(actor, "连击");
  if (!comboState || !canBasicAttack(actor) || battleEnded(state)) return;
  if (random() >= normalizeChance(comboState.value, 1)) return;
  if (comboState.count !== undefined) consumeState(actor, "连击", comboState);
  addRoundLog(state, round, "普攻", {
    actor: actor.name,
    type: "连击",
    text: `${actor.name}触发连击，追加一次普通攻击。`
  });
  applyBasicAttackWithAssault(state, actor, round, random);
}

function executeRound(state, round, random) {
  applyRoundStartStates(state, round, random);
  if (battleEnded(state)) return;

  const activeOrder = getActionOrder(state, "主动");
  activeOrder.forEach((actor) => {
    if (actor.troops <= 0 || battleEnded(state)) return;
    applyActiveTactics(state, actor, round, "主动", random);
  });

  const attackOrder = getActionOrder(state, "普攻");
  attackOrder.forEach((actor) => {
    if (!canBasicAttack(actor) || battleEnded(state)) return;
    applyBasicAttackWithAssault(state, actor, round, random);
    applyComboAttack(state, actor, round, random);
  });

  tickStates(getTeam(state, "own"));
  tickStates(getTeam(state, "enemy"));
}

function simulateSingle(payload = {}, iterationIndex = 0) {
  const normalized = normalizeBattleInput(payload);
  const random = createRandom(getIterationSeed(payload.seed, iterationIndex));
  const state = createInitialState(normalized, payload.options || {});

  applyPrepareTactics(state, "准备阶段", random);

  for (let round = 1; round <= state.maxRounds && !battleEnded(state); round += 1) {
    state.round = round;
    executeRound(state, round, random);
  }

  if (getAliveMembers(state.teams.own).length === 0 || getAliveMembers(state.teams.enemy).length === 0) {
    state.assumptions.push("战斗在一方兵力归零时提前结束。");
  } else if (!battleEnded(state)) {
    state.assumptions.push(`战斗达到${state.maxRounds}回合上限后按剩余兵力判定胜负。`);
  }

  return buildBattleReport(state);
}

function simulateBattle(payload = {}) {
  return simulateSingle(payload, 0);
}

function simulateBatch(payload = {}) {
  const iterations = normalizeIterations(payload.iterations);
  const reports = Array.from({ length: iterations }, (_, index) => simulateSingle(payload, index));
  return buildAggregate(reports);
}

function simulate(payload = {}) {
  const iterations = normalizeIterations(payload.iterations);
  return iterations > 1 ? simulateBatch({ ...payload, iterations }) : simulateBattle(payload);
}

module.exports = {
  simulate,
  simulateBattle,
  simulateBatch
};
