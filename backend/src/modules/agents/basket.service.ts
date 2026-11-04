import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AgentRun } from '../../db/schemas';
import { CatalogService, type CatalogStock } from '../../market/catalog.service';
import { HistoryService, type Technicals } from '../../market/history.service';
import { PricesService } from '../../market/prices.service';
import { NewsService } from '../../news/news.service';
import { SwapsService } from '../../swaps/swaps.service';
import { LLMService } from '../llm/llm.service';
import type { AnalysisJob, StockAnalysisResult, StockData } from './agent.interface';
import { UnifiedAgentService } from './unified-agent.service';

export type RiskLevel = 'conservative' | 'moderate' | 'aggressive';
export type Horizon = 'swing' | 'position' | 'long';

export type BasketRequest = {
  wallet?: string;
  amountUsd: number;
  risk: RiskLevel;
  /** Sector buckets to draw from. Empty = all. */
  buckets: string[];
  horizon: Horizon;
  modelId?: string | null;
  useSentiment: boolean;
  /** Only suggest assets with a USDC route on Monad (the 5 tradable today). */
  tradableOnly: boolean;
  maxPositions: number;
};

export type Holding = {
  symbol: string;
  underlying: string;
  name: string;
  sector: string;
  weight: number;
  amountUsd: number;
  price: number | null;
  tradable: boolean;
  recommendation: StockAnalysisResult['recommendation'];
  score: number;
  reason: string;
};

export type Basket = {
  id: string;
  name: string;
  risk: RiskLevel;
  thesis: string;
  allocationPct: number;
  amountUsd: number;
  holdings: Holding[];
  expectedVolatilityPct: number;
};

export type BasketResult = {
  runId: string;
  modelId: string;
  status: 'ok' | 'fallback';
  summary: string;
  marketRegime: string;
  baskets: Basket[];
  universe: { symbol: string; name: string; sector: string; score: number; recommendation: string; tradable: boolean; price: number | null; changePct: number | null; rsi: number | null; sentiment: number | null }[];
  risks: string[];
  durationMs: number;
  generatedAt: string;
};

const SECTOR_TO_JOB: Record<string, AnalysisJob['sector']> = {
  Tech: 'Technology',
  AI: 'AI',
  Healthcare: 'Healthcare',
  Energy: 'Energy',
  Financial: 'Financial',
  'Real Estate': 'RealEstate',
  Commodities: 'Commodities',
  Consumer: 'Consumer',
};

/** Max names the engine fully analyses per run (each needs a candle fetch); the rest are ranked by sentiment only. */
const ANALYSIS_CAP = 24;

type Candidate = {
  stock: CatalogStock;
  sector: string;
  technicals: Technicals | null;
  sentiment: number | null;
  newsCount: number;
  analysis: StockAnalysisResult | null;
  score: number;
  tradable: boolean;
};

/**
 * AI basket engine: scores a Nasdaq universe with the unified sector agent, then asks the chosen
 * LLM to assemble baskets for the user's amount / risk / horizon. The LLM output is validated and
 * clamped, with a rule-based fallback so the form always returns baskets.
 */
@Injectable()
export class BasketService {
  private readonly logger = new Logger(BasketService.name);

  constructor(
    @InjectModel(AgentRun.name) private readonly runs: Model<AgentRun>,
    private readonly catalog: CatalogService,
    private readonly history: HistoryService,
    private readonly prices: PricesService,
    private readonly news: NewsService,
    private readonly swaps: SwapsService,
    private readonly llm: LLMService,
    private readonly agent: UnifiedAgentService,
  ) {}

  async suggest(req: BasketRequest): Promise<BasketResult> {
    const started = Date.now();
    if (!(req.amountUsd > 0)) throw new BadRequestException('amountUsd must be positive');
    const modelId = req.modelId || this.llm.defaultModelId() || 'rules/fallback';

    const candidates = await this.buildUniverse(req);
    if (candidates.length === 0) {
      throw new BadRequestException('No stocks match those buckets. Widen the sectors or turn off "tradable only".');
    }

    let result: BasketResult;
    let status: 'ok' | 'fallback' = 'ok';
    let error: string | undefined;
    const draft = this.ruleBaskets(req, candidates);
    try {
      if (modelId === 'rules/fallback') throw new Error('no LLM configured');
      result = await this.llmBaskets(req, candidates, draft, modelId);
    } catch (err) {
      status = 'fallback';
      error = (err as Error).message;
      this.logger.warn(`LLM basket generation failed (${modelId}): ${error}; using rule-based baskets`);
      result = draft;
    }

    result.status = status;
    result.modelId = modelId;
    result.durationMs = Date.now() - started;
    result.generatedAt = new Date().toISOString();
    const run = await this.runs.create({
      wallet: req.wallet,
      request: req,
      modelId,
      status,
      result,
      error,
      durationMs: result.durationMs,
    });
    result.runId = String(run._id);
    return result;
  }

