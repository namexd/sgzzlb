const mysql = require("mysql2/promise");
const crypto = require("crypto");

const DEFAULT_CONFIG = {
  host: process.env.MYSQL_HOST || "localhost",
  port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10),
  user: process.env.MYSQL_USER || "sgzzlb",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "sgzzlb",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;

function getPool(config) {
  if (!pool) {
    pool = mysql.createPool(config || DEFAULT_CONFIG);
  }
  return pool;
}

async function createDatabase(config) {
  const p = getPool(config);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      openid VARCHAR(128) UNIQUE,
      username VARCHAR(64) UNIQUE,
      password VARCHAR(128),
      nickname VARCHAR(128) DEFAULT '',
      tier VARCHAR(16) DEFAULT 'free',
      tier_expires_at VARCHAR(32) DEFAULT NULL,
      created_at VARCHAR(32),
      updated_at VARCHAR(32)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Add columns if they don't exist (for existing databases)
  try {
    await p.execute("ALTER TABLE users ADD COLUMN username VARCHAR(64) UNIQUE");
  } catch (e) { /* column already exists */ }
  try {
    await p.execute("ALTER TABLE users ADD COLUMN password VARCHAR(128)");
  } catch (e) { /* column already exists */ }

  await p.execute(`
    CREATE TABLE IF NOT EXISTS draw_pools (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      name VARCHAR(128) NOT NULL,
      created_at VARCHAR(32),
      INDEX idx_draw_pools_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS draw_records (
      id VARCHAR(64) PRIMARY KEY,
      pool_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      date VARCHAR(16) NOT NULL,
      time VARCHAR(16) NOT NULL,
      quality VARCHAR(16) NOT NULL,
      general_name VARCHAR(64) DEFAULT '',
      draw_type VARCHAR(16) NOT NULL,
      group_num INT NOT NULL,
      created_at VARCHAR(32),
      INDEX idx_draw_records_pool (pool_id),
      INDEX idx_draw_records_user (user_id),
      INDEX idx_draw_records_date (user_id, date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS lineups (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      scenario VARCHAR(32) DEFAULT '',
      troop VARCHAR(16) DEFAULT '',
      score INT DEFAULT NULL,
      generals TEXT,
      tactics TEXT,
      source VARCHAR(32) DEFAULT 'mini-program',
      created_at VARCHAR(32),
      updated_at VARCHAR(32),
      INDEX idx_lineups_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS battle_reports (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      own_lineup_id VARCHAR(64) DEFAULT NULL,
      own_generals TEXT,
      own_tactics TEXT,
      own_troop VARCHAR(16) DEFAULT '',
      own_score INT DEFAULT 0,
      enemy_generals TEXT,
      enemy_tactics TEXT,
      enemy_troop VARCHAR(16) DEFAULT '',
      enemy_score INT DEFAULT 0,
      result VARCHAR(8) NOT NULL,
      damage_taken INT DEFAULT 0,
      damage_dealt INT DEFAULT 0,
      rounds INT DEFAULT 0,
      note TEXT,
      battle_date VARCHAR(16),
      created_at VARCHAR(32),
      INDEX idx_battle_reports_user (user_id),
      INDEX idx_battle_reports_date (user_id, battle_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS feedback (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) DEFAULT NULL,
      content TEXT NOT NULL,
      contact VARCHAR(128) DEFAULT '',
      status VARCHAR(16) DEFAULT 'pending',
      created_at VARCHAR(32),
      INDEX idx_feedback_user (user_id),
      INDEX idx_feedback_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  return p;
}

// Password hashing
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return salt + ":" + hash;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return hash === verify;
}

// Register with username/password
async function registerUser(pool, username, password, nickname) {
  // Check if username exists
  const [existing] = await pool.execute("SELECT id FROM users WHERE username = ?", [username]);
  if (existing.length > 0) {
    return { error: "用户名已存在" };
  }

  const id = "user_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const hashedPassword = hashPassword(password);

  await pool.execute(
    "INSERT INTO users (id, username, password, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, username, hashedPassword, nickname || username, now, now]
  );

  const [rows] = await pool.execute("SELECT id, username, nickname, tier, created_at FROM users WHERE id = ?", [id]);
  return { user: rows[0] };
}

// Login with username/password
async function loginUser(pool, username, password) {
  const [rows] = await pool.execute("SELECT * FROM users WHERE username = ?", [username]);
  if (rows.length === 0) {
    return { error: "用户名或密码错误" };
  }

  const user = rows[0];
  if (!verifyPassword(password, user.password)) {
    return { error: "用户名或密码错误" };
  }

  // Return user without password
  const { password: _, ...safeUser } = user;
  return { user: safeUser };
}

async function getOrCreateUser(pool, openid) {
  const [rows] = await pool.execute("SELECT * FROM users WHERE openid = ?", [openid]);
  if (rows.length > 0) return rows[0];

  const id = "user_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  await pool.execute("INSERT INTO users (id, openid, created_at, updated_at) VALUES (?, ?, ?, ?)", [id, openid, now, now]);
  const [newRows] = await pool.execute("SELECT * FROM users WHERE id = ?", [id]);
  return newRows[0];
}

async function getDrawPools(pool, userId) {
  const [rows] = await pool.execute("SELECT * FROM draw_pools WHERE user_id = ? ORDER BY created_at DESC", [userId]);
  return rows;
}

async function createDrawPool(pool, userId, name) {
  const id = "pool_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  await pool.execute("INSERT INTO draw_pools (id, user_id, name, created_at) VALUES (?, ?, ?, ?)", [id, userId, name, now]);
  const [rows] = await pool.execute("SELECT * FROM draw_pools WHERE id = ?", [id]);
  return rows[0];
}

async function deleteDrawPool(pool, poolId, userId) {
  const [poolRows] = await pool.execute("SELECT * FROM draw_pools WHERE id = ? AND user_id = ?", [poolId, userId]);
  if (poolRows.length === 0) return { deleted: 0, recordsDeleted: 0 };

  const [cntRows] = await pool.execute("SELECT COUNT(*) as cnt FROM draw_records WHERE pool_id = ?", [poolId]);
  await pool.execute("DELETE FROM draw_records WHERE pool_id = ?", [poolId]);
  await pool.execute("DELETE FROM draw_pools WHERE id = ?", [poolId]);

  return { deleted: 1, recordsDeleted: cntRows[0].cnt };
}

async function getDrawRecords(pool, poolId, userId) {
  const [rows] = await pool.execute("SELECT * FROM draw_records WHERE pool_id = ? AND user_id = ? ORDER BY created_at DESC", [poolId, userId]);
  return rows;
}

async function getAllDrawRecords(pool, userId) {
  const [rows] = await pool.execute("SELECT * FROM draw_records WHERE user_id = ? ORDER BY created_at DESC", [userId]);
  return rows;
}

async function addDrawRecord(pool, userId, record) {
  // Validate pool ownership
  if (record.poolId && record.poolId !== "default") {
    const [poolRows] = await pool.execute("SELECT id FROM draw_pools WHERE id = ? AND user_id = ?", [record.poolId, userId]);
    if (poolRows.length === 0) {
      return { error: "卡池不存在或无权操作。" };
    }
  }
  const id = record.id || "dr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  await pool.execute(
    `INSERT INTO draw_records (id, pool_id, user_id, date, time, quality, general_name, draw_type, group_num, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE date=VALUES(date), time=VALUES(time), quality=VALUES(quality), general_name=VALUES(general_name)`,
    [id, record.poolId, userId, record.date, record.time, record.quality, record.generalName || "", record.drawType, record.group, now]
  );
  const [rows] = await pool.execute("SELECT * FROM draw_records WHERE id = ?", [id]);
  return rows[0];
}

async function deleteDrawRecord(pool, recordId, userId) {
  const [result] = await pool.execute("DELETE FROM draw_records WHERE id = ? AND user_id = ?", [recordId, userId]);
  return { deleted: result.affectedRows };
}

async function syncDrawRecords(pool, userId, records) {
  // Pre-validate pool ownership for all unique poolIds
  const poolIds = [...new Set(records.map(r => r.poolId).filter(id => id && id !== "default"))];
  const validPoolIds = new Set(["default"]);
  for (const pid of poolIds) {
    const [rows] = await pool.execute("SELECT id FROM draw_pools WHERE id = ? AND user_id = ?", [pid, userId]);
    if (rows.length > 0) validPoolIds.add(pid);
  }

  let added = 0;
  let skipped = 0;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  for (const r of records) {
    if (!validPoolIds.has(r.poolId)) {
      skipped++;
      continue;
    }
    const id = r.id || "dr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    try {
      await pool.execute(
        `INSERT IGNORE INTO draw_records (id, pool_id, user_id, date, time, quality, general_name, draw_type, group_num, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, r.poolId, userId, r.date, r.time, r.quality, r.generalName || "", r.drawType, r.group, now]
      );
      added++;
    } catch (e) {
      // duplicate key, skip
    }
  }

  const [cntRows] = await pool.execute("SELECT COUNT(*) as cnt FROM draw_records WHERE user_id = ?", [userId]);
  return { added, total: cntRows[0].cnt, skipped };
}

