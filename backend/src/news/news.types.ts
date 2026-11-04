import type { NewsSentiment } from './sentiment';

export type NewsArticle = {
  id: string;
  time: string;
  headline: string;
  summary: string;
  tickers: string[];
  xSymbols: string[];
  impact: number;
  sentiment: NewsSentiment;
  category: string;
  dateLabel: string;
  url: string;
  source: string;
  publishedAt: string;
};

export type NewsFeedResponse = {
  articles: NewsArticle[];
  total: number;
  source: 'newsdata' | 'newsapi' | 'demo' | 'cache';
  status: 'ok' | 'empty' | 'error';
  notice?: string | null;
  syncedAt?: string | null;
  filters?: {
    ticker?: string | null;
    category?: string | null;
    time_filter?: string | null;
    q?: string | null;
  };
};

export type NewsSummaryResponse = {
  total: number;
  bullish: number;
  bearish: number;
  neutral: number;
  avgImpact: number;
  byCategory: { category: string; count: number; avgSentiment: number }[];
  topBullish: NewsArticle[];
  topBearish: NewsArticle[];
  syncedAt: string | null;
};
