/**
 * deposits.js — Deposit address engine
 *
 * HOW IT WORKS:
 *   1. Player requests a deposit address via the Mini App
 *   2. We derive a unique child wallet from our master mnemonic
 *      using the path: m/44'/60'/telegramId'/gameId'
 *   3. Player sends exactly entryFee PLS to that address
 *   4. We detect the incoming tx, validate the amount
 *   5. We generate a random secret+salt, compute commitment
 *   6. We call contract.commit(gameId, commitment) from the deposit wallet
 *   7. We store the secret+salt encrypted in the DB
 *   8. When game fills, we call contract.reveal() automatically
 *   9. Winnings land in the deposit wallet, we forward to player's source address
 *
 * SECURITY NOTES:
 *   - Master mnemonic must be stored securely (env var, never in code)
 *   - Deposit wallets hold funds only briefly (~10-30 seconds)
 *   - All contract interactions are done server-side
 *   - Source address (where player sent FROM) gets the winnings back
 */

const { ethers }   = require('ethers');
const crypto       = require('crypto');
const db           = require('./db');
const notify       = require('./notifications');

const RPC_URL          = process.env.PULSCHAIN_RPC_URL || 'https://rpc.pulsechain.com';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const MASTER_MNEMONIC  = process.env.MASTER_MNEMONIC;
const POLL_MS          = 8_000; // check every 8 seconds

// Derivation base path — unique per player+game
// m/44'/60'/0'/telegramId/gameId
const BASE_PATH = "m/44'/60'/0'";

const CONTRACT_ABI = [
  'function gameModes(uint256) view returns (uint256 entryFee, uint256 playerCount, bool active)',
  'function getGame(uint256 gameId) view returns (uint256 modeId, uint8 status, uint256 playerCount, uint256 revealCount, uint256 revealDeadline, address winner, address runnerUp, bytes32 randomSeed)',
  'function gameCount() view returns (uint256)',
  'function commit(uint256 gameId, bytes32 commitment) payable',
  'function reveal(uint256 gameId, bytes32 secret, bytes32 salt)',
  'function computeCommitment(bytes32 secret, bytes32 salt) pure returns (bytes32)',
  'event GameFilled(uint256 indexed gameId, uint256 revealDeadline)',
];

let provider;
let masterWallet;
let contract;
let watchTimer;

// Active deposit sessions: address => session data
const activeSessions = new Map();

// ─── Init ──────────────────────────────────────────────

async function init() {
  if (!MASTER_MNEMONIC) {
    console.warn('⚠️  MASTER_MNEMONIC not set — deposit system disabled');
    return;
  }
  if (!CONTRACT_ADDRESS) {
    console.warn('⚠️  CONTRACT_ADDRESS not set — deposit system disabled');
    return;
  }

  provider     = new ethers.JsonRpcProvider(RPC_URL);
  masterWallet = ethers.HDNodeWallet.fromPhrase(MASTER_MNEMONIC);
  contract     = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

  // Reload any pending sessions from DB on startup
  await reloadPendingSessions();

  // Start polling for deposits
  watchTimer = setInterval(checkDeposits, POLL_MS);

  console.log(`💳 Deposit engine ready — master: ${masterWallet.address.slice(0,10)}...`);
}

// ─── Generate deposit address ──────────────────────────

/**
 * Generate a unique deposit address for a player+game combo.
 * Deterministic — same inputs always produce the same address.
 * Returns { address, entryFee, gameId, modeId }
 */
async function getDepositAddress({ telegramId, gameId, modeId }) {
  if (!masterWallet) throw new Error('Deposit engine not initialized');

  // Derive child wallet
  const wallet = deriveWallet(telegramId, gameId);

  // Get entry fee from contract
  const mode = await contract.gameModes(modeId);
  const entryFee    = mode.entryFee;
  const entryFeeEth = ethers.formatEther(entryFee);

  // Store session in DB + memory
  db.upsertDepositSession({
    telegramId:     String(telegramId),
    gameId:         Number(gameId),
    modeId:         Number(modeId),
    depositAddress: wallet.address.toLowerCase(),
    entryFeeWei:    entryFee.toString(),
    status:         'pending',
  });

  // Track in memory for fast polling
  activeSessions.set(wallet.address.toLowerCase(), {
    telegramId: String(telegramId),
    gameId:     Number(gameId),
    modeId:     Number(modeId),
    entryFee,
    entryFeeEth,
    wallet,
    sourceAddress: null,
  });

  console.log(`💳 Deposit address for tg:${telegramId} game:${gameId} → ${wallet.address}`);

  return {
    address:      wallet.address,
    entryFee:     entryFeeEth,
    entryFeeWei:  entryFee.toString(),
    gameId,
    modeId,
  };
}

