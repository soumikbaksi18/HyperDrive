import { nasdaqCatalog } from "@/lib/xstocks";

type QuoteResult = {
  quote: number | null;
};

const memory = new Map<string, { quote: number | null; at: number }>();
const FRESH_MS = 60_000;
const MISS_MS = 15_000;

async function readQuote(symbol: string): Promise<QuoteResult> {
  const cached = memory.get(symbol);
  const maxAge = cached?.quote == null ? MISS_MS : FRESH_MS;
  if (cached && Date.now() - cached.at < maxAge) {
    return { quote: cached.quote };
  }

  try {
    const response = await fetch(
      `https://api.xstocks.fi/api/v2/public/assets/${encodeURIComponent(symbol)}/price-data`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Hyperdrive/0.1",
        },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      memory.set(symbol, { quote: null, at: Date.now() });
      return { quote: null };
    }
    const body = (await response.json()) as { quote?: unknown };
    const quote = typeof body.quote === "number" && Number.isFinite(body.quote)
      ? body.quote
      : null;
    memory.set(symbol, { quote, at: Date.now() });
    return { quote };
  } catch {
    memory.set(symbol, { quote: null, at: Date.now() });
    return { quote: null };
  }
}

async function mapLimited<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
  return results;
}

const symbolByUpper = new Map(
  nasdaqCatalog.stocks.map((stock) => [stock.symbol.toUpperCase(), stock.symbol]),
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((symbol) => symbolByUpper.get(symbol.trim().toUpperCase()))
    .filter((symbol): symbol is string => Boolean(symbol))
    .slice(0, 18);

  const rows = await mapLimited(symbols, 6, async (symbol) => ({
    symbol,
    ...(await readQuote(symbol)),
  }));

  const quotes: Record<string, number | null> = {};
  for (const row of rows) quotes[row.symbol] = row.quote;

  return Response.json(
    {
      quotes,
      observedAt: new Date().toISOString(),
      source: "https://api.xstocks.fi/api/v2/public/assets/{symbol}/price-data",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30",
      },
    },
  );
}
