import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { NewsArticleDoc, NewsSyncState } from '../db/schemas';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import {
  DB_RETRY_MS,
  NEWS_RETAIN_COUNT,
  NEWS_SYNC_ID,
  SCHEDULER_RETRY_MS,
} from './news.constants';
import { msUntilNewsRefresh } from './news-query';
import { NewsProvider, type RawNewsItem } from './news.provider';
import { NewsTransformService } from './news-transform.service';

@Injectable()
export class NewsRefreshService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NewsRefreshService.name);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectModel(NewsArticleDoc.name) private readonly articles: Model<NewsArticleDoc>,
    @InjectModel(NewsSyncState.name) private readonly syncState: Model<NewsSyncState>,
    private readonly provider: NewsProvider,
    private readonly transform: NewsTransformService,
  ) {}

  onModuleInit() {
    void this.arm('startup');
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private async arm(reason: string) {
    if (this.stopped) return;
    try {
      const mongoReady = this.articles.db.readyState === 1;
      if (!mongoReady) {
        this.logger.warn(`News sync waiting (${reason}); MongoDB is not connected`);
        this.schedule(DB_RETRY_MS, 'database unavailable');
        return;
      }

      const state = await this.syncState.findOne({ id: NEWS_SYNC_ID }).lean();
      const wait = msUntilNewsRefresh(
        state?.lastAttemptAt ? new Date(state.lastAttemptAt) : null,
        this.config.newsCacheTtlMs,
      );
      if (wait > 0) {
        this.logger.log(
          `News sync skipped (${reason}); next upstream pull in ${Math.max(1, Math.round(wait / 60_000))} min`,
        );
        this.schedule(wait, 'within refresh window');
        return;
      }

      const outcome = await this.pull(reason);
      this.schedule(this.config.newsCacheTtlMs, outcome);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`News scheduler paused (${reason}): ${message}`);
      this.schedule(SCHEDULER_RETRY_MS, 'scheduler error');
    }
  }

  private schedule(ms: number, reason: string) {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    const minutes = Math.max(1, Math.round(ms / 60_000));
    this.logger.log(`Next news sync in ${minutes} min (${reason})`);
    this.timer = setTimeout(() => {
      void this.arm('interval');
    }, ms);
    this.timer.unref();
  }

  private async pull(reason: string): Promise<'saved' | 'upstream-limited'> {
    const attemptAt = new Date();
    try {
      const { items, source } = await this.provider.fetchBatch();
      const saved = await this.persist(
        items.slice(0, this.config.newsBatchSize),
        source,
      );
      await this.syncState.findOneAndUpdate(
        { id: NEWS_SYNC_ID },
        {
          id: NEWS_SYNC_ID,
          lastAttemptAt: attemptAt,
          lastSuccessAt: saved > 0 ? new Date() : undefined,
          lastStatus: saved > 0 ? 'ok' : 'empty',
          lastError: null,
          articleCount: saved,
          lastSource: source,
        },
        { upsert: true, new: true },
      );
      this.logger.log(`Stored ${saved} news articles (${reason}, source=${source})`);
      return 'saved';
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      if (!this.upstreamRejected(message)) throw err;
      await this.syncState.findOneAndUpdate(
        { id: NEWS_SYNC_ID },
        {
          id: NEWS_SYNC_ID,
          lastAttemptAt: attemptAt,
          lastStatus: 'error',
          lastError: message,
        },
        { upsert: true, new: true },
      );
      this.logger.warn(`News sync failed (${reason}): ${message}`);
      return 'upstream-limited';
    }
  }

  private upstreamRejected(message: string): boolean {
    return /too many requests|rate limit|quota|newsdata|newsapi|api key|forbidden|401|402|429/i.test(
      message,
    );
  }

  private async persist(items: RawNewsItem[], source: string) {
    const fetchedAt = new Date();
    let saved = 0;
    for (const [index, item] of items.entries()) {
      const article = this.transform.toArticle(item, index, source);
      if (!article) continue;
      await this.articles.findOneAndUpdate(
        { url: article.url },
        {
          url: article.url,
          headline: article.headline,
          summary: article.summary,
          time: article.time,
          dateLabel: article.dateLabel,
          tickers: article.tickers,
          xSymbols: article.xSymbols,
          impact: article.impact,
          sentiment: article.sentiment,
          category: article.category,
          source: article.source,
          publishedAt: new Date(article.publishedAt),
          upstream: source,
          fetchedAt,
        },
        { upsert: true, new: true },
      );
      saved += 1;
    }

    const extra = await this.articles
      .find({}, { _id: 1 })
      .sort({ publishedAt: -1 })
      .skip(NEWS_RETAIN_COUNT)
      .lean();
    if (extra.length > 0) {
      await this.articles.deleteMany({ _id: { $in: extra.map((row) => row._id) } });
    }
    return saved;
  }
}
