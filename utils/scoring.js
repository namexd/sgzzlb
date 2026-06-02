const catalog = require("./catalog");

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

function getGeneral(generalId) {
  return typeof generalId === "object" ? generalId : catalog.findGeneralById(generalId);
}

function getTactic(tacticId) {
  return typeof tacticId === "object" ? tacticId : catalog.findTacticById(tacticId);
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

function recommendTactics(selectedTactics, troop, missingRoles) {
  const selectedNames = new Set(selectedTactics.filter(Boolean).map((item) => item.name));
  const all = catalog
    .getAllTactics()
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
  const troop = input.troop || "骑兵";
  const scenario = input.scenario || "pk";
  const generals = (input.generalIds || []).map(getGeneral).filter(Boolean);
  const tactics = (input.tacticIds || []).map(getTactic).filter(Boolean);
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
    buildDimension("环境适配", scenarioScore, scenarioInfo.text)
  ];

  const totalScore = Math.round(
    dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length
  );

  const explanations = [
    dimensions[0].reason,
    dimensions[1].reason,
    dimensions[2].reason,
    scenarioInfo.text
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

  const replacements = recommendTactics(tactics, troop, missingRoles);
  const confidence = validation.length
    ? "低"
    : tactics.length < 6
      ? "中"
      : "中高";

  return {
    totalScore,
    totalCost,
    troop,
    scenario,
    scenarioName: scenarioInfo.name,
    confidence,
    validation,
    dimensions,
    explanations,
    weaknesses,
    replacements,
    premiumHints: [
      "高级订阅可展开完整替代战法池。",
      "高级订阅可批量预览主流环境队伍对位。"
    ]
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
  getAptitude,
  isTacticCompatible,
  classifyTacticText
};
