/**

- notifications.js — all Telegram message templates
- 
- Each function sends a push message to a player’s chat.
- Messages include a “Open game” button that launches the Mini App.
  */

const TelegramBot = require(‘node-telegram-bot-api’);

const MINI_APP_URL = process.env.MINI_APP_URL; // e.g. https://t.me/YourBot/game
let bot;

function setBot(botInstance) {
bot = botInstance;
}

// ─── Shared helper ─────────────────────────────────────

function openGameBtn(gameId, label = ‘Open game’) {
return {
inline_keyboard: [[
{
text: label,
url: `${MINI_APP_URL}?gameId=${gameId}`,
},
]],
};
}

async function send(telegramId, text, extra = {}) {
if (!bot) { console.warn(‘Bot not ready — skipping notification’); return; }
try {
await bot.sendMessage(telegramId, text, {
parse_mode: ‘HTML’,
…extra,
});
} catch (err) {
// User may have blocked the bot — don’t crash
console.warn(`Could not notify ${telegramId}: ${err.message}`);
}
}

// ─── Message templates ─────────────────────────────────

async function gameFilled(telegramId, { gameId, minutesLeft, entryFeePls }) {
const text =
`⚡ <b>Game #${gameId} is full!</b>\n\n` +
`All players have joined. You now have <b>${minutesLeft} minutes</b> to reveal your secret.\n\n` +
`If you don't reveal in time, your entry fee will be refunded — but you'll forfeit your chance to win.\n\n` +
`Tap below to reveal now 👇`;

await send(telegramId, text, {
reply_markup: openGameBtn(gameId, ‘🔓 Reveal my secret’),
});
}

async function revealUrgent(telegramId, { gameId, blocksLeft }) {
const secondsLeft = blocksLeft * 10;
const text =
`⏰ <b>Hurry — reveal window closing!</b>\n\n` +
`Game #${gameId} has roughly <b>${secondsLeft} seconds</b> left.\n\n` +
`Reveal your secret now or your entry will be forfeited.`;

await send(telegramId, text, {
reply_markup: openGameBtn(gameId, ‘⚡ Reveal now’),
});
}

async function gameWon(telegramId, { gameId, cashxAmount, cashxBurned }) {
const text =
`🏆 <b>You won game #${gameId}!</b>\n\n` +
`<b>${formatCashX(cashxAmount)} CASHX</b> is waiting in your wallet.\n\n` +
`${formatCashX(cashxBurned)} CASHX was burned forever this round 🔥\n\n` +
`Ready for another round?`;

await send(telegramId, text, {
reply_markup: {
inline_keyboard: [[
{ text: ‘🎮 Play again’, web_app: { url: MINI_APP_URL } },
{ text: ‘📊 View result’, url: `${MINI_APP_URL}?gameId=${gameId}` },
]],
},
});
}

async function gameRunnerUp(telegramId, { gameId, cashxAmount, cashxBurned }) {
const text =
`🥈 <b>Runner-up in game #${gameId}</b>\n\n` +
`You broke even — <b>${formatCashX(cashxAmount)} CASHX</b> is in your wallet.\n\n` +
`${formatCashX(cashxBurned)} CASHX burned this round 🔥\n\n` +
`Better luck next round!`;

await send(telegramId, text, {
reply_markup: {
inline_keyboard: [[
{ text: ‘🎮 Play again’, web_app: { url: MINI_APP_URL } },
]],
},
});
}

async function gameLost(telegramId, { gameId, cashxBurned }) {
const text =
`😤 <b>Game #${gameId} finished</b>\n\n` +
`Not this time. ${formatCashX(cashxBurned)} CASHX was burned 🔥\n\n` +
`You have a 40% chance each round — jump back in.`;

await send(telegramId, text, {
reply_markup: {
inline_keyboard: [[
{ text: ‘🎮 Try again’, web_app: { url: MINI_APP_URL } },
]],
},
});
}

async function gameCancelled(telegramId, { gameId, entryFeePls }) {
const text =
`❌ <b>Game #${gameId} was cancelled</b>\n\n` +
`Not all players revealed in time. Your <b>${entryFeePls} PLS</b> has been refunded to your wallet.\n\n` +
`Want to start a new game?`;

await send(telegramId, text, {
reply_markup: {
inline_keyboard: [[
{ text: ‘🎮 New game’, web_app: { url: MINI_APP_URL } },
]],
},
});
}

async function walletLinked(telegramId, { walletAddress }) {
const short = walletAddress.slice(0, 8) + ‘…’ + walletAddress.slice(-6);
const text =
`✅ <b>Wallet linked</b>\n\n` +
`<code>${short}</code>\n\n` +
`You'll now receive game notifications here. Use /settings to adjust.`;

await send(telegramId, text);
}

async function secretSaved(telegramId, { gameId }) {
const text =
`💾 <b>Secret saved</b>\n\n` +
`Your secret for game #${gameId} is saved securely. ` +
`When the game fills, I'll remind you to reveal it.`;

await send(telegramId, text);
}

async function depositConfirmed(telegramId, { gameId, entryFee, txHash }) {
const short = txHash ? txHash.slice(0,10) + ‘…’ : ‘—’;
const text =
`✅ <b>Deposit confirmed!</b>\n\n` +
`<b>${entryFee} PLS</b> received for game #${gameId}.\n\n` +
`You've been automatically entered. I'll notify you when the game fills and reveal for you automatically — no action needed.\n\n` +
`Tx: <code>${short}</code>`;

await send(telegramId, text, {
reply_markup: openGameBtn(gameId, ‘📊 Watch game’),
});
}

async function depositFailed(telegramId, { gameId, reason }) {
const text =
`❌ <b>Entry failed for game #${gameId}</b>\n\n` +
`Something went wrong: ${reason}\n\n` +
`Your PLS has been refunded. Please try again.`;

await send(telegramId, text, {
reply_markup: {
inline_keyboard: [[
{ text: ‘🔄 Try again’, web_app: { url: MINI_APP_URL } },
]],
},
});
}

async function depositRefunded(telegramId, { gameId, amount, toAddress }) {
const short = toAddress ? toAddress.slice(0,8) + ‘…’ + toAddress.slice(-6) : ‘—’;
const text =
`↩️ <b>Refund sent</b>\n\n` +
`<b>${amount} PLS</b> has been returned to <code>${short}</code>.\n\n` +
`Game #${gameId} — wrong amount received or entry failed.`;

await send(telegramId, text);
}

async function winningsForwarded(telegramId, { gameId, cashxAmount, toAddress, txHash }) {
const short    = toAddress ? toAddress.slice(0,8) + ‘…’ + toAddress.slice(-6) : ‘—’;
const shortTx  = txHash ? txHash.slice(0,10) + ‘…’ : ‘—’;
const text =
`💸 <b>Winnings sent!</b>\n\n` +
`<b>${formatCashX(cashxAmount)} CASHX</b> forwarded to:\n<code>${short}</code>\n\n` +
`Game #${gameId} · Tx: <code>${shortTx}</code>`;

await send(telegramId, text);
}

function formatCashX(amount) {
const n = parseFloat(amount);
if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ‘M’;
if (n >= 1_000)     return Math.round(n / 1_000) + ‘K’;
return Math.round(n).toLocaleString();
}

module.exports = {
setBot,
gameFilled,
revealUrgent,
gameWon,
gameRunnerUp,
gameLost,
gameCancelled,
walletLinked,
secretSaved,
depositConfirmed,
depositFailed,
depositRefunded,
winningsForwarded,
};
