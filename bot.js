const TelegramBot = require('node-telegram-bot-api');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NETLIFY_URL = process.env.NETLIFY_URL || 'https://cashx-game.netlify.app';
let bot;
function startBot() {
  if (!BOT_TOKEN) { console.warn('No token'); return; }
  bot = new TelegramBot(BOT_TOKEN, { polling: true });
  function dmBtn(label) {
    return { inline_keyboard: [[{ text: label, web_app: { url: NETLIFY_URL } }]] };
  }
  function groupBtn(label) {
    return { inline_keyboard: [[{ text: label, url: 'https://t.me/CashX_Ai_bot?start=open' }]] };
  }
  bot.onText(/\/start/, function(msg) {
    var id = String(msg.from.id);
    var name = msg.from.first_name || 'Player';
    var isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    if (isGroup) {
      bot.sendMessage(msg.chat.id, 'Welcome to CashX Casino! Tap below to open the casino in your DMs.', { reply_markup: groupBtn('Open CashX Casino') });
    } else {
      bot.sendMessage(id, 'Welcome to CashX Casino ' + name + '!\n\nLottery, Dice, Hi-Lo and Jackpot.\nDeposit CASHX, play instantly.\n20% burned every round.', { reply_markup: dmBtn('Open CashX Casino') });
    }
  });
  bot.onText(/\/play/, function(msg) {
    var isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    if (isGroup) {
      bot.sendMessage(msg.chat.id, 'Tap below to open CashX Casino!', { reply_markup: groupBtn('Play CashX Casino') });
    }
  });
  bot.onText(/\/balance/, function(msg) {
    bot.sendMessage(String(msg.from.id), 'Open the casino to check your balance.', { reply_markup: dmBtn('Open Casino') });
  });
  bot.onText(/\/deposit/, function(msg) {
    bot.sendMessage(String(msg.from.id), 'Open the casino to get your deposit address.', { reply_markup: dmBtn('Open Casino') });
  });
  bot.onText(/\/help/, function(msg) {
    var isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    var chatId = isGroup ? msg.chat.id : String(msg.from.id);
    var btn = isGroup ? groupBtn('Open Casino') : dmBtn('Open Casino');
    bot.sendMessage(chatId, '/start - Open casino\n/play - Casino link in group\n/balance - Check balance\n/deposit - Deposit address\n/help - This list', { reply_markup: btn });
  });
  bot.on('polling_error', function(err) { console.error('Poll error:', err.message); });
  console.log('Bot ready');
}
module.exports = { startBot };
