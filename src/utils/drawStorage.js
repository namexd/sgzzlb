import { getStorage, setStorage, removeStorage } from "./storage";
import * as api from "../services/api";

const DEFAULT_POOL_NAME = "主卡池";
export const SEASON_LENGTH_DAYS = 75;
export const QUALITY_MAP = { orange: "橙", purple: "紫", blue: "蓝" };
export const DRAW_TYPE_MAP = { free: "免费", half: "半价" };

function uid() {
  return "dr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateObj(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  if (formatDateObj(d) !== value) return null;
  return d;
}

function addDays(dateStr, days) {
  const d = parseDateString(dateStr);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return formatDateObj(d);
}

function diffDays(fromDateStr, toDateStr) {
  const from = parseDateString(fromDateStr);
  const to = parseDateString(toDateStr);
  if (!from || !to) return 0;
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / oneDay);
}

export function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Pool CRUD
export function getPools() {
  return getStorage("drawPools") || [];
}

function savePools(pools) {
  setStorage("drawPools", pools);
}

export function ensureDefaultPool() {
  const pools = getPools();
  if (pools.length === 0) {
    const defaultPool = { id: uid(), name: DEFAULT_POOL_NAME, createdAt: new Date().toISOString() };
    savePools([defaultPool]);
    return defaultPool;
  }
  return pools[0];
}

export function createPool(name) {
  const pools = getPools();
  const pool = { id: uid(), name: name || DEFAULT_POOL_NAME, createdAt: new Date().toISOString() };
  pools.push(pool);
  savePools(pools);
  return pool;
}

export function deletePool(poolId) {
  const pools = getPools().filter(p => p.id !== poolId);
  savePools(pools);
  removeStorage(`drawRecords_${poolId}`);
}

// Record CRUD
export function getRecords(poolId) {
  return getStorage(`drawRecords_${poolId}`) || [];
}

function saveRecords(poolId, records) {
  setStorage(`drawRecords_${poolId}`, records);
}

export function addRecord(poolId, record) {
  const records = getRecords(poolId);
  const item = {
    id: uid(),
    poolId,
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

export function deleteRecord(poolId, recordId) {
  const records = getRecords(poolId).filter(r => r.id !== recordId);
  saveRecords(poolId, records);
}

function getSeasonById(seasonId) {
  if (!seasonId) return null;
  return getSeasons().find(s => s.id === seasonId) || null;
}

function recordInSeason(record, season) {
  if (!record || !season) return false;
  if (record.seasonId) return record.seasonId === season.id;
  if (!record.date) return false;
  if (record.date < season.startDate) return false;
  if (season.endDate && record.date > season.endDate) return false;
  return true;
}

export function getSeasonRecords(poolId, seasonId) {
  const season = getSeasonById(seasonId);
  if (!season) return [];
  return getRecords(poolId).filter(record => recordInSeason(record, season));
}

// Pity counter
export function getPityCounter(poolId, seasonId) {
  const records = seasonId ? getSeasonRecords(poolId, seasonId) : getRecords(poolId);
  let count = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].quality === "orange") break;
    count++;
  }
  return count;
}

export function getPityInfo(poolId, seasonId) {
  const counter = getPityCounter(poolId, seasonId);
  return {
    total: 30,
    current: counter,
    remaining: Math.max(0, 30 - counter),
    guaranteedAt: counter > 0 ? counter : null
  };
}

// Draw window
export function getDrawWindow() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const minutes = h * 60 + m;

  const dayStart = 5 * 60;
  const group1End = 16 * 60 + 29;
  const group2End = 29 * 60 + 59;

  let adjusted = minutes - dayStart;
  if (adjusted < 0) adjusted += 24 * 60;

  let activeGroup = null;
  if (adjusted >= 0 && adjusted <= group1End - dayStart) {
    activeGroup = 1;
  } else if (adjusted > group1End - dayStart && adjusted <= group2End - dayStart) {
    activeGroup = 2;
  }

  return { activeGroup, group1Open: adjusted >= 0 && adjusted <= group2End - dayStart };
}

