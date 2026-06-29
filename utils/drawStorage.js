var DEFAULT_POOL_NAME = "主卡池";
var SEASON_LENGTH_DAYS = 75;
var QUALITY_MAP = { orange: "橙", purple: "紫", blue: "蓝" };
var DRAW_TYPE_MAP = { free: "免费", half: "半价", five: "五连" };

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

function formatDateObj(d) {
  var yyyy = d.getFullYear();
  var mm = String(d.getMonth() + 1).padStart(2, "0");
  var dd = String(d.getDate()).padStart(2, "0");
  return yyyy + "-" + mm + "-" + dd;
}

function parseDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  var parts = value.split("-").map(Number);
  var d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (formatDateObj(d) !== value) return null;
  return d;
}

function addDays(dateStr, days) {
  var d = parseDateString(dateStr);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return formatDateObj(d);
}

function diffDays(fromDateStr, toDateStr) {
  var from = parseDateString(fromDateStr);
  var to = parseDateString(toDateStr);
  if (!from || !to) return 0;
  var oneDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / oneDay);
}

function nowTimeStr() {
  var d = new Date();
  var hh = String(d.getHours()).padStart(2, "0");
  var mm = String(d.getMinutes()).padStart(2, "0");
  return hh + ":" + mm;
}

// --- season management ---

var SEASONS_KEY = "drawSeasons";
var CURRENT_SEASON_KEY = "currentSeason";

function getSeasons() {
  if (!hasWx()) return [];
  try {
    return wx.getStorageSync(SEASONS_KEY) || [];
  } catch (e) {
    return [];
  }
}

function saveSeasons(seasons) {
  if (!hasWx()) return;
  try {
    wx.setStorageSync(SEASONS_KEY, seasons);
  } catch (e) {}
}

function getCurrentSeason() {
  if (!hasWx()) return null;
  try {
    return wx.getStorageSync(CURRENT_SEASON_KEY) || null;
  } catch (e) {
    return null;
  }
}

function setCurrentSeason(seasonId) {
  if (!hasWx()) return;
  try {
    wx.setStorageSync(CURRENT_SEASON_KEY, seasonId);
  } catch (e) {}
}

function createSeason(name, startDate) {
  var seasons = getSeasons();
  var effectiveStartDate = startDate || todayStr();
  var season = {
    id: uid(),
    name: name || "S" + (seasons.length + 1),
    startDate: effectiveStartDate,
    endDate: null,
    createdAt: new Date().toISOString()
  };
  var updated = seasons.map(function(s) {
    if (!s.endDate) return Object.assign({}, s, { endDate: effectiveStartDate });
    return s;
  });
  updated.push(season);
  saveSeasons(updated);
  setCurrentSeason(season.id);
  return season;
}

function updateSeasonStartDate(seasonId, startDate) {
  var parsed = parseDateString(startDate);
  if (!seasonId || !parsed) return null;

  var updatedSeason = null;
  var normalizedStartDate = formatDateObj(parsed);
  var updated = getSeasons().map(function(s) {
    if (s.id !== seasonId) return s;
    updatedSeason = Object.assign({}, s, { startDate: normalizedStartDate });
    return updatedSeason;
  });

  if (!updatedSeason) return null;
  saveSeasons(updated);
  return updatedSeason;
}

function getNextSeasonEstimate(seasonId) {
  var season = getSeasonById(seasonId);
  if (!season) return null;

  var startDate = parseDateString(season.startDate) ? season.startDate : todayStr();
  var estimateDate = addDays(startDate, SEASON_LENGTH_DAYS);
  var today = todayStr();
  var elapsedDays = Math.max(0, diffDays(startDate, today));
  var daysUntilEstimate = diffDays(today, estimateDate);

  return {
    seasonId: season.id,
    seasonName: season.name,
    startDate: startDate,
    estimateDate: estimateDate,
    lengthDays: SEASON_LENGTH_DAYS,
    elapsedDays: elapsedDays,
    remainingDays: Math.max(0, daysUntilEstimate),
    overdueDays: Math.max(0, -daysUntilEstimate),
    isOverdue: daysUntilEstimate < 0,
    isDueToday: daysUntilEstimate === 0
  };
}

function endCurrentSeason() {
  var currentId = getCurrentSeason();
  if (!currentId) return;
  var seasons = getSeasons();
  var updated = seasons.map(function(s) {
    if (s.id === currentId && !s.endDate) {
      return Object.assign({}, s, { endDate: todayStr() });
    }
    return s;
  });
  saveSeasons(updated);
  setCurrentSeason(null);
}

