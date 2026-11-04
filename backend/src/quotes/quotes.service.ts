import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { formatUnits, getAddress, isAddress, parseUnits, toHex, type Address, type Hex } from 'viem';
import { ChainService } from '../chain/chain.service';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { QuoteRecord, type TradeSide } from '../db/schemas';
import { CatalogService } from '../market/catalog.service';
import { PricesService } from '../market/prices.service';

export const USDC_DECIMALS = 6;

const QUOTE_TYPES = {
  Quote: [
    { name: 'trader', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'side', type: 'uint8' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'price', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export type QuoteRequest = { trader: string; symbol: string; side: TradeSide; amount: string };

/** Mirrors HyperdriveDesk.buy/sell arithmetic exactly (integer division, fee on the USDC leg). */
export function expectedOut(
  side: TradeSide,
  amountIn: bigint,
  price: bigint,
  feeBps: number,
  decimals: number,
) {
  const unit = 10n ** BigInt(decimals);
  const bps = BigInt(feeBps);
  if (side === 'buy') {
    const fee = (amountIn * bps) / 10_000n;
    return { out: ((amountIn - fee) * unit) / price, fee, gross: amountIn };
  }
  const gross = (amountIn * price) / unit;
  const fee = (gross * bps) / 10_000n;
  return { out: gross - fee, fee, gross };
}

/** USD float -> USDC base units, with the desk spread applied against the trader. */
export function priceUnits(marketUsd: number, side: TradeSide, spreadBps: number) {
  const base = parseUnits(marketUsd.toFixed(USDC_DECIMALS), USDC_DECIMALS);
  const spread = BigInt(Math.max(0, Math.round(spreadBps)));
  if (spread === 0n) return base;
  return side === 'buy'
    ? (base * (10_000n + spread) + 9_999n) / 10_000n // round up: trader pays at least the spread
    : (base * (10_000n - spread)) / 10_000n;
}

@Injectable()
export class QuotesService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectModel(QuoteRecord.name) private readonly quotes: Model<QuoteRecord>,
    private readonly chain: ChainService,
    private readonly catalog: CatalogService,
    private readonly prices: PricesService,
  ) {}

  async create(req: QuoteRequest) {
    const desk = this.chain.requireDesk();
    const signer = this.chain.requireSigner();
    if (!isAddress(req.trader)) throw new BadRequestException('trader must be an address');
    const trader = getAddress(req.trader);
    const stock = this.catalog.bySymbolOrNull(req.symbol);
    if (!stock) throw new BadRequestException(`${req.symbol} is not a Nasdaq xStock on Monad`);
    if (stock.halted) throw new ConflictException(`${stock.symbol} is halted`);

    const listing = await this.chain.listing(stock.address);
    if (!listing.listed) throw new ConflictException(`${stock.symbol} is not listed on the desk yet`);

    let amountIn: bigint;
    try {
      amountIn = parseUnits(req.amount, req.side === 'buy' ? USDC_DECIMALS : listing.decimals);
    } catch {
      throw new BadRequestException('amount is not a valid decimal number');
    }
    if (amountIn <= 0n) throw new BadRequestException('amount must be greater than zero');

    const checked = await this.prices.liveChecked(stock.symbol, this.config.priceBandPct);
    const market = checked.price;
    if (market == null) {
      throw new ServiceUnavailableException(`No live xStocks price for ${stock.symbol} right now`);
    }
    if (checked.rejected) {
      throw new ServiceUnavailableException(`${stock.symbol} price moved sharply; try again in a moment`);
    }

    const price = priceUnits(market, req.side, this.config.quoteSpreadBps);
    const feeBps = await this.chain.feeBps(true); // fresh: a stale fee would make the trade revert on slippage
    const { out, fee, gross } = expectedOut(req.side, amountIn, price, feeBps, listing.decimals);
    if (out <= 0n) throw new BadRequestException('amount is too small to fill');

    const notionalUsd = Number(formatUnits(req.side === 'buy' ? amountIn : gross, USDC_DECIMALS));
    if (notionalUsd < this.config.quoteMinUsdc) {
      throw new BadRequestException(`Minimum trade is $${this.config.quoteMinUsdc}`);
    }
    if (notionalUsd > this.config.quoteMaxUsdc) {
      throw new BadRequestException(`Maximum trade is $${this.config.quoteMaxUsdc}`);
    }

    const usdc = await this.chain.usdcAddress();
    const [traderBalance, deskBalance] = await Promise.all([
      this.chain.balanceOf(req.side === 'buy' ? usdc : stock.address, trader),
      this.chain.balanceOf(req.side === 'buy' ? stock.address : usdc, desk),
    ]);
    if (traderBalance < amountIn) {
      throw new ConflictException(
        req.side === 'buy'
          ? 'Not enough USDC in your wallet for this order'
          : `Not enough ${stock.symbol} in your wallet for this order`,
      );
    }
    const deskNeeds = req.side === 'buy' ? out : gross;
    if (deskBalance < deskNeeds) {
      throw new ConflictException(
        `The desk's ${req.side === 'buy' ? stock.symbol : 'USDC'} inventory is too low for this order`,
      );
    }

    const nonce = toHex(randomBytes(32)) as Hex;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + this.config.quoteTtlSeconds);
    const message = {
      trader,
      token: stock.address,
      side: req.side === 'buy' ? 0 : 1,
      amountIn,
      price,
      deadline,
      nonce,
    };
    const signature = await signer.signTypedData({
      domain: {
        name: 'HyperdriveDesk',
        version: '1',
        chainId: this.chain.chainId,
        verifyingContract: desk,
      },
      types: QUOTE_TYPES,
      primaryType: 'Quote',
      message,
    });

    await this.quotes.create({
      nonce,
      chainId: this.chain.chainId,
      desk,
      trader,
      token: stock.address,
      symbol: stock.symbol,
      side: req.side,
      amountIn: amountIn.toString(),
      price: price.toString(),
      marketPriceUsd: market,
      spreadBps: this.config.quoteSpreadBps,
      expectedOut: out.toString(),
      deadline: new Date(Number(deadline) * 1000),
      signature,
    });

    const outDecimals = req.side === 'buy' ? listing.decimals : USDC_DECIMALS;
    return {
      desk,
      usdc,
      chainId: this.chain.chainId,
      symbol: stock.symbol,
      quote: {
        trader,
        token: stock.address as Address,
        side: message.side,
        amountIn: amountIn.toString(),
        price: price.toString(),
        deadline: deadline.toString(),
        nonce,
      },
      signature,
      /** Exact on-chain output; pass as the slippage floor (minSharesOut / minUsdcOut). */
      expectedOut: out.toString(),
      expectedOutDecimal: formatUnits(out, outDecimals),
      fee: fee.toString(),
      feeUsd: Number(formatUnits(fee, USDC_DECIMALS)),
      feeBps,
      marketPriceUsd: market,
      priceUsd: Number(formatUnits(price, USDC_DECIMALS)),
      expiresAt: new Date(Number(deadline) * 1000).toISOString(),
    };
  }

  async markFilled(nonce: string, txHash: string) {
    await this.quotes.updateOne(
      { nonce: nonce.toLowerCase() },
      { $set: { status: 'filled', txHash: txHash.toLowerCase() } },
    );
  }
}
