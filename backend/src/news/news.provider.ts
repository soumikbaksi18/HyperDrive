import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/configuration';

export type RawNewsItem = {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
};

@Injectable()
export class NewsProvider {
  private readonly logger = new Logger(NewsProvider.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async fetchBatch(): Promise<{ items: RawNewsItem[]; source: 'newsdata' | 'newsapi' | 'demo' }> {
    // Same key resolution as the Emperor Finance agents service: NEWS_DATA_API_KEY, then NEWS_API_KEY.
    const newsApiKey = this.config.newsApiKey ?? this.config.newsDataApiKey;

    if (this.config.newsDataApiKey) {
      try {
        const items = await this.fetchNewsData(this.config.newsDataApiKey);
        if (items.length > 0) return { items, source: 'newsdata' };
      } catch (error) {
        this.logger.warn(`NewsData.io fetch failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    if (newsApiKey) {
      try {
        const items = await this.fetchNewsApi(newsApiKey);
        if (items.length > 0) return { items, source: 'newsapi' };
      } catch (error) {
        this.logger.warn(`NewsAPI fetch failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    return { items: demoArticles(), source: 'demo' };
  }

  private async fetchNewsData(apiKey: string): Promise<RawNewsItem[]> {
    const url = new URL('https://newsdata.io/api/1/latest');
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set(
      'q',
      'NASDAQ OR stocks OR equities OR earnings OR Monad OR "tokenized stock" OR Apple OR NVIDIA OR Tesla OR Microsoft',
    );
    url.searchParams.set('language', 'en');
    url.searchParams.set('category', 'business,technology,top');

    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Hyperdrive/0.1' },
    });
    const body = (await response.json()) as {
      status?: string;
      results?: Array<{
        title?: string;
        description?: string;
        link?: string;
        source_name?: string;
        source_id?: string;
        pubDate?: string;
      }>;
      message?: string;
    };
    if (!response.ok) {
      throw new Error(body.message ?? `NewsData HTTP ${response.status}`);
    }
    if (body.status === 'error') {
      throw new Error(body.message ?? 'NewsData error');
    }
    return (body.results ?? [])
      .map((row) => ({
        title: (row.title ?? '').trim(),
        description: (row.description ?? '').trim(),
        url: (row.link ?? '').trim(),
        source: (row.source_name ?? row.source_id ?? 'News wire').trim(),
        publishedAt: normalizeDate(row.pubDate),
      }))
      .filter((row) => row.title.length > 0);
  }

  private async fetchNewsApi(apiKey: string): Promise<RawNewsItem[]> {
    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.set(
      'q',
      'NASDAQ OR stocks OR equities OR earnings OR Monad OR "tokenized stock" OR "stock market" OR Apple OR NVIDIA',
    );
    url.searchParams.set('language', 'en');
    url.searchParams.set('sortBy', 'publishedAt');
    url.searchParams.set('pageSize', String(this.config.newsBatchSize));
    url.searchParams.set('page', '1');
    url.searchParams.set('apiKey', apiKey);

    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Hyperdrive/0.1' },
    });
    const body = (await response.json()) as {
      status?: string;
      message?: string;
      articles?: Array<{
        title?: string;
        description?: string;
        url?: string;
        publishedAt?: string;
        source?: { name?: string };
      }>;
    };
    if (!response.ok || body.status === 'error') {
      throw new Error(body.message ?? `NewsAPI HTTP ${response.status}`);
    }
    return (body.articles ?? [])
      .map((row) => ({
        title: (row.title ?? '').trim(),
        description: (row.description ?? '').trim(),
        url: (row.url ?? '').trim(),
        source: (row.source?.name ?? 'News wire').trim(),
        publishedAt: normalizeDate(row.publishedAt),
      }))
      .filter((row) => row.title.length > 0 && row.title !== '[Removed]');
  }
}

function normalizeDate(raw: string | undefined) {
  if (!raw) return new Date().toISOString();
  const parsed = Date.parse(raw.replace(' ', 'T'));
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return new Date().toISOString();
}

function demoArticles(): RawNewsItem[] {
  const now = Date.now();
  return [
    {
      title: 'Nasdaq futures steady as mega-cap earnings approach',
      description:
        'Index-linked products saw muted moves while traders positioned for technology and semiconductor reports.',
      url: 'https://example.com/hyperdrive/demo/nasdaq-futures',
      source: 'Hyperdrive market wire',
      publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      title: 'NVIDIA supply commentary keeps chip complex in focus',
      description:
        'Analyst notes highlighted data-center demand while investors watched lead times across the AI supply chain.',
      url: 'https://example.com/hyperdrive/demo/nvidia-supply',
      source: 'Hyperdrive market wire',
      publishedAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      title: 'Apple services growth offsets hardware cycle questions',
      description:
        'Recurring revenue trends remained a talking point for large-cap consumer technology names on Nasdaq.',
      url: 'https://example.com/hyperdrive/demo/apple-services',
      source: 'Hyperdrive market wire',
      publishedAt: new Date(now - 9 * 60 * 60 * 1000).toISOString(),
    },
    {
      title: 'Regulators keep tokenized equity disclosures under review',
      description:
        'Policy headlines emphasized investor protection and transparency for blockchain-based stock products.',
      url: 'https://example.com/hyperdrive/demo/regulation',
      source: 'Hyperdrive market wire',
      publishedAt: new Date(now - 14 * 60 * 60 * 1000).toISOString(),
    },
  ];
}