function getActiveSeason() {
  var currentId = getCurrentSeason();
  if (!currentId) return null;
  var seasons = getSeasons();
  return seasons.find(function(s) { return s.id === currentId; }) || null;
}

function ensureDefaultSeason() {
  var seasons = getSeasons();
  var currentId = getCurrentSeason();

  // If there's a current season, return it
  if (currentId) {
    var current = seasons.find(function(s) { return s.id === currentId; });
    if (current && !current.endDate) return current;
    if (current && current.endDate) setCurrentSeason(null);
  }

  // Find an active season (no end date)
  var active = seasons.find(function(s) { return !s.endDate; });
  if (active) {
    setCurrentSeason(active.id);
    return active;
  }

  // Create a new season
  return createSeason();
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
    seasonId: record.seasonId || getCurrentSeason() || null,
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

function getSeasonById(seasonId) {
  if (!seasonId) return null;
  return getSeasons().find(function(s) { return s.id === seasonId; }) || null;
}

function recordInSeason(record, season) {
  if (!record || !season) return false;
  if (record.seasonId) return record.seasonId === season.id;
  if (!record.date) return false;
  if (record.date < season.startDate) return false;
  if (season.endDate && record.date > season.endDate) return false;
  return true;
}

function getSeasonRecords(poolId, seasonId) {
  var season = getSeasonById(seasonId);
  if (!season) return [];
  return getRecords(poolId).filter(function(record) {
    return recordInSeason(record, season);
  });
}

// --- pity counter ---

function getPityCounter(poolId, seasonId) {
  var records = seasonId ? getSeasonRecords(poolId, seasonId) : getRecords(poolId);
  var count = 0;
  for (var i = records.length - 1; i >= 0; i--) {
    if (records[i].quality === "orange") break;
    count++;
  }
  return count;
}

function getPityInfo(poolId, seasonId) {
  var counter = getPityCounter(poolId, seasonId);
  var remaining = Math.max(0, 30 - counter);
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

function buildCalendarDays(poolId, year, month, seasonId) {
  var records = seasonId ? getSeasonRecords(poolId, seasonId) : getMonthRecords(poolId, year, month);
  if (seasonId) {
    var prefix = year + "-" + String(month).padStart(2, "0");
    records = records.filter(function (r) { return r.date && r.date.indexOf(prefix) === 0; });
  }

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

// --- statistics ---

function getSeasonStats(poolId, seasonId) {
  var season = getSeasonById(seasonId);

  if (!season) {
    return {
      totalDraws: 0,
      orangeCount: 0,
      purpleCount: 0,
      blueCount: 0,
      orangeRate: 0,
      freeDraws: 0,
      halfDraws: 0,
      fiveDraws: 0,
      byMonth: [],
      byGroup: { group1: 0, group2: 0 },
      orangeGenerals: []
    };
  }

  var seasonRecords = getSeasonRecords(poolId, seasonId);
  var orangeRecords = seasonRecords.filter(function(r) { return r.quality === "orange"; });

  // Group by month
  var byMonth = {};
  seasonRecords.forEach(function(r) {
    var monthKey = r.date.substring(0, 7); // YYYY-MM
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { month: monthKey, total: 0, orange: 0, purple: 0, blue: 0 };
    }
    byMonth[monthKey].total++;
    if (r.quality === "orange") byMonth[monthKey].orange++;
    else if (r.quality === "purple") byMonth[monthKey].purple++;
    else byMonth[monthKey].blue++;
  });

  // Sort months
  var monthStats = Object.values(byMonth).sort(function(a, b) {
    return a.month.localeCompare(b.month);
  });

  // Orange generals
  var generalCount = {};
  orangeRecords.forEach(function(r) {
    var name = r.generalName || "未记录";
    generalCount[name] = (generalCount[name] || 0) + 1;
  });
  var orangeGenerals = Object.entries(generalCount).map(function(entry) {
    return { name: entry[0], count: entry[1] };
  }).sort(function(a, b) { return b.count - a.count; });

  return {
    totalDraws: seasonRecords.length,
    orangeCount: orangeRecords.length,
    purpleCount: seasonRecords.filter(function(r) { return r.quality === "purple"; }).length,
    blueCount: seasonRecords.filter(function(r) { return r.quality === "blue"; }).length,
    orangeRate: seasonRecords.length > 0 ? (orangeRecords.length / seasonRecords.length * 100).toFixed(1) : 0,
    freeDraws: seasonRecords.filter(function(r) { return r.drawType === "free"; }).length,
    halfDraws: seasonRecords.filter(function(r) { return r.drawType === "half"; }).length,
    fiveDraws: seasonRecords.filter(function(r) { return r.drawType === "five"; }).length,
    byMonth: monthStats,
    byGroup: {
      group1: seasonRecords.filter(function(r) { return r.group === 1; }).length,
      group2: seasonRecords.filter(function(r) { return r.group === 2; }).length
    },
    orangeGenerals: orangeGenerals
  };
}

function getAllTimeStats(poolId) {
  var records = getRecords(poolId);
  var orangeRecords = records.filter(function(r) { return r.quality === "orange"; });

  // Group by month
  var byMonth = {};
  records.forEach(function(r) {
    var monthKey = r.date.substring(0, 7);
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { month: monthKey, total: 0, orange: 0, purple: 0, blue: 0 };
    }
    byMonth[monthKey].total++;
    if (r.quality === "orange") byMonth[monthKey].orange++;
    else if (r.quality === "purple") byMonth[monthKey].purple++;
    else byMonth[monthKey].blue++;
  });

  var monthStats = Object.values(byMonth).sort(function(a, b) {
    return a.month.localeCompare(b.month);
  });

  var generalCount = {};
  orangeRecords.forEach(function(r) {
    var name = r.generalName || "未记录";
    generalCount[name] = (generalCount[name] || 0) + 1;
  });
  var orangeGenerals = Object.entries(generalCount).map(function(entry) {
    return { name: entry[0], count: entry[1] };
  }).sort(function(a, b) { return b.count - a.count; });

  return {
    totalDraws: records.length,
    orangeCount: orangeRecords.length,
    purpleCount: records.filter(function(r) { return r.quality === "purple"; }).length,
    blueCount: records.filter(function(r) { return r.quality === "blue"; }).length,
    orangeRate: records.length > 0 ? (orangeRecords.length / records.length * 100).toFixed(1) : 0,
    freeDraws: records.filter(function(r) { return r.drawType === "free"; }).length,
    halfDraws: records.filter(function(r) { return r.drawType === "half"; }).length,
    fiveDraws: records.filter(function(r) { return r.drawType === "five"; }).length,
    byMonth: monthStats,
    byGroup: {
      group1: records.filter(function(r) { return r.group === 1; }).length,
      group2: records.filter(function(r) { return r.group === 2; }).length
    },
    orangeGenerals: orangeGenerals
  };
}

function getSeasonByIdFromList(seasons, seasonId) {
  if (!seasonId) return null;
  return (seasons || []).find(function(s) { return s.id === seasonId; }) || null;
}

function getActiveSeasonFromList(seasons) {
  return (seasons || []).find(function(s) { return !s.endDate; }) || null;
}

function getSeasonRecordsFromRecords(records, seasons, seasonId) {
  var season = getSeasonByIdFromList(seasons, seasonId);
  if (!season) return [];
  return (records || []).filter(function(record) {
    return recordInSeason(record, season);
  });
}

function getPityInfoFromRecords(records, seasons, seasonId) {
  var scoped = seasonId ? getSeasonRecordsFromRecords(records, seasons, seasonId) : (records || []);
  var count = 0;
  for (var i = scoped.length - 1; i >= 0; i--) {
    if (scoped[i].quality === "orange") break;
    count++;
  }
  return {
    total: 30,
    current: count,
    remaining: Math.max(0, 30 - count),
    guaranteedAt: count > 0 ? count : null
  };
}

function buildCalendarDaysFromRecords(records, year, month, seasons, seasonId) {
  var scoped = seasonId ? getSeasonRecordsFromRecords(records, seasons, seasonId) : (records || []);
  var prefix = year + "-" + String(month).padStart(2, "0");
  scoped = scoped.filter(function(r) { return r.date && r.date.indexOf(prefix) === 0; });

  var byDate = {};
  scoped.forEach(function(r) {
    if (!byDate[r.date]) byDate[r.date] = { count: 0, hasOrange: false, records: [] };
    byDate[r.date].count++;
    if (r.quality === "orange") byDate[r.date].hasOrange = true;
    byDate[r.date].records.push(r);
  });

  var firstDay = new Date(year, month - 1, 1);
  var lastDay = new Date(year, month, 0);
  var daysInMonth = lastDay.getDate();
  var startDow = firstDay.getDay();
  var days = [];

  for (var i = 0; i < startDow; i++) {
    days.push({ day: null, blank: true });
  }

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
    totalDraws: scoped.length,
    orangeCount: scoped.filter(function(r) { return r.quality === "orange"; }).length,
    purpleCount: scoped.filter(function(r) { return r.quality === "purple"; }).length,
    blueCount: scoped.filter(function(r) { return r.quality === "blue"; }).length
  };
}

