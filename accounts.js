/**
 * accounts.js - Player account system
 *
 * Each player gets a permanent CASHX deposit address
 * derived from their Telegram ID. Deposits credit their
 * balance. Bets deduct from balance. Wins credit balance.
 * Withdrawals send CASHX back to their wallet.
 *
 * Withdrawal tiers:
 *   < 1M CASHX  - instant, bot pays from reserve
 *   >= 1M CASHX - on-chain from contract treasury
 */

const { ethers } = require('ethers');
const db          = require('./db');
const notify      = require('./notifications');

const RPC_URL          = process.env.PULSCHAIN_RPC_URL || 'https://rpc.pulsechain.com';
const MASTER_MNEMONIC  = process.env.MASTER_MNEMONIC;
const CASHX_ADDRESS    = process.env.CASHX_TOKEN_ADDRESS;
const GAS_WALLET_KEY   = process.env.GAS_WALLET_PRIVATE_KEY;
const INSTANT_THRESHOLD = ethers.parseEther('1000000'); // 1M CASHX

const CASHX_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

// Account derivation path - permanent per player
// Different from game deposit path (uses negative offset to avoid collision)
const ACCOUNT_BASE_PATH = "m/44'/60'/1'";

let provider;
let masterWallet;
let cashxContract;
let gasWallet;
let pollTimer;
const watchedAccounts = new Map(); // address -> telegramId

// --- Init ----------------------------------------------

async function init() {
  if (!MASTER_MNEMONIC || !CASHX_ADDRESS) {
    console.warn('    Account system disabled - MASTER_MNEMONIC or CASHX_TOKEN_ADDRESS not set');
    return;
  }

  provider     = new ethers.JsonRpcProvider(RPC_URL);
  masterWallet = ethers.HDNodeWallet.fromPhrase(MASTER_MNEMONIC);
  cashxContract = new ethers.Contract(CASHX_ADDRESS, CASHX_ABI, provider);

  if (GAS_WALLET_KEY) {
    gasWallet = new ethers.Wallet(GAS_WALLET_KEY, provider);
  }

  // Load all existing accounts into watch map
  const accounts = db.getAllAccountAddresses();
  for (const acc of accounts) {
    watchedAccounts.set(acc.deposit_address.toLowerCase(), acc.telegram_id);
  }

  // Start polling for both CASHX and PLS deposits
  pollTimer = setInterval(checkDeposits, 10_000);
  console.log(`  Account system ready - watching ${watchedAccounts.size} addresses`);
}

// --- PulseX router for auto-swap ----------------------
const PULSEX_ROUTER  = process.env.PULSEX_ROUTER || '0x165C3410fC91EF562C50559f7d2262a887B45e4F';
const PULSEX_ROUTER_ABI = [
  'function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable returns (uint256[] memory amounts)',
  'function WETH() external pure returns (address)',
];

// --- Get or create account address --------------------

function getAccountAddress(telegramId) {
  // Check if already stored
  const existing = db.getAccountDepositAddress(telegramId);
  if (existing) return existing;

  // Derive permanent wallet for this player
  const idx     = Number(telegramId) % 0x80000000;
  const path    = `${ACCOUNT_BASE_PATH}/${idx}`;
  const wallet  = masterWallet.derivePath(path);

  // Store it
  db.setAccountDepositAddress(telegramId, wallet.address.toLowerCase());

  // Add to watch map
  watchedAccounts.set(wallet.address.toLowerCase(), String(telegramId));

  console.log(`  Account address for tg:${telegramId}   ${wallet.address}`);
  return wallet.address;
}

// --- Poll for deposits ---------------------------------