async function getUserTier(pool, userId) {
  const [rows] = await pool.execute("SELECT tier, tier_expires_at FROM users WHERE id = ?", [userId]);
  if (rows.length === 0) return { tier: "free", expiresAt: null };

  const user = rows[0];
  if (user.tier === "premium" && user.tier_expires_at) {
    const expiresAt = new Date(user.tier_expires_at);
    if (expiresAt < new Date()) {
      await pool.execute("UPDATE users SET tier = 'free', tier_expires_at = NULL, updated_at = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') WHERE id = ?", [userId]);
      return { tier: "free", expiresAt: null };
    }
  }
  return { tier: user.tier || "free", expiresAt: user.tier_expires_at };
}

async function setUserTier(pool, userId, tier, expiresAt) {
  const validTier = tier === "premium" ? "premium" : "free";
  await pool.execute("UPDATE users SET tier = ?, tier_expires_at = ?, updated_at = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') WHERE id = ?", [validTier, expiresAt || null, userId]);
  return getUserTier(pool, userId);
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

async function addBattleReport(pool, userId, report) {
  const id = report.id || "br_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const battleDate = report.battleDate || new Date().toISOString().slice(0, 10);
  await pool.execute(
    `INSERT INTO battle_reports (id, user_id, own_lineup_id, own_generals, own_tactics, own_troop, own_score,
      enemy_generals, enemy_tactics, enemy_troop, enemy_score, result, damage_taken, damage_dealt, rounds, note, battle_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
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
      battleDate,
      now
    ]
  );
  const [rows] = await pool.execute("SELECT * FROM battle_reports WHERE id = ?", [id]);
  return rows[0];
}

async function getBattleReports(pool, userId, limit, offset) {
  const lim = Math.min(limit || 50, 200);
  const off = offset || 0;
  const [rows] = await pool.execute("SELECT * FROM battle_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?", [userId, lim, off]);
  return rows;
}

async function getBattleReportStats(pool, userId) {
  const [totalRows] = await pool.execute("SELECT COUNT(*) as cnt FROM battle_reports WHERE user_id = ?", [userId]);
  const total = totalRows[0].cnt;

  const [winsRows] = await pool.execute("SELECT COUNT(*) as cnt FROM battle_reports WHERE user_id = ? AND result = 'win'", [userId]);
  const wins = winsRows[0].cnt;

  const [lossesRows] = await pool.execute("SELECT COUNT(*) as cnt FROM battle_reports WHERE user_id = ? AND result = 'loss'", [userId]);
  const losses = lossesRows[0].cnt;

  const [drawsRows] = await pool.execute("SELECT COUNT(*) as cnt FROM battle_reports WHERE user_id = ? AND result = 'draw'", [userId]);
  const draws = drawsRows[0].cnt;

  const [avgRows] = await pool.execute("SELECT AVG(damage_taken) as avg_taken, AVG(damage_dealt) as avg_dealt, AVG(rounds) as avg_rounds FROM battle_reports WHERE user_id = ?", [userId]);
  const avgDamage = avgRows[0];

  const [byTroopRows] = await pool.execute(
    `SELECT own_troop, enemy_troop, COUNT(*) as total,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins
    FROM battle_reports WHERE user_id = ?
    GROUP BY own_troop, enemy_troop ORDER BY total DESC`,
    [userId]
  );

  const [recentRows] = await pool.execute("SELECT result FROM battle_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 10", [userId]);
  const recentWins = recentRows.filter((r) => r.result === "win").length;

  return {
    total,
    wins,
    losses,
    draws,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    avgDamageTaken: Math.round(avgDamage.avg_taken || 0),
    avgDamageDealt: Math.round(avgDamage.avg_dealt || 0),
    avgRounds: Math.round(avgDamage.avg_rounds || 0),
    byTroop: byTroopRows.map((row) => ({
      ownTroop: row.own_troop,
      enemyTroop: row.enemy_troop,
      total: row.total,
      wins: row.wins,
      winRate: Math.round((row.wins / row.total) * 100)
    })),
    recentTrend: `${recentWins}/${recentRows.length}`
  };
}

async function deleteBattleReport(pool, reportId, userId) {
  const [result] = await pool.execute("DELETE FROM battle_reports WHERE id = ? AND user_id = ?", [reportId, userId]);
  return { deleted: result.affectedRows };
}

async function getLineups(pool, userId) {
  const [rows] = await pool.execute("SELECT * FROM lineups WHERE user_id = ? ORDER BY updated_at DESC", [userId]);
  return rows;
}

async function saveLineup(pool, userId, lineup) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const createdAt = lineup.createdAt ? lineup.createdAt.replace('T', ' ').slice(0, 19) : now;
  const updatedAt = lineup.updatedAt ? lineup.updatedAt.replace('T', ' ').slice(0, 19) : now;
  await pool.execute(
    `INSERT INTO lineups (id, user_id, scenario, troop, score, generals, tactics, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE scenario=VALUES(scenario), troop=VALUES(troop), score=VALUES(score),
       generals=VALUES(generals), tactics=VALUES(tactics), source=VALUES(source), updated_at=VALUES(updated_at)`,
    [
      lineup.id, userId, lineup.scenario, lineup.troop, lineup.score,
      JSON.stringify(lineup.generals), JSON.stringify(lineup.tactics),
      lineup.source || "mini-program",
      createdAt,
      updatedAt
    ]
  );
  const [rows] = await pool.execute("SELECT * FROM lineups WHERE id = ?", [lineup.id]);
  return rows[0];
}

async function deleteLineup(pool, lineupId, userId) {
  const [result] = await pool.execute("DELETE FROM lineups WHERE id = ? AND user_id = ?", [lineupId, userId]);
  return { deleted: result.affectedRows };
}

async function addFeedback(pool, userId, content, contact) {
  const id = "fb_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  await pool.execute(
    "INSERT INTO feedback (id, user_id, content, contact, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
    [id, userId || null, content, contact || "", now]
  );
  const [rows] = await pool.execute("SELECT * FROM feedback WHERE id = ?", [id]);
  return rows[0];
}

async function getFeedbackList(pool, limit, offset) {
  const lim = Math.min(limit || 50, 200);
  const off = offset || 0;
  const [rows] = await pool.execute("SELECT * FROM feedback ORDER BY created_at DESC LIMIT ? OFFSET ?", [lim, off]);
  return rows;
}

async function updateFeedbackStatus(pool, feedbackId, status) {
  const validStatuses = ["pending", "read", "resolved", "rejected"];
  if (!validStatuses.includes(status)) {
    return { error: "无效状态。" };
  }
  await pool.execute("UPDATE feedback SET status = ? WHERE id = ?", [status, feedbackId]);
  const [rows] = await pool.execute("SELECT * FROM feedback WHERE id = ?", [feedbackId]);
  return rows[0] || { error: "反馈不存在。" };
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  createDatabase,
  getOrCreateUser,
  registerUser,
  loginUser,
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
  deleteBattleReport,
  addFeedback,
  getFeedbackList,
  updateFeedbackStatus,
  closePool
};