  async recent(wallet?: string, limit = 10) {
    return this.runs
      .find(wallet ? { wallet: wallet.toLowerCase() } : {})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  // ---------------------------------------------------------------------------
  // Universe + scoring
  // ---------------------------------------------------------------------------

  private async buildUniverse(req: BasketRequest): Promise<Candidate[]> {
    const tradable = this.swaps.tradableStatus().symbols;
    const wanted = new Set(req.buckets);
    let stocks = this.catalog
      .allStocks()
      .filter((s) => s.exchangeMic === 'XNAS' && !s.halted)
      .filter((s) => !req.tradableOnly || s.symbol in tradable);
    if (wanted.size) stocks = stocks.filter((s) => this.catalog.sectorsFor(s.underlying).some((t) => wanted.has(t)));

    // Rank by news sentiment first, so the capped deep analysis goes to names with signal.
    const sentimentBySymbol = new Map<string, { score: number; count: number }>();
    if (req.useSentiment) {
      const feed = await this.news.list({ time_filter: '7D', page_size: '200' }).catch(() => null);
      for (const article of feed?.articles ?? []) {
        const s = article.sentiment === 'up' ? 1 : article.sentiment === 'down' ? -1 : 0.1;
        for (const sym of [...article.xSymbols, ...article.tickers.map((t) => (t.endsWith('x') ? t : `${t}x`))]) {
          const row = sentimentBySymbol.get(sym) ?? { score: 0, count: 0 };
          row.score += s * (article.impact / 10);
          row.count += 1;
          sentimentBySymbol.set(sym, row);
        }
      }
    }

    const prioritized = stocks
      .map((stock) => ({ stock, sent: sentimentBySymbol.get(stock.symbol) }))
      .sort((a, b) => (b.stock.symbol in tradable ? 1 : 0) - (a.stock.symbol in tradable ? 1 : 0) || (b.sent?.count ?? 0) - (a.sent?.count ?? 0));
    const deep = prioritized.slice(0, ANALYSIS_CAP);

    const out: Candidate[] = [];
    let cursor = 0;
    const worker = async () => {
      while (cursor < deep.length) {
        const { stock, sent } = deep[cursor++];
        const sector = this.pickSector(stock, req.buckets);
        const technicals = await this.history.technicals(stock.underlying).catch(() => null);
        const quote = await this.prices.get(stock.symbol).catch(() => null);
        const price = quote ?? technicals?.last ?? null;
        const sentiment = sent ? Math.max(-1, Math.min(1, sent.score / Math.max(1, sent.count) )) : null;
        let analysis: StockAnalysisResult | null = null;
        if (technicals && price) {
          const data = this.toStockData(stock, sector, price, technicals, sentiment, sent?.count ?? 0);
          analysis = await this.agent.scoreOnly(data, { sector: SECTOR_TO_JOB[sector] ?? 'Technology' });
        }
        out.push({
          stock,
          sector,
          technicals,
          sentiment,
          newsCount: sent?.count ?? 0,
          analysis,
          score: analysis?.scores.overall ?? 50 + (sentiment ?? 0) * 10,
          tradable: stock.symbol in tradable,
        });
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    return out.sort((a, b) => b.score - a.score);
  }

  private pickSector(stock: CatalogStock, buckets: string[]) {
    const tags = this.catalog.sectorsFor(stock.underlying);
    return tags.find((t) => buckets.includes(t)) ?? tags.find((t) => t !== 'Other') ?? tags[0] ?? 'Other';
  }

  private toStockData(stock: CatalogStock, sector: string, price: number, t: Technicals, sentiment: number | null, newsCount: number): StockData {
    return {
      symbol: stock.symbol,
      companyName: stock.name.replace(/ xStock$/, ''),
      sector,
      industry: sector,
      price: { current: price, open: price, high: t.high52w, low: t.low52w, close: t.prevClose, volume: t.avgVolume },
      // Fundamentals are not available from a free feed; the agent treats missing values as neutral.
      fundamentals: { marketCap: 0, beta: Math.min(3, Math.max(0.3, t.volatilityPct / 25)) },
      technical: { sma20: t.sma20, sma50: t.sma50, sma200: t.sma200, rsi: t.rsi14, macd: t.macd },
      sentiment: sentiment == null ? undefined : { score: sentiment, newsCount },
    };
  }

  // ---------------------------------------------------------------------------
  // Rule-based draft (also the fallback)
  // ---------------------------------------------------------------------------

  private riskProfile(risk: RiskLevel) {
    return {
      conservative: { maxVol: 35, maxWeight: 30, names: 6, split: [60, 30, 10] },
      moderate: { maxVol: 55, maxWeight: 35, names: 5, split: [35, 45, 20] },
      aggressive: { maxVol: 100, maxWeight: 45, names: 4, split: [15, 35, 50] },
    }[risk];
  }

  private ruleBaskets(req: BasketRequest, candidates: Candidate[]): BasketResult {
    const profile = this.riskProfile(req.risk);
    const vol = (c: Candidate) => c.technicals?.volatilityPct ?? 45;
    const byVol = (lo: number, hi: number) => candidates.filter((c) => vol(c) >= lo && vol(c) < hi);
    const steady = byVol(0, 35);
    const balanced = byVol(25, 60);
    const growth = byVol(45, 400);
    const names = Math.min(req.maxPositions, profile.names);

    const mk = (id: string, name: string, risk: RiskLevel, pool: Candidate[], pct: number, thesis: string): Basket => {
      const picks = (pool.length >= 2 ? pool : candidates).slice(0, names);
      const total = picks.reduce((a, c) => a + Math.max(c.score, 1), 0);
      const amount = (req.amountUsd * pct) / 100;
      const holdings = picks.map((c) => {
        const weight = Math.min(profile.maxWeight, (Math.max(c.score, 1) / total) * 100);
        return this.holding(c, weight, amount, c.analysis?.reasoning ?? `Scored ${Math.round(c.score)}/100 by the ${c.sector} agent.`);
      });
      return {
        id,
        name,
        risk,
        thesis,
        allocationPct: pct,
        amountUsd: amount,
        holdings: normalize(holdings, amount),
        expectedVolatilityPct: avg(picks.map(vol)),
      };
    };

    const [a, b, c] = profile.split;
    return {
      runId: '',
      modelId: 'rules/fallback',
      status: 'fallback',
      summary: `Rule-based draft for $${req.amountUsd.toLocaleString()} at ${req.risk} risk across ${req.buckets.length ? req.buckets.join(', ') : 'all sectors'}: lower-volatility names anchor the Steady basket, momentum names fill Growth.`,
      marketRegime: regimeText(candidates),
      baskets: [
        mk('steady', 'Steady Explorer', 'conservative', steady, a, 'Lowest realised volatility names in the universe; capital preservation first.'),
        mk('balanced', 'Balanced Growth', 'moderate', balanced, b, 'Mid-volatility names with the best blended technical and sentiment scores.'),
        mk('growth', 'High-Growth Explorer', 'aggressive', growth, c, 'Highest-momentum, highest-volatility names; expect larger drawdowns.'),
      ],
      universe: candidates.map(universeRow),
      risks: ['Prices move 24/5 on xStocks while Nasdaq is closed overnight.', 'Only assets marked tradable can be bought on Monad today; others need an exchange or bridge.'],
      durationMs: 0,
      generatedAt: '',
    };
  }

  private holding(c: Candidate, weight: number, basketAmount: number, reason: string): Holding {
    return {
      symbol: c.stock.symbol,
      underlying: c.stock.underlying,
      name: c.stock.name.replace(/ xStock$/, ''),
      sector: c.sector,
      weight,
      amountUsd: (basketAmount * weight) / 100,
      price: c.technicals?.last ?? null,
      tradable: c.tradable,
      recommendation: c.analysis?.recommendation ?? 'HOLD',
      score: Math.round(c.score),
      reason,
    };
  }

  // ---------------------------------------------------------------------------
  // LLM refinement (Emperor pattern: rule draft → model refines → validate/clamp → fallback per field)
  // ---------------------------------------------------------------------------

  private async llmBaskets(req: BasketRequest, candidates: Candidate[], draft: BasketResult, modelId: string): Promise<BasketResult> {
    const profile = this.riskProfile(req.risk);
    const rows = candidates.map((c) => ({
      symbol: c.stock.symbol,
      name: c.stock.name.replace(/ xStock$/, ''),
      sector: c.sector,
      price: c.technicals?.last ?? null,
      change_pct: round(c.technicals?.changePct),
      rsi14: round(c.technicals?.rsi14),
      vs_sma50_pct: c.technicals ? round(((c.technicals.last - c.technicals.sma50) / c.technicals.sma50) * 100) : null,
      vs_sma200_pct: c.technicals ? round(((c.technicals.last - c.technicals.sma200) / c.technicals.sma200) * 100) : null,
      macd_hist: round(c.technicals?.macd.histogram, 3),
      volatility_pct: round(c.technicals?.volatilityPct),
      news_sentiment: round(c.sentiment, 2),
      news_count: c.newsCount,
      agent_score: Math.round(c.score),
      agent_view: c.analysis?.recommendation ?? 'HOLD',
      tradable_on_monad: c.tradable,
    }));

    const system = 'You are Hyperdrive\'s portfolio strategist for tokenized Nasdaq stocks (xStocks on Monad). Return valid JSON only. No markdown, no prose outside the JSON.';
    const user = `
Build three stock baskets for this investor. These are suggestions, not executed trades.

Investor:
- Capital: $${req.amountUsd}
- Risk level: ${req.risk} (max single-name weight ${profile.maxWeight}%, up to ${Math.min(req.maxPositions, profile.names)} names per basket)
- Horizon: ${req.horizon} (${{ swing: '1-4 weeks', position: '1-6 months', long: '1 year+' }[req.horizon]})
- Sector buckets requested: ${req.buckets.length ? req.buckets.join(', ') : 'any'}
- Capital split across the three baskets (Steady / Balanced / Growth) must be close to ${profile.split.join(' / ')}% for this risk level.

Universe (each row was scored by a sector agent; agent_score 0-100, higher = better):
${JSON.stringify(rows)}

Rule-based draft you may improve on:
${JSON.stringify(draft.baskets.map((b) => ({ id: b.id, allocationPct: b.allocationPct, holdings: b.holdings.map((h) => ({ symbol: h.symbol, weight: Math.round(h.weight) })) })))}

Rules:
- Use ONLY symbols from the universe. Weights inside a basket must sum to 100.
- Prefer tradable_on_monad=true names where scores are similar; say so in the reason when a pick is not tradable yet.
- Avoid putting the same symbol in more than one basket.
- Reasons: one specific sentence each citing the data (RSI, trend vs SMA, sentiment, volatility).

Return ONLY JSON of this exact shape:
{"summary":"3-4 sentences on the overall plan","market_regime":"1-2 sentences on the tape","risks":["...","..."],
 "baskets":[
  {"id":"steady","name":"Steady Explorer","thesis":"1-2 sentences","allocation_pct":${profile.split[0]},"holdings":[{"symbol":"AAPLx","weight":40,"reason":"..."}]},
  {"id":"balanced","name":"Balanced Growth","thesis":"...","allocation_pct":${profile.split[1]},"holdings":[...]},
  {"id":"growth","name":"High-Growth Explorer","thesis":"...","allocation_pct":${profile.split[2]},"holdings":[...]}
 ]}`.trim();

    const raw = await this.llm.chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { modelId, temperature: 0.25, maxTokens: 2200 },
    );
    const parsed = parseJsonObject(raw) as {
      summary?: string;
      market_regime?: string;
      risks?: string[];
      baskets?: { id?: string; name?: string; thesis?: string; allocation_pct?: number; holdings?: { symbol?: string; weight?: number; reason?: string }[] }[];
    };
    if (!parsed?.baskets?.length) throw new Error('model returned no baskets');

    const bySymbol = new Map(candidates.map((c) => [c.stock.symbol.toUpperCase(), c]));
    const used = new Set<string>();
    const baskets: Basket[] = draft.baskets.map((d) => {
      const m = parsed.baskets!.find((b) => b.id === d.id) ?? parsed.baskets![draft.baskets.indexOf(d)];
      const picks = (m?.holdings ?? [])
        .map((h) => ({ c: bySymbol.get(String(h.symbol ?? '').toUpperCase()), weight: Number(h.weight), reason: String(h.reason ?? '') }))
        .filter((h): h is { c: Candidate; weight: number; reason: string } => Boolean(h.c) && Number.isFinite(h.weight) && h.weight > 0 && !used.has(h.c!.stock.symbol))
        .slice(0, Math.min(req.maxPositions, profile.names + 2));
      if (picks.length === 0) return d; // per-basket fallback to the draft
      picks.forEach((p) => used.add(p.c.stock.symbol));
      const pct = clamp(Number(m?.allocation_pct ?? d.allocationPct), 5, 80);
      const amount = (req.amountUsd * pct) / 100;
      const holdings = picks.map((p) => this.holding(p.c, Math.min(profile.maxWeight + 10, p.weight), amount, p.reason || p.c.analysis?.reasoning || ''));
      return {
        ...d,
        name: m?.name?.trim() || d.name,
        thesis: m?.thesis?.trim() || d.thesis,
        allocationPct: pct,
        amountUsd: amount,
        holdings: normalize(holdings, amount),
        expectedVolatilityPct: avg(picks.map((p) => p.c.technicals?.volatilityPct ?? 45)),
      };
    });
    // Re-normalise basket split to 100 after clamping.
    const sumPct = baskets.reduce((a, b) => a + b.allocationPct, 0);
    for (const b of baskets) {
      b.allocationPct = Math.round((b.allocationPct / sumPct) * 1000) / 10;
      b.amountUsd = (req.amountUsd * b.allocationPct) / 100;
      b.holdings = normalize(b.holdings, b.amountUsd);
    }

    return {
      ...draft,
      status: 'ok',
      summary: parsed.summary?.trim() || draft.summary,
      marketRegime: parsed.market_regime?.trim() || draft.marketRegime,
      risks: Array.isArray(parsed.risks) && parsed.risks.length ? parsed.risks.map(String).slice(0, 6) : draft.risks,
      baskets,
    };
  }
}

function universeRow(c: Candidate) {
  return {
    symbol: c.stock.symbol,
    name: c.stock.name.replace(/ xStock$/, ''),
    sector: c.sector,
    score: Math.round(c.score),
    recommendation: c.analysis?.recommendation ?? 'HOLD',
    tradable: c.tradable,
    price: c.technicals?.last ?? null,
    changePct: c.technicals?.changePct ?? null,
    rsi: c.technicals?.rsi14 ?? null,
    sentiment: c.sentiment,
  };
}

function regimeText(candidates: Candidate[]) {
  const withT = candidates.filter((c) => c.technicals);
  if (!withT.length) return 'Not enough price history to describe the tape.';
  const above200 = withT.filter((c) => c.technicals!.last > c.technicals!.sma200).length;
  const rsi = avg(withT.map((c) => c.technicals!.rsi14));
  const vol = avg(withT.map((c) => c.technicals!.volatilityPct));
  return `${Math.round((above200 / withT.length) * 100)}% of the universe trades above its 200-day average; average RSI ${rsi.toFixed(0)}, average realised volatility ${vol.toFixed(0)}%.`;
}

function normalize(holdings: Holding[], amount: number) {
  const sum = holdings.reduce((a, h) => a + h.weight, 0);
  if (!sum) return holdings;
  return holdings.map((h) => {
    const weight = Math.round((h.weight / sum) * 1000) / 10;
    return { ...h, weight, amountUsd: Math.round((amount * weight) / 100 * 100) / 100 };
  });
}

function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function clamp(x: number, lo: number, hi: number) {
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo;
}
function round(x: number | null | undefined, d = 1) {
  return x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d;
}

/** Strip code fences and pull out the first balanced {...} (Emperor's parse_json_object). */
export function parseJsonObject(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  if (start === -1) throw new Error('no JSON object in model output');
  let depth = 0;
  let inStr = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
  }
  throw new Error('unbalanced JSON in model output');
}
