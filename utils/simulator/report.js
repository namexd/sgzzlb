const { teamRemaining } = require("./state");

function getResult(state) {
  const ownRemaining = teamRemaining(state.teams.own);
  const enemyRemaining = teamRemaining(state.teams.enemy);
  const diff = ownRemaining - enemyRemaining;
  const total = state.teams.own.members.reduce((sum, member) => sum + member.maxTroops, 0);
  if (Math.abs(diff) <= total * 0.03) return "draw";
  return diff > 0 ? "win" : "loss";
}

function buildMemberStats(team) {
  return team.members.map((member) => ({
    id: member.general.id,
    name: member.name,
    remaining: Math.max(0, member.troops),
    maxTroops: member.maxTroops,
    damageDealt: member.damageDealt,
    damageTaken: member.damageTaken,
    healingDone: member.healingDone,
    controlTurnsApplied: member.controlTurnsApplied,
    tacticActivations: member.tacticActivations
  }));
}

function getCoverageKey(item = {}) {
  return `${item.tacticId || ""}:${item.tacticName || ""}:${item.status || ""}`;
}

function dedupeCoverageByTactic(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getCoverageKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatRuleCoverage(ruleCoverage = {}) {
  const explicit = Number(ruleCoverage.explicit) || 0;
  const fallback = Number(ruleCoverage.fallback) || 0;
  const estimated = Number(ruleCoverage.estimated) || 0;
  const missed = Number(ruleCoverage.missed) || 0;
  const total = Math.max(1, explicit + fallback + missed);
  return {
    explicit,
    fallback,
    estimated,
    missed,
    explicitTactics: [...new Set(ruleCoverage.explicitTactics || [])],
    fallbackTactics: [...new Set(ruleCoverage.fallbackTactics || [])],
    missedTactics: [...new Set(ruleCoverage.missedTactics || [])],
    coverageByTactic: dedupeCoverageByTactic(ruleCoverage.coverageByTactic || []),
    explicitRate: Number((explicit / total).toFixed(3)),
    estimatedRate: Number((estimated / total).toFixed(3))
  };
}

function mergeRuleCoverage(reports) {
  return formatRuleCoverage(reports.reduce((merged, report) => {
    const ruleCoverage = report.ruleCoverage || {};
    merged.explicit += Number(ruleCoverage.explicit) || 0;
    merged.fallback += Number(ruleCoverage.fallback) || 0;
    merged.estimated += Number(ruleCoverage.estimated) || 0;
    merged.missed += Number(ruleCoverage.missed) || 0;
    merged.explicitTactics.push(...(ruleCoverage.explicitTactics || []));
    merged.fallbackTactics.push(...(ruleCoverage.fallbackTactics || []));
    merged.missedTactics.push(...(ruleCoverage.missedTactics || []));
    merged.coverageByTactic.push(...(ruleCoverage.coverageByTactic || []));
    return merged;
  }, {
    explicit: 0,
    fallback: 0,
    estimated: 0,
    missed: 0,
    explicitTactics: [],
    fallbackTactics: [],
    missedTactics: [],
    coverageByTactic: []
  }));
}

function getTopMember(members, field) {
  return [...members].sort((a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0))[0] || null;
}

function getTopTactics(metrics, side) {
  const counts = new Map();
  (metrics.tacticActivations || [])
    .filter((item) => item.side === side)
    .forEach((item) => counts.set(item.tactic, (counts.get(item.tactic) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
}

function findLargestAction(rounds, predicate) {
  return rounds
    .flatMap((round) => round.actions.map((action) => ({ ...action, round: round.round, phase: round.phase })))
    .filter(predicate)
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))[0] || null;
}

function buildHighlights(reportBase, state) {
  const ownMembers = reportBase.metrics.ownMembers;
  const enemyMembers = reportBase.metrics.enemyMembers;
  const topOwnDamage = getTopMember(ownMembers, "damageDealt");
  const topEnemyDamage = getTopMember(enemyMembers, "damageDealt");
  const topHealing = getTopMember([...ownMembers, ...enemyMembers], "healingDone");
  const topControl = getTopMember([...ownMembers, ...enemyMembers], "controlTurnsApplied");
  const largestDamage = findLargestAction(reportBase.rounds, (action) => Number(action.amount) > 0 && action.damageType);
  const largestHealing = findLargestAction(reportBase.rounds, (action) => Number(action.amount) > 0 && action.type === "治疗");
  return {
    ownTopDamage: topOwnDamage ? { name: topOwnDamage.name, amount: topOwnDamage.damageDealt } : null,
    enemyTopDamage: topEnemyDamage ? { name: topEnemyDamage.name, amount: topEnemyDamage.damageDealt } : null,
    topHealing: topHealing && topHealing.healingDone > 0 ? { name: topHealing.name, amount: topHealing.healingDone } : null,
    topControl: topControl && topControl.controlTurnsApplied > 0 ? { name: topControl.name, turns: topControl.controlTurnsApplied } : null,
    largestDamage: largestDamage ? {
      round: largestDamage.round,
      phase: largestDamage.phase,
      actor: largestDamage.actor,
      target: largestDamage.target,
      amount: largestDamage.amount,
      damageType: largestDamage.damageType
    } : null,
    largestHealing: largestHealing ? {
      round: largestHealing.round,
      phase: largestHealing.phase,
      actor: largestHealing.actor,
      target: largestHealing.target,
      amount: largestHealing.amount
    } : null,
    ownKeyTactics: getTopTactics(state.metrics, "own"),
    enemyKeyTactics: getTopTactics(state.metrics, "enemy"),
    keyEvents: reportBase.rounds
      .flatMap((round) => round.actions.map((action) => ({ round: round.round, phase: round.phase, ...action })))
      .filter((action) => ["规避", "抵御", "洞察", "连击", "灼烧", "叛逃"].includes(action.type) || ["震慑", "缴械", "计穷"].includes(action.state))
      .slice(0, 8)
      .map((action) => ({ round: action.round, phase: action.phase, type: action.type, actor: action.actor, target: action.target, text: action.text }))
  };
}

function buildBattleReport(state) {
  const ownRemaining = teamRemaining(state.teams.own);
  const enemyRemaining = teamRemaining(state.teams.enemy);
  const ownTotal = state.teams.own.members.reduce((sum, member) => sum + member.maxTroops, 0);
  const enemyTotal = state.teams.enemy.members.reduce((sum, member) => sum + member.maxTroops, 0);
  const result = getResult(state);
  const winner = result === "draw" ? "draw" : result === "win" ? "own" : "enemy";
  const rounds = Math.max(...state.rounds.map((item) => item.round), 0);
  const reportBase = {
    summary: {
      winner,
      result,
      rounds,
      ownRemaining,
      enemyRemaining,
      ownLoss: ownTotal - ownRemaining,
      enemyLoss: enemyTotal - enemyRemaining,
      troopLossRatio: ownTotal > 0 ? Number(((ownTotal - ownRemaining) / ownTotal).toFixed(3)) : 0
    },
    rounds: state.rounds,
    metrics: {
      ...state.metrics,
      ownMembers: buildMemberStats(state.teams.own),
      enemyMembers: buildMemberStats(state.teams.enemy)
    },
    ruleCoverage: formatRuleCoverage(state.ruleCoverage),
    catalogContext: state.catalogContext || null,
    assumptions: [...new Set(state.assumptions)]
  };

  return {
    ...reportBase,
    highlights: buildHighlights(reportBase, state)
  };
}

function getMargin(report) {
  return report.summary.ownRemaining - report.summary.enemyRemaining;
}

function buildDistribution(reports) {
  const sortedMargins = reports.map(getMargin).sort((a, b) => a - b);
  const pick = (ratio) => sortedMargins[Math.min(sortedMargins.length - 1, Math.max(0, Math.floor((sortedMargins.length - 1) * ratio)))] || 0;
  return {
    bestMargin: sortedMargins[sortedMargins.length - 1] || 0,
    worstMargin: sortedMargins[0] || 0,
    medianMargin: pick(0.5),
    p25Margin: pick(0.25),
    p75Margin: pick(0.75)
  };
}

function summarizeSample(report) {
  return {
    summary: report.summary,
    highlights: report.highlights,
    ruleCoverage: report.ruleCoverage,
    assumptions: report.assumptions.slice(0, 5)
  };
}

function buildStabilityReasons({ winRate, draws, losses, avgRatio, distribution, ruleCoverage }) {
  const reasons = [];
  if (winRate >= 70) reasons.push("胜率高于 70%，多数样本能稳定取得兵力优势。");
  else if (winRate >= 55) reasons.push("胜率略占优，但仍存在明显波动。");
  else if (winRate >= 40) reasons.push("胜率接近五五开，阵容强度更依赖触发和对位波动。");
  else reasons.push("胜率低于 40%，当前对位下稳定性偏弱。");
  if (draws > 0) reasons.push(`出现 ${draws} 场平局，说明部分样本兵力差距较小。`);
  if (losses > 0 && distribution.worstMargin < 0) reasons.push(`最差样本落后 ${Math.abs(distribution.worstMargin)} 兵力，需要关注爆发或控制断档。`);
  if (avgRatio >= 0.55) reasons.push("平均战损偏高，即使获胜也可能需要更强续航或减伤。");
  if (ruleCoverage.estimatedRate >= 0.35) reasons.push("估算规则占比较高，结论更适合用于方向判断，不宜视为精确战报。");
  return reasons;
}

function buildAggregate(reports) {
  const total = reports.length;
  const wins = reports.filter((report) => report.summary.result === "win").length;
  const losses = reports.filter((report) => report.summary.result === "loss").length;
  const draws = reports.filter((report) => report.summary.result === "draw").length;
  const avg = (selector) => {
    if (!total) return 0;
    return Math.round(reports.reduce((sum, report) => sum + selector(report), 0) / total);
  };
  const avgRatio = reports.reduce((sum, report) => sum + report.summary.troopLossRatio, 0) / Math.max(total, 1);
  const winRate = Math.round((wins / Math.max(total, 1)) * 100);
  const stability = winRate >= 70 ? "高" : winRate >= 55 ? "中高" : winRate >= 40 ? "中" : "低";
  const distribution = buildDistribution(reports);
  const ruleCoverage = mergeRuleCoverage(reports);
  const bestSample = [...reports].sort((a, b) => getMargin(b) - getMargin(a))[0] || null;
  const worstSample = [...reports].sort((a, b) => getMargin(a) - getMargin(b))[0] || null;

  return {
    summary: {
      iterations: total,
      wins,
      losses,
      draws,
      winRate,
      drawRate: Math.round((draws / Math.max(total, 1)) * 100)
    },
    aggregate: {
      averageOwnRemaining: avg((report) => report.summary.ownRemaining),
      averageEnemyRemaining: avg((report) => report.summary.enemyRemaining),
      averageTroopLossRatio: Number(avgRatio.toFixed(3)),
      averageOwnDamage: avg((report) => report.metrics.ownDamage),
      averageEnemyDamage: avg((report) => report.metrics.enemyDamage),
      averageOwnHealing: avg((report) => report.metrics.ownHealing),
      averageEnemyHealing: avg((report) => report.metrics.enemyHealing),
      stability,
      stabilityReasons: buildStabilityReasons({ winRate, draws, losses, avgRatio, distribution, ruleCoverage }),
      distribution,
      scoreSuggestion: Math.round(winRate * 0.5 + Math.max(0, 100 - avgRatio * 100) * 0.3 + (stability === "高" ? 20 : stability === "中高" ? 14 : stability === "中" ? 8 : 3))
    },
    samples: reports.slice(0, 3),
    bestSample: bestSample ? summarizeSample(bestSample) : null,
    worstSample: worstSample ? summarizeSample(worstSample) : null,
    ruleCoverage,
    catalogContext: reports[0] ? reports[0].catalogContext || null : null,
    assumptions: [...new Set(reports.flatMap((report) => report.assumptions))]
  };
}

module.exports = {
  buildBattleReport,
  buildAggregate
};
