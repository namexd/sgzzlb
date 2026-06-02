import { findGeneralById, findTacticById } from "./catalog";
import { analyzeLineup, isTacticCompatible } from "./scoring";

const TROOPS = ["骑兵", "盾兵", "弓兵", "枪兵"];
const MAX_LINEUPS = 3;
const GENERALS_PER_LINEUP = 3;
const TACTICS_PER_LINEUP = 6;
const APTITUDE_SCORE = { S: 100, A: 82, B: 64, C: 42, "": 55 };

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
  const generalIds = (inventory.generalIds || []).filter(Boolean);
  const tacticIds = (inventory.tacticIds || []).filter(Boolean);
  const scenario = inventory.scenario || "pk";

  if (generalIds.length < GENERALS_PER_LINEUP) return { status: "insufficient", message: `至少需要 ${GENERALS_PER_LINEUP} 名武将才能组建一队。当前 ${generalIds.length} 名。`, lineups: [], conflicts: [] };
  if (tacticIds.length < TACTICS_PER_LINEUP) return { status: "insufficient", message: `至少需要 ${TACTICS_PER_LINEUP} 个战法才能组建一队。当前 ${tacticIds.length} 个。`, lineups: [], conflicts: [] };

  const generalCombos = combinations3(generalIds);
  const availableTactics = new Set(tacticIds);
  const usedTactics = new Set();
  const resultLineups = [];

  for (let round = 0; round < MAX_LINEUPS; round++) {
    const remainingTactics = [...availableTactics].filter((id) => !usedTactics.has(id));
    if (remainingTactics.length < TACTICS_PER_LINEUP) break;
    let bestCombo = null;
    let bestResult = null;
    const usedGenerals = new Set(resultLineups.flatMap((l) => l.generalIds));
    for (const combo of generalCombos) {
      const comboIds = combo.map((g) => (typeof g === "object" ? g.id : g));
      if (comboIds.some((id) => usedGenerals.has(id))) continue;
      const troop = bestTroopForGenerals(comboIds);
      const result = pickBestTactics(comboIds, remainingTactics, troop, scenario);
      if (result.insufficient) continue;
      if (!bestResult || result.score > bestResult.score) { bestCombo = comboIds; bestResult = result; bestResult.troop = troop; }
    }
    if (!bestCombo || !bestResult) break;
    for (const tid of bestResult.tacticIds) usedTactics.add(tid);
    const report = bestResult.report || scoreCandidate(bestCombo, bestResult.tacticIds, bestResult.troop, scenario);
    const generalNames = bestCombo.map(getGeneral).filter(Boolean).map((g) => g.name);
    const tacticNames = bestResult.tacticIds.map(getTactic).filter(Boolean).map((t) => t.name);
    resultLineups.push({ priority: round + 1, role: round === 0 ? "主力" : round === 1 ? "二队" : "三队", generalIds: bestCombo, generals: generalNames, tacticIds: bestResult.tacticIds, tactics: tacticNames, troop: bestResult.troop, scenario, score: report.totalScore, dimensions: report.dimensions, weaknesses: report.weaknesses, confidence: report.confidence });
  }

  if (resultLineups.length === 0) return { status: "no_solution", message: "当前库存无法组建有效阵容。可能缺少足够的兵种适性匹配或战法。", lineups: [], conflicts: [] };

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
    lineups: resultLineups,
    conflicts,
    unused: { generals: unusedGenerals.map(getGeneral).filter(Boolean).map((g) => ({ id: g.id, name: g.name })), tactics: unusedTactics.map(getTactic).filter(Boolean).map((t) => ({ id: t.id, name: t.name })) },
    summary: { totalLineups: resultLineups.length, totalScore: resultLineups.reduce((s, l) => s + l.score, 0), averageScore: Math.round(resultLineups.reduce((s, l) => s + l.score, 0) / resultLineups.length), conflictCount: conflicts.length }
  };
}

export default { optimizeLineups, MAX_LINEUPS, GENERALS_PER_LINEUP, TACTICS_PER_LINEUP };
