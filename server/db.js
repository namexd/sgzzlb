const mysql = require("mysql2/promise");
const crypto = require("crypto");
const baselineCatalog = require("../data/catalog");
const { classifyTacticCoverage } = require("../utils/simulator/tactics");
const {
  normalizeSnapshot,
  diffCatalogs,
  countSnapshot,
  hashSnapshot
} = require("./catalogDiff");

function nowLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const DEFAULT_CONFIG = {
  host: process.env.MYSQL_HOST || "localhost",
  port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "sgzzlb_local",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const PASSWORD_SALT_HEX_LENGTH = 32;
const PASSWORD_HASH_HEX_LENGTH = 128;

let pool = null;

function resolveConfig(config) {
  return { ...DEFAULT_CONFIG, ...(config || {}) };
}

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}

async function ensureDatabaseExists(config) {
  const database = config.database;
  const bootstrapConfig = { ...config };
  delete bootstrapConfig.database;

  const bootstrapPool = mysql.createPool(bootstrapConfig);
  try {
    await bootstrapPool.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await bootstrapPool.end();
  }
}

function getPool(config) {
  if (!pool) {
    pool = mysql.createPool(resolveConfig(config));
  }
  return pool;
}

async function createDatabase(config) {
  const resolvedConfig = resolveConfig(config);
  let p = getPool(resolvedConfig);

  try {
    await p.query("SELECT 1");
  } catch (error) {
    if (error.code !== "ER_BAD_DB_ERROR") {
      throw error;
    }
    await closePool();
    await ensureDatabaseExists(resolvedConfig);
    p = getPool(resolvedConfig);
    await p.query("SELECT 1");
  }

  await p.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      openid VARCHAR(128) UNIQUE,
      username VARCHAR(64) UNIQUE,
      password VARCHAR(255),
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
    await p.execute("ALTER TABLE users ADD COLUMN password VARCHAR(255)");
  } catch (e) { /* column already exists */ }
  try {
    await p.execute("ALTER TABLE users MODIFY COLUMN password VARCHAR(255)");
  } catch (e) { /* column type already compatible */ }

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
    CREATE TABLE IF NOT EXISTS draw_seasons (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      name VARCHAR(64) NOT NULL,
      start_date VARCHAR(16) NOT NULL,
      end_date VARCHAR(16) DEFAULT NULL,
      created_at VARCHAR(32),
      updated_at VARCHAR(32),
      INDEX idx_draw_seasons_user (user_id),
      INDEX idx_draw_seasons_active (user_id, end_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS draw_records (
      id VARCHAR(64) PRIMARY KEY,
      pool_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      season_id VARCHAR(64) DEFAULT NULL,
      date VARCHAR(16) NOT NULL,
      time VARCHAR(16) NOT NULL,
      quality VARCHAR(16) NOT NULL,
      general_name VARCHAR(64) DEFAULT '',
      draw_type VARCHAR(16) NOT NULL,
      group_num INT NOT NULL,
      created_at VARCHAR(32),
      INDEX idx_draw_records_pool (pool_id),
      INDEX idx_draw_records_user (user_id),
      INDEX idx_draw_records_season (user_id, season_id),
      INDEX idx_draw_records_date (user_id, date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  try {
    await p.execute("ALTER TABLE draw_records ADD COLUMN season_id VARCHAR(64) DEFAULT NULL");
  } catch (e) { /* column already exists */ }
  try {
    await p.execute("ALTER TABLE draw_records ADD INDEX idx_draw_records_season (user_id, season_id)");
  } catch (e) { /* index already exists */ }

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
    CREATE TABLE IF NOT EXISTS recommendation_history (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      scenario VARCHAR(80) DEFAULT '',
      target_lineup_count INT DEFAULT 0,
      summary TEXT,
      payload_json MEDIUMTEXT,
      created_at VARCHAR(32),
      updated_at VARCHAR(32),
      INDEX idx_recommendation_history_user (user_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS feedback (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) DEFAULT NULL,
      content TEXT NOT NULL,
      contact VARCHAR(128) DEFAULT '',
      status VARCHAR(16) DEFAULT 'pending',
      type VARCHAR(32) DEFAULT 'general',
      metadata TEXT,
      created_at VARCHAR(32),
      INDEX idx_feedback_user (user_id),
      INDEX idx_feedback_status (status),
      INDEX idx_feedback_type (type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  try {
    await p.execute("ALTER TABLE feedback ADD COLUMN type VARCHAR(32) DEFAULT 'general'");
  } catch (e) { /* column already exists */ }
  try {
    await p.execute("ALTER TABLE feedback ADD COLUMN metadata TEXT");
  } catch (e) { /* column already exists */ }
  try {
    await p.execute("ALTER TABLE feedback ADD INDEX idx_feedback_type (type)");
  } catch (e) { /* index already exists */ }

  await p.execute(`
    CREATE TABLE IF NOT EXISTS catalog_versions (
      id VARCHAR(64) PRIMARY KEY,
      season_key VARCHAR(80) NOT NULL,
      season_label VARCHAR(120) DEFAULT '',
      version_key VARCHAR(120) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'draft',
      source VARCHAR(80) DEFAULT 'manual',
      snapshot_json MEDIUMTEXT,
      diff_json MEDIUMTEXT,
      counts_json TEXT,
      snapshot_hash VARCHAR(128) DEFAULT '',
      created_at VARCHAR(32),
      published_at VARCHAR(32) DEFAULT NULL,
      imported_by VARCHAR(80) DEFAULT 'admin',
      INDEX idx_catalog_versions_season (season_key, status),
      INDEX idx_catalog_versions_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS catalog_import_jobs (
      id VARCHAR(64) PRIMARY KEY,
      season_key VARCHAR(80) NOT NULL,
      season_label VARCHAR(120) DEFAULT '',
      version_id VARCHAR(64) NOT NULL,
      version_key VARCHAR(120) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'draft',
      source VARCHAR(80) DEFAULT 'manual',
      diff_json MEDIUMTEXT,
      error TEXT,
      created_at VARCHAR(32),
      finished_at VARCHAR(32) DEFAULT NULL,
      imported_by VARCHAR(80) DEFAULT 'admin',
      INDEX idx_catalog_import_jobs_status (status),
      INDEX idx_catalog_import_jobs_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS tactic_rule_todos (
      id VARCHAR(64) PRIMARY KEY,
      tactic_id VARCHAR(120) DEFAULT '',
      tactic_name VARCHAR(120) NOT NULL,
      tactic_type VARCHAR(40) DEFAULT '战法',
      coverage_status VARCHAR(40) DEFAULT 'missed',
      priority VARCHAR(16) DEFAULT 'medium',
      status VARCHAR(16) DEFAULT 'open',
      note TEXT,
      season_key VARCHAR(80) DEFAULT '',
      catalog_version_id VARCHAR(64) DEFAULT '',
      created_at VARCHAR(32),
      updated_at VARCHAR(32),
      INDEX idx_tactic_rule_todos_status (status),
      INDEX idx_tactic_rule_todos_tactic (tactic_id),
      INDEX idx_tactic_rule_todos_version (catalog_version_id)
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
  if (!isPasswordHashComplete(stored)) return false;
  const [salt, hash] = stored.split(":");
  const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return hash === verify;
}

function isPasswordHashComplete(stored) {
  if (!stored) return false;
  const [salt, hash] = String(stored).split(":");
  return salt && hash && salt.length === PASSWORD_SALT_HEX_LENGTH && hash.length === PASSWORD_HASH_HEX_LENGTH;
}

// Register with username/password
async function registerUser(pool, username, password, nickname) {
  // Check if username exists
  const [existing] = await pool.execute("SELECT id, password FROM users WHERE username = ?", [username]);
  if (existing.length > 0) {
    const user = existing[0];
    if (!isPasswordHashComplete(user.password)) {
      // 修复早期 password 字段过短导致哈希被截断的账号。
      const now = nowLocal();
      await pool.execute(
        "UPDATE users SET password = ?, nickname = ?, updated_at = ? WHERE id = ?",
        [hashPassword(password), nickname || username, now, user.id]
      );
      const [rows] = await pool.execute("SELECT id, username, nickname, tier, created_at FROM users WHERE id = ?", [user.id]);
      return { user: rows[0], repaired: true };
    }
    return { error: "用户名已存在" };
  }

  const id = "user_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const now = nowLocal();
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
  const now = nowLocal();
  await pool.execute("INSERT INTO users (id, openid, created_at, updated_at) VALUES (?, ?, ?, ?)", [id, openid, now, now]);
  const [newRows] = await pool.execute("SELECT * FROM users WHERE id = ?", [id]);
  return newRows[0];
}

async function getDrawPools(pool, userId) {
  const [rows] = await pool.execute("SELECT * FROM draw_pools WHERE user_id = ? ORDER BY created_at DESC", [userId]);
  return rows;
}

async function createDrawPool(pool, userId, name, poolId) {
  const id = poolId || "pool_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const now = nowLocal();
  await pool.execute(
    `INSERT INTO draw_pools (id, user_id, name, created_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name=VALUES(name)`,
    [id, userId, name, now]
  );
  const [rows] = await pool.execute("SELECT * FROM draw_pools WHERE id = ? AND user_id = ?", [id, userId]);
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

async function getDrawSeasons(pool, userId) {
  const [rows] = await pool.execute("SELECT * FROM draw_seasons WHERE user_id = ? ORDER BY start_date DESC, created_at DESC", [userId]);
  return rows;
}

async function createDrawSeason(pool, userId, season = {}) {
  const id = season.id || "season_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const now = nowLocal();
  const startDate = season.startDate || now.slice(0, 10);
  const name = season.name || "S1";
  const endDate = season.endDate || null;

  if (!endDate) {
    await pool.execute(
      "UPDATE draw_seasons SET end_date = ?, updated_at = ? WHERE user_id = ? AND end_date IS NULL",
      [startDate, now, userId]
    );
  }

  await pool.execute(
    `INSERT INTO draw_seasons (id, user_id, name, start_date, end_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name=VALUES(name), start_date=VALUES(start_date), end_date=VALUES(end_date), updated_at=VALUES(updated_at)`,
    [id, userId, name, startDate, endDate, season.createdAt || now, now]
  );
  const [rows] = await pool.execute("SELECT * FROM draw_seasons WHERE id = ? AND user_id = ?", [id, userId]);
  return rows[0];
}

async function updateDrawSeason(pool, userId, seasonId, patch = {}) {
  const [rows] = await pool.execute("SELECT * FROM draw_seasons WHERE id = ? AND user_id = ?", [seasonId, userId]);
  if (rows.length === 0) return null;
  const current = rows[0];
  const now = nowLocal();
  const next = {
    name: patch.name || current.name,
    startDate: patch.startDate || current.start_date,
    endDate: Object.prototype.hasOwnProperty.call(patch, "endDate") ? (patch.endDate || null) : current.end_date
  };
  await pool.execute(
    "UPDATE draw_seasons SET name = ?, start_date = ?, end_date = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [next.name, next.startDate, next.endDate, now, seasonId, userId]
  );
  const [updated] = await pool.execute("SELECT * FROM draw_seasons WHERE id = ? AND user_id = ?", [seasonId, userId]);
  return updated[0];
}

async function endDrawSeason(pool, userId, seasonId, endDate) {
  return updateDrawSeason(pool, userId, seasonId, { endDate: endDate || nowLocal().slice(0, 10) });
}

async function syncDrawSeasons(pool, userId, seasons = []) {
  let added = 0;
  for (const season of seasons) {
    if (!season || !season.id) continue;
    await createDrawSeason(pool, userId, season);
    added++;
  }
  return { added, total: seasons.length };
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
  const now = nowLocal();
  await pool.execute(
    `INSERT INTO draw_records (id, pool_id, user_id, season_id, date, time, quality, general_name, draw_type, group_num, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE season_id=VALUES(season_id), date=VALUES(date), time=VALUES(time), quality=VALUES(quality), general_name=VALUES(general_name), draw_type=VALUES(draw_type), group_num=VALUES(group_num)`,
    [id, record.poolId, userId, record.seasonId || null, record.date, record.time, record.quality, record.generalName || "", record.drawType, record.group, now]
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
  const now = nowLocal();
  for (const r of records) {
    if (!validPoolIds.has(r.poolId)) {
      skipped++;
      continue;
    }
    const id = r.id || "dr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    try {
      await pool.execute(
        `INSERT IGNORE INTO draw_records (id, pool_id, user_id, season_id, date, time, quality, general_name, draw_type, group_num, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, r.poolId, userId, r.seasonId || null, r.date, r.time, r.quality, r.generalName || "", r.drawType, r.group, now]
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
  const now = nowLocal();
  const battleDate = report.battleDate || nowLocal().slice(0, 10);
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
  const [rows] = await pool.query("SELECT * FROM battle_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?", [userId, lim, off]);
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

  // 可信度分层
  const confidence = total >= 20 ? "高" : total >= 10 ? "中" : total >= 5 ? "低" : "极低";

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
    recentTrend: `${recentWins}/${recentRows.length}`,
    confidence,
    confidenceText: `基于 ${total} 场战报，可信度${confidence}。${total < 10 ? "样本较少，结论仅供参考。" : ""}`
  };
}

async function getLineupBattleStats(pool, lineupId) {
  const [rows] = await pool.execute(
    `SELECT result, COUNT(*) as cnt
     FROM battle_reports
     WHERE own_lineup_id = ?
     GROUP BY result`,
    [lineupId]
  );

  const stats = { total: 0, wins: 0, losses: 0, draws: 0 };
  for (const row of rows) {
    stats.total += row.cnt;
    if (row.result === "win") stats.wins = row.cnt;
    else if (row.result === "loss") stats.losses = row.cnt;
    else if (row.result === "draw") stats.draws = row.cnt;
  }

  stats.winRate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;
  stats.confidence = stats.total >= 10 ? "高" : stats.total >= 5 ? "中" : "低";

  return stats;
}

async function deleteBattleReport(pool, reportId, userId) {
  const [result] = await pool.execute("DELETE FROM battle_reports WHERE id = ? AND user_id = ?", [reportId, userId]);
  return { deleted: result.affectedRows };
}

function normalizeRecommendationHistoryRow(row = {}) {
  const payload = safeParseJson(row.payload_json, {});
  return {
    ...payload,
    id: row.id,
    scenario: payload.scenario || row.scenario || "",
    targetLineupCount: payload.targetLineupCount || row.target_lineup_count || 0,
    createdAt: payload.createdAt || row.created_at || "",
    updatedAt: payload.updatedAt || row.updated_at || row.created_at || ""
  };
}

async function getRecommendationHistory(pool, userId, limit = 20) {
  const lim = Math.min(limit || 20, 100);
  const [rows] = await pool.query(
    "SELECT * FROM recommendation_history WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT ?",
    [userId, lim]
  );
  return rows.map(normalizeRecommendationHistoryRow);
}

async function saveRecommendationHistory(pool, userId, snapshot = {}) {
  const now = nowLocal();
  const id = snapshot.id || "rec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const createdAt = snapshot.createdAt ? String(snapshot.createdAt).replace("T", " ").slice(0, 19) : now;
  const updatedAt = now;
  const payload = {
    ...snapshot,
    id,
    createdAt: snapshot.createdAt || createdAt,
    updatedAt
  };
  const summary = payload.summary ? JSON.stringify(payload.summary) : "";
  await pool.execute(
    `INSERT INTO recommendation_history (id, user_id, scenario, target_lineup_count, summary, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE scenario=VALUES(scenario), target_lineup_count=VALUES(target_lineup_count),
       summary=VALUES(summary), payload_json=VALUES(payload_json), updated_at=VALUES(updated_at)`,
    [
      id,
      userId,
      payload.scenario || "",
      Number(payload.targetLineupCount || 0),
      summary,
      JSON.stringify(payload),
      createdAt,
      updatedAt
    ]
  );
  const [rows] = await pool.execute("SELECT * FROM recommendation_history WHERE id = ? AND user_id = ?", [id, userId]);
  return rows[0] ? normalizeRecommendationHistoryRow(rows[0]) : null;
}

async function getLineups(pool, userId) {
  const [rows] = await pool.execute("SELECT * FROM lineups WHERE user_id = ? ORDER BY updated_at DESC", [userId]);
  return rows.map(parseLineupRow);
}

function parseLineupRow(row) {
  if (!row) return row;
  return {
    ...row,
    generals: safeParseJson(row.generals, []),
    tactics: safeParseJson(row.tactics, [])
  };
}

function safeParseJson(text, fallback) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function saveLineup(pool, userId, lineup) {
  const now = nowLocal();
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
  return parseLineupRow(rows[0]);
}

async function deleteLineup(pool, lineupId, userId) {
  const [result] = await pool.execute("DELETE FROM lineups WHERE id = ? AND user_id = ?", [lineupId, userId]);
  return { deleted: result.affectedRows };
}

function normalizeCatalogVersionRow(row = {}) {
  return {
    id: row.id,
    seasonKey: row.season_key || "default",
    seasonLabel: row.season_label || "默认赛季",
    versionKey: row.version_key || row.id,
    status: row.status || "draft",
    source: row.source || "manual",
    snapshot: safeParseJson(row.snapshot_json, {}),
    diff: safeParseJson(row.diff_json, {}),
    counts: safeParseJson(row.counts_json, {}),
    snapshotHash: row.snapshot_hash || "",
    createdAt: row.created_at || "",
    publishedAt: row.published_at || null,
    importedBy: row.imported_by || "admin"
  };
}

function omitCatalogSnapshot(version) {
  const { snapshot, ...rest } = version;
  return rest;
}

function normalizeCatalogImportJobRow(row = {}) {
  return {
    id: row.id,
    seasonKey: row.season_key || "default",
    seasonLabel: row.season_label || "默认赛季",
    versionId: row.version_id || "",
    versionKey: row.version_key || "",
    status: row.status || "draft",
    source: row.source || "manual",
    diff: safeParseJson(row.diff_json, {}),
    error: row.error || null,
    createdAt: row.created_at || "",
    finishedAt: row.finished_at || null,
    importedBy: row.imported_by || "admin"
  };
}

function normalizeTacticRuleTodoRow(row = {}) {
  return {
    id: row.id,
    tacticId: row.tactic_id || "",
    tacticName: row.tactic_name || "未命名战法",
    tacticType: row.tactic_type || "战法",
    coverageStatus: row.coverage_status || "missed",
    priority: row.priority || "medium",
    status: row.status || "open",
    note: row.note || "",
    seasonKey: row.season_key || "",
    catalogVersionId: row.catalog_version_id || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function normalizeText(value, fallback = "", maxLength = 120) {
  const text = String(value || fallback || "").trim();
  return text.slice(0, maxLength);
}

function makeCatalogId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function getComparableCatalogBaseline(pool, seasonKey) {
  const published = await getPublishedCatalogVersion(pool, seasonKey);
  return published ? published.snapshot : baselineCatalog;
}

async function listCatalogVersions(pool, filters = {}) {
  const params = [];
  const where = [];
  const seasonKey = normalizeText(filters.season || filters.seasonKey, "", 80);
  const status = normalizeText(filters.status, "", 40);
  if (seasonKey) {
    where.push("season_key = ?");
    params.push(seasonKey);
  }
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  const [rows] = await pool.execute(
    `SELECT * FROM catalog_versions${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`,
    params
  );
  return rows.map(normalizeCatalogVersionRow).map(omitCatalogSnapshot);
}

async function getCatalogVersion(pool, id) {
  const [rows] = await pool.execute("SELECT * FROM catalog_versions WHERE id = ?", [id]);
  return rows[0] ? normalizeCatalogVersionRow(rows[0]) : null;
}

async function getPublishedCatalogVersion(pool, seasonKey) {
  const [rows] = await pool.execute(
    "SELECT * FROM catalog_versions WHERE season_key = ? AND status = 'published' ORDER BY published_at DESC, created_at DESC LIMIT 1",
    [seasonKey || "default"]
  );
  return rows[0] ? normalizeCatalogVersionRow(rows[0]) : null;
}

async function createCatalogImportJob(pool, payload = {}) {
  const seasonKey = normalizeText(payload.seasonKey || payload.season, "default", 80) || "default";
  const seasonLabel = normalizeText(payload.seasonLabel, seasonKey === "default" ? "默认赛季" : seasonKey, 120);
  const source = normalizeText(payload.source, "manual", 80) || "manual";
  const importedBy = normalizeText(payload.importedBy, "admin", 80) || "admin";
  const snapshot = normalizeSnapshot(payload.snapshot || payload.catalog || payload);
  const now = nowLocal();
  const versionId = normalizeText(payload.versionId, makeCatalogId("cv"), 64) || makeCatalogId("cv");
  const versionKey = normalizeText(payload.versionKey, `${seasonKey}-${now.replace(/[-: ]/g, "")}`, 120);
  const before = await getComparableCatalogBaseline(pool, seasonKey);
  const diff = diffCatalogs(before, snapshot);
  const counts = countSnapshot(snapshot);
  const snapshotHash = hashSnapshot(snapshot);
  const jobId = makeCatalogId("cij");

  await pool.execute(
    `INSERT INTO catalog_versions (id, season_key, season_label, version_key, status, source, snapshot_json, diff_json, counts_json, snapshot_hash, created_at, published_at, imported_by)
     VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      versionId,
      seasonKey,
      seasonLabel,
      versionKey,
      source,
      JSON.stringify(snapshot),
      JSON.stringify(diff),
      JSON.stringify(counts),
      snapshotHash,
      now,
      importedBy
    ]
  );
  await pool.execute(
    `INSERT INTO catalog_import_jobs (id, season_key, season_label, version_id, version_key, status, source, diff_json, error, created_at, finished_at, imported_by)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, NULL, ?, NULL, ?)`,
    [jobId, seasonKey, seasonLabel, versionId, versionKey, source, JSON.stringify(diff), now, importedBy]
  );

  return {
    job: await getCatalogImportJob(pool, jobId),
    version: omitCatalogSnapshot(await getCatalogVersion(pool, versionId))
  };
}

async function listCatalogImportJobs(pool, filters = {}) {
  const status = normalizeText(filters.status, "", 40);
  const params = [];
  const where = [];
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  const [rows] = await pool.execute(
    `SELECT * FROM catalog_import_jobs${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`,
    params
  );
  return rows.map(normalizeCatalogImportJobRow);
}

async function getCatalogImportJob(pool, id) {
  const [rows] = await pool.execute("SELECT * FROM catalog_import_jobs WHERE id = ?", [id]);
  return rows[0] ? normalizeCatalogImportJobRow(rows[0]) : null;
}

async function upsertTacticRuleTodosForCatalogVersion(pool, version) {
  const tactics = [...(version.snapshot.tactics || []), ...(version.snapshot.troopTactics || [])];
  let created = 0;
  const now = nowLocal();
  for (const tactic of tactics) {
    const tacticKey = tactic.id || tactic.name;
    if (!tacticKey) continue;
    const coverage = classifyTacticCoverage(tactic);
    if (coverage.status !== "missed") continue;
    const [existing] = await pool.execute(
      "SELECT id FROM tactic_rule_todos WHERE catalog_version_id = ? AND (tactic_id = ? OR tactic_name = ?) LIMIT 1",
      [version.id, tactic.id || "", tactic.name || ""]
    );
    if (existing.length > 0) continue;
    await pool.execute(
      `INSERT INTO tactic_rule_todos (id, tactic_id, tactic_name, tactic_type, coverage_status, priority, status, note, season_key, catalog_version_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'medium', 'open', ?, ?, ?, ?, ?)`,
      [
        makeCatalogId("trt"),
        tactic.id || "",
        tactic.name || "未命名战法",
        tactic.type || "战法",
        coverage.status,
        "发布资料时自动生成，待补充战法规则。",
        version.seasonKey,
        version.id,
        now,
        now
      ]
    );
    created += 1;
  }
  return created;
}

async function publishCatalogImportJob(pool, jobId) {
  const job = await getCatalogImportJob(pool, jobId);
  if (!job) throw Object.assign(new Error("导入任务不存在。"), { statusCode: 404 });
  if (job.status !== "draft") throw Object.assign(new Error("只有草稿导入任务可以发布。"), { statusCode: 400 });
  const version = await getCatalogVersion(pool, job.versionId);
  if (!version) throw Object.assign(new Error("导入任务关联的资料版本不存在。"), { statusCode: 404 });
  if (version.status !== "draft") throw Object.assign(new Error("只有草稿资料版本可以发布。"), { statusCode: 400 });

  const now = nowLocal();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      "UPDATE catalog_versions SET status = 'archived' WHERE season_key = ? AND status = 'published' AND id <> ?",
      [version.seasonKey, version.id]
    );
    await connection.execute("UPDATE catalog_versions SET status = 'published', published_at = ? WHERE id = ?", [now, version.id]);
    await connection.execute("UPDATE catalog_import_jobs SET status = 'published', finished_at = ? WHERE id = ?", [now, job.id]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const published = await getCatalogVersion(pool, version.id);
  const createdTodos = await upsertTacticRuleTodosForCatalogVersion(pool, published);
  return {
    job: await getCatalogImportJob(pool, job.id),
    version: omitCatalogSnapshot(published),
    createdTodos
  };
}

async function discardCatalogImportJob(pool, jobId) {
  const job = await getCatalogImportJob(pool, jobId);
  if (!job) throw Object.assign(new Error("导入任务不存在。"), { statusCode: 404 });
  if (job.status !== "draft") throw Object.assign(new Error("只有草稿导入任务可以丢弃。"), { statusCode: 400 });
  const now = nowLocal();
  await pool.execute("UPDATE catalog_import_jobs SET status = 'discarded', finished_at = ? WHERE id = ?", [now, job.id]);
  await pool.execute("UPDATE catalog_versions SET status = 'discarded' WHERE id = ?", [job.versionId]);
  return {
    job: await getCatalogImportJob(pool, job.id),
    version: await getCatalogVersion(pool, job.versionId)
  };
}

async function listTacticRuleTodos(pool, filters = {}) {
  const params = [];
  const where = [];
  const status = normalizeText(filters.status, "", 40);
  const seasonKey = normalizeText(filters.season || filters.seasonKey, "", 80);
  const versionId = normalizeText(filters.catalogVersionId || filters.versionId, "", 64);
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  if (seasonKey) {
    where.push("season_key = ?");
    params.push(seasonKey);
  }
  if (versionId) {
    where.push("catalog_version_id = ?");
    params.push(versionId);
  }
  const [rows] = await pool.execute(
    `SELECT * FROM tactic_rule_todos${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY updated_at DESC, created_at DESC`,
    params
  );
  return rows.map(normalizeTacticRuleTodoRow);
}

async function createTacticRuleTodo(pool, payload = {}) {
  const validPriorities = new Set(["high", "medium", "low"]);
  const validStatuses = new Set(["open", "done", "ignored"]);
  const now = nowLocal();
  const id = normalizeText(payload.id, makeCatalogId("trt"), 64) || makeCatalogId("trt");
  const priority = validPriorities.has(payload.priority) ? payload.priority : "medium";
  const status = validStatuses.has(payload.status) ? payload.status : "open";
  await pool.execute(
    `INSERT INTO tactic_rule_todos (id, tactic_id, tactic_name, tactic_type, coverage_status, priority, status, note, season_key, catalog_version_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      normalizeText(payload.tacticId, "", 120),
      normalizeText(payload.tacticName || payload.name, "未命名战法", 120),
      normalizeText(payload.tacticType || payload.type, "战法", 40),
      normalizeText(payload.coverageStatus, "missed", 40),
      priority,
      status,
      normalizeText(payload.note, "", 500),
      normalizeText(payload.seasonKey || payload.season, "", 80),
      normalizeText(payload.catalogVersionId, "", 120),
      now,
      now
    ]
  );
  const [rows] = await pool.execute("SELECT * FROM tactic_rule_todos WHERE id = ?", [id]);
  return normalizeTacticRuleTodoRow(rows[0]);
}

async function updateTacticRuleTodo(pool, id, payload = {}) {
  const [existingRows] = await pool.execute("SELECT * FROM tactic_rule_todos WHERE id = ?", [id]);
  if (existingRows.length === 0) throw Object.assign(new Error("规则待办不存在。"), { statusCode: 404 });
  const existing = normalizeTacticRuleTodoRow(existingRows[0]);
  const validPriorities = new Set(["high", "medium", "low"]);
  const validStatuses = new Set(["open", "done", "ignored"]);
  if (payload.priority && !validPriorities.has(payload.priority)) {
    throw Object.assign(new Error("无效的优先级。"), { statusCode: 400 });
  }
  if (payload.status && !validStatuses.has(payload.status)) {
    throw Object.assign(new Error("无效的待办状态。"), { statusCode: 400 });
  }
  const next = {
    tacticId: payload.tacticId !== undefined ? normalizeText(payload.tacticId, "", 120) : existing.tacticId,
    tacticName: payload.tacticName !== undefined ? normalizeText(payload.tacticName, "未命名战法", 120) : existing.tacticName,
    tacticType: payload.tacticType !== undefined ? normalizeText(payload.tacticType, "战法", 40) : existing.tacticType,
    coverageStatus: payload.coverageStatus !== undefined ? normalizeText(payload.coverageStatus, "missed", 40) : existing.coverageStatus,
    priority: payload.priority || existing.priority,
    status: payload.status || existing.status,
    note: payload.note !== undefined ? normalizeText(payload.note, "", 500) : existing.note,
    updatedAt: nowLocal()
  };
  await pool.execute(
    `UPDATE tactic_rule_todos SET tactic_id = ?, tactic_name = ?, tactic_type = ?, coverage_status = ?, priority = ?, status = ?, note = ?, updated_at = ? WHERE id = ?`,
    [next.tacticId, next.tacticName, next.tacticType, next.coverageStatus, next.priority, next.status, next.note, next.updatedAt, id]
  );
  const [rows] = await pool.execute("SELECT * FROM tactic_rule_todos WHERE id = ?", [id]);
  return normalizeTacticRuleTodoRow(rows[0]);
}

async function addFeedback(pool, userId, content, contact, options = {}) {
  const id = "fb_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const now = nowLocal();
  await pool.execute(
    "INSERT INTO feedback (id, user_id, content, contact, status, type, metadata, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)",
    [id, userId || null, content, contact || "", options.type || "general", options.metadata || null, now]
  );
  const [rows] = await pool.execute("SELECT * FROM feedback WHERE id = ?", [id]);
  return rows[0];
}

async function getUsers(pool, limit, offset) {
  const lim = Math.min(limit || 50, 200);
  const off = offset || 0;
  const [rows] = await pool.query(
    `SELECT u.*, COUNT(l.id) as lineup_count
     FROM users u
     LEFT JOIN lineups l ON u.id = l.user_id
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [lim, off]
  );
  return rows;
}

async function getUserCount(pool) {
  const [rows] = await pool.execute("SELECT COUNT(*) as cnt FROM users");
  return rows[0].cnt;
}

async function getAdminBattleReports(pool, limit, offset) {
  const lim = Math.min(limit || 50, 200);
  const off = offset || 0;
  const [rows] = await pool.query(
    "SELECT * FROM battle_reports ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [lim, off]
  );
  return rows;
}

async function getFeedbackList(pool, limit, offset) {
  const lim = Math.min(limit || 50, 200);
  const off = offset || 0;
  const [rows] = await pool.query("SELECT * FROM feedback ORDER BY created_at DESC LIMIT ? OFFSET ?", [lim, off]);
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

async function getUserById(pool, userId) {
  const [rows] = await pool.execute(
    `SELECT u.*, COUNT(l.id) as lineup_count
     FROM users u
     LEFT JOIN lineups l ON u.id = l.user_id
     WHERE u.id = ?
     GROUP BY u.id`,
    [userId]
  );
  if (rows.length === 0) return null;
  const user = rows[0];
  const { password: _, ...safeUser } = user;
  return safeUser;
}

async function getFeedbackById(pool, feedbackId) {
  const [rows] = await pool.execute("SELECT * FROM feedback WHERE id = ?", [feedbackId]);
  return rows[0] || null;
}

async function deleteFeedback(pool, feedbackId) {
  const [result] = await pool.execute("DELETE FROM feedback WHERE id = ?", [feedbackId]);
  return { deleted: result.affectedRows };
}

async function getBattleReportById(pool, reportId) {
  const [rows] = await pool.execute("SELECT * FROM battle_reports WHERE id = ?", [reportId]);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    ...row,
    own_generals: safeParseJson(row.own_generals, []),
    own_tactics: safeParseJson(row.own_tactics, []),
    enemy_generals: safeParseJson(row.enemy_generals, []),
    enemy_tactics: safeParseJson(row.enemy_tactics, [])
  };
}

async function getLineupById(pool, lineupId) {
  const [rows] = await pool.execute("SELECT * FROM lineups WHERE id = ?", [lineupId]);
  return rows[0] ? parseLineupRow(rows[0]) : null;
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
  getDrawSeasons,
  createDrawSeason,
  updateDrawSeason,
  endDrawSeason,
  syncDrawSeasons,
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
  getLineupBattleStats,
  deleteBattleReport,
  getRecommendationHistory,
  saveRecommendationHistory,
  addFeedback,
  getFeedbackList,
  updateFeedbackStatus,
  getUsers,
  getUserCount,
  getUserById,
  getAdminBattleReports,
  getFeedbackById,
  deleteFeedback,
  getBattleReportById,
  getLineupById,
  listCatalogVersions,
  getCatalogVersion,
  getPublishedCatalogVersion,
  createCatalogImportJob,
  listCatalogImportJobs,
  getCatalogImportJob,
  publishCatalogImportJob,
  discardCatalogImportJob,
  listTacticRuleTodos,
  createTacticRuleTodo,
  updateTacticRuleTodo,
  closePool
};
