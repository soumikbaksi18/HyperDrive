import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { encodeAbiParameters, formatUnits, getAddress, isAddress, parseUnits, type Address, type Hex } from 'viem';
import { hyperdriveBasketAbi } from '../chain/basket-abi';
import { ChainService } from '../chain/chain.service';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { CatalogService } from '../market/catalog.service';
import { PricesService } from '../market/prices.service';

const KYBER = 'https://aggregator-api.kyberswap.com/monad/api/v1';
const USDC_DECIMALS = 6;
const SHARE_DECIMALS = 18;

type Deployment = {
  chainId: number;
  symbol: string;
  basket: Address;
  hook: Address;
  router: Address;
  poolManager: Address;
  usdc: Address;
  components: { symbol: string; address: Address; weight: number; unitPerShare: string }[];
  poolKey: { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address };
};

export type BasketSide = 'buy' | 'sell';

/**
 * Off-chain side of the NVDAx + TSLAx basket (hNVTS): NAV, and quotes that build the Uniswap v4
 * hookData (per-leg KyberSwap calldata with the basket contract as sender/recipient) for BasketRouter.
 */
@Injectable()
export class BasketsService implements OnModuleInit {
  private readonly logger = new Logger(BasketsService.name);
  private deployment: Deployment | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly chain: ChainService,
    private readonly catalog: CatalogService,
    private readonly prices: PricesService,
  ) {}

  onModuleInit() {
    const file = path.resolve(process.cwd(), process.env.BASKET_DEPLOYMENT ?? '../contracts/deployments/basket-143.json');
    if (!existsSync(file)) {
      this.logger.warn(`No basket deployment at ${file}; /api/baskets reports not deployed`);
      return;
    }
    const d = JSON.parse(readFileSync(file, 'utf8')) as Deployment;
    if (d.chainId !== this.chain.chainId) {
      this.logger.warn(`Basket deployment is for chain ${d.chainId}, backend is on ${this.chain.chainId}; ignoring`);
      return;
    }
    this.deployment = d;
    // Make the basket show up in portfolio/trade indexing like any other asset, priced at NAV.
    this.catalog.registerSynthetic({
      symbol: d.symbol,
      name: 'Hyperdrive NVDA-TSLA Basket',
      underlying: d.symbol,
      logo: '',
      address: getAddress(d.basket),
      halted: false,
    });
    this.prices.registerResolver(d.symbol, async () => {
      const info = await this.info();
      return info.deployed && info.navPerShare > 0 ? info.navPerShare : null;
    });
    this.logger.log(`Basket ${d.symbol} at ${d.basket} (hook ${d.hook}, router ${d.router})`);
  }

  private require(): Deployment {
    if (!this.deployment) throw new ServiceUnavailableException('The basket is not deployed yet (contracts/deployments/basket-143.json)');
    return this.deployment;
  }

  async info() {
    const d = this.deployment;
    if (!d) return { deployed: false as const };
    const [supply, reserves, perShare] = await Promise.all([
      this.read<bigint>('totalSupply'),
      this.read<readonly bigint[]>('reserves'),
      this.read<readonly bigint[]>('componentsPerShare'),
    ]);
    const quotes = await this.prices.getMany(d.components.map((c) => c.symbol));
    const components = d.components.map((c, i) => {
      const price = quotes[c.symbol] ?? null;
      const reserve = Number(formatUnits(reserves[i], 18));
      const perShareAmt = Number(formatUnits(perShare[i], 18));
      return {
        symbol: c.symbol,
        address: c.address,
        targetWeight: c.weight,
        price,
        reserve,
        reserveUsd: price != null ? reserve * price : null,
        perShare: perShareAmt,
        perShareUsd: price != null ? perShareAmt * price : null,
      };
    });
    const tvl = components.reduce((s, c) => s + (c.reserveUsd ?? 0), 0);
    const navPerShare = components.reduce((s, c) => s + (c.perShareUsd ?? 0), 0);
    for (const c of components) (c as typeof c & { liveWeight: number }).liveWeight = tvl > 0 ? ((c.reserveUsd ?? 0) / tvl) * 100 : c.targetWeight;
    return {
      deployed: true as const,
      symbol: d.symbol,
      name: 'Hyperdrive NVDA-TSLA Basket',
      basket: d.basket,
      hook: d.hook,
      router: d.router,
      poolManager: d.poolManager,
      usdc: d.usdc,
      poolKey: d.poolKey,
      totalSupply: Number(formatUnits(supply, SHARE_DECIMALS)),
      navPerShare,
      tvl,
      components,
    };
  }

  async quote(req: { trader: string; side: BasketSide; amount: string; slippageBps?: number }) {
    const d = this.require();
    if (!isAddress(req.trader)) throw new BadRequestException('trader must be an address');
    const trader = getAddress(req.trader);
    const slip = BigInt(Math.min(Math.max(req.slippageBps ?? 100, 10), 500));
    const usdcIs0 = d.poolKey.currency0.toLowerCase() === d.usdc.toLowerCase();
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
    const [supply, reserves] = await Promise.all([this.read<bigint>('totalSupply'), this.read<readonly bigint[]>('reserves')]);

    if (req.side === 'buy') {
      const amountIn = this.parse(req.amount, USDC_DECIMALS);
      if (Number(req.amount) < this.config.quoteMinUsdc) throw new BadRequestException(`Minimum is $${this.config.quoteMinUsdc}`);
      if (Number(req.amount) > this.config.quoteMaxUsdc) throw new BadRequestException(`Maximum is $${this.config.quoteMaxUsdc}`);
      if ((await this.chain.balanceOf(d.usdc, trader)) < amountIn) throw new ConflictException('Not enough USDC in your wallet');

      // Split USDC in proportion to the current reserve value, so every leg lands near the same
      // proportional contribution (that is what the oracle-free mint rewards).
      const quotes = await this.prices.getMany(d.components.map((c) => c.symbol));
      const values = d.components.map((c, i) =>
        supply === 0n ? c.weight : Number(formatUnits(reserves[i], 18)) * (quotes[c.symbol] ?? 0),
      );
      const total = values.reduce((a, b) => a + b, 0) || 1;
      const legUsdc: bigint[] = [];
      let allotted = 0n;
      d.components.forEach((_, i) => {
        const amt = i === d.components.length - 1 ? amountIn - allotted : (amountIn * BigInt(Math.round((values[i] / total) * 1e6))) / 1_000_000n;
        legUsdc.push(amt);
        allotted += amt;
      });

      const legs = await Promise.all(
        d.components.map((c, i) => this.buildLeg(d, d.usdc, c.address, legUsdc[i], slip)),
      );
      const sharesFor = (outs: bigint[]) =>
        outs.reduce((min, out, i) => {
          const s = supply === 0n ? (out * 10n ** 18n) / BigInt(d.components[i].unitPerShare) : (out * supply) / reserves[i];
          return s < min ? s : min;
        }, 2n ** 255n);
      const expectedShares = sharesFor(legs.map((l) => l.amountOut));
      const minShares = sharesFor(legs.map((l) => (l.amountOut * (10_000n - slip)) / 10_000n));
      const hookData = encodeAbiParameters(
        [{ type: 'uint256[]' }, { type: 'bytes[]' }, { type: 'uint256' }, { type: 'address' }],
        [legUsdc, legs.map((l) => l.data), minShares, trader],
      );
      return {
        side: 'buy' as const,
        symbol: d.symbol,
        router: d.router,
        poolKey: d.poolKey,
        zeroForOne: usdcIs0,
        tokenIn: d.usdc,
        amountIn: amountIn.toString(),
        minAmountOut: minShares.toString(),
        expectedOut: expectedShares.toString(),
        expectedOutDecimal: formatUnits(expectedShares, SHARE_DECIMALS),
        minOutDecimal: formatUnits(minShares, SHARE_DECIMALS),
        hookData,
        deadline: deadline.toString(),
        legs: d.components.map((c, i) => ({
          symbol: c.symbol,
          usdc: Number(formatUnits(legUsdc[i], USDC_DECIMALS)),
          expectedOut: formatUnits(legs[i].amountOut, 18),
        })),
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
      };
    }

    const shares = this.parse(req.amount, SHARE_DECIMALS);
    if ((await this.chain.balanceOf(d.basket, trader)) < shares) throw new ConflictException(`Not enough ${d.symbol} in your wallet`);
    const amounts = await this.read<readonly bigint[]>('previewRedeem', [shares]);
    const legs = await Promise.all(d.components.map((c, i) => this.buildLeg(d, c.address, d.usdc, amounts[i], slip)));
    const expectedUsdc = legs.reduce((a, l) => a + l.amountOut, 0n);
    const minUsdc = legs.reduce((a, l) => a + (l.amountOut * (10_000n - slip)) / 10_000n, 0n);
    const hookData = encodeAbiParameters(
      [{ type: 'bytes[]' }, { type: 'uint256' }, { type: 'address' }],
      [legs.map((l) => l.data), minUsdc, trader],
    );
    return {
      side: 'sell' as const,
      symbol: d.symbol,
      router: d.router,
      poolKey: d.poolKey,
      zeroForOne: !usdcIs0,
      tokenIn: d.basket,
      amountIn: shares.toString(),
      minAmountOut: minUsdc.toString(),
      expectedOut: expectedUsdc.toString(),
      expectedOutDecimal: formatUnits(expectedUsdc, USDC_DECIMALS),
      minOutDecimal: formatUnits(minUsdc, USDC_DECIMALS),
      hookData,
      deadline: deadline.toString(),
      legs: d.components.map((c, i) => ({
        symbol: c.symbol,
        amount: formatUnits(amounts[i], 18),
        expectedUsdc: Number(formatUnits(legs[i].amountOut, USDC_DECIMALS)),
      })),
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    };
  }

  /** One KyberSwap leg executed BY the basket contract (sender = recipient = basket). */
  private async buildLeg(d: Deployment, tokenIn: Address, tokenOut: Address, amountIn: bigint, slipBps: bigint) {
    if (amountIn === 0n) return { data: '0x' as Hex, amountOut: 0n };
    // Exclude Uniswap v4 sources: the leg runs inside our v4 hook while the PoolManager is unlocked.
    const routeRes = await this.kyber<{ routeSummary: Record<string, unknown> & { amountOut: string }; routerAddress: string }>(
      `/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}&excludedSources=uniswap-v4`,
    );
    if (getAddress(routeRes.routerAddress) !== getAddress(await this.basketRouterTarget(d))) {
      throw new ServiceUnavailableException('Aggregator router changed; the basket only trusts its configured router');
    }
    const built = await this.kyber<{ data: Hex; amountOut: string }>(`/route/build`, {
      routeSummary: routeRes.routeSummary,
      sender: d.basket,
      recipient: d.basket,
      slippageTolerance: Number(slipBps),
    });
    return { data: built.data, amountOut: BigInt(built.amountOut) };
  }

  private routerTarget: Address | null = null;
  private async basketRouterTarget(d: Deployment): Promise<Address> {
    this.routerTarget ??= await this.chain.client.readContract({ address: d.basket, abi: hyperdriveBasketAbi, functionName: 'router' });
    return this.routerTarget;
  }

  private async kyber<T>(p: string, body?: unknown): Promise<T> {
    const res = await fetch(`${KYBER}${p}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', 'x-client-id': 'hyperdrive' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => null)) as { code?: number; message?: string; data?: T } | null;
    if (res.status === 429) throw new ServiceUnavailableException('DEX aggregator is rate-limiting; retry in a minute');
    if (!res.ok || json?.code !== 0 || !json.data) {
      if (/route not found/i.test(json?.message ?? '')) throw new ConflictException('No DEX route for a basket component right now');
      throw new ServiceUnavailableException(`DEX router: ${json?.message ?? res.status}`);
    }
    return json.data;
  }

  private read<T>(functionName: string, args: unknown[] = []): Promise<T> {
    const d = this.require();
    return this.chain.client.readContract({
      address: d.basket,
      abi: hyperdriveBasketAbi,
      functionName: functionName as never,
      args: args as never,
    }) as Promise<T>;
  }

  private parse(amount: string, decimals: number) {
    if (!/^\d+(\.\d+)?$/.test(amount)) throw new BadRequestException('amount must be a positive decimal');
    const v = parseUnits(amount, decimals);
    if (v <= 0n) throw new BadRequestException('amount must be greater than zero');
    return v;
  }
}
