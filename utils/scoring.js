const catalog = require("./catalog");
const { classifyTacticCoverage } = require("./simulator/tactics");

const SCORING_VERSION = "1.0.0";

const TROOP_KEY = {
  骑兵: "cavalry",
  盾兵: "shield",
  弓兵: "bow",
  枪兵: "spear",
  器械: "siege"
};

const APTITUDE_SCORE = {
  S: 100,
  A: 82,
  B: 64,
  C: 42,
  "": 55
};

const TYPE_ROLE = {
  指挥: "稳定增益",
  主动: "主动输出",
  突击: "普攻联动",
  被动: "稳定被动",
  内政: "非战斗",
  战前: "开局压制",
  普攻: "普攻体系",
  阵法: "队伍结构"
};

const SCENARIO_BONUS = {
  pk: {
    name: "PK赛季",
    tags: ["控", "辅", "谋", "战"],
    text: "PK赛季按高强度环境处理，控制、减伤、治疗和稳定输出权重更高。"
  },
  pioneer: {
    name: "开荒",
    tags: ["医", "辅", "盾"],
    text: "开荒按低损和稳定性处理，治疗、减伤和兵种适性权重更高。"
  },
  war: {
    name: "打架",
    tags: ["控", "武", "谋"],
    text: "打架按对抗环境处理，控制、爆发和速度压制权重更高。"
  }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) return 0;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function getGeneral(generalId, context) {
  return typeof generalId === "object" ? generalId : catalog.findGeneralById(generalId, context);
}

function getTactic(tacticId, context) {
  return typeof tacticId === "object" ? tacticId : catalog.findTacticById(tacticId, context);
}

function getAptitude(general, troop) {
  const key = TROOP_KEY[troop] || "cavalry";
  const rank = general && general.arms ? general.arms[key] || "" : "";
  return {
    rank,
    score: APTITUDE_SCORE[rank] || APTITUDE_SCORE[""]
  };
}

function isTacticCompatible(tactic, troop) {
  if (!tactic) return false;
  if (!Array.isArray(tactic.troopLimit) || tactic.troopLimit.length === 0) return true;
  return tactic.troopLimit.includes(troop) || tactic.troopLimit.includes("器械");
}

function classifyTacticText(tactic) {
  const text = `${tactic.type || ""} ${tactic.description || ""}`;
  return {
    heal: /治疗|恢复|急救/.test(text),
    control: /缴械|计穷|震慑|混乱|虚弱|禁疗|伪报/.test(text),
    damage: /伤害率|兵刃|谋略|攻击/.test(text),
    defense: /减伤|降低.*伤害|分担|抵御|休整/.test(text),
    speed: /速度|先攻/.test(text)
  };
}

function buildDimension(label, score, reason) {
  return {
    label,
    score: Math.round(clamp(score, 0, 100)),
    reason
  };
}

function buildRuleCoverageSignal(tactics) {
  const items = tactics.filter(Boolean).map((tactic) => classifyTacticCoverage(tactic));
  const summary = items.reduce(
    (result, item) => {
      result.total += 1;
      result[item.status] = (result[item.status] || 0) + 1;
      return result;
    },
    { total: 0, explicit: 0, fallback: 0, missed: 0 }
  );
  const coverageRate = summary.total ? Math.round(((summary.explicit + summary.fallback * 0.6) / summary.total) * 100) : 0;
  const score = summary.total ? clamp(45 + coverageRate * 0.55 - summary.missed * 8, 30, 100) : 55;
  const confidenceImpact = summary.missed > 0 ? "部分战法未覆盖，评分可信度下调。" : summary.fallback > 0 ? "部分战法使用通用估算，建议结合模拟结果复核。" : "战法规则覆盖完整，评分可信度较高。";
  return {
    summary,
    coverageRate,
    score,
    confidenceImpact,
    items
  };
}

function normalizeSimulationStats(stats) {
  if (!stats || typeof stats !== "object") return null;
  const winRate = Number(stats.winRate);
  const stability = Number(stats.stability);
  const scoreSuggestion = Number(stats.scoreSuggestion);
  const averageRemaining = Number(stats.averageRemaining);
  const baseScore = Number.isFinite(scoreSuggestion)
    ? scoreSuggestion
    : Number.isFinite(winRate)
      ? clamp(winRate * 0.8 + (Number.isFinite(stability) ? stability * 0.2 : 10), 25, 100)
      : null;
  if (!Number.isFinite(baseScore)) return null;
  return {
    ...stats,
    winRate: Number.isFinite(winRate) ? Math.round(winRate) : null,
    stability: Number.isFinite(stability) ? Math.round(stability) : null,
    averageRemaining: Number.isFinite(averageRemaining) ? Math.round(averageRemaining) : null,
    score: Math.round(clamp(baseScore, 0, 100))
  };
}

