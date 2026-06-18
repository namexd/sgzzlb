import { findGeneralById, findTacticById } from "./catalog";
import { analyzeLineup, isTacticCompatible } from "./scoring";

const TROOPS = ["骑兵", "盾兵", "弓兵", "枪兵"];
const MAX_LINEUPS = 3;
const GENERALS_PER_LINEUP = 3;
const TACTICS_PER_LINEUP = 6;
const APTITUDE_SCORE = { S: 100, A: 82, B: 64, C: 42, "": 55 };

function normalizeTargetLineupCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return MAX_LINEUPS;
  return Math.min(MAX_LINEUPS, Math.max(1, parsed));
}

function toIdSet(value) {
  return new Set((Array.isArray(value) ? value : []).filter(Boolean).map(String));
}

function formatUnusedGeneralIds(ids) {
  return ids.map(getGeneral).filter(Boolean).map((g) => ({ id: g.id, name: g.name }));
}

function formatUnusedTacticIds(ids) {
  return ids.map(getTactic).filter(Boolean).map((t) => ({ id: t.id, name: t.name }));
}

function buildSummary(targetLineupCount, lineups, conflicts) {
  const totalScore = lineups.reduce((s, l) => s + (l.score || 0), 0);
  return {
    targetLineupCount,
    generatedLineupCount: lineups.length,
    totalLineups: lineups.length,
    totalScore,
    averageScore: lineups.length ? Math.round(totalScore / lineups.length) : 0,
    confidence: lineups.length >= targetLineupCount ? "medium" : "low",
    conflictCount: conflicts.length
  };
}

function emptyResult(status, message, { catalogContext, targetLineupCount, generalIds, tacticIds, warnings }) {
  const conflicts = [];
  return {
    status,
    message,
    catalogContext,
    summary: buildSummary(targetLineupCount, [], conflicts),
    lineups: [],
    conflicts,
    unused: {
      generalIds,
      tacticIds,
      generals: formatUnusedGeneralIds(generalIds),
      tactics: formatUnusedTacticIds(tacticIds)
    },
    warnings
  };
}

function chooseTroop(comboIds, preferredTroop) {
  if (TROOPS.includes(preferredTroop)) return preferredTroop;
  return bestTroopForGenerals(comboIds);
}

function buildLineupReasons(lineup, report, preferredTroop) {
  const reasons = [`综合评分 ${report.totalScore}，适合作为${lineup.role}候选。`];
  if (preferredTroop && lineup.troop === preferredTroop) reasons.push(`命中偏好兵种：${preferredTroop}。`);
  if ((report.weaknesses || []).length) reasons.push("已识别主要短板，可继续进入评分或对位复核。");
  return reasons;
}

function getGeneral(id) { return typeof id === "object" ? id : findGeneralById(id); }
function getTactic(id) { return typeof id === "object" ? id : findTacticById(id); }

function combinations3(arr) {
  const result = [];
  for (let i = 0; i < arr.length - 2; i++) {
    for (let j = i + 1; j < arr.length - 1; j++) {
      for (let k = j + 1; k < arr.length; k++) {
        result.push([arr[i], arr[j], arr[k]]);
      }
    }
  }
  return result;
}

function scoreCandidate(generalIds, tacticIds, troop, scenario) {
  return analyzeLineup({ generalIds, tacticIds, troop, scenario, redLevels: [0, 0, 0] });
}

function pickBestTactics(generalIds, availableTacticIds, troop, scenario) {
  const generalObjs = generalIds.map(getGeneral).filter(Boolean);
  const compatible = availableTacticIds.map(getTactic).filter((t) => t && isTacticCompatible(t, troop));
  if (compatible.length < TACTICS_PER_LINEUP) return { tacticIds: compatible.map((t) => t.id), score: 0, insufficient: true };
  if (compatible.length <= 12) return pickBestTacticsBrute(generalIds, compatible, troop, scenario);
  return pickBestTacticsGreedy(generalIds, compatible, troop, scenario);
}

