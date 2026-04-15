/**
 * CashX Game — Telegram Bot Backend
 * Entry point — starts all services
 *
 * SETUP:
 *   npm install
 *   cp .env.example .env   ← fill in your values
 *   node index.js
 */

require('dotenv').config();
const { startBot }     = require('./bot');
const { startWatcher } = require('./watcher');
const { startServer }  = require('./server');
const deposits         = require('./deposits');
const db               = require('./db');

async function main() {
  console.log('🎮 CashX Bot starting...');

  await db.init();
  console.log('✅ Database ready');

  await deposits.init();
  console.log('✅ Deposit engine ready');

  startBot();
  console.log('✅ Telegram bot listening');

  startServer();
  console.log('✅ API server ready');

  await startWatcher();
  console.log('✅ Chain watcher running');

  console.log('🟢 All systems go');
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
