/**
 * watcher.js - PulseChain event listener
 *
 * Watches for these contract events:
 *   GameCreated      - track new game rooms
 *   PlayerJoined     - track who's in each game
 *   GameFilled       - notify all players to reveal
 *   SecretRevealed   - update reveal progress
 *   GameResolved     - notify winner + runner-up
 *   GameCancelled    - notify players of refund
 *
 * Uses ethers.js with a fallback poll loop in case
 * WebSocket connections drop (common on public RPCs).
 */

const { ethers }    = require('ethers');
const db            = require('./db');
const { notify }    = require('./notifications');
const deposits      = require('./deposits');

// --- Config --------------------------------------------

const RPC_URL          = process.env.PULSCHAIN_RPC_URL || 'https://rpc.pulsechain.com';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const POLL_INTERVAL_MS = 12_000; // PulseChain ~10s blocks
const BLOCKS_LOOKBACK  = 100;    // on startup, scan last N blocks for missed events

// --- ABI (events only) --------------------------------

const ABI = [
  'event GameCreated(uint256 indexed gameId, uint256 indexed modeId)',
  'event PlayerJoined(uint256 indexed gameId, address indexed player, uint256 slotIndex)',
  'event GameFilled(uint256 indexed gameId, uint256 revealDeadline)',
  'event SecretRevealed(uint256 indexed gameId, address indexed player)',
  'event GameResolved(uint256 indexed gameId, address winner, address runnerUp, uint256 cashxBought, uint256 burned)',
  'event GameCancelled(uint256 indexed gameId)',
  // Read functions we need for backfill
  'function getGame(uint256 gameId) view returns (uint256 modeId, uint8 status, uint256 playerCount, uint256 revealCount, uint256 revealDeadline, address winner, address runnerUp, bytes32 randomSeed)',
  'function gameModes(uint256) view returns (uint256 entryFee, uint256 playerCount, bool active)',
  'function gameCount() view returns (uint256)',
];

let provider;
let contract;
let lastProcessedBlock = 0;

// --- Start ---------------------------------------------

async function startWatcher() {
  if (!CONTRACT_ADDRESS) {
    console.warn('    CONTRACT_ADDRESS not set - watcher disabled');
    return;
  }

  provider = new ethers.JsonRpcProvider(RPC_URL);
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  // Catch up on any events we missed since last run
  await backfill();

  // Start polling loop (more reliable than websocket for public RPCs)
  setInterval(pollNewBlocks, POLL_INTERVAL_MS);

  console.log(`   Watching ${CONTRACT_ADDRESS} on PulseChain`);
}

// --- Backfill ------------------------------------------

async function backfill() {
  try {
    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - BLOCKS_LOOKBACK);
    console.log(`  Backfilling events from block ${fromBlock} to ${latest}`);

    await processBlockRange(fromBlock, latest);
    lastProcessedBlock = latest;
  } catch (err) {
    console.error('Backfill error:', err.message);
  }
}

// --- Poll loop -----------------------------------------

async function pollNewBlocks() {
  try {
    const latest = await provider.getBlockNumber();
    if (latest <= lastProcessedBlock) return;

    await processBlockRange(lastProcessedBlock + 1, latest);
    lastProcessedBlock = latest;
  } catch (err) {
    console.error('Poll error:', err.message);
  }
}

// --- Process a range of blocks -------------------------

async function processBlockRange(fromBlock, toBlock) {
  // Chunk into 500-block windows to avoid RPC limits
  const CHUNK = 500;
  for (let from = fromBlock; from <= toBlock; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, toBlock);
    await fetchEvents(from, to);
  }
}