export function getDrawDate() {
  const now = new Date();
  if (now.getHours() < 5) now.setDate(now.getDate() - 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getTodayGroupRecords(poolId) {
  const date = getDrawDate();
  const records = getRecords(poolId);
  return {
    group1: records.filter(r => r.date === date && r.group === 1),
    group2: records.filter(r => r.date === date && r.group === 2)
  };
}

// Calendar
export function buildCalendarDays(poolId, year, month, seasonId) {
  const records = seasonId ? getSeasonRecords(poolId, seasonId) : getRecords(poolId);
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const monthRecords = records.filter(r => r.date && r.date.indexOf(prefix) === 0);

  const byDate = {};
  monthRecords.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = { count: 0, hasOrange: false, records: [] };
    byDate[r.date].count++;
    if (r.quality === "orange") byDate[r.date].hasOrange = true;
    byDate[r.date].records.push(r);
  });

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startDow = firstDay.getDay();

  const days = [];
  for (let i = 0; i < startDow; i++) days.push({ day: null, blank: true });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const info = byDate[dateStr];
    days.push({
      day: d,
      date: dateStr,
      count: info ? info.count : 0,
      hasOrange: info ? info.hasOrange : false,
      records: info ? info.records : []
    });
  }

  return {
    year, month, days,
    totalDraws: monthRecords.length,
    orangeCount: monthRecords.filter(r => r.quality === "orange").length,
    purpleCount: monthRecords.filter(r => r.quality === "purple").length,
    blueCount: monthRecords.filter(r => r.quality === "blue").length
  };
}

// Season management
const SEASONS_KEY = "drawSeasons";
const CURRENT_SEASON_KEY = "currentSeason";

export function getSeasons() {
  return getStorage(SEASONS_KEY) || [];
}

function saveSeasons(seasons) {
  setStorage(SEASONS_KEY, seasons);
}

export function getCurrentSeason() {
  return getStorage(CURRENT_SEASON_KEY) || null;
}

export function setCurrentSeason(seasonId) {
  setStorage(CURRENT_SEASON_KEY, seasonId);
}

export function createSeason(name, startDate) {
  const seasons = getSeasons();
  const effectiveStartDate = startDate || todayStr();
  const season = {
    id: uid(),
    name: name || "S" + (seasons.length + 1),
    startDate: effectiveStartDate,
    endDate: null,
    createdAt: new Date().toISOString()
  };
  const updated = seasons.map(s => {
    if (!s.endDate) return { ...s, endDate: effectiveStartDate };
    return s;
  });
  updated.push(season);
  saveSeasons(updated);
  setCurrentSeason(season.id);
  return season;
}

export function updateSeasonStartDate(seasonId, startDate) {
  const parsed = parseDateString(startDate);
  if (!seasonId || !parsed) return null;

  let updatedSeason = null;
  const normalizedStartDate = formatDateObj(parsed);
  const updated = getSeasons().map(s => {
    if (s.id !== seasonId) return s;
    updatedSeason = { ...s, startDate: normalizedStartDate };
    return updatedSeason;
  });

  if (!updatedSeason) return null;
  saveSeasons(updated);
  return updatedSeason;
}

export function getNextSeasonEstimate(seasonId) {
  const season = getSeasonById(seasonId);
  if (!season) return null;

  const startDate = parseDateString(season.startDate) ? season.startDate : todayStr();
  const estimateDate = addDays(startDate, SEASON_LENGTH_DAYS);
  const today = todayStr();
  const elapsedDays = Math.max(0, diffDays(startDate, today));
  const daysUntilEstimate = diffDays(today, estimateDate);

  return {
    seasonId: season.id,
    seasonName: season.name,
    startDate,
    estimateDate,
    lengthDays: SEASON_LENGTH_DAYS,
    elapsedDays,
    remainingDays: Math.max(0, daysUntilEstimate),
    overdueDays: Math.max(0, -daysUntilEstimate),
    isOverdue: daysUntilEstimate < 0,
    isDueToday: daysUntilEstimate === 0
  };
}

export function endCurrentSeason() {
  const currentId = getCurrentSeason();
  if (!currentId) return;
  const seasons = getSeasons();
  const updated = seasons.map(s => {
    if (s.id === currentId && !s.endDate) {
      return { ...s, endDate: todayStr() };
    }
    return s;
  });
  saveSeasons(updated);
  setCurrentSeason(null);
}

export function getActiveSeason() {
  const currentId = getCurrentSeason();
  if (!currentId) return null;
  const seasons = getSeasons();
  return seasons.find(s => s.id === currentId) || null;
}

export function ensureDefaultSeason() {
  const seasons = getSeasons();
  const currentId = getCurrentSeason();

  if (currentId) {
    const current = seasons.find(s => s.id === currentId);
    if (current && !current.endDate) return current;
    if (current && current.endDate) setCurrentSeason(null);
  }

  const active = seasons.find(s => !s.endDate);
  if (active) {
    setCurrentSeason(active.id);
    return active;
  }

  return createSeason();
}