function describeSimulationSignal(signal) {
  if (!signal) return "未接入战报模拟结果，本次评分以资料、兵种和战法规则为主。";
  const parts = [];
  if (Number.isFinite(signal.winRate)) parts.push(`模拟胜率 ${signal.winRate}%`);
  if (Number.isFinite(signal.stability)) parts.push(`稳定性 ${signal.stability}`);
  if (Number.isFinite(signal.averageRemaining)) parts.push(`平均剩余兵力 ${signal.averageRemaining}`);
  return parts.length ? `${parts.join("，")}。` : "已接入战报模拟摘要。";
}

function adjustConfidence(baseConfidence, validation, ruleSignal, simulationSignal) {
  if (validation.length) return "低";
  const missed = ruleSignal.summary.missed || 0;
  const fallback = ruleSignal.summary.fallback || 0;
  if (missed >= 2) return "中低";
  if (missed || fallback >= 3) return baseConfidence === "中高" && simulationSignal ? "中" : "中低";
  if (simulationSignal && baseConfidence === "中高") return "高";
  return baseConfidence;
}

function recommendTactics(selectedTactics, troop, missingRoles, context) {
  const selectedNames = new Set(selectedTactics.filter(Boolean).map((item) => item.name));
  const all = catalog
    .getAllTactics(context)
    .filter((item) => !selectedNames.has(item.name))
    .filter((item) => item.quality === "S" || item.quality === "A")
    .filter((item) => isTacticCompatible(item, troop));

  const rolePatterns = {
    heal: /治疗|恢复|急救/,
    control: /缴械|计穷|震慑|混乱|虚弱|禁疗|伪报/,
    defense: /减伤|降低.*伤害|分担|抵御|休整/,
    damage: /伤害率|兵刃|谋略|攻击/
  };

  const preferred = missingRoles.flatMap((role) => {
    const pattern = rolePatterns[role];
    if (!pattern) return [];
    return all.filter((item) => pattern.test(`${item.type || ""} ${item.description || ""}`));
  });

  const unique = [];
  const seen = new Set();
  for (const item of [...preferred, ...all]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push({
      id: item.id,
      name: item.name,
      quality: item.quality,
      type: item.type,
      reason: `${item.quality || ""}${item.type || "战法"}，${isTacticCompatible(item, troop) ? "符合当前兵种" : "需换兵种"}`
    });
    if (unique.length >= 8) break;
  }
  return unique;
}