function buildStatsFromRecords(records) {
  var scoped = records || [];
  var orangeRecords = scoped.filter(function(r) { return r.quality === "orange"; });
  var byMonth = {};
  scoped.forEach(function(r) {
    var monthKey = String(r.date || "").substring(0, 7);
    if (!monthKey) return;
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { month: monthKey, total: 0, orange: 0, purple: 0, blue: 0 };
    }
    byMonth[monthKey].total++;
    if (r.quality === "orange") byMonth[monthKey].orange++;
    else if (r.quality === "purple") byMonth[monthKey].purple++;
    else byMonth[monthKey].blue++;
  });

  var generalCount = {};
  orangeRecords.forEach(function(r) {
    var name = r.generalName || "未记录";
    generalCount[name] = (generalCount[name] || 0) + 1;
  });

  return {
    totalDraws: scoped.length,
    orangeCount: orangeRecords.length,
    purpleCount: scoped.filter(function(r) { return r.quality === "purple"; }).length,
    blueCount: scoped.filter(function(r) { return r.quality === "blue"; }).length,
    orangeRate: scoped.length > 0 ? (orangeRecords.length / scoped.length * 100).toFixed(1) : 0,
    freeDraws: scoped.filter(function(r) { return r.drawType === "free"; }).length,
    halfDraws: scoped.filter(function(r) { return r.drawType === "half"; }).length,
    fiveDraws: scoped.filter(function(r) { return r.drawType === "five"; }).length,
    byMonth: Object.values(byMonth).sort(function(a, b) { return a.month.localeCompare(b.month); }),
    byGroup: {
      group1: scoped.filter(function(r) { return Number(r.group) === 1; }).length,
      group2: scoped.filter(function(r) { return Number(r.group) === 2; }).length
    },
    orangeGenerals: Object.entries(generalCount).map(function(entry) {
      return { name: entry[0], count: entry[1] };
    }).sort(function(a, b) { return b.count - a.count; })
  };
}

