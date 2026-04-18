const TelegramBot = require('node-telegram-bot-api');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NETLIFY_URL = process.env.NETLIFY_URL || 'https://cashx-game.netlify.app';
let bot;
function startBot() {
  if (!BOT_TOKEN) { console.warn('No token'); return; }
  bot = new TelegramBot(BOT_TOKEN, { polling: true });
  function btn(label) {
    return { inline_keyboard: [[{ text: label, web_app: { url: NETLIFY_URL } }]] };
  }
  bot.onText(/\/start/, function(msg) {
    var id = String(msg.from.id);
    var name = msg.from.first_name || 'Player';
    bot.sendMessage(id, 'Welcome to CashX Casino ' + name + '!\n\nLottery, Dice, Hi-Lo and Jackpot.\nDeposit CASHX, play instantly.\n20% burned every round.', { reply_markup: btn('Open CashX Casino') });
  });
  bot.onText(/\/balance/, function(msg) {
    bot.sendMessage(String(msg.from.id), 'Open the casino to check your balance.', { reply_markup: btn('Open Casino') });
  });
  bot.onText(/\/deposit/, function(msg) {
    bot.sendMessage(String(msg.from.id), 'Open the casino to get your deposit address.', { reply_markup: btn('Open Casino') });
  });
  bot.onText(/\/help/, function(msg) {
    bot.sendMessage(String(msg.from.id), '/start - Open casino\n/balance - Check balance\n/deposit - Deposit address\n/help - This list', { reply_markup: btn('Open Casino') });
  });
  bot.on('polling_error', function(err) { console.error('Poll error:', err.message); });
  console.log('Bot ready');
}
module.exports = { startBot };
