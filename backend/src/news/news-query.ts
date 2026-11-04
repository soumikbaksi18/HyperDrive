import type { NewsArticle } from './news.types';
import { MONAD_TOPIC_TERMS } from './sentiment';

function matchesMonadFilter(article: NewsArticle) {
  if (article.category === 'Monad') return true;
  const blob = `${article.headline} ${article.summary}`.toLowerCase();
  return MONAD_TOPIC_TERMS.some((term) => blob.includes(term));
}

export function msUntilNewsRefresh(lastAttemptAt: Date | null, refreshMs: number, now = Date.now()) {
  if (!lastAttemptAt) return 0;
  const elapsed = now - lastAttemptAt.getTime();
  if (elapsed >= refreshMs) return 0;
  if (elapsed < 0) return refreshMs;
  return refreshMs - elapsed;
}

export function parsePage(value: string | undefined, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1000, Math.max(1, Math.trunc(parsed)));
}

export function parsePageSize(value: string | undefined, fallback = 30) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

function withinTime(publishedAt: string, timeFilter: string | undefined, now = Date.now()) {
  const label = timeFilter ?? '7D';
  if (label === 'All') return true;
  const published = Date.parse(publishedAt);
  if (!Number.isFinite(published)) return true;
  const ageMs = now - published;
  if (label === '24H') return ageMs <= 24 * 60 * 60 * 1000;
  if (label === '7D') return ageMs <= 7 * 24 * 60 * 60 * 1000;
  if (label === '30D') return ageMs <= 30 * 24 * 60 * 60 * 1000;
  return true;
}

export function filterArticles(
  articles: NewsArticle[],
  query: {
    ticker?: string;
    category?: string;
    timeFilter?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  },
) {
  const ticker = query.ticker?.trim().toUpperCase().replace(/X$/, '') ?? '';
  const category = query.category?.trim();
  const needle = query.q?.trim().toLowerCase() ?? '';
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 30;

  let list = articles.filter((article) => withinTime(article.publishedAt, query.timeFilter));
  if (category && category !== 'All') {
    list = list.filter((article) =>
      category === 'Monad' ? matchesMonadFilter(article) : article.category === category,
    );
  }
  if (ticker) {
    list = list.filter(
      (article) =>
        article.tickers.some((t) => t.toUpperCase() === ticker || t.toUpperCase().startsWith(ticker)) ||
        article.xSymbols.some((s) => s.toUpperCase().replace(/X$/, '') === ticker) ||
        `${article.headline} ${article.summary}`.toUpperCase().includes(ticker),
    );
  }
  if (needle) {
    list = list.filter((article) => {
      const blob = `${article.headline} ${article.summary} ${article.source}`.toLowerCase();
      return blob.includes(needle);
    });
  }

  const start = (page - 1) * pageSize;
  return {
    articles: list.slice(start, start + pageSize),
    total: list.length,
  };
}

export function summarizeArticles(articles: NewsArticle[]) {
  const bullish = articles.filter((a) => a.sentiment === 'up');
  const bearish = articles.filter((a) => a.sentiment === 'down');
  const neutral = articles.filter((a) => a.sentiment === 'neutral');
  const avgImpact =
    articles.length === 0 ? 0 : articles.reduce((sum, a) => sum + a.impact, 0) / articles.length;

  const buckets = new Map<string, { count: number; score: number }>();
  for (const article of articles) {
    const row = buckets.get(article.category) ?? { count: 0, score: 0 };
    row.count += 1;
    row.score += article.sentiment === 'up' ? 1 : article.sentiment === 'down' ? -1 : 0;
    buckets.set(article.category, row);
  }

  const byCategory = [...buckets.entries()]
    .map(([category, row]) => ({
      category,
      count: row.count,
      avgSentiment: row.count === 0 ? 0 : row.score / row.count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total: articles.length,
    bullish: bullish.length,
    bearish: bearish.length,
    neutral: neutral.length,
    avgImpact: Math.round(avgImpact * 10) / 10,
    byCategory,
    topBullish: [...bullish].sort((a, b) => b.impact - a.impact).slice(0, 5),
    topBearish: [...bearish].sort((a, b) => b.impact - a.impact).slice(0, 5),
  };
}
