const db = require('./db');
const { startBot } = require('./bot');
const server = require('./server');
const watcher = require('./watcher');
const deposits = require('./deposits');

async function main() {
  console.log('CashX Bot starting...');
  db.init();
  console.log('Database ready');
  deposits.init();
  console.log('Deposit engine ready');
  startBot();
  console.log('Telegram bot listening');
  server.start();
  console.log('API server ready');
  watcher.start();
  console.log('Chain watcher running');
  console.log('All systems go');
}

main().catch(console.error);