function pickBestTacticsBrute(generalIds, compatibleTactics, troop, scenario) {
  let best = null;
  const n = compatibleTactics.length;
  for (let a = 0; a < n - 5; a++) {
    for (let b = a + 1; b < n - 4; b++) {
      for (let c = b + 1; c < n - 3; c++) {
        for (let d = c + 1; d < n - 2; d++) {
          for (let e = d + 1; e < n - 1; e++) {
            for (let f = e + 1; f < n; f++) {
              const ids = [compatibleTactics[a], compatibleTactics[b], compatibleTactics[c], compatibleTactics[d], compatibleTactics[e], compatibleTactics[f]].map((t) => t.id);
              const report = scoreCandidate(generalIds, ids, troop, scenario);
              if (!best || report.totalScore > best.score) best = { tacticIds: ids, score: report.totalScore, report };
            }
          }
        }
      }
    }
  }
  return best || { tacticIds: compatibleTactics.slice(0, 6).map((t) => t.id), score: 0 };
}

function pickBestTacticsGreedy(generalIds, compatibleTactics, troop, scenario) {
  const scored = compatibleTactics.map((t) => {
    const solo = scoreCandidate(generalIds, [t.id], troop, scenario);
    return { tactic: t, soloScore: solo.totalScore };
  });
  scored.sort((a, b) => b.soloScore - a.soloScore);
  const picked = [];
  const pickedIds = new Set();
  const candidates = scored.slice(0, 16);
  while (picked.length < TACTICS_PER_LINEUP && candidates.length > 0) {
    let bestAdd = null;
    let bestScore = -1;
    for (const c of candidates) {
      if (pickedIds.has(c.tactic.id)) continue;
      const testIds = [...picked.map((p) => p.tactic.id), c.tactic.id];
      const report = scoreCandidate(generalIds, testIds, troop, scenario);
      if (report.totalScore > bestScore) { bestScore = report.totalScore; bestAdd = c; }
    }
    if (!bestAdd) break;
    picked.push(bestAdd);
    pickedIds.add(bestAdd.tactic.id);
  }
  const tacticIds = picked.map((p) => p.tactic.id);
  const report = scoreCandidate(generalIds, tacticIds, troop, scenario);
  return { tacticIds, score: report.totalScore, report };
}

function bestTroopForGenerals(generalIds) {
  const generals = generalIds.map(getGeneral).filter(Boolean);
  let bestTroop = "骑兵";
  let bestTotal = -1;
  for (const troop of TROOPS) {
    const key = { 骑兵: "cavalry", 盾兵: "shield", 弓兵: "bow", 枪兵: "spear" }[troop];
    const total = generals.reduce((sum, g) => {
      const rank = g.arms ? g.arms[key] || "" : "";
      return sum + (APTITUDE_SCORE[rank] || 55);
    }, 0);
    if (total > bestTotal) { bestTotal = total; bestTroop = troop; }
  }
  return bestTroop;
}

