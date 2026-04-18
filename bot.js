const TelegramBot = require(‘node-telegram-bot-api’);
const db = require(’./db’);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NETLIFY_URL = process.env.NETLIFY_URL || ‘https://cashx-game.netlify.app’;

let bot;

function startBot() {
if (!BOT_TOKEN) {
console.warn(‘TELEGRAM_BOT_TOKEN not set - bot disabled’);
return;
}

bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.setMyCommands([
{ command: ‘start’, description: ‘Open CashX Casino’ },
{ command: ‘balance’, description: ‘Check your balance’ },
{ command: ‘deposit’, description: ‘Get deposit address’ },
{ command: ‘help’, description: ‘Show all commands’ },
]).catch(function(e){ console.warn(‘Commands error:’, e.message); });

function gameBtn(label) {
return { inline_keyboard: [[{ text: label, web_app: { url: NETLIFY_URL } }]] };
}

bot.onText(//start(?:\s+(.+))?/, async function(msg, match) {
var tgId = String(msg.from.id);
var tgName = msg.from.username || msg.from.first_name || ‘Player’;

```
try { db.upsertPlayer({ telegramId: tgId, telegramName: tgName }); } catch(e){}

var startParam = match && match[1] ? match[1].trim() : '';
if (startParam.indexOf('ref_') === 0) {
  var referrerId = startParam.replace('ref_', '');
  if (referrerId !== tgId) {
    try { db.registerReferral(referrerId, tgId); } catch(e){}
  }
}

var text = 'Welcome to <b>CashX Casino</b>!\n\nLottery, Dice, Hi-Lo and Jackpot.\nDeposit CASHX, play instantly, win big.\n20% burned every round.\n\nTap below to open the casino:';
await bot.sendMessage(tgId, text, { parse_mode: 'HTML', reply_markup: gameBtn('Open CashX Casino') });
```

});

bot.onText(//balance/, async function(msg) {
var tgId = String(msg.from.id);
try {
var bal = db.getBalance(tgId);
var { ethers } = require(‘ethers’);
var cashx = ethers.formatEther(bal.cashx);
await bot.sendMessage(tgId, ‘Your balance: <b>’ + cashx + ’ CASHX</b>’, { parse_mode: ‘HTML’, reply_markup: gameBtn(‘Open Casino’) });
} catch(e) {
await bot.sendMessage(tgId, ‘Balance unavailable. Open the casino to check.’, { reply_markup: gameBtn(‘Open Casino’) });
}
});

bot.onText(//deposit/, async function(msg) {
var tgId = String(msg.from.id);
try {
var accounts = require(’./accounts’);
var addr = accounts.getAccountAddress(tgId);
await bot.sendMessage(tgId,
‘Your deposit address:\n<code>’ + addr + ‘</code>\n\nSend CASHX or PLS to this address. PLS is auto-swapped to CASHX.’,
{ parse_mode: ‘HTML’ }
);
} catch(e) {
await bot.sendMessage(tgId, ‘Open the casino to get your deposit address.’, { reply_markup: gameBtn(‘Open Casino’) });
}
});

bot.onText(//help/, async function(msg) {
var tgId = String(msg.from.id);
await bot.sendMessage(tgId,
‘<b>CashX Casino commands</b>\n\n/start - Open the casino\n/balance - Check CASHX balance\n/deposit - Get deposit address\n/help - This list’,
{ parse_mode: ‘HTML’, reply_markup: gameBtn(‘Open Casino’) }
);
});

bot.on(‘polling_error’, function(err) {
console.error(‘Polling error:’, err.message);
});

console.log(‘Bot ready’);
}

module.exports = { startBot };
