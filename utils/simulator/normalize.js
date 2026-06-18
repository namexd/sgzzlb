const catalog = require("../catalog");

const TROOP_KEY = {
  骑兵: "cavalry",
  盾兵: "shield",
  弓兵: "bow",
  枪兵: "spear",
  器械: "siege"
};

const APTITUDE_FACTOR = {
  S: 1.12,
  A: 1,
  B: 0.88,
  C: 0.72,
  "": 0.9
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function readNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function resolveGeneral(value, context) {
  if (!value) return null;
  if (typeof value === "object") return value;
  return catalog.findGeneralById(value, context);
}

function resolveTactic(value, context) {
  if (!value) return null;
  if (typeof value === "object") return value;
  return catalog.findTacticById(value, context);
}

function resolveEquipment(value, context) {
  if (!value) return null;
  const equipment = catalog.getEquipment(context);
  if (typeof value === "object") {
    const found = equipment.find((item) => item.id === value.id || item.name === value.name);
    return found ? { ...found, ...value, rawDetails: value.rawDetails || found.rawDetails, effect: value.effect !== undefined ? value.effect : found.effect } : value;
  }
  const text = String(value);
  return equipment.find((item) => item.id === text || item.name === text) || null;
}

function normalizeTroops(troops) {
  const source = Array.isArray(troops) ? troops : [];
  return [0, 1, 2].map((index) => {
    const value = Number(source[index]);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 10000;
  });
}

function normalizeAttributePoint(point) {
  const source = point || {};
  return {
    force: clamp(readNumber(source.force), 0, 100),
    intellect: clamp(readNumber(source.intellect !== undefined ? source.intellect : source.intelligence), 0, 100),
    command: clamp(readNumber(source.command), 0, 100),
    speed: clamp(readNumber(source.speed), 0, 100)
  };
}

function getAttributePoint(attributePoints, index) {
  if (!Array.isArray(attributePoints)) return normalizeAttributePoint(null);
  return normalizeAttributePoint(attributePoints[index]);
}

function getEquipmentText(equipment) {
  const rawDetails = Array.isArray(equipment.rawDetails)
    ? equipment.rawDetails.map((item) => `${item.key || ""}${item.value || ""}`).join(" ")
    : "";
  return [equipment.name, equipment.quality, equipment.type, equipment.effect, equipment.description, rawDetails]
    .filter(Boolean)
    .join(" ");
}

function parseTextStat(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return 0;
}

function getStatBundle(source = {}) {
  const stats = source.stats || source.attributes || source.bonus || {};
  return {
    force: readNumber(source.force !== undefined ? source.force : stats.force),
    intellect: readNumber(source.intellect !== undefined ? source.intellect : source.intelligence !== undefined ? source.intelligence : stats.intellect !== undefined ? stats.intellect : stats.intelligence),
    command: readNumber(source.command !== undefined ? source.command : stats.command),
    speed: readNumber(source.speed !== undefined ? source.speed : stats.speed)
  };
}

function getEquipmentStatBonus(equipment) {
  const direct = getStatBundle(equipment);
  const text = getEquipmentText(equipment);
  return {
    force: direct.force + parseTextStat(text, [/武力[^\d+-]*[+＋]?(\d+)/, /攻击[^\d+-]*[+＋]?(\d+)/]),
    intellect: direct.intellect + parseTextStat(text, [/智力[^\d+-]*[+＋]?(\d+)/, /谋略[^\d+-]*[+＋]?(\d+)/]),
    command: direct.command + parseTextStat(text, [/统率[^\d+-]*[+＋]?(\d+)/, /防御[^\d+-]*[+＋]?(\d+)/]),
    speed: direct.speed + parseTextStat(text, [/速度[^\d+-]*[+＋]?(\d+)/])
  };
}

function getKeywordStates(text, source) {
  const states = [];
  if (/援护|抵御/.test(text)) states.push({ type: "抵御", value: 1, remaining: 2, count: 1, source });
  if (/规避/.test(text)) states.push({ type: "规避", value: 0.25, remaining: 2, source });
  if (/洞察/.test(text)) states.push({ type: "洞察", value: 1, remaining: 2, source });
  if (/先攻/.test(text)) states.push({ type: "先攻", value: 1, remaining: 2, source });
  if (/连击/.test(text)) states.push({ type: "连击", value: 0.35, remaining: 2, source });
  if (/会心/.test(text)) states.push({ type: "会心", value: 0.12, multiplier: 1.35, remaining: 8, source });
  if (/奇谋/.test(text)) states.push({ type: "奇谋", value: 0.12, multiplier: 1.35, remaining: 8, source });
  if (/急救/.test(text)) states.push({ type: "急救", value: 70, remaining: 2, source });
  if (/休整|持续治疗/.test(text)) states.push({ type: "休整", value: 70, remaining: 2, source });
  return states;
}

function getEquipmentForPosition(equipment, index, context) {
  const source = Array.isArray(equipment) ? equipment : [];
  if (Array.isArray(source[index])) return source[index].map((item) => resolveEquipment(item, context)).filter(Boolean);
  const explicit = source
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .filter((item) => {
      const position = item.position !== undefined ? item.position : item.index !== undefined ? item.index : item.generalIndex;
      return Number(position) === index;
    })
    .map((item) => resolveEquipment(item, context))
    .filter(Boolean);
  if (explicit.length) return explicit;
  if (!source[index] || (typeof source[index] === "object" && source[index].position !== undefined)) return [];
  return [resolveEquipment(source[index], context)].filter(Boolean);
}

function getItemsForPosition(source, index, general) {
  if (!source) return [];
  if (Array.isArray(source)) {
    if (Array.isArray(source[index])) return source[index].filter(Boolean);
    if (source[index] && (source.length <= 3 || source[index].position === undefined)) return [source[index]];
    return source
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .filter((item) => {
        const position = item.position !== undefined ? item.position : item.index !== undefined ? item.index : item.generalIndex;
        return Number(position) === index || item.generalId === general.id || item.generalName === general.name;
      });
  }
  if (typeof source === "object") {
    const byIndex = source[index] || source[String(index)];
    const byGeneral = source[general.id] || source[general.name];
    return [byIndex, byGeneral].flat().filter(Boolean);
  }
  return [source];
}

function getModifierText(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  return [item.name, item.effect, item.description, item.text, item.source]
    .filter(Boolean)
    .join(" ");
}

function readChance(value, fallback = 0) {
  const number = readNumber(value, fallback);
  if (number > 1) return clamp(number / 100, 0, 1);
  return clamp(number, 0, 1);
}

function normalizePrepareModifiers(items, memberName, assumptions) {
  const result = { reducePrepareTurns: 0, skipPrepareChance: 0, sources: [] };
  items.filter(Boolean).forEach((item) => {
    const text = getModifierText(item);
    const sourceList = Array.isArray(item.sources) ? item.sources : [];
    const sourceName = item.name || item.source || text;
    sourceList.concat(sourceName ? [sourceName] : []).forEach((source) => {
      if (source && !result.sources.includes(source)) result.sources.push(source);
    });

    if (typeof item === "object") {
      result.reducePrepareTurns = Math.max(
        result.reducePrepareTurns,
        readNumber(item.reducePrepareTurns !== undefined ? item.reducePrepareTurns : item.reducePrepareRounds !== undefined ? item.reducePrepareRounds : item.prepareReduction)
      );
      result.skipPrepareChance = Math.max(
        result.skipPrepareChance,
        readChance(item.skipPrepareChance !== undefined ? item.skipPrepareChance : item.skipPrepareProbability !== undefined ? item.skipPrepareProbability : item.skipChance)
      );
    }

    const chanceMatch = text.match(/(\d+)%[^，。；]*?(?:跳过|无需|免除)[^，。；]*?准备/);
    if (chanceMatch) result.skipPrepareChance = Math.max(result.skipPrepareChance, readChance(chanceMatch[1]));
    if (/(?:跳过|无需|免除)[^，。；]*?准备/.test(text)) result.skipPrepareChance = Math.max(result.skipPrepareChance, 1);
    const reduceMatch = text.match(/(?:减少|缩短)(\d+)回合准备/);
    if (reduceMatch) result.reducePrepareTurns = Math.max(result.reducePrepareTurns, Number(reduceMatch[1]));
  });

  result.reducePrepareTurns = Math.max(0, Math.round(result.reducePrepareTurns));
  if (result.sources.length && (result.reducePrepareTurns > 0 || result.skipPrepareChance > 0)) {
    assumptions.push(`${memberName} ${result.sources.join("、")} 已按跳过准备/减少准备关键词估算。`);
  }
  return result;
}

function getPrepareModifierItems(lineup, general, index) {
  return [
    ...getItemsForPosition(lineup.prepareModifiers, index, general),
    ...getItemsForPosition(lineup.battleBooks, index, general),
    ...getItemsForPosition(lineup.books, index, general),
    ...[general.prepareModifiers, general.battleBooks, general.books].flat().filter(Boolean)
  ];
}

function applyEquipmentEffects(member, equipmentList, assumptions) {
  member.equipment = equipmentList.map((equipment) => ({ id: equipment.id, name: equipment.name, quality: equipment.quality, type: equipment.type }));
  equipmentList.forEach((equipment) => {
    const text = getEquipmentText(equipment);
    const bonus = getEquipmentStatBonus(equipment);
    member.stats.force += bonus.force;
    member.stats.intellect += bonus.intellect;
    member.stats.command += bonus.command;
    member.stats.speed += bonus.speed;
    const states = getKeywordStates(text, equipment.name || "装备");
    member.initialStates.push(...states);
    const hasBonus = Object.values(bonus).some((value) => value > 0);
    if (hasBonus || states.length) {
      assumptions.push(`${member.name} 装备 ${equipment.name || "未知装备"} 已按属性或特技关键词估算。`);
    } else {
      assumptions.push(`${member.name} 装备 ${equipment.name || "未知装备"} 暂未命中可模拟效果，仅记录装备信息。`);
    }
  });
}

function getBondBonus(description) {
  const bonus = { force: 0, intellect: 0, command: 0, speed: 0 };
  if (/武力|兵刃|会心|攻击/.test(description)) bonus.force += 5;
  if (/智力|谋略|奇谋/.test(description)) bonus.intellect += 5;
  if (/统率|减伤|防御|受到.*降低/.test(description)) bonus.command += 5;
  if (/速度|先攻/.test(description)) bonus.speed += 5;
  if (!Object.values(bonus).some(Boolean)) {
    bonus.force = 3;
    bonus.intellect = 3;
    bonus.command = 3;
    bonus.speed = 2;
  }
  return bonus;
}

function applyBondEffects(members, assumptions, enabled) {
  if (!enabled) return [];
  const byName = new Map();
  members.forEach((member) => {
    (member.general.bonds || []).forEach((bond) => {
      if (!bond || !bond.name) return;
      if (!byName.has(bond.name)) byName.set(bond.name, { bond, members: [] });
      byName.get(bond.name).members.push(member);
    });
  });
  const applied = [];
  byName.forEach(({ bond, members: bondedMembers }) => {
    if (bondedMembers.length < 3) return;
    const description = bond.description || "";
    const bonus = getBondBonus(description);
    bondedMembers.forEach((member) => {
      member.stats.force += bonus.force;
      member.stats.intellect += bonus.intellect;
      member.stats.command += bonus.command;
      member.stats.speed += bonus.speed;
      member.initialStates.push(...getKeywordStates(description, bond.name));
    });
    applied.push({ name: bond.name, members: bondedMembers.map((member) => member.name), description });
    assumptions.push(`已启用缘分 ${bond.name}，按描述关键词为相关武将估算属性或状态增益。`);
  });
  if (!applied.length) assumptions.push("已启用缘分检查，但当前三名武将未命中共同缘分。");
  return applied;
}

function normalizeBattleOptions(input = {}) {
  const morale = input.morale === undefined ? 100 : clamp(readNumber(input.morale, 100), 0, 120);
  return {
    terrain: input.terrain || "默认",
    weather: input.weather || "默认",
    morale,
    moraleProvided: input.morale !== undefined,
    terrainProvided: input.terrain !== undefined,
    weatherProvided: input.weather !== undefined
  };
}

function applyBattleOptions(members, options, assumptions, side) {
  const label = side === "own" ? "我方" : "敌方";
  if (options.moraleProvided && options.morale !== 100) {
    const factor = clamp(0.8 + (options.morale / 100) * 0.2, 0.8, 1.04);
    members.forEach((member) => {
      member.stats.force = Number((member.stats.force * factor).toFixed(1));
      member.stats.intellect = Number((member.stats.intellect * factor).toFixed(1));
      member.stats.command = Number((member.stats.command * factor).toFixed(1));
    });
    assumptions.push(`${label}士气 ${options.morale} 已按 ${factor.toFixed(2)} 系数估算到攻防属性。`);
  }
  if (options.terrainProvided && options.terrain !== "默认") {
    assumptions.push(`${label}地形 ${options.terrain} 暂未接入专属地形公式，仅记录到模拟输入。`);
  }
  if (options.weatherProvided && options.weather !== "默认") {
    assumptions.push(`${label}天气 ${options.weather} 暂未接入专属天气公式，仅记录到模拟输入。`);
  }
}

function normalizeLineup(input, side, globalBattleOptions = {}, catalogContext = {}) {
  const lineup = input || {};
  const troop = lineup.troop || "骑兵";
  const generalValues = lineup.generalIds || lineup.generals || [];
  const tacticValues = lineup.tacticIds || lineup.tactics || [];
  const redLevels = Array.isArray(lineup.redLevels) ? lineup.redLevels : [0, 0, 0];
  const troops = normalizeTroops(lineup.troops);
  const generals = generalValues.map((item) => resolveGeneral(item, catalogContext)).filter(Boolean).slice(0, 3);
  const tactics = tacticValues.map((item) => resolveTactic(item, catalogContext)).filter(Boolean);
  const battleOptions = normalizeBattleOptions({ ...globalBattleOptions, ...(lineup.battleOptions || {}) });
  const assumptions = [];

  if (generals.length < 3) {
    throw Object.assign(new Error(`${side === "own" ? "我方" : "敌方"}至少需要 3 名武将。`), { statusCode: 400 });
  }

  if (new Set(generals.map((item) => item.id || item.name)).size !== generals.length) {
    throw Object.assign(new Error(`${side === "own" ? "我方" : "敌方"}不能重复上阵同一武将。`), { statusCode: 400 });
  }

  if (tactics.length < 3) {
    assumptions.push(`${side === "own" ? "我方" : "敌方"}战法不足，缺位武将仅按普攻参与模拟。`);
  }

  const members = generals.map((general, index) => {
    const stats = general.stats || {};
    const redLevel = Number(redLevels[index]) || 0;
    const point = getAttributePoint(lineup.attributePoints, index);
    const key = TROOP_KEY[troop] || "cavalry";
    const aptitude = general.arms ? general.arms[key] || "" : "";
    const innateTactic = general.tactics && general.tactics.innate
      ? {
          id: `${general.id || general.name}-innate`,
          name: general.tactics.innate,
          quality: "S",
          type: "被动",
          source: "自带战法",
          description: general.tactics.innateDescription || ""
        }
      : null;
    const member = {
      id: `${side}-${index}`,
      side,
      position: index,
      general,
      name: general.name || `${side}-${index + 1}`,
      troop,
      aptitude,
      aptitudeFactor: APTITUDE_FACTOR[aptitude] || APTITUDE_FACTOR[""],
      maxTroops: troops[index],
      troops: troops[index],
      stats: {
        force: Number(stats.force || 70) + redLevel * 1.2 + point.force,
        intellect: Number(stats.intellect !== undefined ? stats.intellect : stats.intelligence !== undefined ? stats.intelligence : 70) + redLevel * 1.2 + point.intellect,
        command: Number(stats.command || 70) + redLevel + point.command,
        speed: Number(stats.speed || 50) + redLevel * 0.5 + point.speed
      },
      attributePoints: point,
      innateTactic,
      tactics: tactics.filter((_, tacticIndex) => Math.floor(tacticIndex / 2) === index).slice(0, 2),
      states: [],
      initialStates: [],
      disabledTactics: false,
      damageDealt: 0,
      damageTaken: 0,
      healingDone: 0,
      controlTurnsApplied: 0,
      tacticActivations: {},
      prepareModifiers: normalizePrepareModifiers(getPrepareModifierItems(lineup, general, index), general.name || `${side}-${index + 1}`, assumptions)
    };
    applyEquipmentEffects(member, getEquipmentForPosition(lineup.equipment, index, catalogContext), assumptions);
    return member;
  });

  const appliedBonds = applyBondEffects(members, assumptions, Boolean(lineup.bondEnabled));
  applyBattleOptions(members, battleOptions, assumptions, side);

  return {
    side,
    troop,
    members,
    bondEnabled: Boolean(lineup.bondEnabled),
    appliedBonds,
    battleOptions,
    assumptions
  };
}

function normalizeBattleInput(payload = {}) {
  if (!payload.own || !payload.enemy) {
    throw Object.assign(new Error("模拟需要同时提供 own 和 enemy 阵容。"), { statusCode: 400 });
  }
  const globalBattleOptions = payload.battleOptions || (payload.options && payload.options.battleOptions) || {};
  const catalogContext = payload.catalogSnapshot ? { catalogSnapshot: payload.catalogSnapshot } : {};
  const own = normalizeLineup(payload.own, "own", globalBattleOptions, catalogContext);
  const enemy = normalizeLineup(payload.enemy, "enemy", globalBattleOptions, catalogContext);
  return {
    own,
    enemy,
    catalogContext: payload.catalogContext || null,
    assumptions: [...own.assumptions, ...enemy.assumptions]
  };
}

module.exports = {
  TROOP_KEY,
  APTITUDE_FACTOR,
  normalizeBattleInput,
  normalizeLineup
};
