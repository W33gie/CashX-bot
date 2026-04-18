/**

- notifications.js — Telegram message templates
  */

const MINI_APP_URL = process.env.MINI_APP_URL || ‘https://cashx-game.netlify.app’;
let bot;

function setBot(botInstance) {
bot = botInstance;
}

function gameBtn(label) {
return { inline_keyboard: [[{ text: label, url: MINI_APP_URL }]] };
}

async function send(telegramId, text, extra) {
if (!bot) return;
try {
await bot.sendMessage(telegramId, text, Object.assign({ parse_mode: ‘HTML’ }, extra || {}));
} catch (err) {
console.warn(’Could not notify ’ + telegramId + ’: ’ + err.message);
}
}

async function gameFilled(telegramId, opts) {
await send(telegramId,
‘⚡ <b>Game #’ + opts.gameId + ’ is full!</b>\n\nYou have <b>’ + opts.minutesLeft + ’ minutes</b> to reveal your secret.\n\nTap below to reveal now 👇’,
{ reply_markup: gameBtn(‘🔓 Open game’) });
}

async function revealUrgent(telegramId, opts) {
await send(telegramId,
‘⏰ <b>Hurry!</b> Game #’ + opts.gameId + ’ reveal window closing — ~’ + (opts.blocksLeft * 10) + ’ seconds left.’,
{ reply_markup: gameBtn(‘⚡ Open game’) });
}

async function gameWon(telegramId, opts) {
await send(telegramId,
‘🏆 <b>You won game #’ + opts.gameId + ‘!</b>\n\n<b>’ + formatCashX(opts.cashxAmount) + ’ CASHX</b> sent to your wallet.\n\n’ + formatCashX(opts.cashxBurned) + ’ CASHX burned 🔥’,
{ reply_markup: gameBtn(‘🎮 Play again’) });
}

async function gameRunnerUp(telegramId, opts) {
await send(telegramId,
‘🥈 <b>Runner-up in game #’ + opts.gameId + ‘</b>\n\n<b>’ + formatCashX(opts.cashxAmount) + ’ CASHX</b> sent to your wallet.\n\nBetter luck next round!’,
{ reply_markup: gameBtn(‘🎮 Play again’) });
}

async function gameLost(telegramId, opts) {
await send(telegramId,
‘😤 <b>Game #’ + opts.gameId + ’ finished</b>\n\nNot this time. ’ + formatCashX(opts.cashxBurned) + ’ CASHX burned 🔥\n\nYou have a 40% chance each round.’,
{ reply_markup: gameBtn(‘🎮 Try again’) });
}

async function gameCancelled(telegramId, opts) {
await send(telegramId,
‘❌ <b>Game #’ + opts.gameId + ’ was cancelled</b>\n\nYour <b>’ + opts.entryFeePls + ’ PLS</b> has been refunded.’,
{ reply_markup: gameBtn(‘🎮 New game’) });
}

async function walletLinked(telegramId, opts) {
const short = opts.walletAddress.slice(0, 8) + ‘…’ + opts.walletAddress.slice(-6);
await send(telegramId, ‘✅ <b>Wallet linked</b>\n\n<code>’ + short + ‘</code>’);
}

