/**
 * bot.js — Telegram bot command handlers
 *
 * Commands:
 *   /start        — welcome + link wallet
 *   /wallet       — link or update wallet address
 *   /games        — list open games
 *   /mysecret     — retrieve saved secret for a game
 *   /settings     — notification preferences
 *   /help         — command list
 *
 * The Mini App itself handles all on-chain interactions.
 * The bot is purely for notifications + account linking.
 */

const TelegramBot  = require('node-telegram-bot-api');
const db           = require('./db');
const notify       = require('./notifications');

const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL;
const WEBHOOK_URL  = process.env.WEBHOOK_URL; // optional — use polling if not set

let bot;

// ─── Start ─────────────────────────────────────────────

function startBot() {
  if (!BOT_TOKEN) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN not set — bot disabled');
    return;
  }

  const useWebhook = !!WEBHOOK_URL;

  bot = new TelegramBot(BOT_TOKEN, {
    polling: !useWebhook,
  });

  if (useWebhook) {
    bot.setWebHook(`${WEBHOOK_URL}/bot${BOT_TOKEN}`);
  }

  notify.setBot(bot);
  registerCommands();
  registerHandlers();

  return bot;
}

// ─── Register bot commands (shows in Telegram menu) ────

async function registerCommands() {
  await bot.setMyCommands([
    { command: 'start',    description: 'Get started' },
    { command: 'wallet',   description: 'Link your wallet address' },
    { command: 'games',    description: 'See open games' },
    { command: 'mysecret', description: 'Retrieve saved secret for a game' },
    { command: 'settings', description: 'Notification preferences' },
    { command: 'help',     description: 'Show all commands' },
  ]);
}

// ─── Handlers ──────────────────────────────────────────

