import { parseUnits } from 'viem';
import { expectedOut, priceUnits } from '../quotes/quotes.service';
import { buildLedgers, type LedgerTrade } from './pnl';

const AAPL = '0x9d275685dc284c8eb1c79f6aba7a63dc75ec890a';
const at = (n: number) => new Date(Date.UTC(2026, 10, n));

function trade(side: 'buy' | 'sell', usdc: string, shares: string, day: number, fee = '0'): LedgerTrade {
  return {
    token: AAPL,
    symbol: 'AAPLx',
    side,
    usdcAmount: parseUnits(usdc, 6).toString(),
    shares: parseUnits(shares, 18).toString(),
    shareDecimals: 18,
    fee: parseUnits(fee, 6).toString(),
    priceUsd: Number(usdc) / Number(shares),
    timestamp: at(day),
  };
}

describe('buildLedgers (average cost)', () => {
  it('accumulates buys into cost basis', () => {
    const l = buildLedgers([trade('buy', '1000', '5', 1), trade('buy', '1200', '4', 2)]).get(AAPL)!;
    expect(l.shares).toBe(parseUnits('9', 18));
    expect(l.costBasis).toBe(parseUnits('2200', 6));
    expect(l.realized).toBe(0n);
    expect(l.tradeCount).toBe(2);
  });

  it('realizes PnL against the average cost on a partial sell', () => {
    // 10 shares for $2000 (avg $200). Sell 4 for $1000 => cost of sold $800, realized +$200.
    const l = buildLedgers([trade('buy', '2000', '10', 1), trade('sell', '1000', '4', 2)]).get(AAPL)!;
    expect(l.shares).toBe(parseUnits('6', 18));
    expect(l.costBasis).toBe(parseUnits('1200', 6));
    expect(l.realized).toBe(parseUnits('200', 6));
  });

  it('records a loss and closes the position cleanly', () => {
    const l = buildLedgers([trade('buy', '300', '3', 1), trade('sell', '240', '3', 2)]).get(AAPL)!;
    expect(l.shares).toBe(0n);
    expect(l.costBasis).toBe(0n);
    expect(l.realized).toBe(-parseUnits('60', 6));
  });

  it('treats shares sold beyond the ledger as zero cost basis', () => {
    const l = buildLedgers([trade('buy', '100', '1', 1), trade('sell', '300', '2', 2)]).get(AAPL)!;
    expect(l.shares).toBe(0n);
    expect(l.realized).toBe(parseUnits('200', 6));
  });

  it('sums fees', () => {
    const l = buildLedgers([trade('buy', '1000', '5', 1, '5'), trade('sell', '600', '2', 2, '3')]).get(AAPL)!;
    expect(l.fees).toBe(parseUnits('8', 6));
  });
});

describe('quote math mirrors HyperdriveDesk', () => {
  it('buy: (amountIn - fee) * 1e18 / price', () => {
    const { out, fee } = expectedOut('buy', parseUnits('1000', 6), parseUnits('200', 6), 50, 18);
    expect(fee).toBe(parseUnits('5', 6));
    expect(out).toBe(parseUnits('4.975', 18));
  });

  it('sell: shares * price / 1e18 - fee', () => {
    const { out, gross } = expectedOut('sell', parseUnits('2', 18), parseUnits('250', 6), 0, 18);
    expect(gross).toBe(parseUnits('500', 6));
    expect(out).toBe(parseUnits('500', 6));
  });

  it('applies the spread against the trader', () => {
    expect(priceUnits(332.285, 'buy', 0)).toBe(332_285_000n);
    expect(priceUnits(200, 'buy', 25)).toBe(200_500_000n);
    expect(priceUnits(200, 'sell', 25)).toBe(199_500_000n);
  });
});
