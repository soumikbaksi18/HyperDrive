import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type TradeSide = 'buy' | 'sell';

/**
 * Raw on-chain amounts are stored as decimal strings of base units (exact).
 * The *Usd / *Decimal number fields are derived copies for display and aggregation.
 */

/** One `Trade` event emitted by HyperdriveDesk. Source of truth for positions and PnL. */
@Schema({ collection: 'trades', timestamps: true })
export class Trade {
  @Prop({ required: true }) chainId!: number;
  @Prop({ required: true, lowercase: true }) desk!: string;
  @Prop({ required: true, lowercase: true }) txHash!: string;
  @Prop({ required: true }) logIndex!: number;
  @Prop({ required: true }) blockNumber!: number;
  @Prop({ required: true }) timestamp!: Date;
  @Prop({ required: true, lowercase: true, index: true }) trader!: string;
  @Prop({ required: true, lowercase: true }) token!: string;
  @Prop({ required: true }) symbol!: string;
  @Prop({ required: true, enum: ['buy', 'sell'] }) side!: TradeSide;
  /** USDC base units the trader paid (buy, fee included) or received (sell, net of fee). */
  @Prop({ required: true }) usdcAmount!: string;
  @Prop({ required: true }) shares!: string;
  @Prop({ required: true }) shareDecimals!: number;
  /** USDC base units per whole share. */
  @Prop({ required: true }) price!: string;
  @Prop({ required: true }) fee!: string;
  @Prop({ required: true, lowercase: true }) nonce!: string;
  @Prop({ required: true }) usdcAmountUsd!: number;
  @Prop({ required: true }) sharesDecimal!: number;
  @Prop({ required: true }) priceUsd!: number;
  @Prop({ required: true }) feeUsd!: number;
}
export type TradeDocument = HydratedDocument<Trade>;
export const TradeSchema = SchemaFactory.createForClass(Trade);
TradeSchema.index({ chainId: 1, txHash: 1, logIndex: 1 }, { unique: true });
TradeSchema.index({ trader: 1, timestamp: 1 });

export type QuoteStatus = 'issued' | 'filled';

/** Every quote the backend signs, so fills can be reconciled and unfilled quotes audited. */
@Schema({ collection: 'quotes', timestamps: true })
export class QuoteRecord {
  @Prop({ required: true, unique: true, lowercase: true }) nonce!: string;
  @Prop({ required: true }) chainId!: number;
  @Prop({ required: true, lowercase: true }) desk!: string;
  @Prop({ required: true, lowercase: true, index: true }) trader!: string;
  @Prop({ required: true, lowercase: true }) token!: string;
  @Prop({ required: true }) symbol!: string;
  @Prop({ required: true, enum: ['buy', 'sell'] }) side!: TradeSide;
  @Prop({ required: true }) amountIn!: string;
  @Prop({ required: true }) price!: string;
  @Prop({ required: true }) marketPriceUsd!: number;
  @Prop({ required: true }) spreadBps!: number;
  @Prop({ required: true }) expectedOut!: string;
  @Prop({ required: true }) deadline!: Date;
  @Prop({ required: true }) signature!: string;
  @Prop({ required: true, enum: ['issued', 'filled'], default: 'issued' }) status!: QuoteStatus;
  @Prop({ lowercase: true }) txHash?: string;
}
export type QuoteRecordDocument = HydratedDocument<QuoteRecord>;
export const QuoteRecordSchema = SchemaFactory.createForClass(QuoteRecord);

/** Indexer cursor: last block whose Trade logs are fully stored. */
@Schema({ collection: 'indexer_state', timestamps: true })
export class IndexerState {
  @Prop({ required: true, unique: true }) key!: string;
  @Prop({ required: true }) lastBlock!: number;
  /** Hash of lastBlock, to detect a reset/forked chain under the same desk address. */
  @Prop() lastBlockHash?: string;
}
export const IndexerStateSchema = SchemaFactory.createForClass(IndexerState);

/** Point-in-time portfolio value, used for the value-over-time chart. */
@Schema({ collection: 'portfolio_snapshots' })
export class PortfolioSnapshot {
  @Prop({ required: true, lowercase: true }) wallet!: string;
  @Prop({ required: true }) at!: Date;
  @Prop({ required: true }) marketValue!: number;
  @Prop({ required: true }) costBasis!: number;
  @Prop({ required: true }) realizedPnl!: number;
  @Prop({ required: true }) unrealizedPnl!: number;
  @Prop({ required: true }) netInvested!: number;
}
export const PortfolioSnapshotSchema = SchemaFactory.createForClass(PortfolioSnapshot);
PortfolioSnapshotSchema.index({ wallet: 1, at: 1 });

/** Cached market headline (NewsData / NewsAPI batch). */
@Schema({ collection: 'news_articles', timestamps: true })
export class NewsArticleDoc {
  @Prop({ required: true, unique: true }) url!: string;
  @Prop({ required: true }) headline!: string;
  @Prop({ required: true, default: '' }) summary!: string;
  @Prop({ required: true }) time!: string;
  @Prop({ required: true }) dateLabel!: string;
  @Prop({ type: [String], required: true, default: [] }) tickers!: string[];
  @Prop({ type: [String], required: true, default: [] }) xSymbols!: string[];
  @Prop({ required: true }) impact!: number;
  @Prop({ required: true, enum: ['up', 'down', 'neutral'] }) sentiment!: 'up' | 'down' | 'neutral';
  @Prop({ required: true }) category!: string;
  @Prop({ required: true }) source!: string;
  @Prop({ required: true }) publishedAt!: Date;
  @Prop({ required: true, default: 'newsdata' }) upstream!: string;
  @Prop({ required: true }) fetchedAt!: Date;
}
export type NewsArticleDocDocument = HydratedDocument<NewsArticleDoc>;
export const NewsArticleDocSchema = SchemaFactory.createForClass(NewsArticleDoc);
NewsArticleDocSchema.index({ publishedAt: -1 });

@Schema({ collection: 'news_sync_state' })
export class NewsSyncState {
  @Prop({ required: true, unique: true }) id!: string;
  @Prop() lastAttemptAt?: Date;
  @Prop() lastSuccessAt?: Date;
  @Prop({ required: true, default: 'empty' }) lastStatus!: string;
  @Prop() lastError?: string;
  @Prop({ default: 0 }) articleCount!: number;
  @Prop() lastSource?: string;
}
export type NewsSyncStateDocument = HydratedDocument<NewsSyncState>;
export const NewsSyncStateSchema = SchemaFactory.createForClass(NewsSyncState);

/** One AI basket-suggestion run (the Trading engine form submission and its result). */
@Schema({ collection: 'agent_runs', timestamps: true })
export class AgentRun {
  @Prop({ lowercase: true, index: true }) wallet?: string;
  @Prop({ required: true, type: Object }) request!: Record<string, unknown>;
  @Prop({ required: true }) modelId!: string;
  @Prop({ required: true }) status!: 'ok' | 'fallback' | 'error';
  @Prop({ type: Object }) result?: Record<string, unknown>;
  @Prop() error?: string;
  @Prop({ required: true }) durationMs!: number;
}
export const AgentRunSchema = SchemaFactory.createForClass(AgentRun);
