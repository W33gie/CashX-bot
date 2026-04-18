const TelegramBot = require('node-telegram-bot-api');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let bot;
function startBot(){
  if(!BOT_TOKEN){ console.warn('No token'); return; }
  bot = new TelegramBot(BOT_TOKEN, {polling: true});
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.from.id, 'CashX Casino is live!');
  });
  console.log('Bot ready');
}
module.exports = { startBot };
