"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bot,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  fetchNewsFeed,
  fetchNewsSummary,
  fetchTradable,
  type NewsArticle,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { isCatalogSymbol, nasdaqCatalog } from "@/lib/xstocks";

const catalogBySymbol = new Map(
  nasdaqCatalog.stocks.map((stock) => [stock.symbol.toUpperCase(), stock]),
);

const MAG7 = ["AAPLx", "MSFTx", "GOOGLx", "AMZNx", "NVDAx", "METAx", "TSLAx"];

const BASKETS = [
  {
    id: "steady",
    name: "Steady Explorer",
    tone: "Lower-volatility Nasdaq mix",
    gradient: "from-[#d8ccff] via-[#9b87f5] to-[#6842d6] text-[#1c1038]",
    muted: "text-[#2a1458]/70",
    pick: (scores: Map<string, number>, tradable: Set<string>) =>
      pickBasket(scores, tradable, MAG7, 5, (s) => Math.max(s, 0)),
  },
  {
    id: "balanced",
    name: "Balanced Growth",
    tone: "The middle basket most people compare first",
    gradient: "app-card",
    muted: "text-white/45",
    pick: (scores: Map<string, number>, tradable: Set<string>) =>
      pickBasket(scores, tradable, [...scores.keys()], 6, (s) => s),
  },
  {
    id: "growth",
    name: "High-Growth Explorer",
    tone: "Sharper names when impact and sentiment align",
    gradient: "app-card",
    muted: "text-white/45",
    pick: (scores: Map<string, number>, tradable: Set<string>) =>
      pickBasket(scores, tradable, [...scores.keys()], 5, (s) => s, 4),
  },
] as const;

function scoreSymbols(articles: NewsArticle[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const article of articles) {
    const sentiment =
      article.sentiment === "up" ? 1 : article.sentiment === "down" ? -0.85 : 0.15;
    const bump = sentiment * article.impact;
    for (const sym of article.xSymbols) {
      scores.set(sym, (scores.get(sym) ?? 0) + bump);
    }
    for (const ticker of article.tickers) {
      const sym = ticker.endsWith("x") ? ticker : `${ticker}x`;
      if (isCatalogSymbol(sym)) {
        scores.set(sym, (scores.get(sym) ?? 0) + bump * 0.85);
      }
    }
  }
  return scores;
}

function pickBasket(
  scores: Map<string, number>,
  tradable: Set<string>,
  universe: string[],
  count: number,
  transform: (s: number) => number,
  minScore = -Infinity,
) {
  const ranked = universe
    .filter((sym) => isCatalogSymbol(sym))
    .map((sym) => ({ sym, raw: scores.get(sym) ?? 0, score: transform(scores.get(sym) ?? 0) }))
    .filter((row) => row.raw >= minScore)
    .sort((a, b) => b.score - a.score);

  const chosen = ranked.slice(0, count);
  if (chosen.length === 0) return [];

  const total = chosen.reduce((sum, row) => sum + Math.max(row.score, 0.01), 0);
  return chosen.map((row) => ({
    symbol: row.sym,
    name: catalogBySymbol.get(row.sym.toUpperCase())?.name ?? row.sym,
    weight: Math.round((Math.max(row.score, 0.01) / total) * 1000) / 10,
    tradable: tradable.has(row.sym),
    score: row.raw,
  }));
}

function normalizeWeights(
  rows: { symbol: string; name: string; weight: number; tradable: boolean; score: number }[],
) {
  if (rows.length === 0) return rows;
  const sum = rows.reduce((a, r) => a + r.weight, 0);
  if (Math.abs(sum - 100) < 0.2) return rows;
  const scale = 100 / sum;
  return rows.map((r) => ({ ...r, weight: Math.round(r.weight * scale * 10) / 10 }));
}

