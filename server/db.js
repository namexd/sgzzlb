const Database = require("better-sqlite3");
const path = require("node:path");
const fs = require("node:fs");

const DEFAULT_DB_PATH = path.join(__dirname, "..", ".runtime", "app.db");

function createDatabase(dbPath) {
  const filePath = dbPath || DEFAULT_DB_PATH;
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(filePath);

  // Enable WAL mode for better concurrent read performance
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      openid TEXT UNIQUE,
      nickname TEXT DEFAULT '',
      tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
      tier_expires_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS draw_pools (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS draw_records (
      id TEXT PRIMARY KEY,
      pool_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      quality TEXT NOT NULL CHECK (quality IN ('orange', 'purple', 'blue')),
      general_name TEXT DEFAULT '',
      draw_type TEXT NOT NULL CHECK (draw_type IN ('free', 'half')),
      group_num INTEGER NOT NULL CHECK (group_num IN (1, 2)),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (pool_id) REFERENCES draw_pools(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lineups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      scenario TEXT DEFAULT '',
      troop TEXT DEFAULT '',
      score INTEGER,
      generals TEXT DEFAULT '[]',
      tactics TEXT DEFAULT '[]',
      source TEXT DEFAULT 'mini-program',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_draw_pools_user ON draw_pools(user_id);
    CREATE INDEX IF NOT EXISTS idx_draw_records_pool ON draw_records(pool_id);
    CREATE INDEX IF NOT EXISTS idx_draw_records_user ON draw_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_draw_records_date ON draw_records(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_lineups_user ON lineups(user_id);

    CREATE TABLE IF NOT EXISTS battle_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      own_lineup_id TEXT DEFAULT NULL,
      own_generals TEXT DEFAULT '[]',
      own_tactics TEXT DEFAULT '[]',
      own_troop TEXT DEFAULT '',
      own_score INTEGER DEFAULT 0,
      enemy_generals TEXT DEFAULT '[]',
      enemy_tactics TEXT DEFAULT '[]',
      enemy_troop TEXT DEFAULT '',
      enemy_score INTEGER DEFAULT 0,
      result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
      damage_taken INTEGER DEFAULT 0,
      damage_dealt INTEGER DEFAULT 0,
      rounds INTEGER DEFAULT 0,
      note TEXT DEFAULT '',
      battle_date TEXT DEFAULT (date('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_battle_reports_user ON battle_reports(user_id);
    CREATE INDEX IF NOT EXISTS idx_battle_reports_date ON battle_reports(user_id, battle_date);
  `);

  return db;
}

// User operations
function getOrCreateUser(db, openid) {
  let user = db.prepare("SELECT * FROM users WHERE openid = ?").get(openid);
  if (!user) {
    const id = "user_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    db.prepare("INSERT INTO users (id, openid) VALUES (?, ?)").run(id, openid);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  }
  return user;
}

// Draw pool operations
function getDrawPools(db, userId) {
  return db.prepare("SELECT * FROM draw_pools WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

function createDrawPool(db, userId, name) {
  const id = "pool_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  db.prepare("INSERT INTO draw_pools (id, user_id, name) VALUES (?, ?, ?)").run(id, userId, name);
  return db.prepare("SELECT * FROM draw_pools WHERE id = ?").get(id);
}

function deleteDrawPool(db, poolId, userId) {
  const pool = db.prepare("SELECT * FROM draw_pools WHERE id = ? AND user_id = ?").get(poolId, userId);
  if (!pool) return { deleted: 0, recordsDeleted: 0 };

  const recordsDeleted = db.prepare("SELECT COUNT(*) as cnt FROM draw_records WHERE pool_id = ?").get(poolId).cnt;
  db.prepare("DELETE FROM draw_records WHERE pool_id = ?").run(poolId);
  db.prepare("DELETE FROM draw_pools WHERE id = ?").run(poolId);

  return { deleted: 1, recordsDeleted };
}

// Draw record operations
function getDrawRecords(db, poolId, userId) {
  return db.prepare("SELECT * FROM draw_records WHERE pool_id = ? AND user_id = ? ORDER BY created_at DESC").all(poolId, userId);
}

function getAllDrawRecords(db, userId) {
  return db.prepare("SELECT * FROM draw_records WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

function addDrawRecord(db, userId, record) {
  const id = record.id || "dr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO draw_records (id, pool_id, user_id, date, time, quality, general_name, draw_type, group_num)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, record.poolId, userId, record.date, record.time, record.quality, record.generalName || "", record.drawType, record.group);
  return db.prepare("SELECT * FROM draw_records WHERE id = ?").get(id);
}

function deleteDrawRecord(db, recordId, userId) {
  const result = db.prepare("DELETE FROM draw_records WHERE id = ? AND user_id = ?").run(recordId, userId);
  return { deleted: result.changes };
}

function syncDrawRecords(db, userId, records) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO draw_records (id, pool_id, user_id, date, time, quality, general_name, draw_type, group_num)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let added = 0;
  const insertMany = db.transaction((items) => {
    for (const r of items) {
      const id = r.id || "dr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const result = stmt.run(id, r.poolId, userId, r.date, r.time, r.quality, r.generalName || "", r.drawType, r.group);
      if (result.changes > 0) added++;
    }
  });

  insertMany(records);

  const total = db.prepare("SELECT COUNT(*) as cnt FROM draw_records WHERE user_id = ?").get(userId).cnt;
  return { added, total };
}

// Lineup operations (migrate from JSON store)
// Subscription operations
function getUserTier(db, userId) {
  const user = db.prepare("SELECT tier, tier_expires_at FROM users WHERE id = ?").get(userId);
  if (!user) return { tier: "free", expiresAt: null };
  // Check if premium has expired
  if (user.tier === "premium" && user.tier_expires_at) {
    const expiresAt = new Date(user.tier_expires_at);
    if (expiresAt < new Date()) {
      db.prepare("UPDATE users SET tier = 'free', tier_expires_at = NULL, updated_at = datetime('now') WHERE id = ?").run(userId);
      return { tier: "free", expiresAt: null };
    }
  }
  return { tier: user.tier || "free", expiresAt: user.tier_expires_at };
}

function setUserTier(db, userId, tier, expiresAt) {
  const validTier = tier === "premium" ? "premium" : "free";
  db.prepare("UPDATE users SET tier = ?, tier_expires_at = ?, updated_at = datetime('now') WHERE id = ?")
    .run(validTier, expiresAt || null, userId);
  return getUserTier(db, userId);
}

function getEntitlements(tier) {
  const premium = tier === "premium";
  return {
    tier: premium ? "premium" : "free",
    canSeeDeepExplanation: premium,
    canSeeAllReplacements: premium,
    canSaveUnlimitedLineups: premium,
    matchupLimit: premium ? 12 : 2
  };
}

// Battle report operations
function addBattleReport(db, userId, report) {
  const id = report.id || "br_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const stmt = db.prepare(`
    INSERT INTO battle_reports (id, user_id, own_lineup_id, own_generals, own_tactics, own_troop, own_score,
      enemy_generals, enemy_tactics, enemy_troop, enemy_score, result, damage_taken, damage_dealt, rounds, note, battle_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, userId,
    report.ownLineupId || null,
    JSON.stringify(report.ownGenerals || []),
    JSON.stringify(report.ownTactics || []),
    report.ownTroop || "",
    report.ownScore || 0,
    JSON.stringify(report.enemyGenerals || []),
    JSON.stringify(report.enemyTactics || []),
    report.enemyTroop || "",
    report.enemyScore || 0,
    report.result,
    report.damageTaken || 0,
    report.damageDealt || 0,
    report.rounds || 0,
    report.note || "",
    report.battleDate || new Date().toISOString().slice(0, 10)
  );
  return db.prepare("SELECT * FROM battle_reports WHERE id = ?").get(id);
}

function getBattleReports(db, userId, limit, offset) {
  const lim = Math.min(limit || 50, 200);
  const off = offset || 0;
  return db.prepare("SELECT * FROM battle_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .all(userId, lim, off);
}

function getBattleReportStats(db, userId) {
  const total = db.prepare("SELECT COUNT(*) as cnt FROM battle_reports WHERE user_id = ?").get(userId).cnt;
  const wins = db.prepare("SELECT COUNT(*) as cnt FROM battle_reports WHERE user_id = ? AND result = 'win'").get(userId).cnt;
  const losses = db.prepare("SELECT COUNT(*) as cnt FROM battle_reports WHERE user_id = ? AND result = 'loss'").get(userId).cnt;
  const draws = db.prepare("SELECT COUNT(*) as cnt FROM battle_reports WHERE user_id = ? AND result = 'draw'").get(userId).cnt;
  const avgDamage = db.prepare("SELECT AVG(damage_taken) as avg_taken, AVG(damage_dealt) as avg_dealt, AVG(rounds) as avg_rounds FROM battle_reports WHERE user_id = ?").get(userId);

  // Win rate by troop matchup
  const byTroop = db.prepare(`
    SELECT own_troop, enemy_troop,
      COUNT(*) as total,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins
    FROM battle_reports WHERE user_id = ?
    GROUP BY own_troop, enemy_troop
    ORDER BY total DESC
  `).all(userId);

  // Recent trend (last 10)
  const recent = db.prepare("SELECT result FROM battle_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 10").all(userId);
  const recentWins = recent.filter((r) => r.result === "win").length;

  return {
    total,
    wins,
    losses,
    draws,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    avgDamageTaken: Math.round(avgDamage.avg_taken || 0),
    avgDamageDealt: Math.round(avgDamage.avg_dealt || 0),
    avgRounds: Math.round(avgDamage.avg_rounds || 0),
    byTroop: byTroop.map((row) => ({
      ownTroop: row.own_troop,
      enemyTroop: row.enemy_troop,
      total: row.total,
      wins: row.wins,
      winRate: Math.round((row.wins / row.total) * 100)
    })),
    recentTrend: `${recentWins}/${recent.length}`
  };
}

function deleteBattleReport(db, reportId, userId) {
  const result = db.prepare("DELETE FROM battle_reports WHERE id = ? AND user_id = ?").run(reportId, userId);
  return { deleted: result.changes };
}

function getLineups(db, userId) {
  return db.prepare("SELECT * FROM lineups WHERE user_id = ? ORDER BY updated_at DESC").all(userId);
}

function saveLineup(db, userId, lineup) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO lineups (id, user_id, scenario, troop, score, generals, tactics, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    lineup.id, userId, lineup.scenario, lineup.troop, lineup.score,
    JSON.stringify(lineup.generals), JSON.stringify(lineup.tactics),
    lineup.source || "mini-program",
    lineup.createdAt || new Date().toISOString(),
    lineup.updatedAt || new Date().toISOString()
  );
  return db.prepare("SELECT * FROM lineups WHERE id = ?").get(lineup.id);
}

function deleteLineup(db, lineupId, userId) {
  const result = db.prepare("DELETE FROM lineups WHERE id = ? AND user_id = ?").run(lineupId, userId);
  return { deleted: result.changes };
}

module.exports = {
  createDatabase,
  getOrCreateUser,
  getDrawPools,
  createDrawPool,
  deleteDrawPool,
  getDrawRecords,
  getAllDrawRecords,
  addDrawRecord,
  deleteDrawRecord,
  syncDrawRecords,
  getLineups,
  saveLineup,
  deleteLineup,
  getUserTier,
  setUserTier,
  getEntitlements,
  addBattleReport,
  getBattleReports,
  getBattleReportStats,
  deleteBattleReport
};