function analyzeLineup(input) {
  const context = input.catalogSnapshot ? { catalogSnapshot: input.catalogSnapshot } : input.snapshot ? { snapshot: input.snapshot } : undefined;
  const troop = input.troop || "骑兵";
  const scenario = input.scenario || "pk";
  const generals = (input.generalIds || []).map((id) => getGeneral(id, context)).filter(Boolean);
  const tactics = (input.tacticIds || []).map((id) => getTactic(id, context)).filter(Boolean);
  const redLevels = input.redLevels || [0, 0, 0];
  const validation = [];

  if (generals.length < 3) {
    validation.push("请至少选择 3 名武将，评分才有参考价值。");
  }
  if (new Set(generals.map((item) => item.id)).size !== generals.length) {
    validation.push("同一武将不能重复上阵。");
  }

  const totalCost = generals.reduce((sum, item) => sum + (item.cost || 0), 0);
  if (totalCost > 20) {
    validation.push(`当前统御为 ${totalCost}，已超过常规 20 御上限。`);
  }

  const statBase = average(
    generals.flatMap((item) => [item.stats.force, item.stats.intellect, item.stats.command])
  );
  const redBonus = average(redLevels.map((value) => Number(value) || 0)) * 1.8;
  const statScore = clamp(statBase + redBonus, 45, 100);

  const aptitudes = generals.map((item) => getAptitude(item, troop));
  const aptitudeScore = average(aptitudes.map((item) => item.score));
  const weakAptitudes = generals
    .map((item, index) => ({ general: item, aptitude: aptitudes[index] }))
    .filter((item) => item.aptitude.score < 82);

  const incompatibleTactics = tactics.filter((item) => !isTacticCompatible(item, troop));
  const tacticRoles = tactics.map(classifyTacticText);
  const roleCount = tacticRoles.reduce(
    (acc, item) => {
      Object.keys(acc).forEach((key) => {
        if (item[key]) acc[key] += 1;
      });
      return acc;
    },
    { heal: 0, control: 0, damage: 0, defense: 0, speed: 0 }
  );
  const roleCoverage =
    Math.min(roleCount.damage, 3) * 14 +
    Math.min(roleCount.control, 2) * 12 +
    Math.min(roleCount.defense, 2) * 10 +
    Math.min(roleCount.heal, 1) * 12 +
    Math.min(roleCount.speed, 1) * 6;
  const tacticScore = clamp(42 + roleCoverage - incompatibleTactics.length * 16, 30, 100);

  const factions = generals.map((item) => item.faction).filter(Boolean);
  const mainFaction = factions[0];
  const sameFactionCount = factions.filter((item) => item === mainFaction).length;
  const tags = generals.flatMap((item) => item.tags || []);
  const scenarioInfo = SCENARIO_BONUS[scenario] || SCENARIO_BONUS.pk;
  const scenarioHit = tags.filter((tag) => scenarioInfo.tags.includes(tag)).length;
  const identityScore = clamp(56 + sameFactionCount * 9 + scenarioHit * 5, 35, 100);
  const scenarioScore = clamp(58 + scenarioHit * 7 + roleCount.control * 4 + roleCount.defense * 4, 35, 100);
  const ruleSignal = buildRuleCoverageSignal(tactics);
  const simulationSignal = normalizeSimulationStats(input.simulationStats || input.simulationSummary);

  const dimensions = [
    buildDimension(
      "属性基础",
      statScore,
      `三名武将核心属性均值约 ${Math.round(statBase)}，红度加成按预览权重计入。`
    ),
    buildDimension(
      "兵种适性",
      aptitudeScore,
      `${troop}适性为 ${aptitudes.map((item) => item.rank || "-").join(" / ")}。`
    ),
    buildDimension(
      "战法协同",
      tacticScore,
      `当前战法覆盖输出 ${roleCount.damage}、控制 ${roleCount.control}、减伤 ${roleCount.defense}、治疗 ${roleCount.heal}。`
    ),
    buildDimension(
      "阵营标签",
      identityScore,
      `同阵营 ${sameFactionCount} 人，命中当前场景标签 ${scenarioHit} 个。`
    ),
    buildDimension("环境适配", scenarioScore, scenarioInfo.text),
    buildDimension(
      "规则可信度",
      ruleSignal.score,
      `显式规则 ${ruleSignal.summary.explicit}，通用估算 ${ruleSignal.summary.fallback}，未覆盖 ${ruleSignal.summary.missed}，覆盖可信度 ${ruleSignal.coverageRate}%。${ruleSignal.confidenceImpact}`
    )
  ];

  if (simulationSignal) {
    dimensions.push(buildDimension("模拟复核", simulationSignal.score, describeSimulationSignal(simulationSignal)));
  }

  const dimensionWeights = {
    属性基础: 1.15,
    兵种适性: 1.1,
    战法协同: 1.25,
    阵营标签: 0.9,
    环境适配: 1,
    规则可信度: 0.8,
    模拟复核: 1
  };
  const weightedScore = dimensions.reduce(
    (result, item) => {
      const weight = dimensionWeights[item.label] || 1;
      result.score += item.score * weight;
      result.weight += weight;
      return result;
    },
    { score: 0, weight: 0 }
  );
  const totalScore = Math.round(weightedScore.weight ? weightedScore.score / weightedScore.weight : 0);

  const explanations = [
    dimensions[0].reason,
    dimensions[1].reason,
    dimensions[2].reason,
    scenarioInfo.text,
    ruleSignal.confidenceImpact,
    describeSimulationSignal(simulationSignal)
  ];

  const weaknesses = [];
  if (weakAptitudes.length) {
    weaknesses.push(
      `${weakAptitudes.map((item) => `${item.general.name}${item.aptitude.rank || "-"}`).join("、")} 的${troop}适性偏低。`
    );
  }
  if (incompatibleTactics.length) {
    weaknesses.push(`${incompatibleTactics.map((item) => item.name).join("、")} 与当前兵种限制不匹配。`);
  }
  if (roleCount.damage < 2) weaknesses.push("输出战法密度偏低，容易出现回合内压制不足。");
  if (roleCount.defense + roleCount.heal < 1) weaknesses.push("缺少减伤或恢复，战损和稳定性风险较高。");
  if (!weaknesses.length) weaknesses.push("当前没有硬性短板，建议继续用真实战报校验对位稳定性。");

  const missingRoles = [];
  if (roleCount.heal < 1) missingRoles.push("heal");
  if (roleCount.control < 1) missingRoles.push("control");
  if (roleCount.defense < 1) missingRoles.push("defense");
  if (roleCount.damage < 2) missingRoles.push("damage");

  const replacements = recommendTactics(tactics, troop, missingRoles, context);
  const baseConfidence = tactics.length < 6 ? "中" : "中高";
  const confidence = adjustConfidence(baseConfidence, validation, ruleSignal, simulationSignal);

  return {
    scoringVersion: SCORING_VERSION,
    totalScore,
    totalCost,
    troop,
    scenario,
    scenarioName: scenarioInfo.name,
    confidence,
    catalogContext: input.catalogContext || null,
    analysisSignals: {
      ruleCoverage: {
        summary: ruleSignal.summary,
        coverageRate: ruleSignal.coverageRate,
        confidenceImpact: ruleSignal.confidenceImpact,
        items: ruleSignal.items
      },
      simulation: simulationSignal
    },
    validation,
    dimensions,
    explanations,
    weaknesses,
    replacements,
    premiumHints: [
      "高级订阅可展开完整替代战法池。",
      "高级订阅可批量预览主流环境队伍对位。"
    ],
    battleStats: null // 战报统计需要从服务端获取
  };
}

