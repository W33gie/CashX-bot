/**

- bot.js - Telegram bot command handlers
  */

const TelegramBot  = require(‘node-telegram-bot-api’);
const db           = require(’./db’);
const notify       = require(’./notifications’);

const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL || ‘https://t.me/CashX_Ai_bot/CashXCasino’;
const WEBHOOK_URL  = process.env.WEBHOOK_URL;

let bot;

function startBot() {
if (!BOT_TOKEN) {
console.warn(‘⚠️  TELEGRAM_BOT_TOKEN not set — bot disabled’);
return;
}

bot = new TelegramBot(BOT_TOKEN, { polling: !WEBHOOK_URL });

if (WEBHOOK_URL) {
bot.setWebHook(WEBHOOK_URL + ‘/bot’ + BOT_TOKEN);
}

notify.setBot(bot);
registerCommands();
registerHandlers();
return bot;
}

async function registerCommands() {
try {
await bot.setMyCommands([
{ command: ‘start’,    description: ‘Get started’ },
{ command: ‘wallet’,   description: ‘Link your wallet address’ },
{ command: ‘games’,    description: ‘See open games’ },
{ command: ‘mysecret’, description: ‘Retrieve saved secret for a game’ },
{ command: ‘settings’, description: ‘Notification preferences’ },
{ command: ‘help’,     description: ‘Show all commands’ },
]);
} catch(e) {
console.warn(‘Could not register commands:’, e.message);
}
}

function gameBtn(label) {
// Use web_app type so Telegram opens as Mini App, not external browser
const netlifyUrl = process.env.NETLIFY_URL || ‘https://cashx-game.netlify.app’;
return { inline_keyboard: [[{ text: label, web_app: { url: netlifyUrl } }]] };
}

function registerHandlers() {

bot.onText(//start(?:\s+(.+))?/, async (msg, match) => {
const tgId   = String(msg.from.id);
const tgName = msg.from.username || msg.from.first_name || ‘Player’;
db.upsertPlayer({ telegramId: tgId, telegramName: tgName });

```
// Handle referral param
const startParam = match && match[1] ? match[1].trim() : '';
if (startParam.startsWith('ref_')) {
  const referrerId = startParam.replace('ref_', '');
  if (referrerId !== tgId) {
    db.registerReferral(referrerId, tgId);
    console.log('Referral registered: ' + referrerId + ' -> ' + tgId);
  }
}

const player = db.getPlayerByTelegram(tgId);
const text = player
  ? 'Welcome back, <b>' + tgName + '</b>! Ready to play? 🎲'
  : 'Welcome to <b>CashX Casino</b>! 🎲\n\nLottery, Dice, Hi-Lo and Jackpot.\nDeposit CASHX, play instantly, win big.\n20% burned every round.\n\nTap below to open the casino:';
await bot.sendMessage(tgId, text, { parse_mode: 'HTML', reply_markup: gameBtn('🎲 Open CashX Casino') });
```

});

bot.onText(//wallet(?:\s+(.+))?/, async (msg, match) => {
const tgId    = String(msg.from.id);
const tgName  = msg.from.username || msg.from.first_name || ‘Player’;
const address = match[1]?.trim();
if (!address) {
const player  = db.getPlayerByTelegram(tgId);
const current = player?.wallet_address;
await bot.sendMessage(tgId,
current
? ‘Your linked wallet:\n<code>’ + current + ‘</code>\n\nTo change: <code>/wallet 0xNewAddress</code>’
: ‘No wallet linked yet.\n\nUse: <code>/wallet 0xYourAddress</code>’,
{ parse_mode: ‘HTML’ });
return;
}
if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
await bot.sendMessage(tgId, ‘Invalid address. Must start with <code>0x</code> and be 42 characters.’, { parse_mode: ‘HTML’ });
return;
}
const existing = db.getPlayerByWallet(address);
if (existing && existing.telegram_id !== tgId) {
await bot.sendMessage(tgId, ‘That wallet is already linked to another account.’);
return;
}
db.upsertPlayer({ telegramId: tgId, telegramName: tgName, walletAddress: address });
await bot.sendMessage(tgId, ‘✅ Wallet linked: <code>’ + address.slice(0,8) + ‘…’ + address.slice(-6) + ‘</code>’, { parse_mode: ‘HTML’ });
});