// Statistics
export function getSeasonStats(poolId, seasonId) {
  const season = getSeasonById(seasonId);

  if (!season) {
    return {
      totalDraws: 0, orangeCount: 0, purpleCount: 0, blueCount: 0,
      orangeRate: 0, freeDraws: 0, halfDraws: 0,
      byMonth: [], byGroup: { group1: 0, group2: 0 }, orangeGenerals: []
    };
  }

  const seasonRecords = getSeasonRecords(poolId, seasonId);
  const orangeRecords = seasonRecords.filter(r => r.quality === "orange");

  const byMonth = {};
  seasonRecords.forEach(r => {
    const monthKey = r.date.substring(0, 7);
    if (!byMonth[monthKey]) byMonth[monthKey] = { month: monthKey, total: 0, orange: 0, purple: 0, blue: 0 };
    byMonth[monthKey].total++;
    if (r.quality === "orange") byMonth[monthKey].orange++;
    else if (r.quality === "purple") byMonth[monthKey].purple++;
    else byMonth[monthKey].blue++;
  });

  const monthStats = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));

  const generalCount = {};
  orangeRecords.forEach(r => {
    const name = r.generalName || "未记录";
    generalCount[name] = (generalCount[name] || 0) + 1;
  });
  const orangeGenerals = Object.entries(generalCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalDraws: seasonRecords.length,
    orangeCount: orangeRecords.length,
    purpleCount: seasonRecords.filter(r => r.quality === "purple").length,
    blueCount: seasonRecords.filter(r => r.quality === "blue").length,
    orangeRate: seasonRecords.length > 0 ? (orangeRecords.length / seasonRecords.length * 100).toFixed(1) : 0,
    freeDraws: seasonRecords.filter(r => r.drawType === "free").length,
    halfDraws: seasonRecords.filter(r => r.drawType === "half").length,
    byMonth: monthStats,
    byGroup: {
      group1: seasonRecords.filter(r => r.group === 1).length,
      group2: seasonRecords.filter(r => r.group === 2).length
    },
    orangeGenerals
  };
}

export function getAllTimeStats(poolId) {
  const records = getRecords(poolId);
  const orangeRecords = records.filter(r => r.quality === "orange");

  const byMonth = {};
  records.forEach(r => {
    const monthKey = r.date.substring(0, 7);
    if (!byMonth[monthKey]) byMonth[monthKey] = { month: monthKey, total: 0, orange: 0, purple: 0, blue: 0 };
    byMonth[monthKey].total++;
    if (r.quality === "orange") byMonth[monthKey].orange++;
    else if (r.quality === "purple") byMonth[monthKey].purple++;
    else byMonth[monthKey].blue++;
  });

  const monthStats = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));

  const generalCount = {};
  orangeRecords.forEach(r => {
    const name = r.generalName || "未记录";
    generalCount[name] = (generalCount[name] || 0) + 1;
  });
  const orangeGenerals = Object.entries(generalCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalDraws: records.length,
    orangeCount: orangeRecords.length,
    purpleCount: records.filter(r => r.quality === "purple").length,
    blueCount: records.filter(r => r.quality === "blue").length,
    orangeRate: records.length > 0 ? (orangeRecords.length / records.length * 100).toFixed(1) : 0,
    freeDraws: records.filter(r => r.drawType === "free").length,
    halfDraws: records.filter(r => r.drawType === "half").length,
    byMonth: monthStats,
    byGroup: {
      group1: records.filter(r => r.group === 1).length,
      group2: records.filter(r => r.group === 2).length
    },
    orangeGenerals
  };
}

// Remote sync
export async function syncToRemote() {
  if (!api.isRemoteMode()) return;
  const pools = getPools();
  const allRecords = [];
  pools.forEach(pool => {
    const records = getRecords(pool.id);
    allRecords.push(...records);
  });
  if (allRecords.length > 0) {
    await api.syncDrawRecords(allRecords);
  }
}

export async function loadFromRemote() {
  if (!api.isRemoteMode()) return;
  try {
    const poolsRes = await api.getDrawPools();
    const pools = poolsRes.items || poolsRes;
    if (pools.length > 0) {
      savePools(pools);
      for (const pool of pools) {
        const recordsRes = await api.getDrawRecords(pool.id);
        const records = recordsRes.items || recordsRes;
        saveRecords(pool.id, records);
      }
    }
  } catch (e) {
    console.error("Load from remote failed:", e);
  }
}
