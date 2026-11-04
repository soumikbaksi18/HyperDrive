import { Injectable } from '@nestjs/common';
import { CatalogService } from '../market/catalog.service';
import { calculateImpact, classifyCategory, getSentiment } from './sentiment';
import type { NewsArticle } from './news.types';
import type { RawNewsItem } from './news.provider';

@Injectable()
export class NewsTransformService {
  constructor(private readonly catalog: CatalogService) {}

  toArticle(item: RawNewsItem, index: number, _upstream: string): NewsArticle | null {
    const headline = item.title.trim();
    if (!headline || headline === '[Removed]') return null;
    const summary = item.description.trim();
    const combined = `${headline} ${summary}`;
    const published = new Date(item.publishedAt);
    if (Number.isNaN(published.getTime())) return null;
    const { tickers, xSymbols } = this.extractTickers(combined);
    const url = item.url.trim() || `headline:${headline.slice(0, 180)}`;
    return {
      id: `${published.getTime()}-${index}`,
      time: published.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      headline,
      summary,
      tickers,
      xSymbols,
      impact: calculateImpact(headline, summary, item.source),
      sentiment: getSentiment(headline, summary),
      category: classifyCategory(combined),
      dateLabel: published
        .toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
        .toUpperCase(),
      url,
      source: item.source.trim() || 'News wire',
      publishedAt: published.toISOString(),
    };
  }

  private extractTickers(text: string) {
    const upper = text.toUpperCase();
    const lower = text.toLowerCase();
    const tickers = new Set<string>();
    const xSymbols = new Set<string>();
    for (const stock of this.catalog.allStocks()) {
      const underlying = stock.underlying.toUpperCase();
      const symbol = stock.symbol.toUpperCase();
      if (
        upper.includes(underlying) ||
        upper.includes(symbol) ||
        lower.includes(stock.name.toLowerCase())
      ) {
        tickers.add(underlying);
        xSymbols.add(symbol);
      }
    }
    if (tickers.size === 0) tickers.add('NDX');
    return { tickers: [...tickers].slice(0, 6), xSymbols: [...xSymbols].slice(0, 6) };
  }
}