async function fetchEvents(fromBlock, toBlock) {
  const filter = { address: CONTRACT_ADDRESS, fromBlock, toBlock };

  const [
    createdLogs,
    joinedLogs,
    filledLogs,
    revealedLogs,
    resolvedLogs,
    cancelledLogs,
  ] = await Promise.all([
    contract.queryFilter(contract.filters.GameCreated(),     fromBlock, toBlock),
    contract.queryFilter(contract.filters.PlayerJoined(),    fromBlock, toBlock),
    contract.queryFilter(contract.filters.GameFilled(),      fromBlock, toBlock),
    contract.queryFilter(contract.filters.SecretRevealed(),  fromBlock, toBlock),
    contract.queryFilter(contract.filters.GameResolved(),    fromBlock, toBlock),
    contract.queryFilter(contract.filters.GameCancelled(),   fromBlock, toBlock),
  ]);

  // Process in chronological order within range
  const allEvents = [
    ...createdLogs.map(e   => ({ ...e, _type: 'GameCreated'     })),
    ...joinedLogs.map(e    => ({ ...e, _type: 'PlayerJoined'    })),
    ...filledLogs.map(e    => ({ ...e, _type: 'GameFilled'      })),
    ...revealedLogs.map(e  => ({ ...e, _type: 'SecretRevealed'  })),
    ...resolvedLogs.map(e  => ({ ...e, _type: 'GameResolved'    })),
    ...cancelledLogs.map(e => ({ ...e, _type: 'GameCancelled'   })),
  ].sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);

  for (const event of allEvents) {
    await handleEvent(event).catch(err =>
      console.error(`Error handling ${event._type}:`, err.message)
    );
  }
}

// --- Event handlers ------------------------------------