async function secretSaved(telegramId, opts) {
await send(telegramId, ‘💾 <b>Secret saved</b> for game #’ + opts.gameId + ‘.\n\nI'll remind you when it's time to reveal.’);
}

async function depositConfirmed(telegramId, opts) {
await send(telegramId,
‘✅ <b>Deposit confirmed!</b>\n\n<b>’ + opts.entryFee + ’ PLS</b> received for game #’ + opts.gameId + ‘.\n\nYou've been entered automatically — I'll reveal for you when the game fills.’,
{ reply_markup: gameBtn(‘📊 Watch game’) });
}

async function depositFailed(telegramId, opts) {
await send(telegramId,
‘❌ <b>Entry failed for game #’ + opts.gameId + ‘</b>\n\nYour PLS has been refunded. Please try again.’,
{ reply_markup: gameBtn(‘🔄 Try again’) });
}

async function depositRefunded(telegramId, opts) {
const short = opts.toAddress ? opts.toAddress.slice(0, 8) + ‘…’ + opts.toAddress.slice(-6) : ‘—’;
await send(telegramId, ‘↩️ <b>Refund sent</b>\n\n<b>’ + opts.amount + ’ PLS</b> returned to <code>’ + short + ‘</code>.’);
}

async function winningsForwarded(telegramId, opts) {
const short = opts.toAddress ? opts.toAddress.slice(0, 8) + ‘…’ + opts.toAddress.slice(-6) : ‘—’;
await send(telegramId, ‘💸 <b>Winnings sent!</b>\n\n<b>’ + formatCashX(opts.cashxAmount) + ’ CASHX</b> forwarded to:\n<code>’ + short + ‘</code>’);
}

function formatCashX(amount) {
const n = parseFloat(amount);
if (n >= 1000000) return (n / 1000000).toFixed(1) + ‘M’;
if (n >= 1000)    return Math.round(n / 1000) + ‘K’;
return Math.round(n).toLocaleString();
}

async function referralBonus(telegramId, { refereeId, bonusAmount }) {
const text =
`🎁 <b>Referral bonus earned!</b>\n\n` +
`Someone you referred just made their first deposit.\n\n` +
`<b>+${formatCashX(bonusAmount)} CASHX</b> added to your balance automatically.\n\n` +
`Keep sharing your referral link to earn more!`;
await send(telegramId, text, {
reply_markup: {
inline_keyboard: [[
{ text: ‘💰 View balance’, web_app: { url: MINI_APP_URL } },
]],
},
});
}

async function plsDepositReceived(telegramId, { plsAmount }) {
const text =
`⚡ <b>${plsAmount} PLS received!</b>\n\n` +
`Swapping to CASHX on PulseX now... Your balance will update in ~30 seconds.`;
await send(telegramId, text);
}

async function accountDeposit(telegramId, { amount, newBalance, fromPLS }) {
const depositLine = fromPLS
? `<b>${fromPLS} PLS</b> swapped to <b>${formatCashX(amount)} CASHX</b>`
: `<b>${formatCashX(amount)} CASHX</b> deposited`;
const text =
`💰 <b>Deposit confirmed!</b>\n\n` +
`${depositLine} — added to your account.\n\n` +
`Balance: <b>${formatCashX(newBalance)} CASHX</b>\n\n` +
`Ready to play!`;
await send(telegramId, text, {
reply_markup: {
inline_keyboard: [[
{ text: ‘🎮 Play now’, web_app: { url: MINI_APP_URL } },
]],
},
});
}

async function withdrawalSent(telegramId, { amount, toAddress, txHash, instant }) {
const short  = toAddress.slice(0,8) + ‘…’ + toAddress.slice(-6);
const shortTx = txHash ? txHash.slice(0,10) + ‘…’ : ‘-’;
const text =
`✅ <b>Withdrawal sent!</b>\n\n` +
`<b>${formatCashX(amount)} CASHX</b> sent to:\n<code>${short}</code>\n\n` +
`${instant ? '⚡ Instant transfer' : '🔗 On-chain transfer'}\n` +
`Tx: <code>${shortTx}</code>`;
await send(telegramId, text);
}

async function withdrawalFailed(telegramId, { amount, reason }) {
const text =
`❌ <b>Withdrawal failed</b>\n\n` +
`<b>${formatCashX(amount)} CASHX</b> could not be sent.\n\n` +
`Reason: ${reason}\n\n` +
`Your balance has been refunded.`;
await send(telegramId, text);
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
referralBonus,
plsDepositReceived,
accountDeposit,
withdrawalSent,
withdrawalFailed,
};
