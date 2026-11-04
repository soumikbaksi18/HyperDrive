import { Injectable } from '@nestjs/common';
import { formatUnits, getAddress, type Address } from 'viem';
import { ChainService } from '../chain/chain.service';
import { CatalogService } from '../market/catalog.service';
import { PricesService } from '../market/prices.service';
import { USDC_DECIMALS } from '../quotes/quotes.service';
import { buildLedgers } from './pnl';
import { TradesService } from './trades.service';

const usd = (units: bigint) => Number(formatUnits(units, USDC_DECIMALS));
const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

export type PortfolioView = Awaited<ReturnType<PortfolioService['get']>>;

@Injectable()
export class PortfolioService {
  constructor(
    private readonly trades: TradesService,
    private readonly catalog: CatalogService,
    private readonly prices: PricesService,
    private readonly chain: ChainService,
  ) {}

  async get(wallet: string, opts: { onchain?: boolean } = {}) {
    const address = getAddress(wallet);
    const rows = await this.trades.allForWalletAscending(address);
    const ledgers = [...buildLedgers(rows).values()];
    const active = ledgers.filter((l) => l.shares > 0n);
    const quotes = await this.prices.getMany(active.map((l) => l.symbol));

    const onchain = new Map<string, bigint>();
    if (opts.onchain) {
      await Promise.all(
        active.map(async (l) => {
          const balance = await this.chain.balanceOf(l.token as Address, address).catch(() => null);
          if (balance != null) onchain.set(l.token, balance);
        }),
      );
    }

    const positions = ledgers.map((l) => {
      const stock = this.catalog.byAddressOrNull(l.token);
      const shares = Number(formatUnits(l.shares, l.decimals));
      const costBasis = usd(l.costBasis);
      const live = quotes[l.symbol] ?? null;
      const currentPrice = l.shares > 0n ? (live ?? l.lastTradePriceUsd) : (live ?? null);
      const marketValue = l.shares > 0n && currentPrice != null ? shares * currentPrice : 0;
      const unrealizedPnl = l.shares > 0n ? marketValue - costBasis : 0;
      const realizedPnl = usd(l.realized);
      const chainBalance = onchain.get(l.token);
      return {
        token: l.token,
        symbol: l.symbol,
        name: stock?.name.replace(/ xStock$/, '') ?? l.symbol,
        underlying: stock?.underlying ?? l.symbol,
        logo: stock?.logo ?? null,
        status: l.shares > 0n ? ('active' as const) : ('closed' as const),
        shares,
        sharesRaw: l.shares.toString(),
        avgCost: shares > 0 ? costBasis / shares : 0,
        costBasis,
        currentPrice,
        priceIsLive: live != null,
        marketValue,
        unrealizedPnl,
        unrealizedPnlPct: pct(unrealizedPnl, costBasis),
        realizedPnl,
        totalPnl: unrealizedPnl + realizedPnl,
        totalBought: usd(l.totalBought),
        totalSold: usd(l.totalSold),
        fees: usd(l.fees),
        tradeCount: l.tradeCount,
        firstTradeAt: l.firstTradeAt,
        lastTradeAt: l.lastTradeAt,
        onchainShares:
          chainBalance != null ? Number(formatUnits(chainBalance, l.decimals)) : null,
        allocationPct: 0,
      };
    });

    const marketValue = positions.reduce((s, p) => s + p.marketValue, 0);
    for (const p of positions) p.allocationPct = pct(p.marketValue, marketValue);
    positions.sort(
      (a, b) =>
        Number(b.status === 'active') - Number(a.status === 'active') || b.marketValue - a.marketValue,
    );

    const costBasis = positions.reduce((s, p) => s + p.costBasis, 0);
    const unrealizedPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
    const realizedPnl = positions.reduce((s, p) => s + p.realizedPnl, 0);
    const totalBought = positions.reduce((s, p) => s + p.totalBought, 0);
    const totalSold = positions.reduce((s, p) => s + p.totalSold, 0);

    return {
      wallet: address,
      chainId: this.chain.chainId,
      pricedAt: new Date().toISOString(),
      summary: {
        marketValue,
        costBasis,
        unrealizedPnl,
        unrealizedPnlPct: pct(unrealizedPnl, costBasis),
        realizedPnl,
        totalPnl: unrealizedPnl + realizedPnl,
        totalPnlPct: pct(unrealizedPnl + realizedPnl, totalBought),
        totalBought,
        totalSold,
        netInvested: totalBought - totalSold,
        fees: positions.reduce((s, p) => s + p.fees, 0),
        tradeCount: rows.length,
        activePositions: positions.filter((p) => p.status === 'active').length,
        closedPositions: positions.filter((p) => p.status === 'closed').length,
        firstTradeAt: rows[0]?.timestamp ?? null,
      },
      positions,
    };
  }
}