function registerHandlers() {

  // /start
  bot.onText(/\/start/, async (msg) => {
    const tgId   = String(msg.from.id);
    const tgName = msg.from.username || msg.from.first_name || 'Player';

    db.upsertPlayer({ telegramId: tgId, telegramName: tgName });

    const player = db.getPlayerByTelegram(tgId);
    const hasWallet = !!player?.wallet_address;

    const text = hasWallet
      ? `Welcome back, ${tgName}! Ready to play? 🎮`
      : `Welcome to <b>CashX Game</b>! 🎮\n\n` +
        `5 players enter, 1 wins 3× their stake in CASHX — 20% burned every round.\n\n` +
        `To get started, link your PulseChain wallet:\n` +
        `<code>/wallet 0xYourWalletAddress</code>`;

    await bot.sendMessage(tgId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '🎮 Open game', url: MINI_APP_URL },
        ]],
      },
    });
  });

  // /wallet <address>
  bot.onText(/\/wallet(?:\s+(.+))?/, async (msg, match) => {
    const tgId      = String(msg.from.id);
    const tgName    = msg.from.username || msg.from.first_name || 'Player';
    const address   = match[1]?.trim();

    if (!address) {
      const player = db.getPlayerByTelegram(tgId);
      const current = player?.wallet_address;
      await bot.sendMessage(tgId,
        current
          ? `Your linked wallet:\n<code>${current}</code>\n\nTo change it:\n<code>/wallet 0xNewAddress</code>`
          : `No wallet linked yet.\n\nUse:\n<code>/wallet 0xYourWalletAddress</code>`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Basic EVM address validation
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      await bot.sendMessage(tgId,
        `That doesn't look like a valid wallet address.\n\nExpecting: <code>0x</code> + 40 hex characters.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Check if already claimed by another user
    const existing = db.getPlayerByWallet(address);
    if (existing && existing.telegram_id !== tgId) {
      await bot.sendMessage(tgId,
        `That wallet is already linked to another account.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    db.upsertPlayer({ telegramId: tgId, telegramName: tgName, walletAddress: address });
    await notify.walletLinked(tgId, { walletAddress: address });
  });

  // /games
  bot.onText(/\/games/, async (msg) => {
    const tgId = String(msg.from.id);
    const games = db.getOpenGames();

    if (games.length === 0) {
      await bot.sendMessage(tgId,
        `No open games right now.\n\nOpen the app to create one!`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '🎮 Create game', url: MINI_APP_URL },
            ]],
          },
        }
      );
      return;
    }

    const lines = games.map(g => {
      const statusIcon = g.status === 'open' ? '🟢' : '⚡';
      const slots = `${g.player_count}/${g.max_players}`;
      return `${statusIcon} <b>Game #${g.game_id}</b> — ${slots} players — ${g.entry_fee_pls} PLS each`;
    });

    await bot.sendMessage(tgId,
      `<b>Open games</b>\n\n${lines.join('\n')}\n\nTap to join 👇`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '🎮 Open game lobby', url: MINI_APP_URL },
          ]],
        },
      }
    );
  });

  // /mysecret <gameId>
  bot.onText(/\/mysecret(?:\s+(\d+))?/, async (msg, match) => {
    const tgId   = String(msg.from.id);
    const gameId = match[1] ? parseInt(match[1]) : null;

    if (gameId === null) {
      await bot.sendMessage(tgId,
        `Usage: <code>/mysecret 14</code> (replace 14 with your game ID)`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    const secret = db.getSecret(tgId, gameId);
    if (!secret) {
      await bot.sendMessage(tgId,
        `No saved secret found for game #${gameId}.\n\n` +
        `If you committed via the Mini App, your secret was stored locally in your browser — ` +
        `check your Telegram Saved Messages.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    await bot.sendMessage(tgId,
      `🔐 <b>Your secret for game #${gameId}</b>\n\n` +
      `<b>Secret:</b>\n<code>${secret.secret}</code>\n\n` +
      `<b>Salt:</b>\n<code>${secret.salt}</code>\n\n` +
      `<b>Commitment:</b>\n<code>${secret.commitment}</code>\n\n` +
      `Paste these into the Reveal tab in the game app.`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🔓 Go to reveal',
              url: `${MINI_APP_URL?gameId=${gameId}&tab=reveal` },
            },
          ]],
        },
      }
    );
  });

  // /settings
  bot.onText(/\/settings/, async (msg) => {
    const tgId  = String(msg.from.id);
    const player = db.getPlayerByTelegram(tgId);

    if (!player) {
      await bot.sendMessage(tgId, 'Use /start first.');
      return;
    }

    const fillIcon   = player.notify_fill   ? '🔔' : '🔕';
    const revealIcon = player.notify_reveal ? '🔔' : '🔕';
    const resultIcon = player.notify_result ? '🔔' : '🔕';

    await bot.sendMessage(tgId,
      `<b>Notification settings</b>\n\nTap to toggle:`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: `${fillIcon} Game filled`, callback_data: 'toggle_fill' }],
            [{ text: `${revealIcon} Reveal reminders`, callback_data: 'toggle_reveal' }],
            [{ text: `${resultIcon} Game results`, callback_data: 'toggle_result' }],
          ],
        },
      }
    );
  });

  // /help
  bot.onText(/\/help/, async (msg) => {
    const tgId = String(msg.from.id);
    await bot.sendMessage(tgId,
      `<b>CashX Game — commands</b>\n\n` +
      `/start — welcome screen\n` +
      `/wallet — link your PulseChain wallet\n` +
      `/games — see open game rooms\n` +
      `/mysecret &lt;gameId&gt; — retrieve your saved secret\n` +
      `/settings — notification preferences\n` +
      `/help — this list\n\n` +
      `<i>All game actions (join, commit, reveal, claim) happen inside the Mini App.</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // Callback queries (settings toggles)
  bot.on('callback_query', async (query) => {
    const tgId = String(query.from.id);
    const data = query.data;

    const player = db.getPlayerByTelegram(tgId);
    if (!player) { await bot.answerCallbackQuery(query.id); return; }

    if (data === 'toggle_fill') {
      db.updateNotifyPrefs(tgId, { fill: !player.notify_fill });
    } else if (data === 'toggle_reveal') {
      db.updateNotifyPrefs(tgId, { reveal: !player.notify_reveal });
    } else if (data === 'toggle_result') {
      db.updateNotifyPrefs(tgId, { result: !player.notify_result });
    }

    await bot.answerCallbackQuery(query.id, { text: 'Updated!' });

    // Re-render settings
    const updated = db.getPlayerByTelegram(tgId);
    const fillIcon   = updated.notify_fill   ? '🔔' : '🔕';
    const revealIcon = updated.notify_reveal ? '🔔' : '🔕';
    const resultIcon = updated.notify_result ? '🔔' : '🔕';

    await bot.editMessageReplyMarkup(
      {
        inline_keyboard: [
          [{ text: `${fillIcon} Game filled`,       callback_data: 'toggle_fill'   }],
          [{ text: `${revealIcon} Reveal reminders`, callback_data: 'toggle_reveal' }],
          [{ text: `${resultIcon} Game results`,     callback_data: 'toggle_result' }],
        ],
      },
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    );
  });
}

module.exports = { startBot };
