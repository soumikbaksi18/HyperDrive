import type { TradeSide } from '../db/schemas';

export type LedgerTrade = {
  token: string;
  symbol: string;
  side: TradeSide;
  /** USDC base units: paid on a buy (fee included), received on a sell (net of fee). */
  usdcAmount: string;
  shares: string;
  shareDecimals: number;
  fee: string;
  priceUsd: number;
  timestamp: Date;
};

export type Ledger = {
  token: string;
  symbol: string;
  decimals: number;
  /** Shares still held, base units. */
  shares: bigint;
  /** Remaining cost basis of `shares`, USDC base units. */
  costBasis: bigint;
  /** Realized PnL, USDC base units (may be negative). */
  realized: bigint;
  totalBought: bigint;
  totalSold: bigint;
  sharesBought: bigint;
  sharesSold: bigint;
  fees: bigint;
  tradeCount: number;
  firstTradeAt: Date;
  lastTradeAt: Date;
  lastTradePriceUsd: number;
};

/**
 * Average-cost ledger per token, in exact integer arithmetic.
 *
 * Buy:  shares += s, cost += usdcPaid (fees are part of cost basis).
 * Sell: cost of the sold slice = cost * s / shares; realized += proceeds - that slice.
 * Shares sold beyond what the desk ledger shows (tokens that arrived from elsewhere) are
 * treated as zero cost basis, and the held amount is clamped at zero.
 *
 * `trades` must be in chain order (block, logIndex ascending).
 */
export function buildLedgers(trades: LedgerTrade[]): Map<string, Ledger> {
  const ledgers = new Map<string, Ledger>();

  for (const trade of trades) {
    const key = trade.token.toLowerCase();
    let ledger = ledgers.get(key);
    if (!ledger) {
      ledger = {
        token: key,
        symbol: trade.symbol,
        decimals: trade.shareDecimals,
        shares: 0n,
        costBasis: 0n,
        realized: 0n,
        totalBought: 0n,
        totalSold: 0n,
        sharesBought: 0n,
        sharesSold: 0n,
        fees: 0n,
        tradeCount: 0,
        firstTradeAt: trade.timestamp,
        lastTradeAt: trade.timestamp,
        lastTradePriceUsd: trade.priceUsd,
      };
      ledgers.set(key, ledger);
    }

    const usdc = BigInt(trade.usdcAmount);
    const shares = BigInt(trade.shares);
    ledger.fees += BigInt(trade.fee);
    ledger.tradeCount += 1;
    ledger.lastTradeAt = trade.timestamp;
    ledger.lastTradePriceUsd = trade.priceUsd;

    if (trade.side === 'buy') {
      ledger.shares += shares;
      ledger.costBasis += usdc;
      ledger.totalBought += usdc;
      ledger.sharesBought += shares;
      continue;
    }

    const matched = shares < ledger.shares ? shares : ledger.shares;
    const costOfSold = ledger.shares > 0n ? (ledger.costBasis * matched) / ledger.shares : 0n;
    ledger.realized += usdc - costOfSold;
    ledger.costBasis -= costOfSold;
    ledger.shares -= matched;
    if (ledger.shares === 0n) ledger.costBasis = 0n; // drop rounding dust once flat
    ledger.totalSold += usdc;
    ledger.sharesSold += shares;
  }

  return ledgers;
}