// ─── Derive wallet ─────────────────────────────────────

function deriveWallet(telegramId, gameId) {
  // Cap indices to valid BIP32 range (0 to 2^31-1)
  const tgIndex   = Number(telegramId) % 0x80000000;
  const gameIndex = Number(gameId)     % 0x80000000;
  const path = `${BASE_PATH}/${tgIndex}/${gameIndex}`;
  return masterWallet.derivePath(path);
}

// ─── Poll for deposits ─────────────────────────────────

async function checkDeposits() {
  if (activeSessions.size === 0) return;

  for (const [address, session] of activeSessions.entries()) {
    try {
      await checkOneDeposit(address, session);
    } catch (err) {
      console.error(`Deposit check error for ${address}:`, err.message);
    }
  }
}

async function checkOneDeposit(address, session) {
  const balance = await provider.getBalance(address);

  if (balance === 0n) return; // nothing received yet

  const expected = BigInt(session.entryFee);

  // Allow ±0.1% tolerance for gas rounding
  const tolerance = expected / 1000n;
  const diff = balance > expected ? balance - expected : expected - balance;

  if (diff > tolerance) {
    // Wrong amount — refund
    console.log(`⚠️  Wrong amount at ${address}: got ${ethers.formatEther(balance)}, expected ${session.entryFeeEth}`);
    await refundDeposit(address, session, balance);
    activeSessions.delete(address);
    db.updateDepositStatus(address, 'refunded_wrong_amount');
    return;
  }

  console.log(`✅ Deposit confirmed at ${address} — ${ethers.formatEther(balance)} PLS`);

  // Find source address from transaction history
  const sourceAddress = await findSourceAddress(address);

  // Commit to contract
  await commitToContract(address, session, balance, sourceAddress);
  activeSessions.delete(address);
}

// ─── Find where the PLS came from ─────────────────────

async function findSourceAddress(depositAddress) {
  try {
    // Get last N blocks and find the tx that funded this address
    const latest = await provider.getBlockNumber();
    const fromBlock = latest - 50;

    for (let b = latest; b >= fromBlock; b--) {
      const block = await provider.getBlock(b, true);
      if (!block?.transactions) continue;

      for (const tx of block.transactions) {
        if (tx.to?.toLowerCase() === depositAddress.toLowerCase() && tx.value > 0n) {
          return tx.from;
        }
      }
    }
  } catch (e) {
    console.error('Could not find source address:', e.message);
  }
  return null;
}

// ─── Commit to contract ────────────────────────────────