function getSeasonStatsFromRecords(records, seasons, seasonId) {
  return buildStatsFromRecords(getSeasonRecordsFromRecords(records, seasons, seasonId));
}

function getAllTimeStatsFromRecords(records) {
  return buildStatsFromRecords(records || []);
}

function getNextSeasonEstimateFromSeason(season) {
  if (!season) return null;
  var startDate = parseDateString(season.startDate) ? season.startDate : todayStr();
  var estimateDate = addDays(startDate, SEASON_LENGTH_DAYS);
  var today = todayStr();
  var elapsedDays = Math.max(0, diffDays(startDate, today));
  var daysUntilEstimate = diffDays(today, estimateDate);

  return {
    seasonId: season.id,
    seasonName: season.name,
    startDate: startDate,
    estimateDate: estimateDate,
    lengthDays: SEASON_LENGTH_DAYS,
    elapsedDays: elapsedDays,
    remainingDays: Math.max(0, daysUntilEstimate),
    overdueDays: Math.max(0, -daysUntilEstimate),
    isOverdue: daysUntilEstimate < 0,
    isDueToday: daysUntilEstimate === 0
  };
}

module.exports = {
  SEASON_LENGTH_DAYS: SEASON_LENGTH_DAYS,
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
  getSeasonRecords: getSeasonRecords,
  addRecord: addRecord,
  deleteRecord: deleteRecord,
  getPityCounter: getPityCounter,
  getPityInfo: getPityInfo,
  getDrawWindow: getDrawWindow,
  getDrawDate: getDrawDate,
  getTodayGroupRecords: getTodayGroupRecords,
  buildCalendarDays: buildCalendarDays,
  // Season management
  getSeasons: getSeasons,
  getCurrentSeason: getCurrentSeason,
  setCurrentSeason: setCurrentSeason,
  createSeason: createSeason,
  updateSeasonStartDate: updateSeasonStartDate,
  getNextSeasonEstimate: getNextSeasonEstimate,
  endCurrentSeason: endCurrentSeason,
  getActiveSeason: getActiveSeason,
  ensureDefaultSeason: ensureDefaultSeason,
  // Statistics
  getSeasonStats: getSeasonStats,
  getAllTimeStats: getAllTimeStats,
  getActiveSeasonFromList: getActiveSeasonFromList,
  getSeasonRecordsFromRecords: getSeasonRecordsFromRecords,
  getPityInfoFromRecords: getPityInfoFromRecords,
  buildCalendarDaysFromRecords: buildCalendarDaysFromRecords,
  getSeasonStatsFromRecords: getSeasonStatsFromRecords,
  getAllTimeStatsFromRecords: getAllTimeStatsFromRecords,
  getNextSeasonEstimateFromSeason: getNextSeasonEstimateFromSeason
};