bot.onText(//games/, async (msg) => {
const tgId  = String(msg.from.id);
const games = db.getOpenGames();
if (games.length === 0) {
await bot.sendMessage(tgId, ‘No open games right now. Open the app to create one!’, { reply_markup: gameBtn(‘🎮 Create game’) });
return;
}
const lines = games.map(g => {
const icon = g.status === ‘open’ ? ‘🟢’ : ‘⚡’;
return icon + ’ <b>Game #’ + g.game_id + ‘</b> — ’ + g.player_count + ‘/’ + g.max_players + ’ players — ’ + g.entry_fee_pls + ’ PLS each’;
});
await bot.sendMessage(tgId, ‘<b>Open games</b>\n\n’ + lines.join(’\n’), { parse_mode: ‘HTML’, reply_markup: gameBtn(‘🎮 Open lobby’) });
});

bot.onText(//mysecret(?:\s+(\d+))?/, async (msg, match) => {
const tgId   = String(msg.from.id);
const gameId = match[1] ? parseInt(match[1]) : null;
if (gameId === null) {
await bot.sendMessage(tgId, ‘Usage: <code>/mysecret 14</code>’, { parse_mode: ‘HTML’ });
return;
}
const secret = db.getSecret(tgId, gameId);
if (!secret) {
await bot.sendMessage(tgId, ‘No saved secret for game #’ + gameId + ‘.\n\nCheck your Telegram Saved Messages.’);
return;
}
await bot.sendMessage(tgId,
‘🔐 <b>Secret for game #’ + gameId + ‘</b>\n\n<b>Secret:</b>\n<code>’ + secret.secret + ‘</code>\n\n<b>Salt:</b>\n<code>’ + secret.salt + ‘</code>’,
{ parse_mode: ‘HTML’, reply_markup: gameBtn(‘🔓 Go to reveal’) });
});

bot.onText(//settings/, async (msg) => {
const tgId   = String(msg.from.id);
const player = db.getPlayerByTelegram(tgId);
if (!player) { await bot.sendMessage(tgId, ‘Use /start first.’); return; }
const f = player.notify_fill   ? ‘🔔’ : ‘🔕’;
const r = player.notify_reveal ? ‘🔔’ : ‘🔕’;
const s = player.notify_result ? ‘🔔’ : ‘🔕’;
await bot.sendMessage(tgId, ‘<b>Notification settings</b>\n\nTap to toggle:’, {
parse_mode: ‘HTML’,
reply_markup: {
inline_keyboard: [
[{ text: f + ’ Game filled’,       callback_data: ‘toggle_fill’   }],
[{ text: r + ’ Reveal reminders’,   callback_data: ‘toggle_reveal’ }],
[{ text: s + ’ Game results’,       callback_data: ‘toggle_result’ }],
],
},
});
});

bot.onText(//help/, async (msg) => {
const tgId = String(msg.from.id);
await bot.sendMessage(tgId,
‘<b>CashX Game — commands</b>\n\n/start — welcome\n/wallet — link wallet\n/games — open games\n/mysecret <id> — get your secret\n/settings — notifications\n/help — this list’,
{ parse_mode: ‘HTML’ });
});

bot.on(‘callback_query’, async (query) => {
const tgId = String(query.from.id);
const data = query.data;
const player = db.getPlayerByTelegram(tgId);
if (!player) { await bot.answerCallbackQuery(query.id); return; }
if (data === ‘toggle_fill’)   db.updateNotifyPrefs(tgId, { fill:   !player.notify_fill   });
if (data === ‘toggle_reveal’) db.updateNotifyPrefs(tgId, { reveal: !player.notify_reveal });
if (data === ‘toggle_result’) db.updateNotifyPrefs(tgId, { result: !player.notify_result });
await bot.answerCallbackQuery(query.id, { text: ‘Updated!’ });
const updated = db.getPlayerByTelegram(tgId);
const f = updated.notify_fill   ? ‘🔔’ : ‘🔕’;
const r = updated.notify_reveal ? ‘🔔’ : ‘🔕’;
const s = updated.notify_result ? ‘🔔’ : ‘🔕’;
await bot.editMessageReplyMarkup({
inline_keyboard: [
[{ text: f + ’ Game filled’,       callback_data: ‘toggle_fill’   }],
[{ text: r + ’ Reveal reminders’,   callback_data: ‘toggle_reveal’ }],
[{ text: s + ’ Game results’,       callback_data: ‘toggle_result’ }],
],
}, { chat_id: query.message.chat.id, message_id: query.message.message_id });
});

bot.on(‘polling_error’, (err) => {
console.error(‘Polling error:’, err.message);
});
}

module.exports = { startBot };
