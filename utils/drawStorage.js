var DEFAULT_POOL_NAME = "主卡池";
var QUALITY_MAP = { orange: "橙", purple: "紫", blue: "蓝" };
var DRAW_TYPE_MAP = { free: "免费", half: "半价" };

// --- helpers ---

function hasWx() {
  return typeof wx !== "undefined" && typeof wx.getStorageSync === "function";
}

function uid() {
  return "dr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function todayStr() {
  var d = new Date();
  var yyyy = d.getFullYear();
  var mm = String(d.getMonth() + 1).padStart(2, "0");
  var dd = String(d.getDate()).padStart(2, "0");
  return yyyy + "-" + mm + "-" + dd;
}

function nowTimeStr() {
  var d = new Date();
  var hh = String(d.getHours()).padStart(2, "0");
  var mm = String(d.getMinutes()).padStart(2, "0");
  return hh + ":" + mm;
}

// --- storage keys ---

var POOLS_KEY = "drawPools";
function recordsKey(poolId) {
  return "drawRecords_" + poolId;
}

// --- pool CRUD ---

function getPools() {
  if (!hasWx()) return [];
  try {
    return wx.getStorageSync(POOLS_KEY) || [];
  } catch (e) {
    return [];
  }
}

function savePools(pools) {
  if (!hasWx()) return;
  try {
    wx.setStorageSync(POOLS_KEY, pools);
  } catch (e) {}
}

function ensureDefaultPool() {
  var pools = getPools();
  if (pools.length === 0) {
    var defaultPool = { id: uid(), name: DEFAULT_POOL_NAME, createdAt: new Date().toISOString() };
    savePools([defaultPool]);
    return defaultPool;
  }
  return pools[0];
}

function createPool(name) {
  var pools = getPools();
  var pool = { id: uid(), name: name || DEFAULT_POOL_NAME, createdAt: new Date().toISOString() };
  pools.push(pool);
  savePools(pools);
  return pool;
}

function deletePool(poolId) {
  var pools = getPools().filter(function (p) { return p.id !== poolId; });
  savePools(pools);
  try {
    wx.removeStorageSync(recordsKey(poolId));
  } catch (e) {}
}

// --- draw record CRUD ---

function getRecords(poolId) {
  if (!hasWx()) return [];
  try {
    return wx.getStorageSync(recordsKey(poolId)) || [];
  } catch (e) {
    return [];
  }
}

function saveRecords(poolId, records) {
  if (!hasWx()) return;
  try {
    wx.setStorageSync(recordsKey(poolId), records);
  } catch (e) {}
}

function addRecord(poolId, record) {
  var records = getRecords(poolId);
  var item = {
    id: uid(),
    poolId: poolId,
    date: record.date || todayStr(),
    time: record.time || nowTimeStr(),
    quality: record.quality || "blue",
    generalName: record.generalName || "",
    drawType: record.drawType || "free",
    group: record.group || 1
  };
  records.push(item);
  saveRecords(poolId, records);
  return item;
}

function deleteRecord(poolId, recordId) {
  var records = getRecords(poolId).filter(function (r) { return r.id !== recordId; });
  saveRecords(poolId, records);
}

// --- pity counter ---

function getPityCounter(poolId) {
  var records = getRecords(poolId);
  var count = 0;
  for (var i = records.length - 1; i >= 0; i--) {
    if (records[i].quality === "orange") break;
    count++;
  }
  return count;
}

function getPityInfo(poolId) {
  var counter = getPityCounter(poolId);
  var remaining = 30 - counter;
  var guaranteed = counter > 0 ? counter : null;
  return {
    total: 30,
    current: counter,
    remaining: remaining,
    guaranteedAt: guaranteed
  };
}

// --- draw window detection ---

function getDrawWindow() {
  var now = new Date();
  var h = now.getHours();
  var m = now.getMinutes();
  var minutes = h * 60 + m;

  // Day starts at 5:00. Group 1: 5:00-16:29, Group 2: 16:30-29:59 (wrapped)
  var dayStart = 5 * 60; // 300
  var group1End = 16 * 60 + 29; // 989
  var group2End = 29 * 60 + 59; // 1799

  var adjusted = minutes - dayStart;
  if (adjusted < 0) adjusted += 24 * 60;

  var activeGroup = null;
  if (adjusted >= 0 && adjusted <= group1End - dayStart) {
    activeGroup = 1;
  } else if (adjusted > group1End - dayStart && adjusted <= group2End - dayStart) {
    activeGroup = 2;
  }

  return { activeGroup: activeGroup, group1Open: adjusted >= 0 && adjusted <= group2End - dayStart, group2Open: adjusted > group1End - dayStart && adjusted <= group2End - dayStart };
}

function getDrawDate() {
  var now = new Date();
  if (now.getHours() < 5) {
    now.setDate(now.getDate() - 1);
  }
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
}

function getTodayGroupRecords(poolId) {
  var date = getDrawDate();
  var records = getRecords(poolId);
  return {
    group1: records.filter(function (r) { return r.date === date && r.group === 1; }),
    group2: records.filter(function (r) { return r.date === date && r.group === 2; })
  };
}

// --- calendar helpers ---

function getMonthRecords(poolId, year, month) {
  var records = getRecords(poolId);
  var prefix = year + "-" + String(month).padStart(2, "0");
  return records.filter(function (r) { return r.date && r.date.indexOf(prefix) === 0; });
}

function buildCalendarDays(poolId, year, month) {
  var records = getMonthRecords(poolId, year, month);

  // Group records by date
  var byDate = {};
  records.forEach(function (r) {
    if (!byDate[r.date]) byDate[r.date] = { count: 0, hasOrange: false, records: [] };
    byDate[r.date].count++;
    if (r.quality === "orange") byDate[r.date].hasOrange = true;
    byDate[r.date].records.push(r);
  });

  var firstDay = new Date(year, month - 1, 1);
  var lastDay = new Date(year, month, 0);
  var daysInMonth = lastDay.getDate();
  var startDow = firstDay.getDay(); // 0=Sun

  var days = [];

  // Leading blanks
  for (var i = 0; i < startDow; i++) {
    days.push({ day: null, blank: true });
  }

  // Month days
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = year + "-" + String(month).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    var info = byDate[dateStr];
    days.push({
      day: d,
      date: dateStr,
      count: info ? info.count : 0,
      hasOrange: info ? info.hasOrange : false,
      records: info ? info.records : []
    });
  }

  return {
    year: year,
    month: month,
    days: days,
    totalDraws: records.length,
    orangeCount: records.filter(function (r) { return r.quality === "orange"; }).length,
    purpleCount: records.filter(function (r) { return r.quality === "purple"; }).length,
    blueCount: records.filter(function (r) { return r.quality === "blue"; }).length
  };
}

module.exports = {
  QUALITY_MAP: QUALITY_MAP,
  DRAW_TYPE_MAP: DRAW_TYPE_MAP,
  uid: uid,
  todayStr: todayStr,
  nowTimeStr: nowTimeStr,
  getPools: getPools,
  ensureDefaultPool: ensureDefaultPool,
  createPool: createPool,
  deletePool: deletePool,
  getRecords: getRecords,
  addRecord: addRecord,
  deleteRecord: deleteRecord,
  getPityCounter: getPityCounter,
  getPityInfo: getPityInfo,
  getDrawWindow: getDrawWindow,
  getDrawDate: getDrawDate,
  getTodayGroupRecords: getTodayGroupRecords,
  buildCalendarDays: buildCalendarDays
};
