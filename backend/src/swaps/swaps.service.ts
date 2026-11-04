import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { formatUnits, getAddress, isAddress, parseUnits, type Address, type Hex } from 'viem';
import { ChainService } from '../chain/chain.service';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import type { TradeSide } from '../db/schemas';
import { CatalogService } from '../market/catalog.service';
import { PricesService } from '../market/prices.service';
import { USDC_DECIMALS } from '../quotes/quotes.service';

const KYBER = 'https://aggregator-api.kyberswap.com';
const KYBER_CHAIN: Record<number, string> = { 143: 'monad' };
const XSTOCK_DECIMALS = 18;

type KyberRoute = {
  routeSummary: Record<string, unknown> & { amountIn: string; amountOut: string };
  routerAddress: string;
};

/**
 * Mainnet execution path: route USDC <-> xStock through the KyberSwap aggregator on Monad.
 * The user's wallet signs and sends the router call; nothing is custodied by Hyperdrive.
 */
@Injectable()
export class SwapsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SwapsService.name);
  /** symbol -> implied $ per share from a $1 USDC route, for assets with DEX liquidity on Monad. */
  private tradable = new Map<string, number>();
  private scan = { startedAt: null as Date | null, finishedAt: null as Date | null, checked: 0, total: 0 };
  private scanTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly chain: ChainService,
    private readonly catalog: CatalogService,
    private readonly prices: PricesService,
  ) {}

  get enabled() {
    return Boolean(KYBER_CHAIN[this.chain.chainId]);
  }

  onApplicationBootstrap() {
    if (!this.enabled) return;
    void this.scanTradable();
    this.scanTimer = setInterval(() => void this.scanTradable(), 30 * 60_000);
  }

  onModuleDestroy() {
    if (this.scanTimer) clearInterval(this.scanTimer);
  }

  /** Which catalog assets currently have a USDC route on Monad (refreshed every 30 min). */
  tradableStatus() {
    return {
      venue: 'KyberSwap',
      complete: this.scan.finishedAt != null,
      scannedAt: this.scan.finishedAt,
      checked: this.scan.checked,
      total: this.scan.total,
      symbols: Object.fromEntries(this.tradable),
    };
  }

  private async scanTradable() {
    const network = KYBER_CHAIN[this.chain.chainId];
    if (!network || (this.scan.startedAt && !this.scan.finishedAt)) return;
    const stocks = this.catalog.allStocks();
    const found = new Map<string, number>();
    this.scan = { startedAt: new Date(), finishedAt: null, checked: 0, total: stocks.length };
    let cursor = 0;
    const worker = async () => {
      while (cursor < stocks.length) {
        const stock = stocks[cursor++];
        for (let attempt = 0; attempt < 4; attempt++) {
          const res = await fetch(
            `${KYBER}/${network}/api/v1/routes?tokenIn=${this.config.usdcAddress}&tokenOut=${stock.address}&amountIn=1000000`,
            { headers: { 'x-client-id': 'hyperdrive' } },
          ).catch(() => null);
          const json = (await res?.json().catch(() => null)) as
            | { code?: number; message?: string; data?: { routeSummary?: { amountOut?: string } } }
            | null;
          const out = json?.code === 0 ? json.data?.routeSummary?.amountOut : undefined;
          if (out && out !== '0') {
            found.set(stock.symbol, 1 / Number(formatUnits(BigInt(out), XSTOCK_DECIMALS)));
            break;
          }
          if (json && /route not found|token not found/i.test(json.message ?? '')) break;
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1))); // rate-limited or flaky: back off
        }
        this.scan.checked += 1;
        // Publish progress as it goes, so the UI fills in during the first scan.
        if (found.has(stock.symbol)) this.tradable.set(stock.symbol, found.get(stock.symbol)!);
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    this.tradable = found;
    this.scan.finishedAt = new Date();
    this.logger.log(`DEX scan: ${found.size}/${stocks.length} assets have a USDC route on Monad`);
  }

  async quote(req: { trader: string; symbol: string; side: TradeSide; amount: string }) {
    const network = KYBER_CHAIN[this.chain.chainId];
    if (!network) throw new ServiceUnavailableException(`DEX routing is not available on chain ${this.chain.chainId}`);
    if (!isAddress(req.trader)) throw new BadRequestException('trader must be an address');
    const trader = getAddress(req.trader);
    const stock = this.catalog.bySymbolOrNull(req.symbol);
    if (!stock) throw new BadRequestException(`${req.symbol} is not a Nasdaq xStock on Monad`);
    if (stock.halted) throw new ConflictException(`${stock.symbol} is halted`);

    const usdc = this.config.usdcAddress;
    const buying = req.side === 'buy';
    const tokenIn = buying ? usdc : stock.address;
    const tokenOut = buying ? stock.address : usdc;
    let amountIn: bigint;
    try {
      amountIn = parseUnits(req.amount, buying ? USDC_DECIMALS : XSTOCK_DECIMALS);
    } catch {
      throw new BadRequestException('amount is not a valid decimal number');
    }
    if (amountIn <= 0n) throw new BadRequestException('amount must be greater than zero');

    const balance = await this.chain.balanceOf(tokenIn, trader);
    if (balance < amountIn) {
      throw new ConflictException(`Not enough ${buying ? 'USDC' : stock.symbol} in your wallet for this order`);
    }

    const route = await this.kyber<KyberRoute>(
      `/${network}/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}`,
    ).catch((error: Error) => {
      if (/route not found/i.test(error.message)) {
        throw new ConflictException(`No DEX liquidity for ${stock.symbol} on Monad right now. Try another stock.`);
      }
      throw error;
    });

    const amountOut = BigInt(route.routeSummary.amountOut);
    if (amountOut <= 0n) throw new ConflictException(`No DEX liquidity for ${stock.symbol} right now`);
    const usdcLeg = buying ? amountIn : amountOut;
    const shareLeg = buying ? amountOut : amountIn;
    const priceUsd = Number(formatUnits(usdcLeg, USDC_DECIMALS)) / Number(formatUnits(shareLeg, XSTOCK_DECIMALS));

    const notional = Number(formatUnits(usdcLeg, USDC_DECIMALS));
    if (notional < this.config.quoteMinUsdc) throw new BadRequestException(`Minimum trade is $${this.config.quoteMinUsdc}`);
    if (notional > this.config.quoteMaxUsdc) throw new BadRequestException(`Maximum trade is $${this.config.quoteMaxUsdc}`);

    // Protect the user from a thin or skewed pool: compare against the xStocks reference price.
    const reference = await this.prices.get(stock.symbol);
    const deviationPct = reference ? ((priceUsd - reference) / reference) * 100 : null;
    const worse = deviationPct != null && (buying ? deviationPct : -deviationPct);
    if (worse !== false && worse != null && worse > this.config.priceBandPct) {
      throw new ConflictException(
        `DEX price $${priceUsd.toFixed(2)} is ${worse.toFixed(1)}% worse than the xStocks price $${reference!.toFixed(2)}; not routing this order.`,
      );
    }

    const slippageBps = this.config.swapSlippageBps;
    const built = await this.kyber<{
      routerAddress: string;
      data: Hex;
      transactionValue: string;
      amountOut: string;
      gas: string;
    }>(`/${network}/api/v1/route/build`, {
      routeSummary: route.routeSummary,
      sender: trader,
      recipient: trader,
      slippageTolerance: slippageBps,
    });

    const expectedOut = BigInt(built.amountOut);
    const minOut = (expectedOut * BigInt(10_000 - slippageBps)) / 10_000n;
    const outDecimals = buying ? XSTOCK_DECIMALS : USDC_DECIMALS;
    return {
      mode: 'dex' as const,
      venue: 'KyberSwap',
      chainId: this.chain.chainId,
      symbol: stock.symbol,
      trader,
      router: getAddress(built.routerAddress) as Address,
      data: built.data,
      value: built.transactionValue,
      gas: built.gas,
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      expectedOut: expectedOut.toString(),
      expectedOutDecimal: formatUnits(expectedOut, outDecimals),
      minOutDecimal: formatUnits(minOut, outDecimals),
      slippageBps,
      priceUsd,
      marketPriceUsd: reference,
      deviationPct,
      feeUsd: 0,
      feeBps: 0,
      // Routes go stale quickly; the UI re-quotes past this.
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    };
  }

  private async kyber<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${KYBER}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', 'x-client-id': 'hyperdrive' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => null)) as { code?: number; message?: string; data?: T } | null;
    if (!res.ok || !json || json.code !== 0 || !json.data) {
      const message = json?.message ?? `KyberSwap HTTP ${res.status}`;
      this.logger.warn(`kyber ${path.split('?')[0]}: ${message}`);
      throw new ServiceUnavailableException(`DEX router: ${message}`);
    }
    return json.data;
  }
}