export function TradingEngineView() {
  const summary = useQuery({
    queryKey: ["news-summary", "engine"],
    queryFn: () => fetchNewsSummary("All"),
    staleTime: 120_000,
  });
  const feed = useQuery({
    queryKey: ["news-feed", "engine"],
    queryFn: () => fetchNewsFeed({ time_filter: "All", page_size: 100 }),
    staleTime: 120_000,
  });
  const tradableQuery = useQuery({
    queryKey: ["tradable"],
    queryFn: fetchTradable,
    refetchInterval: (q) => (q.state.data?.complete ? 5 * 60_000 : 15_000),
    retry: false,
  });

  const loading = summary.isLoading || feed.isLoading;
  const error = summary.error ?? feed.error;

  const scores = useMemo(
    () => scoreSymbols(feed.data?.articles ?? []),
    [feed.data?.articles],
  );

  const tradableSet = useMemo(() => {
    const syms = tradableQuery.data?.symbols ?? {};
    return new Set(Object.keys(syms));
  }, [tradableQuery.data?.symbols]);

  const baskets = useMemo(
    () =>
      BASKETS.map((b) => ({
        ...b,
        holdings: normalizeWeights(b.pick(scores, tradableSet)),
      })),
    [scores, tradableSet],
  );

  const signalCount = scores.size;
  const syncedAt = summary.data?.syncedAt ?? feed.data?.syncedAt;

  const refresh = () => {
    void summary.refetch();
    void feed.refetch();
    void tradableQuery.refetch();
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-sm text-violet-200/70">
            <Bot className="size-4" aria-hidden />
            Agent desk
          </p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight md:text-4xl">Trading engine</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
            Reads the cached headline feed, scores Nasdaq xStocks by sentiment and impact, and
            drafts three basket weights. Nothing executes until you approve trades on Markets.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 text-sm text-white/80 hover:bg-white/[0.08] disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh run
        </button>
      </header>

      <section className="grid gap-4 lg:grid-cols-4">
        <PipelineCard
          label="Headlines ingested"
          value={loading ? "…" : String(summary.data?.total ?? feed.data?.total ?? 0)}
          detail={feed.data?.source ? `Source · ${feed.data.source}` : "News cache"}
        />
        <PipelineCard
          label="Symbols scored"
          value={loading ? "…" : String(signalCount)}
          detail={`${summary.data?.bullish ?? 0} up · ${summary.data?.bearish ?? 0} down`}
        />
        <PipelineCard
          label="Avg impact"
          value={loading ? "…" : summary.data ? summary.data.avgImpact.toFixed(1) : "—"}
          detail="Across cached articles"
        />
        <PipelineCard
          label="DEX tradable"
          value={
            tradableQuery.isLoading
              ? "…"
              : tradableQuery.data
                ? `${Object.keys(tradableQuery.data.symbols).length}/${tradableQuery.data.total || "—"}`
                : "—"
          }
          detail={
            tradableQuery.data?.complete
              ? "USDC routes on Monad"
              : "Liquidity scan in progress"
          }
        />
      </section>

      {error && (
        <div className="app-card rounded-2xl border border-amber-400/30 px-5 py-4 text-sm text-amber-100">
          Couldn&apos;t load engine inputs: {(error as Error).message}. Start the backend on port 3001.
        </div>
      )}

      <section className="app-card rounded-3xl p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold tracking-[0.16em] text-white/45 uppercase">
              Pipeline
            </h2>
            <p className="mt-1 text-sm text-white/55">
              {syncedAt
                ? `Last news sync ${new Date(syncedAt).toLocaleString()}`
                : "Waiting for first news sync"}
            </p>
          </div>
          <Link
            href="/insights"
            className="inline-flex items-center gap-1 text-xs text-violet-200 hover:text-white"
          >
            Open insights feed <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        <ol className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            { step: "1", title: "Ingest", body: "Mongo news cache + provider refresh" },
            { step: "2", title: "Sentiment", body: "Per-headline up / down / neutral tags" },
            { step: "3", title: "Score", body: "Map tickers → xStock symbols" },
            { step: "4", title: "Propose", body: "Three basket weight drafts below" },
          ].map((item) => (
            <li
              key={item.step}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <span className="text-[10px] font-semibold tracking-[0.14em] text-violet-300/80">
                STEP {item.step}
              </span>
              <p className="mt-1 text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/45">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Proposed baskets</h2>
            <p className="text-sm text-white/45">
              Weights from the latest headline run. Approve allocation manually on Markets.
            </p>
          </div>
          <Link
            href="/markets"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-gradient-to-r from-[#7c5cff] to-[#a855f7] px-4 text-sm font-medium text-white"
          >
            Trade on markets
            <ArrowUpRight className="size-4" />
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {baskets.map((basket, index) => (
            <article
              key={basket.id}
              className={cn(
                "rounded-3xl p-5",
                index === 0 ? `bg-gradient-to-br ${basket.gradient}` : basket.gradient,
              )}
            >
              <p className={cn("text-xs", basket.muted)}>Basket {index + 1}</p>
              <h3 className="mt-2 text-xl font-medium">{basket.name}</h3>
              <p className={cn("mt-1 text-sm", index === 0 ? "text-[#2a1458]/75" : "text-white/50")}>
                {basket.tone}
              </p>

              {loading ? (
                <p className={cn("mt-6 text-sm", index === 0 ? "text-[#2a1458]/70" : "text-white/45")}>
                  Running scores…
                </p>
              ) : basket.holdings.length === 0 ? (
                <p className={cn("mt-6 text-sm", index === 0 ? "text-[#2a1458]/70" : "text-white/45")}>
                  No xStock symbols in the headline set yet. Check Insights for fresh tickers.
                </p>
              ) : (
                <ul className="mt-5 space-y-2">
                  {basket.holdings.map((row) => (
                    <li
                      key={row.symbol}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm",
                        index === 0 ? "bg-[#2a1458]/10" : "bg-white/[0.04]",
                      )}
                    >
                      <span className="min-w-0 truncate font-medium">{row.symbol}</span>
                      <span
                        className={cn(
                          "shrink-0 tabular-nums",
                          index === 0 ? "text-[#2a1458]/80" : "text-white/55",
                        )}
                      >
                        {row.weight}%
                      </span>
                      {!row.tradable && (
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[10px]",
                            index === 0 ? "bg-[#2a1458]/15 text-[#2a1458]" : "bg-white/10 text-white/45",
                          )}
                        >
                          no pool
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>

      {(summary.data?.topBullish?.length ?? 0) > 0 && (
        <section className="app-card rounded-3xl p-5 md:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-300" aria-hidden />
            <h2 className="text-sm font-medium">Top bullish signals</h2>
          </div>
          <ul className="mt-4 divide-y divide-white/10">
            {summary.data!.topBullish.slice(0, 5).map((article) => (
              <li key={article.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="text-sm leading-snug text-white/90">{article.headline}</p>
                  <p className="mt-1 text-xs text-white/40">
                    {[...article.xSymbols, ...article.tickers].slice(0, 4).join(" · ") || article.category}
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-emerald-300/90">
                  impact {article.impact.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PipelineCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="app-card rounded-2xl px-4 py-4">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-white/40 uppercase">{label}</p>
      <p className="mt-2 text-2xl font-medium tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-white/45">{detail}</p>
    </article>
  );
}
