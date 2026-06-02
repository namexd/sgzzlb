import { getStorage, setStorage } from "./storage";
import * as api from "../services/api";

const DEFAULT_POOL_NAME = "主卡池";
export const QUALITY_MAP = { orange: "橙", purple: "紫", blue: "蓝" };
export const DRAW_TYPE_MAP = { free: "免费", half: "半价" };

function uid() {
  return "dr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

// Pity counter
export function getPityCounter(poolId) {
  const records = getRecords(poolId);
  let count = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].quality === "orange") break;
    count++;
  }
  return count;
}

export function getPityInfo(poolId) {
  const counter = getPityCounter(poolId);
  return {
    total: 30,
    current: counter,
    remaining: 30 - counter,
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
export function buildCalendarDays(poolId, year, month) {
  const records = getRecords(poolId);
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
