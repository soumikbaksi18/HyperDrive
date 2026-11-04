import { Injectable, Logger, NotFoundException } from '@nestjs/common';

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

export type Technicals = {
  last: number;
  prevClose: number;
  changePct: number;
  sma20: number;
  sma50: number;
  sma200: number;
  rsi14: number;
  macd: { value: number; signal: number; histogram: number };
  /** Annualised realised volatility of daily log returns, in %. */
  volatilityPct: number;
  high52w: number;
  low52w: number;
  avgVolume: number;
  bars: number;
};

export type HistoryResult = {
  symbol: string;
  name: string | null;
  range: string;
  interval: string;
  candles: Candle[];
  technicals: Technicals | null;
  fetchedAt: string;
};

const RANGES: Record<string, string> = { '1d': '5m', '5d': '15m', '1mo': '1h', '3mo': '1d', '6mo': '1d', '1y': '1d', '2y': '1wk' };

/** Daily/intraday candles for an underlying ticker from Yahoo's public chart endpoint, with a short cache. */
@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);
  private readonly cache = new Map<string, { at: number; value: HistoryResult }>();

  async get(underlying: string, range = '6mo', interval?: string): Promise<HistoryResult> {
    const symbol = underlying.toUpperCase().replace(/[^A-Z0-9.^=-]/g, '');
    const rng = RANGES[range] ? range : '6mo';
    const itv = interval ?? RANGES[rng];
    const key = `${symbol}:${rng}:${itv}`;
    const hit = this.cache.get(key);
    const ttl = itv.endsWith('m') || itv.endsWith('h') ? 60_000 : 10 * 60_000;
    if (hit && Date.now() - hit.at < ttl) return hit.value;

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${rng}&interval=${itv}`;
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 Hyperdrive/0.1' }, signal: AbortSignal.timeout(15_000) });
    const body = (await res.json().catch(() => null)) as {
      chart?: { result?: { meta?: Record<string, unknown>; timestamp?: number[]; indicators?: { quote?: Record<string, (number | null)[]>[] } }[]; error?: { description?: string } };
    } | null;
    const result = body?.chart?.result?.[0];
    if (!res.ok || !result?.timestamp) {
      throw new NotFoundException(`No price history for ${symbol}: ${body?.chart?.error?.description ?? `HTTP ${res.status}`}`);
    }
    const q = result.indicators?.quote?.[0] ?? {};
    const candles: Candle[] = [];
    result.timestamp.forEach((t, i) => {
      const c = q.close?.[i];
      if (c == null) return;
      candles.push({
        time: t,
        open: q.open?.[i] ?? c,
        high: q.high?.[i] ?? c,
        low: q.low?.[i] ?? c,
        close: c,
        volume: q.volume?.[i] ?? 0,
      });
    });
    const meta = result.meta ?? {};
    const value: HistoryResult = {
      symbol,
      name: (meta.longName as string) ?? (meta.shortName as string) ?? null,
      range: rng,
      interval: itv,
      candles,
      technicals: computeTechnicals(candles, meta),
      fetchedAt: new Date().toISOString(),
    };
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  /** Daily technicals (used by the agents): always the 1y/1d series regardless of chart range. */
  technicals(underlying: string) {
    return this.get(underlying, '1y', '1d').then((h) => h.technicals);
  }
}

function sma(values: number[], n: number) {
  if (values.length < n) return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const slice = values.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / n;
}

function ema(values: number[], n: number): number[] {
  const k = 2 / (n + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

export function computeTechnicals(candles: Candle[], meta: Record<string, unknown> = {}): Technicals | null {
  const closes = candles.map((c) => c.close);
  if (closes.length < 15) return null;
  const last = closes[closes.length - 1];
  const prevClose = (meta.chartPreviousClose as number) ?? closes[closes.length - 2];

  let gains = 0;
  let losses = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  const rs = losses === 0 ? 100 : gains / losses;
  const rsi14 = losses === 0 ? 100 : 100 - 100 / (1 + rs);

  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  const macdLine = e12.map((v, i) => v - e26[i]);
  const signalLine = ema(macdLine, 9);
  const macdValue = macdLine[macdLine.length - 1];
  const macdSignal = signalLine[signalLine.length - 1];

  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) returns.push(Math.log(closes[i] / closes[i - 1]));
  const recent = returns.slice(-60);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const variance = recent.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, recent.length - 1);
  const volatilityPct = Math.sqrt(variance) * Math.sqrt(252) * 100;

  return {
    last,
    prevClose,
    changePct: prevClose ? ((last - prevClose) / prevClose) * 100 : 0,
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    rsi14,
    macd: { value: macdValue, signal: macdSignal, histogram: macdValue - macdSignal },
    volatilityPct,
    high52w: (meta.fiftyTwoWeekHigh as number) ?? Math.max(...candles.map((c) => c.high)),
    low52w: (meta.fiftyTwoWeekLow as number) ?? Math.min(...candles.map((c) => c.low)),
    avgVolume: candles.slice(-20).reduce((a, c) => a + c.volume, 0) / Math.min(20, candles.length),
    bars: candles.length,
  };
}
