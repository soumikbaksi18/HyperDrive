"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchNewsFeed,
  fetchNewsSummary,
  type NewsArticle,
  type NewsSentiment,
  type NewsSummaryResponse,
} from "@/lib/api";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/cn";
import type { GlobeArc } from "@/components/ui/globe-world";
import { Globe, Loader2, Minus, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";

const World = dynamic(() => import("@/components/ui/globe-world").then((m) => m.World), {
  ssr: false,
});

const PRIORITY_LEVELS = ["Critical", "High", "Low"] as const;
type Priority = (typeof PRIORITY_LEVELS)[number];

const TICKER_SYMBOLS = ["NVDAx", "AAPLx", "TSLAx", "MSFTx", "AMZNx", "GOOGLx", "METAx"];

const ARC_COLORS = ["#a78bfa", "#c4b5fd", "#8b5cf6", "#7c3aed", "#ddd6fe"];

const MARKET_ARCS: GlobeArc[] = [
  { order: 1, startLat: 40.7, startLng: -74.0, endLat: 51.5, endLng: -0.1, arcAlt: 0.32, color: ARC_COLORS[1] },
  { order: 2, startLat: 51.5, startLng: -0.1, endLat: 35.7, endLng: 139.7, arcAlt: 0.36, color: ARC_COLORS[2] },
  { order: 3, startLat: 37.8, startLng: -122.4, endLat: 38.9, endLng: -77.0, arcAlt: 0.3, color: ARC_COLORS[0] },
  { order: 4, startLat: 22.3, startLng: 114.2, endLat: 1.3, endLng: 103.8, arcAlt: 0.38, color: ARC_COLORS[3] },
  { order: 5, startLat: 48.8, startLng: 2.3, endLat: 40.4, endLng: -3.7, arcAlt: 0.28, color: ARC_COLORS[4] },
  { order: 6, startLat: 35.7, startLng: 139.7, endLat: -33.9, endLng: 151.2, arcAlt: 0.4, color: ARC_COLORS[1] },
];

type FeedItem = NewsArticle & {
  entities: string[];
  sourceHandle: string;
  repLevel: "HIGH REP" | "LOW REP";
  priority: Priority;
};

function priorityFromImpact(impact: number): Priority {
  if (impact >= 8) return "Critical";
  if (impact >= 6) return "High";
  return "Low";
}

function mapArticle(article: NewsArticle): FeedItem {
  const entities = [...article.tickers, ...article.xSymbols];
  const handle = `@${article.source.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24)}`;
  const priority = priorityFromImpact(article.impact);
  return {
    ...article,
    entities,
    sourceHandle: handle,
    repLevel: article.impact >= 6.5 ? "HIGH REP" : "LOW REP",
    priority,
  };
}

function SourceAvatar({ source }: { source: string }) {
  return (
    <div
      className="relative flex size-10 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg bg-violet-950/80 ring-1 ring-violet-300/25"
      title={source}
    >
      <LogoMark className="size-7" />
    </div>
  );
}

function SentimentIcon({ sentiment }: { sentiment: NewsSentiment }) {
  if (sentiment === "up") return <TrendingUp className="size-4 text-emerald-400" aria-label="Positive" />;
  if (sentiment === "down") return <TrendingDown className="size-4 text-rose-400" aria-label="Negative" />;
  return <Minus className="size-4 text-violet-300/60" aria-label="Neutral" />;
}

function HighlightedHeadline({ headline, entities }: { headline: string; entities: string[] }) {
  if (!entities.length) return <span>{headline}</span>;
  const pattern = entities.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const parts = headline.split(new RegExp(`(${pattern})`, "gi"));
  return (
    <span>
      {parts.map((part, i) =>
        entities.some((e) => e.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="rounded bg-violet-400/35 px-0.5 font-medium text-violet-100">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </span>
  );
}

function SentimentInsightsPanel({ summary }: { summary: NewsSummaryResponse | null }) {
  if (!summary) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-violet-200/50">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading sentiment…
      </div>
    );
  }
  const total = summary.bullish + summary.bearish + summary.neutral || 1;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Bullish", value: summary.bullish, pct: Math.round((summary.bullish / total) * 100), tone: "emerald" },
          { label: "Neutral", value: summary.neutral, pct: Math.round((summary.neutral / total) * 100), tone: "violet" },
          { label: "Bearish", value: summary.bearish, pct: Math.round((summary.bearish / total) * 100), tone: "rose" },
        ].map((row) => (
          <div
            key={row.label}
            className={cn(
              "rounded-xl border p-3 text-center",
              row.tone === "emerald" && "border-emerald-400/25 bg-emerald-400/5",
              row.tone === "violet" && "border-violet-400/25 bg-violet-400/5",
              row.tone === "rose" && "border-rose-400/25 bg-rose-400/5",
            )}
          >
            <p className="text-xl font-semibold tabular-nums text-white">{row.value}</p>
            <p className="text-[10px] text-white/45">
              {row.label} · {row.pct}%
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-white/45">
        Avg impact {summary.avgImpact.toFixed(1)} · {summary.total} headlines in window
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/80">Top bullish</p>
          <ul className="mt-2 space-y-1.5 text-xs text-white/65">
            {summary.topBullish.map((a) => (
              <li key={a.id}>{a.headline}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-200/80">Top bearish</p>
          <ul className="mt-2 space-y-1.5 text-xs text-white/65">
            {summary.topBearish.map((a) => (
              <li key={a.id}>{a.headline}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function MarketTicker() {
  const [quotes, setQuotes] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let ignore = false;
    fetch(`/api/quotes?symbols=${encodeURIComponent(TICKER_SYMBOLS.join(","))}`)
      .then((r) => r.json())
      .then((body: { quotes?: Record<string, number | null> }) => {
        if (!ignore) setQuotes(body.quotes ?? {});
      })
      .catch(() => null);
    return () => {
      ignore = true;
    };
  }, []);

  const items = TICKER_SYMBOLS.map((symbol) => ({
    symbol,
    price: quotes[symbol],
  }));

  return (
    <div className="flex shrink-0 items-center gap-6 overflow-hidden border-t border-violet-200/10 bg-[#0c0914]/95 px-4 py-2 text-[11px]">
      <span className="inline-flex shrink-0 items-center gap-1.5 font-medium text-emerald-300">
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
        ONLINE
      </span>
      <div className="ticker-track flex w-max gap-8 pr-8 text-white/55">
        {[...items, ...items].map((item, i) => (
          <span key={`${item.symbol}-${i}`} className="inline-flex shrink-0 items-center gap-2 tabular-nums">
            <span className="font-mono text-violet-100/90">{item.symbol.replace(/x$/i, "")}</span>
            <span>{item.price != null ? `$${item.price.toFixed(2)}` : "—"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function InsightsView() {
  const [activeTab, setActiveTab] = useState<"feed" | "whale" | "insights">("feed");

  const [news, setNews] = useState<FeedItem[]>([]);
  const [summary, setSummary] = useState<NewsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const globalTension = useMemo(() => {
    if (!summary || summary.total === 0) return "1.00";
    const skew = (summary.bullish - summary.bearish) / summary.total;
    return (1.2 + skew * 0.35).toFixed(2);
  }, [summary]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [feed, sum] = await Promise.all([
        fetchNewsFeed({ time_filter: "All", page_size: 100 }),
        fetchNewsSummary("All"),
      ]);
      setNews((feed.articles ?? []).map(mapArticle));
      setSummary(sum);
      setNotice(feed.notice ?? null);
    } catch (err) {
      setNotice(null);
      setError(err instanceof Error ? err.message : "Failed to load headlines");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tabClass = (active: boolean) =>
    cn(
      "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition",
      active
        ? "bg-violet-400/25 text-violet-100 shadow-[inset_0_0_0_1px_rgba(196,181,253,0.35)]"
        : "text-white/45 hover:bg-white/5 hover:text-white/80",
    );

  return (
    <div className="flex min-h-[calc(100dvh-5.75rem)] flex-col bg-[#09070f]">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Globe — ~60% */}
        <div className="relative hidden min-h-[320px] flex-1 flex-col border-b border-violet-200/10 lg:flex lg:max-w-[60%] lg:border-r lg:border-b-0">
          <div className="flex flex-1 flex-col items-center justify-center p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-100">
                <span className="size-1.5 animate-pulse rounded-full bg-violet-300" />
                Global sentiment {globalTension}
              </span>
              <TrendingUp className="size-3.5 text-violet-300" />
            </div>
            <div className="relative flex h-[min(70vh,720px)] w-full flex-1 items-center justify-center">
              <World data={MARKET_ARCS} />
            </div>
          </div>
        </div>

        {/* Feed panel — ~40% */}
        <div className="flex h-[calc(100dvh-5.75rem-2.5rem)] max-h-[100dvh] min-h-[420px] min-w-0 flex-1 flex-col border-violet-200/10 bg-[#0c0914]/80 lg:max-w-[40%]">
          <div className="shrink-0 border-b border-violet-200/10 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">Active signals</span>
              <span className="text-[11px] uppercase tracking-wider text-white/40">
                {loading ? "Updating…" : "Live from Hyperdrive API"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-violet-200/15 bg-black/30 p-1">
                <button type="button" className={tabClass(activeTab === "feed")} onClick={() => setActiveTab("feed")}>
                  Feed
                </button>
                <button type="button" className={tabClass(activeTab === "whale")} onClick={() => setActiveTab("whale")}>
                  Flow tracker
                </button>
                <button type="button" className={tabClass(activeTab === "insights")} onClick={() => setActiveTab("insights")}>
                  Insights
                  {summary ? (
                    <span className="ml-1.5 font-semibold text-fuchsia-300">({summary.total})</span>
                  ) : null}
                </button>
              </div>
            </div>
            {!loading && news.length > 0 && (
              <p className="mt-2 text-[11px] text-white/40">{news.length} headlines in feed</p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#0a0812] p-4">
            {activeTab === "feed" && (
              <>
                {notice && news.length > 0 && (
                  <p className="mb-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-100/90">
                    {notice}
                  </p>
                )}
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-white/45">
                    <Loader2 className="size-5 animate-spin text-violet-300" />
                    <span className="text-sm">Loading signals…</span>
                  </div>
                ) : error ? (
                  <p className="py-12 text-center text-sm text-rose-300">{error}</p>
                ) : news.length === 0 ? (
                  <p className="py-12 text-center text-sm text-white/45">
                    {notice ?? "No headlines cached yet. The backend refreshes on a timer."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {news.map((item) => (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-xl border border-violet-200/10 bg-white/[0.03] transition hover:border-violet-200/25 hover:bg-white/[0.05]"
                      >
                        <div className="flex gap-3 p-3.5">
                          <SourceAvatar source={item.source} />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/45">
                              <span className="text-xs font-semibold text-white">{item.source}</span>
                              <span>{item.sourceHandle}</span>
                              <span className="text-[9px] font-semibold uppercase tracking-wide text-fuchsia-300/90">
                                {item.repLevel}
                              </span>
                              <span>·</span>
                              <span className="tabular-nums">{item.time}</span>
                              <SentimentIcon sentiment={item.sentiment} />
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-violet-200">
                                NEWS
                              </span>
                              <span
                                className={cn(
                                  "rounded-md px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                                  item.priority === "Critical" && "bg-rose-500/20 text-rose-200",
                                  item.priority === "High" && "bg-fuchsia-500/20 text-fuchsia-100",
                                  item.priority === "Low" && "bg-white/10 text-white/45",
                                )}
                              >
                                {item.priority}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-violet-400/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-violet-200">
                                <Globe className="size-3" />
                                {item.category}
                              </span>
                            </div>
                            <p className="text-xs font-semibold leading-snug text-white">
                              <HighlightedHeadline headline={item.headline} entities={item.entities} />
                            </p>
                            {item.url.startsWith("http") && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-200 hover:text-violet-100"
                              >
                                Read article →
                              </a>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
            {activeTab === "whale" && (
              <p className="py-12 text-center text-sm text-white/45">
                Large-wallet flow tracking is not enabled yet. Use the feed for headline sentiment.
              </p>
            )}
            {activeTab === "insights" && <SentimentInsightsPanel summary={summary} />}
          </div>

          <div className="shrink-0 border-t border-violet-200/10 p-4">
            <button
              type="button"
              onClick={() => void load()}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-violet-200/20 bg-violet-500/10 text-sm font-medium text-violet-100 hover:bg-violet-500/20"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              Refresh headlines
            </button>
          </div>
        </div>
      </div>

      <MarketTicker />
    </div>
  );
}