async function commitToContract(depositAddress, session, balance, sourceAddress) {
  const { telegramId, gameId, modeId, wallet } = session;

  // Generate random secret + salt
  const secretBytes = crypto.randomBytes(32);
  const saltBytes   = crypto.randomBytes(32);
  const secret = '0x' + secretBytes.toString('hex');
  const salt   = '0x' + saltBytes.toString('hex');

  // Compute commitment
  const commitment = await contract.computeCommitment(secret, salt);

  // Save secret + salt to DB (encrypted)
  db.saveSecret({ telegramId, gameId, secret, salt, commitment });

  // Store source address for payout
  if (sourceAddress) {
    db.updateDepositSourceAddress(depositAddress, sourceAddress);
  }

  // Connect wallet to provider + contract
  const connectedWallet   = wallet.connect(provider);
  const connectedContract = contract.connect(connectedWallet);

  try {
    // Estimate gas for commit tx
    const gasPrice    = (await provider.getFeeData()).gasPrice;
    const gasEstimate = await connectedContract.commit.estimateGas(
      gameId, commitment, { value: balance }
    );
    const gasCost = gasPrice * gasEstimate * 12n / 10n; // 20% buffer

    // Check we have enough to cover gas
    if (balance < gasCost) {
      throw new Error(`Insufficient balance for gas: ${ethers.formatEther(balance)} PLS`);
    }

    // Send commit transaction
    const tx = await connectedContract.commit(gameId, commitment, {
      value:    balance,
      gasLimit: gasEstimate * 12n / 10n,
      gasPrice,
    });

    console.log(`📝 Commit tx sent for game #${gameId}: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Committed to game #${gameId} for tg:${telegramId}`);

    db.updateDepositStatus(depositAddress, 'committed', tx.hash);

    // Notify player
    const tgPlayer = db.getPlayerByTelegram(telegramId);
    if (tgPlayer) {
      await notify.depositConfirmed(telegramId, {
        gameId,
        entryFee: session.entryFeeEth,
        txHash:   tx.hash,
      });
    }

  } catch (err) {
    console.error(`Commit failed for game #${gameId}:`, err.message);
    db.updateDepositStatus(depositAddress, 'commit_failed');

    // Refund player
    await refundDeposit(depositAddress, session, balance);

    await notify.depositFailed(telegramId, { gameId, reason: err.message });
  }
}

// ─── Auto-reveal ───────────────────────────────────────

/**
 * Called by watcher.js when a GameFilled event fires.
 * Finds all deposit-based players in this game and reveals for them.
 */
async function autoRevealForGame(gameId) {
  const sessions = db.getDepositSessionsByGame(gameId);

  for (const session of sessions) {
    if (session.status !== 'committed') continue;

    try {
      await autoRevealOne(session);
    } catch (err) {
      console.error(`Auto-reveal failed for game #${gameId} tg:${session.telegram_id}:`, err.message);
    }
  }
}

async function autoRevealOne(session) {
  const { telegram_id, game_id, deposit_address } = session;

  // Get secret from DB
  const secretData = db.getSecret(telegram_id, game_id);
  if (!secretData) {
    console.error(`No secret found for tg:${telegram_id} game:${game_id}`);
    return;
  }

  // Re-derive wallet
  const wallet           = deriveWallet(telegram_id, game_id);
  const connectedWallet  = wallet.connect(provider);
  const connectedContract = contract.connect(connectedWallet);

  // Fund reveal wallet with a tiny bit of PLS for gas
  // (The commit tx leaves the wallet empty — we need gas for reveal)
  await fundRevealGas(wallet.address, connectedWallet);

  const gasPrice    = (await provider.getFeeData()).gasPrice;
  const gasEstimate = await connectedContract.reveal.estimateGas(
    game_id, secretData.secret, secretData.salt
  );

  const tx = await connectedContract.reveal(game_id, secretData.secret, secretData.salt, {
    gasLimit: gasEstimate * 12n / 10n,
    gasPrice,
  });

  console.log(`🔓 Auto-reveal tx for game #${game_id}: ${tx.hash}`);
  await tx.wait();
  console.log(`✅ Auto-revealed for tg:${telegram_id} game:${game_id}`);

  db.updateDepositStatus(deposit_address, 'revealed', tx.hash);
}

// ─── Fund reveal gas ───────────────────────────────────

/**
 * Send a small amount of PLS from the gas wallet to cover reveal tx.
 * The gas wallet is a separate funded wallet just for covering gas.
 */
async function fundRevealGas(toAddress, toWallet) {
  const GAS_WALLET_KEY = process.env.GAS_WALLET_PRIVATE_KEY;
  if (!GAS_WALLET_KEY) {
    throw new Error('GAS_WALLET_PRIVATE_KEY not set — needed to fund reveal gas');
  }

  const gasWallet   = new ethers.Wallet(GAS_WALLET_KEY, provider);
  const gasPrice    = (await provider.getFeeData()).gasPrice;
  const gasAmount   = gasPrice * 100000n; // enough for 1 reveal tx

  const balance = await provider.getBalance(toAddress);
  if (balance >= gasAmount) return; // already has enough

  const tx = await gasWallet.sendTransaction({
    to:       toAddress,
    value:    gasAmount,
    gasPrice,
  });
  await tx.wait();
  console.log(`⛽ Funded ${toAddress} with ${ethers.formatEther(gasAmount)} PLS for gas`);
}

