import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { erc20Abi, formatUnits, isHash, parseEventLogs, type Hash, type Log, type TransactionReceipt } from 'viem';
import { ChainService } from '../chain/chain.service';
import { hyperdriveDeskAbi } from '../chain/desk-abi';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { Trade, type TradeSide } from '../db/schemas';
import { CatalogService } from '../market/catalog.service';
import { QuotesService, USDC_DECIMALS } from '../quotes/quotes.service';

/** Decodes HyperdriveDesk `Trade` logs and stores them idempotently in Mongo. */
@Injectable()
export class TradesService {
  private readonly logger = new Logger(TradesService.name);
  private readonly blockTimes = new Map<bigint, Date>();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectModel(Trade.name) private readonly trades: Model<Trade>,
    private readonly chain: ChainService,
    private readonly catalog: CatalogService,
    private readonly quotes: QuotesService,
  ) {}

  /** Store Trade logs. Returns the wallets that got at least one new trade. */
  async ingest(logs: Log[]): Promise<Set<string>> {
    const desk = this.chain.requireDesk().toLowerCase();
    const events = parseEventLogs({ abi: hyperdriveDeskAbi, eventName: 'Trade', logs }).filter(
      (event) => event.address.toLowerCase() === desk,
    );
    const touched = new Set<string>();

    for (const event of events) {
      const { trader, token, side, usdcAmount, shares, price, fee, nonce } = event.args;
      const stock = this.catalog.byAddressOrNull(token);
      const decimals = this.chain.tokenDecimals(token);
      const timestamp = await this.blockTime(event.blockNumber);

      const result = await this.trades.updateOne(
        { chainId: this.chain.chainId, txHash: event.transactionHash.toLowerCase(), logIndex: event.logIndex },
        {
          $setOnInsert: {
            chainId: this.chain.chainId,
            desk,
            txHash: event.transactionHash,
            logIndex: event.logIndex,
            blockNumber: Number(event.blockNumber),
            timestamp,
            trader,
            token,
            symbol: stock?.symbol ?? token,
            side: side === 0 ? 'buy' : 'sell',
            usdcAmount: usdcAmount.toString(),
            shares: shares.toString(),
            shareDecimals: decimals,
            price: price.toString(),
            fee: fee.toString(),
            nonce,
            usdcAmountUsd: Number(formatUnits(usdcAmount, USDC_DECIMALS)),
            sharesDecimal: Number(formatUnits(shares, decimals)),
            priceUsd: Number(formatUnits(price, USDC_DECIMALS)),
            feeUsd: Number(formatUnits(fee, USDC_DECIMALS)),
          },
        },
        { upsert: true },
      );

      if (result.upsertedCount > 0) {
        touched.add(trader.toLowerCase());
        await this.quotes.markFilled(nonce, event.transactionHash);
        this.logger.log(
          `${side === 0 ? 'BUY ' : 'SELL'} ${stock?.symbol ?? token} ${formatUnits(shares, decimals)} by ${trader} (${event.transactionHash})`,
        );
      }
    }
    return touched;
  }

  /** Index one transaction right away (called by the frontend after its receipt confirms). */
  async syncTransaction(txHash: string) {
    if (!isHash(txHash)) throw new BadRequestException('txHash must be a 32-byte hex hash');
    const receipt = await this.chain.client
      .getTransactionReceipt({ hash: txHash as Hash })
      .catch(() => null);
    if (!receipt) throw new NotFoundException('Transaction receipt not found yet; retry shortly');
    if (receipt.status !== 'success') throw new BadRequestException('Transaction reverted');

    const touched = this.chain.desk ? await this.ingest(receipt.logs) : new Set<string>();
    if (touched.size === 0) {
      // Not a desk fill: try a wallet swap through the DEX aggregator (mainnet path).
      const wallet = await this.ingestSwapReceipt(receipt);
      if (wallet) touched.add(wallet);
    }
    const stored = await this.trades
      .find({ chainId: this.chain.chainId, txHash: txHash.toLowerCase() })
      .lean();
    return { touched, trades: stored };
  }

  forWallet(wallet: string, limit?: number) {
    const query = this.trades.find({ chainId: this.chain.chainId, trader: wallet.toLowerCase() }).sort({ timestamp: -1, logIndex: -1 });
    if (limit) query.limit(limit);
    return query.lean();
  }

  /** Chronological order: what the cost-basis walk needs. */
  allForWalletAscending(wallet: string) {
    return this.trades.find({ chainId: this.chain.chainId, trader: wallet.toLowerCase() }).sort({ blockNumber: 1, logIndex: 1 }).lean();
  }

  /** Drop every stored trade for this desk (used when the indexer detects a chain reset). */
  async purgeDesk(desk: string) {
    const res = await this.trades.deleteMany({ chainId: this.chain.chainId, desk: desk.toLowerCase() });
    return res.deletedCount;
  }

  /**
   * Record a DEX swap from its ERC-20 Transfer logs: the sender paid USDC and received an xStock
   * (buy), or the reverse (sell). Amounts are the net transfers to/from the sender's wallet.
   */
  private async ingestSwapReceipt(receipt: TransactionReceipt): Promise<string | null> {
    const trader = receipt.from.toLowerCase();
    const usdc = this.config.usdcAddress.toLowerCase();
    const transfers = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs });

    let usdcOut = 0n;
    let usdcIn = 0n;
    const shares = new Map<string, { inn: bigint; out: bigint; logIndex: number }>();
    for (const t of transfers) {
      const token = t.address.toLowerCase();
      const from = t.args.from.toLowerCase();
      const to = t.args.to.toLowerCase();
      if (token === usdc) {
        if (from === trader) usdcOut += t.args.value;
        if (to === trader) usdcIn += t.args.value;
        continue;
      }
      if (!this.catalog.byAddressOrNull(token)) continue;
      const row = shares.get(token) ?? { inn: 0n, out: 0n, logIndex: t.logIndex };
      if (to === trader) row.inn += t.args.value;
      if (from === trader) row.out += t.args.value;
      shares.set(token, row);
    }

    for (const [token, row] of shares) {
      const side: TradeSide | null =
        row.inn > row.out && usdcOut > usdcIn ? 'buy' : row.out > row.inn && usdcIn > usdcOut ? 'sell' : null;
      if (!side) continue;
      const shareAmount = side === 'buy' ? row.inn - row.out : row.out - row.inn;
      const usdcAmount = side === 'buy' ? usdcOut - usdcIn : usdcIn - usdcOut;
      const stock = this.catalog.byAddressOrNull(token)!;
      const decimals = 18;
      const price = (usdcAmount * 10n ** BigInt(decimals)) / shareAmount;
      const timestamp = await this.blockTime(receipt.blockNumber);
      const result = await this.trades.updateOne(
        { chainId: this.chain.chainId, txHash: receipt.transactionHash.toLowerCase(), logIndex: row.logIndex },
        {
          $setOnInsert: {
            chainId: this.chain.chainId,
            desk: (receipt.to ?? '0x0').toLowerCase(), // aggregator router
            txHash: receipt.transactionHash,
            logIndex: row.logIndex,
            blockNumber: Number(receipt.blockNumber),
            timestamp,
            trader,
            token,
            symbol: stock.symbol,
            side,
            usdcAmount: usdcAmount.toString(),
            shares: shareAmount.toString(),
            shareDecimals: decimals,
            price: price.toString(),
            fee: '0',
            nonce: receipt.transactionHash,
            usdcAmountUsd: Number(formatUnits(usdcAmount, USDC_DECIMALS)),
            sharesDecimal: Number(formatUnits(shareAmount, decimals)),
            priceUsd: Number(formatUnits(price, USDC_DECIMALS)),
            feeUsd: 0,
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount > 0) {
        this.logger.log(`DEX ${side.toUpperCase()} ${stock.symbol} ${formatUnits(shareAmount, decimals)} by ${trader} (${receipt.transactionHash})`);
      }
      return trader;
    }
    return null;
  }

  distinctTraders(): Promise<string[]> {
    return this.trades.distinct('trader', { chainId: this.chain.chainId });
  }

  private async blockTime(blockNumber: bigint) {
    const cached = this.blockTimes.get(blockNumber);
    if (cached) return cached;
    const block = await this.chain.client.getBlock({ blockNumber });
    const time = new Date(Number(block.timestamp) * 1000);
    if (this.blockTimes.size > 5_000) this.blockTimes.clear();
    this.blockTimes.set(blockNumber, time);
    return time;
  }
}