export function optimizeLineups(inventory) {
  const catalogContext = inventory.catalogContext || null;
  const options = inventory.options || {};
  const targetLineupCount = normalizeTargetLineupCount(inventory.targetLineupCount);
  const excludedGeneralIds = toIdSet(options.excludedGeneralIds);
  const excludedTacticIds = toIdSet(options.excludedTacticIds);
  const lockedGeneralIds = toIdSet(options.lockedGeneralIds);
  const lockedTacticIds = toIdSet(options.lockedTacticIds);
  const preferredTroop = TROOPS.includes(options.preferredTroop) ? options.preferredTroop : "";
  const warnings = [];
  const generalIds = (inventory.generalIds || []).filter(Boolean).map(String).filter((id) => !excludedGeneralIds.has(id));
  const tacticIds = (inventory.tacticIds || []).filter(Boolean).map(String).filter((id) => !excludedTacticIds.has(id));
  const scenario = inventory.scenario || "pk";

  if (excludedGeneralIds.size) warnings.push(`已排除 ${excludedGeneralIds.size} 名武将，不参与本次配将。`);
  if (excludedTacticIds.size) warnings.push(`已排除 ${excludedTacticIds.size} 个战法，不参与本次配将。`);
  if (lockedGeneralIds.size || lockedTacticIds.size) warnings.push("一期配将已接收锁定条件，但暂不做复杂跨队锁位；建议通过库存范围控制本次推荐。");
  if (options.preferredTroop && !preferredTroop) warnings.push(`暂不支持兵种偏好：${options.preferredTroop}，已自动选择最佳兵种。`);

  const emptyContext = { catalogContext, targetLineupCount, generalIds, tacticIds, warnings };

  if (generalIds.length < GENERALS_PER_LINEUP) return emptyResult("insufficient", `至少需要 ${GENERALS_PER_LINEUP} 名武将才能组建一队。当前 ${generalIds.length} 名。`, emptyContext);
  if (tacticIds.length < TACTICS_PER_LINEUP) return emptyResult("insufficient", `至少需要 ${TACTICS_PER_LINEUP} 个战法才能组建一队。当前 ${tacticIds.length} 个。`, emptyContext);

  const generalCombos = combinations3(generalIds);
  const availableTactics = new Set(tacticIds);
  const usedTactics = new Set();
  const resultLineups = [];

  for (let round = 0; round < targetLineupCount; round++) {
    const remainingTactics = [...availableTactics].filter((id) => !usedTactics.has(id));
    if (remainingTactics.length < TACTICS_PER_LINEUP) break;
    let bestCombo = null;
    let bestResult = null;
    const usedGenerals = new Set(resultLineups.flatMap((l) => l.generalIds));
    for (const combo of generalCombos) {
      const comboIds = combo.map((g) => (typeof g === "object" ? g.id : g)).map(String);
      if (comboIds.some((id) => usedGenerals.has(id))) continue;
      const troop = chooseTroop(comboIds, preferredTroop);
      const result = pickBestTactics(comboIds, remainingTactics, troop, scenario);
      if (result.insufficient && preferredTroop) {
        const fallbackTroop = bestTroopForGenerals(comboIds);
        const fallbackResult = pickBestTactics(comboIds, remainingTactics, fallbackTroop, scenario);
        if (!fallbackResult.insufficient && (!bestResult || fallbackResult.score > bestResult.score)) {
          bestCombo = comboIds;
          bestResult = fallbackResult;
          bestResult.troop = fallbackTroop;
        }
        continue;
      }
      if (result.insufficient) continue;
      if (!bestResult || result.score > bestResult.score) { bestCombo = comboIds; bestResult = result; bestResult.troop = troop; }
    }
    if (!bestCombo || !bestResult) break;
    for (const tid of bestResult.tacticIds) usedTactics.add(String(tid));
    const report = bestResult.report || scoreCandidate(bestCombo, bestResult.tacticIds, bestResult.troop, scenario);
    const generalNames = bestCombo.map(getGeneral).filter(Boolean).map((g) => g.name);
    const tacticNames = bestResult.tacticIds.map(getTactic).filter(Boolean).map((t) => t.name);
    const lineup = {
      priority: round + 1,
      rank: round + 1,
      role: round === 0 ? "主力" : round === 1 ? "二队" : "三队",
      generalIds: bestCombo,
      generals: generalNames,
      tacticIds: bestResult.tacticIds,
      tactics: tacticNames,
      troop: bestResult.troop,
      scenario,
      score: report.totalScore,
      dimensions: report.dimensions || {},
      weaknesses: report.weaknesses || [],
      confidence: report.confidence,
      alternatives: report.replacements || [],
      assumptions: report.assumptions || [],
      ruleCoverage: report.analysisSignals ? report.analysisSignals.ruleCoverage : undefined
    };
    lineup.reasons = buildLineupReasons(lineup, report, preferredTroop);
    resultLineups.push(lineup);
  }

  if (resultLineups.length === 0) return emptyResult("no_solution", "当前库存无法组建有效阵容。可能缺少足够的兵种适性匹配或战法。", emptyContext);

  const tacticUsage = {};
  for (const lineup of resultLineups) {
    for (const tid of lineup.tacticIds) {
      if (!tacticUsage[tid]) tacticUsage[tid] = [];
      tacticUsage[tid].push(lineup.role);
    }
  }
  const conflicts = Object.entries(tacticUsage).filter(([, roles]) => roles.length > 1).map(([tid, roles]) => ({ tactic: getTactic(tid), tacticName: (getTactic(tid) || {}).name || tid, usedBy: roles }));
  const unusedGenerals = generalIds.filter((id) => !resultLineups.some((l) => l.generalIds.includes(id)));
  const unusedTactics = tacticIds.filter((id) => !usedTactics.has(id));

  return {
    status: "ok",
    message: `成功生成 ${resultLineups.length} 套共存阵容。`,
    catalogContext,
    summary: buildSummary(targetLineupCount, resultLineups, conflicts),
    lineups: resultLineups,
    conflicts,
    unused: {
      generalIds: unusedGenerals,
      tacticIds: unusedTactics,
      generals: formatUnusedGeneralIds(unusedGenerals),
      tactics: formatUnusedTacticIds(unusedTactics)
    },
    warnings
  };
}

export default { optimizeLineups, MAX_LINEUPS, GENERALS_PER_LINEUP, TACTICS_PER_LINEUP };