// ─── Forward winnings ──────────────────────────────────

/**
 * Called after GameResolved — sends winnings from deposit wallet
 * back to the player's source address.
 */
async function forwardWinnings({ telegramId, gameId, depositAddress, winnerAddress }) {
  const session = db.getDepositSession(depositAddress);
  if (!session?.source_address) {
    console.warn(`No source address for ${depositAddress} — cannot forward winnings`);
    return;
  }

  // Re-derive wallet
  const wallet           = deriveWallet(telegramId, gameId);
  const connectedWallet  = wallet.connect(provider);

  // Wait a moment for CASHX transfer to settle
  await new Promise(r => setTimeout(r, 5000));

  // Forward any CASHX in the deposit wallet to the source address
  // (CASHX contract interaction)
  const CASHX_ABI   = ['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)'];
  const cashxAddr   = process.env.CASHX_TOKEN_ADDRESS;
  if (!cashxAddr) return;

  const cashxContract = new ethers.Contract(cashxAddr, CASHX_ABI, connectedWallet);
  const cashxBalance  = await cashxContract.balanceOf(depositAddress);

  if (cashxBalance > 0n) {
    const gasPrice = (await provider.getFeeData()).gasPrice;
    await fundRevealGas(depositAddress, connectedWallet); // top up gas

    const tx = await cashxContract.transfer(session.source_address, cashxBalance, { gasPrice });
    await tx.wait();

    const amount = ethers.formatEther(cashxBalance);
    console.log(`💸 Forwarded ${amount} CASHX from ${depositAddress} → ${session.source_address}`);

    await notify.winningsForwarded(telegramId, {
      gameId,
      cashxAmount:   amount,
      toAddress:     session.source_address,
      txHash:        tx.hash,
    });
  }
}

// ─── Refund ────────────────────────────────────────────

async function refundDeposit(depositAddress, session, balance) {
  try {
    const sourceAddress = await findSourceAddress(depositAddress);
    if (!sourceAddress) {
      console.error(`Cannot refund ${depositAddress} — no source address found`);
      return;
    }

    const wallet          = session.wallet || deriveWallet(session.telegramId, session.gameId);
    const connectedWallet = wallet.connect(provider);
    const gasPrice        = (await provider.getFeeData()).gasPrice;
    const gasCost         = gasPrice * 21000n;
    const refundAmount    = balance - gasCost;

    if (refundAmount <= 0n) return;

    const tx = await connectedWallet.sendTransaction({
      to:       sourceAddress,
      value:    refundAmount,
      gasPrice,
    });
    await tx.wait();

    console.log(`↩️  Refunded ${ethers.formatEther(refundAmount)} PLS to ${sourceAddress}`);

    await notify.depositRefunded(session.telegramId, {
      gameId:    session.gameId,
      amount:    ethers.formatEther(refundAmount),
      toAddress: sourceAddress,
    });

  } catch (err) {
    console.error('Refund failed:', err.message);
  }
}

// ─── Reload pending sessions on restart ───────────────

async function reloadPendingSessions() {
  const pending = db.getPendingDepositSessions();
  for (const s of pending) {
    const wallet = deriveWallet(s.telegram_id, s.game_id);
    const mode   = await contract.gameModes(s.mode_id).catch(() => null);
    if (!mode) continue;

    activeSessions.set(s.deposit_address, {
      telegramId:   s.telegram_id,
      gameId:       s.game_id,
      modeId:       s.mode_id,
      entryFee:     mode.entryFee,
      entryFeeEth:  ethers.formatEther(mode.entryFee),
      wallet,
      sourceAddress: s.source_address,
    });
  }
  if (pending.length > 0) {
    console.log(`🔄 Reloaded ${pending.length} pending deposit sessions`);
  }
}

module.exports = {
  init,
  getDepositAddress,
  autoRevealForGame,
  forwardWinnings,
};
