/**
 * db.js — SQLite database layer
 *
 * Tables:
 *   players  — telegram_id ↔ wallet_address mapping
 *   games    — known game state (synced from chain events)
 *   secrets  — encrypted secret+salt stored server-side per player per game
 */

const Database = require('better-sqlite3');
const path     = require('path');
const crypto   = require('crypto');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'cashx.db');
const SECRET_KEY = process.env.SECRET_ENCRYPTION_KEY; // 32-char hex key for AES-256

let db;

// ─── Init ──────────────────────────────────────────────

function init() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      telegram_id   TEXT PRIMARY KEY,
      telegram_name TEXT,
      wallet_address TEXT UNIQUE,
      registered_at INTEGER DEFAULT (unixepoch()),
      notify_fill   INTEGER DEFAULT 1,
      notify_reveal INTEGER DEFAULT 1,
      notify_result INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS games (
      game_id       INTEGER PRIMARY KEY,
      mode_id       INTEGER NOT NULL,
      status        TEXT NOT NULL DEFAULT 'open',
      player_count  INTEGER NOT NULL DEFAULT 0,
      max_players   INTEGER NOT NULL,
      entry_fee_pls TEXT NOT NULL,
      reveal_deadline INTEGER,
      winner_address  TEXT,
      runner_address  TEXT,
      cashx_bought    TEXT,
      cashx_burned    TEXT,
      created_at    INTEGER DEFAULT (unixepoch()),
      updated_at    INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS game_players (
      game_id       INTEGER NOT NULL,
      wallet_address TEXT NOT NULL,
      slot_index    INTEGER NOT NULL,
      has_revealed  INTEGER DEFAULT 0,
      joined_at     INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (game_id, wallet_address),
      FOREIGN KEY (game_id) REFERENCES games(game_id)
    );

    CREATE TABLE IF NOT EXISTS secrets (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id   TEXT NOT NULL,
      game_id       INTEGER NOT NULL,
      secret_enc    TEXT NOT NULL,
      salt_enc      TEXT NOT NULL,
      commitment    TEXT NOT NULL,
      saved_at      INTEGER DEFAULT (unixepoch()),
      UNIQUE (telegram_id, game_id),
      FOREIGN KEY (game_id) REFERENCES games(game_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id   TEXT NOT NULL,
      game_id       INTEGER,
      type          TEXT NOT NULL,
      sent_at       INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS deposit_sessions (
      deposit_address TEXT PRIMARY KEY,
      telegram_id     TEXT NOT NULL,
      game_id         INTEGER NOT NULL,
      mode_id         INTEGER NOT NULL,
      entry_fee_wei   TEXT NOT NULL,
      source_address  TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',
      commit_tx       TEXT,
      reveal_tx       TEXT,
      created_at      INTEGER DEFAULT (unixepoch()),
      updated_at      INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_game_players_wallet  ON game_players(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_secrets_telegram     ON secrets(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_notifs_telegram      ON notifications(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_deposit_telegram     ON deposit_sessions(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_deposit_game         ON deposit_sessions(game_id);
    CREATE INDEX IF NOT EXISTS idx_deposit_status       ON deposit_sessions(status);
  `);

  return Promise.resolve();
}

// ─── Players ───────────────────────────────────────────

function upsertPlayer({ telegramId, telegramName, walletAddress }) {
  return db.prepare(`
    INSERT INTO players (telegram_id, telegram_name, wallet_address)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      telegram_name   = excluded.telegram_name,
      wallet_address  = COALESCE(excluded.wallet_address, wallet_address)
  `).run(telegramId, telegramName, walletAddress || null);
}

function getPlayerByWallet(walletAddress) {
  return db.prepare(
    'SELECT * FROM players WHERE LOWER(wallet_address) = LOWER(?)'
  ).get(walletAddress);
}

function getPlayerByTelegram(telegramId) {
  return db.prepare('SELECT * FROM players WHERE telegram_id = ?').get(telegramId);
}

function setWallet(telegramId, walletAddress) {
  return db.prepare(
    'UPDATE players SET wallet_address = ? WHERE telegram_id = ?'
  ).run(walletAddress, telegramId);
}

function updateNotifyPrefs(telegramId, { fill, reveal, result }) {
  return db.prepare(`
    UPDATE players SET
      notify_fill   = COALESCE(?, notify_fill),
      notify_reveal = COALESCE(?, notify_reveal),
      notify_result = COALESCE(?, notify_result)
    WHERE telegram_id = ?
  `).run(
    fill   !== undefined ? (fill   ? 1 : 0) : null,
    reveal !== undefined ? (reveal ? 1 : 0) : null,
    result !== undefined ? (result ? 1 : 0) : null,
    telegramId
  );
}

// ─── Games ─────────────────────────────────────────────

function upsertGame({ gameId, modeId, status, playerCount, maxPlayers, entryFeePls }) {
  return db.prepare(`
    INSERT INTO games (game_id, mode_id, status, player_count, max_players, entry_fee_pls)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(game_id) DO UPDATE SET
      status        = excluded.status,
      player_count  = excluded.player_count,
      updated_at    = unixepoch()
  `).run(gameId, modeId, status, playerCount, maxPlayers, entryFeePls);
}

function updateGameStatus(gameId, status, extra = {}) {
  const { revealDeadline, winnerAddress, runnerAddress, cashxBought, cashxBurned } = extra;
  return db.prepare(`
    UPDATE games SET
      status           = ?,
      reveal_deadline  = COALESCE(?, reveal_deadline),
      winner_address   = COALESCE(?, winner_address),
      runner_address   = COALESCE(?, runner_address),
      cashx_bought     = COALESCE(?, cashx_bought),
      cashx_burned     = COALESCE(?, cashx_burned),
      updated_at       = unixepoch()
    WHERE game_id = ?
  `).run(
    status,
    revealDeadline || null,
    winnerAddress  || null,
    runnerAddress  || null,
    cashxBought    || null,
    cashxBurned    || null,
    gameId
  );
}

function getGame(gameId) {
  return db.prepare('SELECT * FROM games WHERE game_id = ?').get(gameId);
}

function getOpenGames() {
  return db.prepare("SELECT * FROM games WHERE status IN ('open','filled') ORDER BY game_id DESC").all();
}

// ─── Game players ──────────────────────────────────────

function addGamePlayer(gameId, walletAddress, slotIndex) {
  return db.prepare(`
    INSERT OR IGNORE INTO game_players (game_id, wallet_address, slot_index)
    VALUES (?, ?, ?)
  `).run(gameId, walletAddress.toLowerCase(), slotIndex);
}

function markRevealed(gameId, walletAddress) {
  return db.prepare(`
    UPDATE game_players SET has_revealed = 1
    WHERE game_id = ? AND LOWER(wallet_address) = LOWER(?)
  `).run(gameId, walletAddress);
}

function getGamePlayers(gameId) {
  return db.prepare('SELECT * FROM game_players WHERE game_id = ? ORDER BY slot_index').all(gameId);
}

// ─── Secrets (server-side encrypted storage) ──────────

/**
 * Encrypt a secret/salt before storing.
 * Uses AES-256-GCM with a per-record IV.
 * SECRET_ENCRYPTION_KEY must be a 32-byte hex string in .env
 */
function encrypt(plaintext) {
  if (!SECRET_KEY) throw new Error('SECRET_ENCRYPTION_KEY not set in .env');
  const key = Buffer.from(SECRET_KEY, 'hex');
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag  = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

function decrypt(ciphertext) {
  if (!SECRET_KEY) throw new Error('SECRET_ENCRYPTION_KEY not set in .env');
  const key = Buffer.from(SECRET_KEY, 'hex');
  const [ivHex, tagHex, encHex] = ciphertext.split(':');
  const iv  = Buffer.from(ivHex,  'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc) + decipher.final('utf8');
}

function saveSecret({ telegramId, gameId, secret, salt, commitment }) {
  return db.prepare(`
    INSERT INTO secrets (telegram_id, game_id, secret_enc, salt_enc, commitment)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(telegram_id, game_id) DO UPDATE SET
      secret_enc  = excluded.secret_enc,
      salt_enc    = excluded.salt_enc,
      commitment  = excluded.commitment
  `).run(telegramId, gameId, encrypt(secret), encrypt(salt), commitment);
}

function getSecret(telegramId, gameId) {
  const row = db.prepare(
    'SELECT * FROM secrets WHERE telegram_id = ? AND game_id = ?'
  ).get(telegramId, gameId);
  if (!row) return null;
  return {
    ...row,
    secret: decrypt(row.secret_enc),
    salt:   decrypt(row.salt_enc),
  };
}

// ─── Deposit sessions ──────────────────────────────────

function upsertDepositSession({ telegramId, gameId, modeId, depositAddress, entryFeeWei, status }) {
  return db.prepare(`
    INSERT INTO deposit_sessions (deposit_address, telegram_id, game_id, mode_id, entry_fee_wei, status)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(deposit_address) DO UPDATE SET
      status     = excluded.status,
      updated_at = unixepoch()
  `).run(depositAddress, telegramId, gameId, modeId, entryFeeWei, status);
}

function updateDepositStatus(depositAddress, status, txHash = null) {
  return db.prepare(`
    UPDATE deposit_sessions SET
      status     = ?,
      commit_tx  = CASE WHEN ? IS NOT NULL AND status = 'pending' THEN ? ELSE commit_tx END,
      reveal_tx  = CASE WHEN ? IS NOT NULL AND status = 'committed' THEN ? ELSE reveal_tx END,
      updated_at = unixepoch()
    WHERE deposit_address = ?
  `).run(status, txHash, txHash, txHash, txHash, depositAddress);
}

function updateDepositSourceAddress(depositAddress, sourceAddress) {
  return db.prepare(
    'UPDATE deposit_sessions SET source_address = ?, updated_at = unixepoch() WHERE deposit_address = ?'
  ).run(sourceAddress, depositAddress);
}

function getDepositSession(depositAddress) {
  return db.prepare('SELECT * FROM deposit_sessions WHERE deposit_address = ?').get(depositAddress);
}

function getDepositSessionsByGame(gameId) {
  return db.prepare('SELECT * FROM deposit_sessions WHERE game_id = ?').all(gameId);
}

function getDepositSessionsByTelegram(telegramId) {
  return db.prepare(
    'SELECT * FROM deposit_sessions WHERE telegram_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(telegramId);
}

function getPendingDepositSessions() {
  return db.prepare(
    "SELECT * FROM deposit_sessions WHERE status IN ('pending','committed')"
  ).all();
}

// ─── Notifications log ─────────────────────────────────

function logNotification(telegramId, gameId, type) {
  return db.prepare(
    'INSERT INTO notifications (telegram_id, game_id, type) VALUES (?, ?, ?)'
  ).run(telegramId, gameId, type);
}

function wasNotified(telegramId, gameId, type) {
  const row = db.prepare(
    'SELECT 1 FROM notifications WHERE telegram_id = ? AND game_id = ? AND type = ?'
  ).get(telegramId, gameId, type);
  return !!row;
}

// ─── Exports ───────────────────────────────────────────

module.exports = {
  init,
  upsertPlayer,
  getPlayerByWallet,
  getPlayerByTelegram,
  setWallet,
  updateNotifyPrefs,
  upsertGame,
  updateGameStatus,
  getGame,
  getOpenGames,
  addGamePlayer,
  markRevealed,
  getGamePlayers,
  saveSecret,
  getSecret,
  upsertDepositSession,
  updateDepositStatus,
  updateDepositSourceAddress,
  getDepositSession,
  getDepositSessionsByGame,
  getDepositSessionsByTelegram,
  getPendingDepositSessions,
  logNotification,
  wasNotified,
};
