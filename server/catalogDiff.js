const crypto = require("node:crypto");

const COLLECTIONS = ["generals", "tactics", "troopTactics", "equipment"];
const IGNORED_KEYS = new Set(["generatedAt", "updatedAt", "fetchedAt", "importedAt", "publishedAt", "archivedAt"]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .filter((key) => !IGNORED_KEYS.has(key))
    .sort()
    .reduce((next, key) => {
      next[key] = sortObject(value[key]);
      return next;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(sortObject(value));
}

function normalizeRecord(record = {}) {
  return sortObject(record);
}

function normalizeSnapshot(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const snapshot = {
    meta: source.meta && typeof source.meta === "object" ? clone(source.meta) : {},
    generals: Array.isArray(source.generals) ? clone(source.generals) : [],
    tactics: Array.isArray(source.tactics) ? clone(source.tactics) : [],
    troopTactics: Array.isArray(source.troopTactics) ? clone(source.troopTactics) : [],
    equipment: Array.isArray(source.equipment) ? clone(source.equipment) : []
  };
  return snapshot;
}

function getRecordId(record) {
  return String(record.id || record.name || "").trim();
}

function summarizeRecord(record = {}) {
  return {
    id: record.id || null,
    name: record.name || "未命名",
    type: record.type || record.faction || record.quality || "",
    source: record.source || record.sourceGeneral || ""
  };
}

function getChangedFields(before = {}, after = {}) {
  const fields = new Set([...Object.keys(before), ...Object.keys(after)].filter((key) => !IGNORED_KEYS.has(key)));
  return [...fields].filter((key) => stableStringify(before[key]) !== stableStringify(after[key]));
}

function toRecordMap(records) {
  return records.reduce((map, record, index) => {
    const id = getRecordId(record) || `__index_${index}`;
    map.set(id, record);
    return map;
  }, new Map());
}

function diffCollection(beforeRecords = [], afterRecords = []) {
  const beforeMap = toRecordMap(beforeRecords);
  const afterMap = toRecordMap(afterRecords);
  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  for (const [id, after] of afterMap.entries()) {
    const before = beforeMap.get(id);
    if (!before) {
      added.push(summarizeRecord(after));
      continue;
    }
    if (stableStringify(normalizeRecord(before)) === stableStringify(normalizeRecord(after))) {
      unchanged.push(summarizeRecord(after));
      continue;
    }
    changed.push({
      id: after.id || before.id || id,
      name: after.name || before.name || "未命名",
      before: summarizeRecord(before),
      after: summarizeRecord(after),
      changedFields: getChangedFields(before, after)
    });
  }

  for (const [id, before] of beforeMap.entries()) {
    if (!afterMap.has(id)) removed.push(summarizeRecord(before));
  }

  return {
    added,
    changed,
    removed,
    unchanged,
    counts: {
      added: added.length,
      changed: changed.length,
      removed: removed.length,
      unchanged: unchanged.length
    }
  };
}

function countSnapshot(snapshot = {}) {
  const normalized = normalizeSnapshot(snapshot);
  return COLLECTIONS.reduce((counts, key) => {
    counts[key] = normalized[key].length;
    return counts;
  }, {});
}

function summarizeDiff(diff = {}) {
  return COLLECTIONS.reduce((summary, key) => {
    const counts = diff[key] && diff[key].counts ? diff[key].counts : {};
    summary[key] = {
      added: counts.added || 0,
      changed: counts.changed || 0,
      removed: counts.removed || 0,
      unchanged: counts.unchanged || 0
    };
    return summary;
  }, {});
}

function diffCatalogs(beforeSnapshot = {}, afterSnapshot = {}) {
  const before = normalizeSnapshot(beforeSnapshot);
  const after = normalizeSnapshot(afterSnapshot);
  const diff = COLLECTIONS.reduce((result, key) => {
    result[key] = diffCollection(before[key], after[key]);
    return result;
  }, {});
  return {
    summary: summarizeDiff(diff),
    ...diff
  };
}

function hashSnapshot(snapshot = {}) {
  return crypto.createHash("sha256").update(stableStringify(normalizeSnapshot(snapshot))).digest("hex");
}

module.exports = {
  COLLECTIONS,
  normalizeSnapshot,
  diffCatalogs,
  countSnapshot,
  hashSnapshot,
  summarizeDiff,
  stableStringify
};