async function checkDeposits() {
  if (watchedAccounts.size === 0) return;

  try {
    const latest    = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - 5);

    // -- Check CASHX transfers --
    const filter = cashxContract.filters.Transfer(null, null);
    const events  = await cashxContract.queryFilter(filter, fromBlock, latest);

    for (const event of events) {
      const to = event.args.to.toLowerCase();
      if (!watchedAccounts.has(to)) continue;
      const telegramId = watchedAccounts.get(to);
      const amount     = event.args.value;
      const txHash     = event.transactionHash;
      if (db.isDepositProcessed(txHash)) continue;
      await processDeposit(telegramId, amount, txHash, 'cashx');
    }

    // -- Check PLS (native) deposits --
    for (const [address, telegramId] of watchedAccounts.entries()) {
      const balance = await provider.getBalance(address);
      if (balance === 0n) continue;

      // Check if this balance is new (not yet processed)
      const key = `pls_balance_${address}`;
      const lastKnown = db.getMetaValue(key) || '0';
      if (BigInt(lastKnown) >= balance) continue;

      const newPLS = balance - BigInt(lastKnown);
      if (newPLS < ethers.parseEther('1000')) continue; // ignore dust

      console.log(`  PLS deposit detected at ${address}: ${ethers.formatEther(newPLS)} PLS`);

      // Notify user PLS received, swapping now
      await notify.plsDepositReceived(telegramId, {
        plsAmount: ethers.formatEther(newPLS),
      }).catch(() => {});

      // Swap PLS -> CASHX
      await swapPLSForCASHX(address, telegramId, newPLS, balance);

      // Update last known balance
      db.setMetaValue(key, balance.toString());
    }

  } catch (err) {
    console.error('Account deposit poll error:', err.message);
  }
}

async function swapPLSForCASHX(accountAddress, telegramId, plsAmount, totalBalance) {
  try {
    // Derive wallet for this account
    const idx    = Number(telegramId) % 0x80000000;
    const path   = `${ACCOUNT_BASE_PATH}/${idx}`;
    const wallet = masterWallet.derivePath(path).connect(provider);

    const router   = new ethers.Contract(PULSEX_ROUTER, PULSEX_ROUTER_ABI, wallet);
    const wplsAddr = await router.WETH();
    const swapPath = [wplsAddr, CASHX_ADDRESS];

    const gasPrice    = (await provider.getFeeData()).gasPrice;
    const gasEstimate = 300000n;
    const gasCost     = gasPrice * gasEstimate;
    const swapAmount  = plsAmount - gasCost;

    if (swapAmount <= 0n) {
      console.warn(`PLS deposit too small to cover gas at ${accountAddress}`);
      return;
    }

    const cashxBefore = await cashxContract.balanceOf(accountAddress);

    const tx = await router.swapExactETHForTokens(
      1n, // min out - accept any amount
      swapPath,
      accountAddress,
      BigInt(Math.floor(Date.now() / 1000) + 300),
      { value: swapAmount, gasLimit: gasEstimate, gasPrice }
    );

    await tx.wait();

    const cashxAfter   = await cashxContract.balanceOf(accountAddress);
    const cashxReceived = cashxAfter - cashxBefore;

    console.log(`  Swapped ${ethers.formatEther(swapAmount)} PLS -> ${ethers.formatEther(cashxReceived)} CASHX for tg:${telegramId}`);

    // Now process as CASHX deposit
    const fakeTxHash = `pls_swap_${tx.hash}`;
    await processDeposit(telegramId, cashxReceived, fakeTxHash, 'cashx', ethers.formatEther(plsAmount));

  } catch (err) {
    console.error(`PLS->CASHX swap failed for ${accountAddress}:`, err.message);
  }
}

async function processDeposit(telegramId, amountWei, txHash, token = 'cashx', originalPLS = null) {
  const amountFormatted = ethers.formatEther(amountWei);

  db.creditBalance(telegramId, amountWei.toString(), 'cashx', {
    note:   originalPLS
      ? `Swapped ${originalPLS} PLS -> ${amountFormatted} CASHX`
      : `Deposit ${amountFormatted} CASHX`,
    txHash,
  });

  db.markDepositProcessed(txHash);

  // -- Pay referral bonus on first deposit --
  const referralResult = db.payReferralBonus(telegramId, amountWei.toString());
  if (referralResult) {
    const bonusFormatted = ethers.formatEther(referralResult.bonus);
    console.log(`  Referral bonus ${bonusFormatted} CASHX -> tg:${referralResult.referrerId}`);
    await notify.referralBonus(referralResult.referrerId, {
      refereeId:  telegramId,
      bonusAmount: bonusFormatted,
    }).catch(() => {});
  }

  const newBalance   = db.getBalance(telegramId);
  const balFormatted = ethers.formatEther(newBalance.cashx);

  console.log(`  Credited ${amountFormatted} CASHX to tg:${telegramId} (balance: ${balFormatted})`);

  await notify.accountDeposit(telegramId, {
    amount:     amountFormatted,
    newBalance: balFormatted,
    fromPLS:    originalPLS,
  }).catch(() => {});
}

