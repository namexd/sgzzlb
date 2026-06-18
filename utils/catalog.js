const catalog = require("../data/catalog");

const GENERAL_SORT = {
  魏: 1,
  蜀: 2,
  吴: 3,
  群: 4
};

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function byName(a, b) {
  return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hans-CN");
}

function resolveCatalog(context = {}) {
  if (context.catalogSnapshot && typeof context.catalogSnapshot === "object") return context.catalogSnapshot;
  if (context.snapshot && typeof context.snapshot === "object") return context.snapshot;
  return catalog;
}

function getCatalog(context) {
  return resolveCatalog(context);
}

function getMeta(context) {
  return resolveCatalog(context).meta || {};
}

function getCollection(key, context) {
  const source = resolveCatalog(context);
  return Array.isArray(source[key]) ? source[key] : [];
}

function getGenerals(context) {
  return [...getCollection("generals", context)].sort((a, b) => {
    const factionDiff = (GENERAL_SORT[a.faction] || 9) - (GENERAL_SORT[b.faction] || 9);
    return factionDiff || byName(a, b);
  });
}

function getTactics(context) {
  return [...getCollection("tactics", context)].sort(byName);
}

function getEquipment(context) {
  return [...getCollection("equipment", context)].sort(byName);
}

function getTroopTactics(context) {
  return [...getCollection("troopTactics", context)].sort(byName);
}

function findGeneralById(id, context) {
  return getCollection("generals", context).find((item) => item.id === id) || null;
}

function findTacticById(id, context) {
  return (
    getCollection("tactics", context).find((item) => item.id === id) ||
    getCollection("troopTactics", context).find((item) => item.id === id) ||
    null
  );
}

function getAllTactics(context) {
  return [...getCollection("tactics", context), ...getCollection("troopTactics", context)].sort(byName);
}

function getGeneralPickerOptions(context) {
  return getGenerals(context).map((item) => `${item.faction || "?"} · ${item.name} · ${item.cost || "?"}御`);
}

function getTacticPickerOptions(context) {
  return getAllTactics(context).map((item) => `${item.quality || "-"} · ${item.type || "战法"} · ${item.name}`);
}

function searchRecords(type, keyword, context) {
  const text = normalizeText(keyword);
  const poolMap = {
    generals: getGenerals(context),
    tactics: getTactics(context),
    equipment: getEquipment(context),
    troopTactics: getTroopTactics(context)
  };
  const records = poolMap[type] || [];
  if (!text) return records;
  return records.filter((item) => {
    const body = [
      item.name,
      item.faction,
      item.quality,
      item.type,
      item.source,
      item.sourceGeneral,
      item.description,
      item.tactics && item.tactics.innate,
      item.tactics && item.tactics.inherited,
      Array.isArray(item.tags) ? item.tags.join(" ") : "",
      Array.isArray(item.troopLimit) ? item.troopLimit.join(" ") : ""
    ]
      .filter(Boolean)
      .join(" ");
    return normalizeText(body).includes(text);
  });
}

function getTacticsByNames(names, context) {
  const wanted = new Set((names || []).filter(Boolean));
  return getAllTactics(context).filter((item) => wanted.has(item.name));
}

module.exports = {
  getCatalog,
  getMeta,
  getGenerals,
  getTactics,
  getAllTactics,
  getEquipment,
  getTroopTactics,
  findGeneralById,
  findTacticById,
  getGeneralPickerOptions,
  getTacticPickerOptions,
  searchRecords,
  getTacticsByNames
};