async function handleEvent(event) {
  const args = event.args;

  switch (event._type) {

    case 'GameCreated': {
      const gameId = Number(args.gameId);
      const modeId = Number(args.modeId);

      // Fetch mode config to know entry fee + player count
      const mode = await contract.gameModes(modeId);
      const entryFeePls = ethers.formatEther(mode.entryFee);

      db.upsertGame({
        gameId,
        modeId,
        status:      'open',
        playerCount: 0,
        maxPlayers:  Number(mode.playerCount),
        entryFeePls,
      });

      console.log(`  Game #${gameId} created - mode ${modeId}, ${mode.playerCount} players, ${entryFeePls} PLS each`);
      break;
    }

    case 'PlayerJoined': {
      const gameId = Number(args.gameId);
      const wallet = args.player.toLowerCase();
      const slot   = Number(args.slotIndex);

      db.addGamePlayer(gameId, wallet, slot);

      // Update player count in games table
      const game = db.getGame(gameId);
      if (game) {
        db.upsertGame({
          gameId,
          modeId:      game.mode_id,
          status:      game.status,
          playerCount: slot + 1,
          maxPlayers:  game.max_players,
          entryFeePls: game.entry_fee_pls,
        });
      }

      console.log(`  Player joined game #${gameId} - slot ${slot} - ${wallet.slice(0,8)}...`);
      break;
    }

    case 'GameFilled': {
      const gameId        = Number(args.gameId);
      const revealDeadline = Number(args.revealDeadline); // block number

      db.updateGameStatus(gameId, 'filled', { revealDeadline });

      // Estimate real time for the deadline
      const currentBlock = await provider.getBlockNumber();
      const blocksLeft   = revealDeadline - currentBlock;
      const secondsLeft  = blocksLeft * 10; // ~10s per PulseChain block
      const minutesLeft  = Math.max(1, Math.round(secondsLeft / 60));

      console.log(`  Game #${gameId} filled! Reveal window: ${minutesLeft} min`);

      // Auto-reveal for deposit-based players (no manual action needed)
      await deposits.autoRevealForGame(gameId).catch(err =>
        console.error('Auto-reveal error:', err.message)
      );

      // Notify all players in this game
      const players = db.getGamePlayers(gameId);
      for (const p of players) {
        const tgUser = db.getPlayerByWallet(p.wallet_address);
        if (!tgUser || !tgUser.notify_reveal) continue;
        if (db.wasNotified(tgUser.telegram_id, gameId, 'game_filled')) continue;

        await notify.gameFilled(tgUser.telegram_id, {
          gameId,
          minutesLeft,
          entryFeePls: db.getGame(gameId)?.entry_fee_pls,
        });

        db.logNotification(tgUser.telegram_id, gameId, 'game_filled');
      }
      break;
    }

    case 'SecretRevealed': {
      const gameId = Number(args.gameId);
      const wallet = args.player.toLowerCase();

      db.markRevealed(gameId, wallet);

      const players  = db.getGamePlayers(gameId);
      const revealed = players.filter(p => p.has_revealed).length;
      const total    = players.length;

      console.log(`  Secret revealed in game #${gameId} - ${revealed}/${total}`);

      // Nudge unrevealed players if getting close to deadline
      const game = db.getGame(gameId);
      const currentBlock = await provider.getBlockNumber().catch(() => 0);
      const blocksLeft = (game?.reveal_deadline || 0) - currentBlock;

      if (blocksLeft < 20 && blocksLeft > 0) {
        // Under ~3 minutes left - send urgency notification
        for (const p of players) {
          if (p.has_revealed) continue;
          const tgUser = db.getPlayerByWallet(p.wallet_address);
          if (!tgUser || !tgUser.notify_reveal) continue;
          if (db.wasNotified(tgUser.telegram_id, gameId, 'reveal_urgent')) continue;

          await notify.revealUrgent(tgUser.telegram_id, { gameId, blocksLeft });
          db.logNotification(tgUser.telegram_id, gameId, 'reveal_urgent');
        }
      }
      break;
    }

    case 'GameResolved': {
      const gameId      = Number(args.gameId);
      const winner      = args.winner.toLowerCase();
      const runnerUp    = args.runnerUp.toLowerCase();
      const cashxBought = ethers.formatUnits(args.cashxBought, 18);
      const cashxBurned = ethers.formatUnits(args.burned, 18);

      db.updateGameStatus(gameId, 'resolved', {
        winnerAddress: winner,
        runnerAddress: runnerUp,
        cashxBought,
        cashxBurned,
      });

      // Forward winnings to deposit players' source addresses
      const depositSessions = db.getDepositSessionsByGame(gameId);
      for (const session of depositSessions) {
        if (session.status !== 'revealed') continue;
        const isWinner   = session.deposit_address.toLowerCase() === winner;
        const isRunnerUp = session.deposit_address.toLowerCase() === runnerUp;
        if (isWinner || isRunnerUp) {
          deposits.forwardWinnings({
            telegramId:     session.telegram_id,
            gameId,
            depositAddress: session.deposit_address,
            winnerAddress:  winner,
          }).catch(err => console.error('Forward winnings error:', err.message));
        }
      }

      console.log(`  Game #${gameId} resolved - winner ${winner.slice(0,8)}... - ${cashxBought} CASHX bought, ${cashxBurned} burned`);

      const winnerPls  = (parseFloat(cashxBought) * 0.60).toFixed(0);
      const runnerPls  = (parseFloat(cashxBought) * 0.20).toFixed(0);

      // Notify winner
      const winnerUser = db.getPlayerByWallet(winner);
      if (winnerUser && winnerUser.notify_result) {
        if (!db.wasNotified(winnerUser.telegram_id, gameId, 'winner')) {
          await notify.gameWon(winnerUser.telegram_id, {
            gameId,
            cashxAmount: winnerPls,
            cashxBurned,
          });
          db.logNotification(winnerUser.telegram_id, gameId, 'winner');
        }
      }

      // Notify runner-up
      const runnerUser = db.getPlayerByWallet(runnerUp);
      if (runnerUser && runnerUser.notify_result) {
        if (!db.wasNotified(runnerUser.telegram_id, gameId, 'runner_up')) {
          await notify.gameRunnerUp(runnerUser.telegram_id, {
            gameId,
            cashxAmount: runnerPls,
            cashxBurned,
          });
          db.logNotification(runnerUser.telegram_id, gameId, 'runner_up');
        }
      }

      // Notify losers
      const allPlayers = db.getGamePlayers(gameId);
      for (const p of allPlayers) {
        if ([winner, runnerUp].includes(p.wallet_address)) continue;
        const tgUser = db.getPlayerByWallet(p.wallet_address);
        if (!tgUser || !tgUser.notify_result) continue;
        if (db.wasNotified(tgUser.telegram_id, gameId, 'lost')) continue;

        await notify.gameLost(tgUser.telegram_id, { gameId, cashxBurned });
        db.logNotification(tgUser.telegram_id, gameId, 'lost');
      }
      break;
    }

    case 'GameCancelled': {
      const gameId = Number(args.gameId);
      db.updateGameStatus(gameId, 'cancelled');
      console.log(`  Game #${gameId} cancelled - refunds sent`);

      const players = db.getGamePlayers(gameId);
      for (const p of players) {
        const tgUser = db.getPlayerByWallet(p.wallet_address);
        if (!tgUser) continue;
        if (db.wasNotified(tgUser.telegram_id, gameId, 'cancelled')) continue;

        await notify.gameCancelled(tgUser.telegram_id, {
          gameId,
          entryFeePls: db.getGame(gameId)?.entry_fee_pls,
        });
        db.logNotification(tgUser.telegram_id, gameId, 'cancelled');
      }
      break;
    }
  }
}

module.exports = { startWatcher };
