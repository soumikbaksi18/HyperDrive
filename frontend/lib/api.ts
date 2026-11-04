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
