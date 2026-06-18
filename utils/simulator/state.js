const CONTROL_STATE_TYPES = new Set(["缴械", "计穷", "震慑", "虚弱", "混乱", "禁疗"]);

function cloneMember(member) {
  return {
    ...member,
    troops: member.maxTroops,
    states: (member.initialStates || []).map((state) => ({ ...state })),
    damageDealt: 0,
    damageTaken: 0,
    healingDone: 0,
    controlTurnsApplied: 0,
    tacticActivations: {}
  };
}

function createInitialState(normalized, options = {}) {
  return {
    maxRounds: Math.max(1, Math.min(Number(options.maxRounds) || 8, 8)),
    round: 0,
    teams: {
      own: {
        ...normalized.own,
        members: normalized.own.members.map(cloneMember)
      },
      enemy: {
        ...normalized.enemy,
        members: normalized.enemy.members.map(cloneMember)
      }
    },
    rounds: [],
    metrics: {
      ownDamage: 0,
      enemyDamage: 0,
      ownHealing: 0,
      enemyHealing: 0,
      ownControlTurns: 0,
      enemyControlTurns: 0,
      ownEvades: 0,
      enemyEvades: 0,
      ownGuards: 0,
      enemyGuards: 0,
      ownCriticals: 0,
      enemyCriticals: 0,
      ownStrategicCriticals: 0,
      enemyStrategicCriticals: 0,
      ownOngoingDamage: 0,
      enemyOngoingDamage: 0,
      ownOngoingHealing: 0,
      enemyOngoingHealing: 0,
      ownStateHits: 0,
      enemyStateHits: 0,
      ownStateResists: 0,
      enemyStateResists: 0,
      tacticActivations: []
    },
    ruleCoverage: {
      explicit: 0,
      fallback: 0,
      estimated: 0,
      missed: 0,
      explicitTactics: [],
      fallbackTactics: [],
      missedTactics: [],
      coverageByTactic: []
    },
    catalogContext: normalized.catalogContext || null,
    assumptions: [...normalized.assumptions]
  };
}

function getTeam(state, side) {
  return state.teams[side];
}

function getEnemySide(side) {
  return side === "own" ? "enemy" : "own";
}

function getEnemyTeam(state, side) {
  return getTeam(state, getEnemySide(side));
}

function getAliveMembers(team) {
  return team.members.filter((member) => member.troops > 0);
}

function isAlive(member) {
  return member && member.troops > 0;
}

function teamRemaining(team) {
  return team.members.reduce((sum, member) => sum + Math.max(0, member.troops), 0);
}

function addRoundLog(state, round, phase, action) {
  let roundLog = state.rounds.find((item) => item.round === round && item.phase === phase);
  if (!roundLog) {
    roundLog = { round, phase, actions: [] };
    state.rounds.push(roundLog);
  }
  roundLog.actions.push(action);
}

function getActiveStates(member, type) {
  return (member.states || []).filter((state) => state.type === type && state.remaining > 0);
}

function hasState(member, type) {
  return getActiveStates(member, type).length > 0;
}

function getStateValue(member, type) {
  return getActiveStates(member, type).reduce((max, state) => Math.max(max, Number(state.value) || 0), 0);
}

function getPrimaryState(member, type) {
  return getActiveStates(member, type).sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))[0] || null;
}

function consumeState(member, type, targetState = null) {
  const index = member.states.findIndex((state) => state.remaining > 0 && state.type === type && (!targetState || state === targetState));
  if (index < 0) return null;
  const state = member.states[index];
  if (state.count !== undefined) {
    state.count = Math.max(0, Number(state.count) - 1);
    if (state.count > 0) return state;
  }
  member.states.splice(index, 1);
  return state;
}

function tickStates(team) {
  team.members.forEach((member) => {
    member.states = member.states
      .map((state) => ({ ...state, remaining: state.remaining - 1 }))
      .filter((state) => state.remaining > 0 && (state.count === undefined || Number(state.count) > 0));
  });
}

function getActionOrder(state, phase) {
  const actors = [...getAliveMembers(state.teams.own), ...getAliveMembers(state.teams.enemy)];
  return actors.sort((a, b) => {
    const firstA = hasState(a, "先攻") ? 1 : 0;
    const firstB = hasState(b, "先攻") ? 1 : 0;
    if (firstA !== firstB) return firstB - firstA;
    const speedDiff = (b.stats.speed || 0) - (a.stats.speed || 0);
    if (speedDiff) return speedDiff;
    if (a.side !== b.side) return a.side === "own" ? -1 : 1;
    return a.position - b.position;
  });
}

function battleEnded(state) {
  return teamRemaining(state.teams.own) <= 0 || teamRemaining(state.teams.enemy) <= 0;
}

module.exports = {
  CONTROL_STATE_TYPES,
  createInitialState,
  getTeam,
  getEnemySide,
  getEnemyTeam,
  getAliveMembers,
  isAlive,
  teamRemaining,
  addRoundLog,
  getActiveStates,
  hasState,
  getStateValue,
  getPrimaryState,
  consumeState,
  tickStates,
  getActionOrder,
  battleEnded
};
