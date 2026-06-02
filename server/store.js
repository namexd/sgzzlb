const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_STORE_FILE = path.join(__dirname, "..", ".runtime", "admin-store.json");

const DEFAULT_RULES = [
  {
    id: "default-score-policy",
    name: "默认评分策略",
    enabled: true,
    description: "复用前端评分规则，后续可替换为数据库规则表。"
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultStore() {
  return {
    rules: clone(DEFAULT_RULES),
    assetAudits: [],
    lineups: [],
    drawPools: [],
    drawRecords: [],
    auditLog: []
  };
}

function normalizeStore(input = {}) {
  const defaults = createDefaultStore();
  return {
    rules: Array.isArray(input.rules) ? input.rules : defaults.rules,
    assetAudits: Array.isArray(input.assetAudits) ? input.assetAudits : defaults.assetAudits,
    lineups: Array.isArray(input.lineups) ? input.lineups : defaults.lineups,
    drawPools: Array.isArray(input.drawPools) ? input.drawPools : defaults.drawPools,
    drawRecords: Array.isArray(input.drawRecords) ? input.drawRecords : defaults.drawRecords,
    auditLog: Array.isArray(input.auditLog) ? input.auditLog : defaults.auditLog
  };
}

function snapshotStore(store) {
  return {
    rules: clone(store.rules),
    assetAudits: clone(store.assetAudits),
    lineups: clone(store.lineups),
    drawPools: clone(store.drawPools),
    drawRecords: clone(store.drawRecords),
    auditLog: clone(store.auditLog)
  };
}

function attachStoreMethods(store, options = {}) {
  const filePath = options.filePath || null;

  Object.defineProperties(store, {
    save: {
      enumerable: false,
      value() {
        if (!filePath) return;
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
        const tempPath = `${filePath}.${process.pid}.tmp`;
        fs.writeFileSync(tempPath, `${JSON.stringify(snapshotStore(store), null, 2)}\n`, "utf8");
        fs.renameSync(tempPath, filePath);
      }
    },
    reset: {
      enumerable: false,
      value() {
        const defaults = createDefaultStore();
        store.rules = defaults.rules;
        store.assetAudits = defaults.assetAudits;
        store.lineups = defaults.lineups;
        store.drawPools = defaults.drawPools;
        store.drawRecords = defaults.drawRecords;
        store.auditLog = defaults.auditLog;
      }
    },
    exportSnapshot: {
      enumerable: false,
      value() {
        return snapshotStore(store);
      }
    }
  });

  return store;
}

function createMemoryStore(initialState = {}) {
  return attachStoreMethods(normalizeStore(initialState));
}

function readStoreFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw Object.assign(new Error(`管理后台存储文件不是合法 JSON：${filePath}`), { statusCode: 500 });
  }
}

function createFileStore(filePath = DEFAULT_STORE_FILE, initialState = {}) {
  const existingState = readStoreFile(filePath);
  const store = attachStoreMethods(normalizeStore(existingState || initialState), { filePath });
  if (!existingState) store.save();
  return store;
}

function saveStore(store) {
  if (store && typeof store.save === "function") {
    store.save();
  }
}

function resetStore(store) {
  if (store && typeof store.reset === "function") {
    store.reset();
    return;
  }

  const defaults = createDefaultStore();
  store.rules = defaults.rules;
  store.assetAudits = defaults.assetAudits;
  store.lineups = defaults.lineups;
  store.auditLog = defaults.auditLog;
}

function exportStore(store) {
  if (store && typeof store.exportSnapshot === "function") {
    return store.exportSnapshot();
  }
  return snapshotStore(normalizeStore(store));
}

module.exports = {
  DEFAULT_STORE_FILE,
  createDefaultStore,
  createMemoryStore,
  createFileStore,
  saveStore,
  resetStore,
  exportStore
};
