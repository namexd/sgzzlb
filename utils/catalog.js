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

function getCatalog() {
  return catalog;
}

function getMeta() {
  return catalog.meta || {};
}

function getGenerals() {
  return [...catalog.generals].sort((a, b) => {
    const factionDiff = (GENERAL_SORT[a.faction] || 9) - (GENERAL_SORT[b.faction] || 9);
    return factionDiff || byName(a, b);
  });
}

function getTactics() {
  return [...catalog.tactics].sort(byName);
}

function getEquipment() {
  return [...catalog.equipment].sort(byName);
}

function getTroopTactics() {
  return [...catalog.troopTactics].sort(byName);
}

function findGeneralById(id) {
  return catalog.generals.find((item) => item.id === id) || null;
}

function findTacticById(id) {
  return (
    catalog.tactics.find((item) => item.id === id) ||
    catalog.troopTactics.find((item) => item.id === id) ||
    null
  );
}

function getAllTactics() {
  return [...catalog.tactics, ...catalog.troopTactics].sort(byName);
}

function getGeneralPickerOptions() {
  return getGenerals().map((item) => `${item.faction || "?"} · ${item.name} · ${item.cost || "?"}御`);
}

function getTacticPickerOptions() {
  return getAllTactics().map((item) => `${item.quality || "-"} · ${item.type || "战法"} · ${item.name}`);
}

function searchRecords(type, keyword) {
  const text = normalizeText(keyword);
  const poolMap = {
    generals: getGenerals(),
    tactics: getTactics(),
    equipment: getEquipment(),
    troopTactics: getTroopTactics()
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

function getTacticsByNames(names) {
  const wanted = new Set((names || []).filter(Boolean));
  return getAllTactics().filter((item) => wanted.has(item.name));
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