function buildSimulationStats(simulation, side = "own") {
  if (!simulation || !simulation.summary) return null;

  if (simulation.aggregate) {
    const iterations = simulation.summary.iterations || 1;
    const ownWinRate = simulation.summary.winRate || 0;
    const enemyWinRate = Math.round(((simulation.summary.losses || 0) / iterations) * 100);
    return {
      source: "simulator-v1",
      iterations,
      winRate: side === "own" ? ownWinRate : enemyWinRate,
      drawRate: simulation.summary.drawRate || 0,
      averageRemaining: side === "own" ? simulation.aggregate.averageOwnRemaining : simulation.aggregate.averageEnemyRemaining,
      averageOpponentRemaining: side === "own" ? simulation.aggregate.averageEnemyRemaining : simulation.aggregate.averageOwnRemaining,
      averageDamage: side === "own" ? simulation.aggregate.averageOwnDamage : simulation.aggregate.averageEnemyDamage,
      averageHealing: side === "own" ? simulation.aggregate.averageOwnHealing : simulation.aggregate.averageEnemyHealing,
      troopLossRatio: simulation.aggregate.averageTroopLossRatio,
      stability: simulation.aggregate.stability,
      scoreSuggestion: side === "own" ? simulation.aggregate.scoreSuggestion : Math.round(enemyWinRate * 0.7)
    };
  }

  const isOwn = side === "own";
  const result = simulation.summary.result;
  return {
    source: "simulator-v1",
    iterations: 1,
    result: isOwn ? result : result === "win" ? "loss" : result === "loss" ? "win" : "draw",
    winner: simulation.summary.winner,
    remaining: isOwn ? simulation.summary.ownRemaining : simulation.summary.enemyRemaining,
    opponentRemaining: isOwn ? simulation.summary.enemyRemaining : simulation.summary.ownRemaining,
    damage: isOwn ? simulation.metrics.ownDamage : simulation.metrics.enemyDamage,
    healing: isOwn ? simulation.metrics.ownHealing : simulation.metrics.enemyHealing,
    troopLossRatio: simulation.summary.troopLossRatio,
    scoreSuggestion: result === "draw" ? 60 : (isOwn && result === "win") || (!isOwn && result === "loss") ? 75 : 45
  };
}

function compareLineups(ownReport, enemyReport) {
  const scoreDelta = (ownReport.totalScore || 0) - (enemyReport.totalScore || 0);
  const troopNote = ownReport.troop === enemyReport.troop ? "同兵种对位，红度和战法稳定性更关键。" : "跨兵种对位，需结合战法触发和速度线判断。";
  const level = scoreDelta >= 8 ? "优势" : scoreDelta <= -8 ? "劣势" : "均势";
  return {
    level,
    scoreDelta,
    summary: `本方评分 ${ownReport.totalScore}，对方评分 ${enemyReport.totalScore}，预览为${level}。`,
    risk: scoreDelta >= 0 ? "优势不代表稳赢，若缺少控制或减伤仍可能高战损。" : "劣势对位建议先补足兵种适性、减伤或关键控制。",
    troopNote,
    confidence: ownReport.confidence === "中高" && enemyReport.confidence === "中高" ? "中高" : "中"
  };
}

module.exports = {
  TROOP_KEY,
  analyzeLineup,
  compareLineups,
  buildSimulationStats,
  getAptitude,
  isTacticCompatible,
  classifyTacticText
};