// --- Place a bet from balance --------------------------

function placeBet(telegramId, amountWei, game, gameId) {
  if (!db.hasSufficientBalance(telegramId, amountWei)) {
    throw new Error('Insufficient balance');
  }
  db.debitBalance(telegramId, amountWei.toString(), 'cashx', { game, gameId, note: `${game} bet` });
}

// --- Credit winnings to balance -----------------------

function creditWinnings(telegramId, amountWei, game, gameId) {
  db.creditBalance(telegramId, amountWei.toString(), 'cashx', {
    game,
    gameId,
    note: `${game} win`,
  });
}

// --- Withdraw ------------------------------------------

async function requestWithdrawal(telegramId, amountWei, toAddress) {
  if (!ethers.isAddress(toAddress)) throw new Error('Invalid address');

  const amount = BigInt(amountWei);
  if (!db.hasSufficientBalance(telegramId, amount.toString())) {
    throw new Error('Insufficient balance');
  }

  // Create withdrawal request (debits balance immediately)
  const result = db.createWithdrawalRequest(telegramId, amount.toString(), toAddress);
  const withdrawalId = result.lastInsertRowid;

  console.log(`  Withdrawal #${withdrawalId} requested by tg:${telegramId} - ${ethers.formatEther(amount)} CASHX to ${toAddress}`);

  // Process immediately
  await processWithdrawal(withdrawalId, telegramId, amount, toAddress);
}

async function processWithdrawal(id, telegramId, amountWei, toAddress) {
  try {
    let txHash;

    if (amountWei < INSTANT_THRESHOLD) {
      // -- Instant: send from gas/reserve wallet --
      txHash = await sendInstant(amountWei, toAddress);
    } else {
      // -- On-chain: send from contract treasury --
      txHash = await sendOnChain(amountWei, toAddress);
    }

    db.updateWithdrawalStatus(id, 'completed', txHash);

    const amount = ethers.formatEther(amountWei);
    console.log(`  Withdrawal #${id} sent - ${amount} CASHX to ${toAddress} tx:${txHash}`);

    await notify.withdrawalSent(telegramId, {
      amount:    amount,
      toAddress,
      txHash,
      instant:   amountWei < INSTANT_THRESHOLD,
    }).catch(() => {});

  } catch (err) {
    console.error(`Withdrawal #${id} failed:`, err.message);
    db.updateWithdrawalStatus(id, 'failed');

    // Refund balance
    db.creditBalance(telegramId, amountWei.toString(), 'cashx', {
      note: `Refund - withdrawal failed: ${err.message}`,
    });

    await notify.withdrawalFailed(telegramId, { amount: ethers.formatEther(amountWei), reason: err.message })
      .catch(() => {});
  }
}

async function sendInstant(amountWei, toAddress) {
  if (!gasWallet) throw new Error('Gas wallet not configured');
  const connected  = cashxContract.connect(gasWallet);
  const gasPrice   = (await provider.getFeeData()).gasPrice;
  const tx = await connected.transfer(toAddress, amountWei, { gasPrice });
  await tx.wait();
  return tx.hash;
}

async function sendOnChain(amountWei, toAddress) {
  // For large withdrawals - uses the master wallet treasury
  const treasury = masterWallet.connect(provider);
  const connected = cashxContract.connect(treasury);
  const gasPrice  = (await provider.getFeeData()).gasPrice;
  const tx = await connected.transfer(toAddress, amountWei, { gasPrice });
  await tx.wait();
  return tx.hash;
}

// --- Process pending withdrawals on startup ------------

async function processPendingWithdrawals() {
  const pending = db.getPendingWithdrawals();
  for (const w of pending) {
    await processWithdrawal(
      w.id,
      w.telegram_id,
      BigInt(w.amount),
      w.to_address
    ).catch(err => console.error(`Pending withdrawal ${w.id} error:`, err.message));
  }
}

module.exports = {
  init,
  getAccountAddress,
  placeBet,
  creditWinnings,
  requestWithdrawal,
  processPendingWithdrawals,
};
