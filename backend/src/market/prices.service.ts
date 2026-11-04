import { Injectable, Logger } from '@nestjs/common';

const FRESH_MS = 30_000;
const MISS_MS = 10_000;

/** Latest xStocks price-data quote per symbol (USD per share), with a short in-memory cache. */
@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);
  private readonly cache = new Map<string, { price: number | null; at: number }>();
  private readonly lastGood = new Map<string, { price: number; at: number }>();
  private readonly resolvers = new Map<string, () => Promise<number | null>>();

  /** Price a non-xStocks symbol (e.g. a basket at NAV) with a custom function. */
  registerResolver(symbol: string, fn: () => Promise<number | null>) {
    this.resolvers.set(symbol, fn);
  }

  /** Always hits the API: used to sign quotes, where a cached price is not good enough. */
  async live(symbol: string): Promise<number | null> {
    try {
      const res = await fetch(
        `https://api.xstocks.fi/api/v2/public/assets/${encodeURIComponent(symbol)}/price-data`,
        { headers: { Accept: 'application/json', 'User-Agent': 'Hyperdrive/0.1' } },
      );
      if (!res.ok) {
        this.cache.set(symbol, { price: null, at: Date.now() });
        return null;
      }
      const body = (await res.json()) as { quote?: unknown };
      const price =
        typeof body.quote === 'number' && Number.isFinite(body.quote) && body.quote > 0
          ? body.quote
          : null;
      this.cache.set(symbol, { price, at: Date.now() });
      return price;
    } catch (error) {
      this.logger.warn(`price-data ${symbol} failed: ${(error as Error).message}`);
      this.cache.set(symbol, { price: null, at: Date.now() });
      return null;
    }
  }

  /**
   * Live price for signing, rejected if it moved more than `bandPct` from the last accepted
   * price seen in the past 10 minutes (guards against a bad tick from the upstream API).
   */
  async liveChecked(symbol: string, bandPct: number): Promise<{ price: number | null; rejected: boolean }> {
    const price = await this.live(symbol);
    if (price == null) return { price: null, rejected: false };
    const prev = this.lastGood.get(symbol);
    if (prev && Date.now() - prev.at < 10 * 60_000 && Math.abs(price / prev.price - 1) * 100 > bandPct) {
      this.logger.warn(`${symbol} price ${price} outside ${bandPct}% band of ${prev.price}; not signing`);
      return { price, rejected: true };
    }
    this.lastGood.set(symbol, { price, at: Date.now() });
    return { price, rejected: false };
  }

  async get(symbol: string): Promise<number | null> {
    const resolver = this.resolvers.get(symbol);
    if (resolver) return resolver().catch(() => null);
    const hit = this.cache.get(symbol);
    if (hit && Date.now() - hit.at < (hit.price == null ? MISS_MS : FRESH_MS)) return hit.price;
    return this.live(symbol);
  }

  async getMany(symbols: string[]): Promise<Record<string, number | null>> {
    const unique = [...new Set(symbols)];
    const out: Record<string, number | null> = {};
    let cursor = 0;
    const worker = async () => {
      while (cursor < unique.length) {
        const symbol = unique[cursor++];
        out[symbol] = await this.get(symbol);
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, unique.length) }, worker));
    return out;
  }
}
