const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const raw = body?.message;
    const message = Array.isArray(raw) ? raw.join('; ') : (raw ?? `Request failed: ${res.status}`);
    throw new ApiError(message, res.status);
  }
  return body as T;
}

export function fetchHealth() {
  return request<{ status: string; service: string; timestamp: string; mongo: string }>('/health');
}

export type DeskConfig =
  | { configured: false; chainId: number }
  | {
      configured: true;
      /** desk = HyperdriveDesk with signed quotes; dex = wallet swap via the DEX aggregator (mainnet). */
      mode: 'desk' | 'dex';
      chainId: number;
      desk?: `0x${string}`;
      usdc: `0x${string}`;
      feeBps: number;
    };

export const fetchDesk = () => request<DeskConfig>('/desk');

export type TradeSide = 'buy' | 'sell';

export type SignedQuote = {
  desk: `0x${string}`;
  usdc: `0x${string}`;
  chainId: number;
  symbol: string;
  quote: {
    trader: `0x${string}`;
    token: `0x${string}`;
    side: number;
    amountIn: string;
    price: string;
    deadline: string;
    nonce: `0x${string}`;
  };
  signature: `0x${string}`;
  expectedOut: string;
  expectedOutDecimal: string;
  fee: string;
  feeUsd: number;
  feeBps: number;
  marketPriceUsd: number;
  priceUsd: number;
  expiresAt: string;
};

export const requestQuote = (body: {
  trader: string;
  symbol: string;
  side: TradeSide;
  amount: string;
}) => request<SignedQuote>('/quotes', { method: 'POST', body: JSON.stringify(body) });

export type SwapQuote = {
  mode: 'dex';
  venue: string;
  chainId: number;
  symbol: string;
  trader: `0x${string}`;
  router: `0x${string}`;
  data: `0x${string}`;
  value: string;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: string;
  expectedOut: string;
  expectedOutDecimal: string;
  minOutDecimal: string;
  slippageBps: number;
  priceUsd: number;
  marketPriceUsd: number | null;
  deviationPct: number | null;
  feeUsd: number;
  feeBps: number;
  expiresAt: string;
};

export const requestSwap = (body: {
  trader: string;
  symbol: string;
  side: TradeSide;
  amount: string;
}) => request<SwapQuote>('/swap/quote', { method: 'POST', body: JSON.stringify(body) });

export const syncTrade = (txHash: string) =>
  request<{ trades: TradeRecord[] }>('/trades/sync', {
    method: 'POST',
    body: JSON.stringify({ txHash }),
  });

export type Position = {
  token: string;
  symbol: string;
  name: string;
  underlying: string;
  logo: string | null;
  status: 'active' | 'closed';
  shares: number;
  sharesRaw: string;
  avgCost: number;
  costBasis: number;
  currentPrice: number | null;
  priceIsLive: boolean;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  totalPnl: number;
  totalBought: number;
  totalSold: number;
  fees: number;
  tradeCount: number;
  firstTradeAt: string;
  lastTradeAt: string;
  onchainShares: number | null;
  allocationPct: number;
};

export type Portfolio = {
  wallet: string;
  chainId: number;
  pricedAt: string;
  summary: {
    marketValue: number;
    costBasis: number;
    unrealizedPnl: number;
    unrealizedPnlPct: number;
    realizedPnl: number;
    totalPnl: number;
    totalPnlPct: number;
    totalBought: number;
    totalSold: number;
    netInvested: number;
    fees: number;
    tradeCount: number;
    activePositions: number;
    closedPositions: number;
    firstTradeAt: string | null;
  };
  positions: Position[];
};

export type TradeRecord = {
  txHash: string;
  logIndex: number;
  blockNumber: number;
  timestamp: string;
  symbol: string;
  token: string;
  side: TradeSide;
  usdcAmountUsd: number;
  sharesDecimal: number;
  priceUsd: number;
  feeUsd: number;
};

export type Snapshot = {
  at: string;
  marketValue: number;
  costBasis: number;
  realizedPnl: number;
  unrealizedPnl: number;
  netInvested: number;
};

export const fetchPortfolio = (wallet: string) =>
  request<Portfolio>(`/portfolio/${wallet}?onchain=1`);
export const fetchTrades = (wallet: string, limit = 100) =>
  request<TradeRecord[]>(`/portfolio/${wallet}/trades?limit=${limit}`);
export const fetchHistory = (wallet: string, days = 30) =>
  request<Snapshot[]>(`/portfolio/${wallet}/history?days=${days}`);

export type NewsSentiment = 'up' | 'down' | 'neutral';

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
  source: string;
  status: string;
  notice?: string | null;
  syncedAt?: string | null;
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

export function fetchNewsFeed(params: {
  ticker?: string;
  category?: string;
  time_filter?: string;
  page_size?: number;
  q?: string;
}) {
  const query = new URLSearchParams();
  if (params.ticker) query.set('ticker', params.ticker);
  if (params.category) query.set('category', params.category);
  if (params.time_filter) query.set('time_filter', params.time_filter);
  if (params.page_size) query.set('page_size', String(params.page_size));
  if (params.q) query.set('q', params.q);
  const qs = query.toString();
  return request<NewsFeedResponse>(`/news${qs ? `?${qs}` : ''}`);
}

export function fetchNewsSearch(q: string, time_filter = '7D', page_size = 50) {
  const query = new URLSearchParams({ q, time_filter, page_size: String(page_size) });
  return request<NewsFeedResponse>(`/news/search?${query}`);
}

export function fetchNewsSummary(time_filter = '7D', ticker?: string) {
  const query = new URLSearchParams({ time_filter });
  if (ticker) query.set('ticker', ticker);
  return request<NewsSummaryResponse>(`/news/summary?${query}`);
}

export function analyzeNewsSentiment(text: string) {
  return request<{ sentiment: NewsSentiment; scores: { positive: number; negative: number; compound: number } }>(
    '/news/sentiment',
    { method: 'POST', body: JSON.stringify({ text }) },
  );
}

export type TradableStatus = {
  venue: string;
  complete: boolean;
  scannedAt: string | null;
  checked: number;
  total: number;
  /** symbol -> implied $ per share from a $1 USDC route */
  symbols: Record<string, number>;
};

/** Which assets currently have USDC liquidity on Monad (backend scans every 30 min). */
export const fetchTradable = () => request<TradableStatus>('/swap/tradable');
