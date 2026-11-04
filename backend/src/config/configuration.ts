import { isAddress, type Address, type Hex } from 'viem';

export type AppConfig = {
  port: number;
  mongoUri: string;
  rpcUrl: string;
  chainId: number;
  deskAddress: Address | null;
  deskDeployBlock: bigint;
  quoteSignerKey: Hex | null;
  quoteTtlSeconds: number;
  quoteSpreadBps: number;
  priceBandPct: number;
  usdcAddress: Address;
  swapSlippageBps: number;
  indexerRewindBlocks: number;
  quoteMinUsdc: number;
  quoteMaxUsdc: number;
  indexerEnabled: boolean;
  indexerPollMs: number;
  indexerBlockRange: number;
  catalogPath: string;
  snapshotIntervalMs: number;
  newsDataApiKey: string | null;
  newsApiKey: string | null;
  newsCacheTtlMs: number;
  newsBatchSize: number;
};

function num(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return value != null && value !== '' && Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(): AppConfig {
  const env = process.env;
  const desk = env.DESK_ADDRESS?.trim();
  if (desk && !isAddress(desk)) throw new Error(`DESK_ADDRESS is not an address: ${desk}`);
  const key = env.QUOTE_SIGNER_PRIVATE_KEY?.trim();
  if (key && !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('QUOTE_SIGNER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key');
  }

  return {
    port: num(env.PORT, 3001),
    mongoUri: env.MONGODB_URI ?? 'mongodb://localhost:27017/hyperdrive',
    rpcUrl: env.MONAD_RPC_URL ?? 'https://rpc.monad.xyz',
    chainId: num(env.CHAIN_ID, 143),
    deskAddress: desk ? (desk as Address) : null,
    deskDeployBlock: BigInt(env.DESK_DEPLOY_BLOCK || '0'),
    quoteSignerKey: key ? (key as Hex) : null,
    quoteTtlSeconds: num(env.QUOTE_TTL_SECONDS, 30),
    // Default edge so a signed quote isn't a free option on price moves during its TTL.
    quoteSpreadBps: num(env.QUOTE_SPREAD_BPS, 15),
    // Refuse to sign if the live price jumps more than this vs the last good price.
    priceBandPct: num(env.PRICE_BAND_PCT, 10),
    // Native USDC on Monad mainnet; used by the DEX swap path and swap-receipt parsing.
    usdcAddress: (env.USDC_ADDRESS?.trim() || '0x754704Bc059F8C67012fEd69BC8A327a5aafb603') as Address,
    swapSlippageBps: num(env.SWAP_SLIPPAGE_BPS, 50),
    indexerRewindBlocks: num(env.INDEXER_REWIND_BLOCKS, 10),
    quoteMinUsdc: num(env.QUOTE_MIN_USDC, 1),
    quoteMaxUsdc: num(env.QUOTE_MAX_USDC, 10_000),
    indexerEnabled: (env.INDEXER_ENABLED ?? 'true') !== 'false',
    indexerPollMs: num(env.INDEXER_POLL_MS, 4_000),
    indexerBlockRange: num(env.INDEXER_BLOCK_RANGE, 100),
    catalogPath: env.CATALOG_PATH ?? '../frontend/data/monad-xstocks.json',
    snapshotIntervalMs: num(env.SNAPSHOT_INTERVAL_MS, 15 * 60_000),
    newsDataApiKey: env.NEWS_DATA_API_KEY?.trim() || null,
    newsApiKey: env.NEWS_API_KEY?.trim() || null,
    newsCacheTtlMs: num(env.NEWS_CACHE_TTL_MS, 6 * 60 * 60 * 1000),
    newsBatchSize: num(env.NEWS_BATCH_SIZE, 30),
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
