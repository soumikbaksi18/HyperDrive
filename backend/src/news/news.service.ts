import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { NewsArticleDoc, NewsSyncState } from '../db/schemas';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { NEWS_SYNC_ID } from './news.constants';
import { filterArticles, parsePage, parsePageSize, summarizeArticles } from './news-query';
import { analyzeText } from './sentiment';
import type { NewsArticle, NewsFeedResponse, NewsSummaryResponse } from './news.types';

@Injectable()
export class NewsService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectModel(NewsArticleDoc.name) private readonly articles: Model<NewsArticleDoc>,
    @InjectModel(NewsSyncState.name) private readonly syncState: Model<NewsSyncState>,
  ) {}

  async list(query: {
    ticker?: string;
    category?: string;
    time_filter?: string;
    page?: string;
    page_size?: string;
    q?: string;
  }): Promise<NewsFeedResponse> {
    const { rows, state } = await this.loadStored();
    const filtered = filterArticles(rows, {
      ticker: query.ticker,
      category: query.category,
      timeFilter: query.time_filter,
      q: query.q,
      page: parsePage(query.page),
      pageSize: parsePageSize(query.page_size, this.config.newsBatchSize),
    });
    return {
      articles: filtered.articles,
      total: filtered.total,
      source: (state?.lastSource as NewsFeedResponse['source']) ?? 'cache',
      status: state?.lastStatus === 'error' ? 'error' : rows.length > 0 ? 'ok' : 'empty',
      notice: this.notice(state, rows.length),
      syncedAt: state?.lastSuccessAt?.toISOString() ?? null,
      filters: {
        ticker: query.ticker ?? null,
        category: query.category ?? null,
        time_filter: query.time_filter ?? null,
        q: query.q ?? null,
      },
    };
  }

  async search(query: {
    q: string;
    time_filter?: string;
    page?: string;
    page_size?: string;
  }): Promise<NewsFeedResponse> {
    return this.list({
      q: query.q,
      time_filter: query.time_filter,
      page: query.page,
      page_size: query.page_size,
    });
  }

  async summary(query: { time_filter?: string; ticker?: string }): Promise<NewsSummaryResponse> {
    const { rows, state } = await this.loadStored();
    const filtered = filterArticles(rows, {
      ticker: query.ticker,
      timeFilter: query.time_filter,
      page: 1,
      pageSize: 500,
    });
    const stats = summarizeArticles(filtered.articles);
    return {
      ...stats,
      syncedAt: state?.lastSuccessAt?.toISOString() ?? null,
    };
  }

  analyzeSentiment(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      return { sentiment: 'neutral' as const, scores: { positive: 0, negative: 0, compound: 0 } };
    }
    return analyzeText(trimmed);
  }

  private async loadStored() {
    const [docs, state] = await Promise.all([
      this.articles.find().sort({ publishedAt: -1 }).limit(100).lean(),
      this.syncState.findOne({ id: NEWS_SYNC_ID }).lean(),
    ]);
    const rows: NewsArticle[] = docs.map((doc) => ({
      id: String(doc._id),
      time: doc.time,
      headline: doc.headline,
      summary: doc.summary,
      tickers: doc.tickers ?? [],
      xSymbols: doc.xSymbols ?? [],
      impact: doc.impact,
      sentiment: doc.sentiment,
      category: doc.category,
      dateLabel: doc.dateLabel,
      url: doc.url,
      source: doc.source,
      publishedAt: new Date(doc.publishedAt).toISOString(),
    }));
    return { rows, state };
  }

  private notice(state: NewsSyncState | null, storedCount: number) {
    if (state?.lastStatus === 'error') {
      const detail = state.lastError ? ` ${state.lastError}` : '';
      return `Showing saved headlines.${detail} Upstream news is fetched at most once every ${Math.round(this.config.newsCacheTtlMs / 3_600_000)} hours while the server runs.`;
    }
    if (storedCount === 0) {
      if (!this.config.newsDataApiKey && !this.config.newsApiKey) {
        return 'No saved news yet. Set NEWS_DATA_API_KEY in the backend env; the scheduler pulls a batch on startup and on a timer.';
      }
      return 'No saved news yet. The scheduler fetches headlines on startup and refreshes on a timer while the server is running.';
    }
    return null;
  }
}
