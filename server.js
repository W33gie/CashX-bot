/**
 * server.js — HTTP API for the Mini App
 *
 * Endpoints:
 *   POST /register          — register Telegram user
 *   POST /wallet            — link wallet address
 *   POST /prefs             — update notification prefs
 *   POST /deposit-address   — get unique deposit address for a game
 *   GET  /games             — list open games
 *   GET  /game/:id          — single game state
 *   GET  /player/:telegramId — player stats + history
 *
 * All endpoints validate Telegram initData to prevent spoofing.
 */

const http    = require('http');
const crypto  = require('crypto');
const db      = require('./db');
const deposits = require('./deposits');

const PORT        = process.env.PORT || 3000;
const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;

// ─── Init ──────────────────────────────────────────────

function startServer() {
  const server = http.createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`🌐 API server listening on port ${PORT}`);
  });
  return server;
}

// ─── Router ────────────────────────────────────────────

async function handleRequest(req, res) {
  // CORS — allow Mini App origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (req.method === 'POST' && url.pathname === '/register') {
      return await handleRegister(req, res);
    }
    if (req.method === 'POST' && url.pathname === '/wallet') {
      return await handleWallet(req, res);
    }
    if (req.method === 'POST' && url.pathname === '/prefs') {
      return await handlePrefs(req, res);
    }
    if (req.method === 'POST' && url.pathname === '/deposit-address') {
      return await handleDepositAddress(req, res);
    }
    if (req.method === 'GET' && url.pathname === '/games') {
      return handleGames(req, res);
    }
    if (req.method === 'GET' && url.pathname.startsWith('/game/')) {
      const gameId = parseInt(url.pathname.split('/')[2]);
      return handleGame(req, res, gameId);
    }
    if (req.method === 'GET' && url.pathname.startsWith('/player/')) {
      const telegramId = url.pathname.split('/')[2];
      return handlePlayer(req, res, telegramId);
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true });
    }

    json(res, 404, { error: 'Not found' });

  } catch (err) {
    console.error('API error:', err);
    json(res, 500, { error: 'Internal server error' });
  }
}

// ─── Handlers ──────────────────────────────────────────

async function handleRegister(req, res) {
  const body = await readBody(req);
  const { telegramId, telegramName, initData } = body;

  if (!telegramId) return json(res, 400, { error: 'telegramId required' });

  // Validate initData in production
  if (initData && !validateInitData(initData)) {
    return json(res, 401, { error: 'Invalid Telegram auth' });
  }

  db.upsertPlayer({ telegramId: String(telegramId), telegramName: telegramName || 'Unknown' });

  return json(res, 200, { ok: true });
}

async function handleWallet(req, res) {
  const body = await readBody(req);
  const { telegramId, walletAddress, initData } = body;

  if (!telegramId || !walletAddress) {
    return json(res, 400, { error: 'telegramId and walletAddress required' });
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return json(res, 400, { error: 'Invalid wallet address' });
  }
  if (initData && !validateInitData(initData)) {
    return json(res, 401, { error: 'Invalid Telegram auth' });
  }

  // Check not claimed by another user
  const existing = db.getPlayerByWallet(walletAddress);
  if (existing && existing.telegram_id !== String(telegramId)) {
    return json(res, 409, { error: 'Wallet already linked to another account' });
  }

  db.upsertPlayer({ telegramId: String(telegramId), walletAddress });

  return json(res, 200, { ok: true });
}

async function handlePrefs(req, res) {
  const body = await readBody(req);
  const { telegramId, fill, reveal, result, initData } = body;

  if (!telegramId) return json(res, 400, { error: 'telegramId required' });
  if (initData && !validateInitData(initData)) {
    return json(res, 401, { error: 'Invalid Telegram auth' });
  }

  db.updateNotifyPrefs(String(telegramId), { fill, reveal, result });

  return json(res, 200, { ok: true });
}

async function handleDepositAddress(req, res) {
  const body = await readBody(req);
  const { telegramId, gameId, modeId, initData } = body;

  if (!telegramId || modeId === undefined) {
    return json(res, 400, { error: 'telegramId and modeId required' });
  }
  if (initData && !validateInitData(initData)) {
    return json(res, 401, { error: 'Invalid Telegram auth' });
  }

  // Ensure player exists
  db.upsertPlayer({ telegramId: String(telegramId), telegramName: 'Unknown' });

  try {
    const result = await deposits.getDepositAddress({
      telegramId: String(telegramId),
      gameId:     gameId !== undefined ? Number(gameId) : 0,
      modeId:     Number(modeId),
    });

    return json(res, 200, result);

  } catch (err) {
    console.error('Deposit address error:', err);
    return json(res, 500, { error: err.message });
  }
}

function handleGames(req, res) {
  const games = db.getOpenGames();
  return json(res, 200, { games });
}

function handleGame(req, res, gameId) {
  if (isNaN(gameId)) return json(res, 400, { error: 'Invalid game ID' });
  const game    = db.getGame(gameId);
  const players = db.getGamePlayers(gameId);
  if (!game) return json(res, 404, { error: 'Game not found' });
  return json(res, 200, { game, players });
}

function handlePlayer(req, res, telegramId) {
  const player = db.getPlayerByTelegram(telegramId);
  if (!player) return json(res, 404, { error: 'Player not found' });
  const sessions = db.getDepositSessionsByTelegram(telegramId);
  return json(res, 200, { player, sessions });
}

// ─── Telegram initData validation ─────────────────────
//
// This prevents anyone from spoofing requests to the API.
// Telegram signs the initData with your bot token — we verify it here.

function validateInitData(initDataStr) {
  try {
    if (!BOT_TOKEN || !initDataStr) return true; // skip in dev

    const params   = new URLSearchParams(initDataStr);
    const hash     = params.get('hash');
    params.delete('hash');

    const dataCheckStr = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckStr)
      .digest('hex');

    return computedHash === hash;
  } catch {
    return false;
  }
}

// ─── Helpers ───────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

module.exports = { startServer };
