"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  ArrowUpRight,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  fetchMarketHistory,
  fetchModels,
  fetchTradable,
  requestBaskets,
  type Basket,
  type BasketResult,
  type Horizon,
  type RiskLevel,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatPct, formatUsd, pnlTone } from "@/lib/format";
import { nasdaqCatalog, SECTORS, type Sector } from "@/lib/xstocks";
import { TradeDialog, type TradeTarget } from "@/components/trade/trade-dialog";
import { INDICATORS, TradingViewChart } from "./trading-view-chart";

const catalogBySymbol = new Map(nasdaqCatalog.stocks.map((s) => [s.symbol.toUpperCase(), s]));

/** TradingView symbol for an xStock's underlying. ETFs trade on NYSE Arca; stocks on Nasdaq. */
function tvSymbol(underlying: string, exchangeMic: string) {
  const prefix = exchangeMic === "XNAS" ? "NASDAQ" : exchangeMic === "ARCX" ? "AMEX" : "NYSE";
  return `${prefix}:${underlying}`;
}

const TIMEFRAMES = [
  ["5", "5m"],
  ["60", "1h"],
  ["240", "4h"],
  ["D", "1D"],
  ["W", "1W"],
] as const;

const RISKS: { id: RiskLevel; label: string; copy: string }[] = [
  { id: "conservative", label: "Conservative", copy: "Low-volatility names, capped weights" },
  { id: "moderate", label: "Moderate", copy: "Balanced growth and stability" },
  { id: "aggressive", label: "Aggressive", copy: "Momentum names, larger drawdowns" },
];
const HORIZONS: { id: Horizon; label: string }[] = [
  { id: "swing", label: "1–4 weeks" },
  { id: "position", label: "1–6 months" },
  { id: "long", label: "1 year+" },
];
const BUCKETS = SECTORS.filter((s) => s !== "Other");

type Step = "configure" | "analysis" | "baskets";

export function TradingEngineView() {
  const { address } = useAccount();

  // ------------------------------------------------------------------ markets
  const tradable = useQuery({
    queryKey: ["tradable"],
    queryFn: fetchTradable,
    refetchInterval: (q) => (q.state.data?.complete ? 5 * 60_000 : 15_000),
    retry: false,
  });
  const assets = useMemo(() => {
    const syms = Object.keys(tradable.data?.symbols ?? {});
    const rows = syms.map((sym) => catalogBySymbol.get(sym.toUpperCase())).filter((s): s is NonNullable<typeof s> => Boolean(s));
    // Fixed order the desk cares about first, then anything new the scan finds.
    const order = ["NVDAx", "TSLAx", "QQQx", "SPYx", "EWYx"];
    return rows.sort((a, b) => (order.indexOf(a.symbol) + 1 || 99) - (order.indexOf(b.symbol) + 1 || 99));
  }, [tradable.data?.symbols]);
  const [selectedSym, setSelectedSym] = useState<string | null>(null);
  const selected = assets.find((a) => a.symbol === selectedSym) ?? assets[0] ?? null;
  const [timeframe, setTimeframe] = useState<string>("D");
  const [indicators, setIndicators] = useState<string[]>(["RSI", "MACD"]);
  const [trade, setTrade] = useState<TradeTarget | null>(null);

  const history = useQuery({
    queryKey: ["history", selected?.underlying],
    queryFn: () => fetchMarketHistory(selected!.underlying, "6mo"),
    enabled: Boolean(selected),
    refetchInterval: 60_000,
  });
  const tech = history.data?.technicals ?? null;

  // ------------------------------------------------------------------ AI form
  const models = useQuery({ queryKey: ["llm-models"], queryFn: fetchModels, staleTime: 5 * 60_000 });
  const [step, setStep] = useState<Step>("configure");
  const [amount, setAmount] = useState("1000");
  const [risk, setRisk] = useState<RiskLevel>("moderate");
  const [horizon, setHorizon] = useState<Horizon>("position");
  const [buckets, setBuckets] = useState<Sector[]>(["Tech", "AI"]);
  const [modelId, setModelId] = useState<string | null>(null);
  const [useSentiment, setUseSentiment] = useState(true);
  const [tradableOnly, setTradableOnly] = useState(false);
  const [maxPositions, setMaxPositions] = useState(5);
  const chosenModel = modelId ?? models.data?.default ?? null;

  const run = useMutation({
    mutationFn: requestBaskets,
    onSuccess: () => setStep("baskets"),
  });

  const submit = () => {
    setStep("analysis");
    run.mutate({
      wallet: address,
      amountUsd: Number(amount),
      risk,
      buckets,
      horizon,
      modelId: chosenModel,
      useSentiment,
      tradableOnly,
      maxPositions,
    });
  };

  const amountOk = Number(amount) >= 1;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ---------------------------------------------------------------- header strip */}
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#0c0914]/80 px-4 py-3 backdrop-blur-xl md:px-5">
        <div className="mr-2 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-violet-400/20 text-violet-100">
            <Bot className="size-4" />
          </span>
          <div>
            <h1 className="text-sm font-medium leading-tight">Trading engine</h1>
            <p className="text-[11px] text-white/40">Tradable xStocks on Monad · AI basket suggestions</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {assets.length === 0 && (
            <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/45">
              {tradable.isError ? "Backend offline" : "Scanning Monad liquidity…"}
            </span>
          )}
          {assets.map((a) => (
            <button
              key={a.symbol}
              type="button"
              onClick={() => setSelectedSym(a.symbol)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition",
                selected?.symbol === a.symbol
                  ? "border-violet-300/50 bg-violet-400/15 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/65 hover:text-white",
              )}
            >
              <Image src={a.logo} alt="" width={18} height={18} className="size-[18px] rounded-md bg-white/10" />
              <span className="font-mono">{a.symbol}</span>
            </button>
          ))}
        </div>

        {selected && (
          <div className="ml-auto flex items-center gap-4 text-sm">
            <div className="text-right">
              <p className="text-xl font-semibold tabular-nums">{tech ? formatUsd(tech.last) : "—"}</p>
              <p className={cn("text-xs tabular-nums", tech ? pnlTone(tech.changePct) : "text-white/40")}>
                {tech ? formatPct(tech.changePct) : "…"} <span className="text-white/35">1D</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTrade({ symbol: selected.symbol, name: selected.name.replace(/ xStock$/, ""), logo: selected.logo, address: selected.address })}
              className="h-9 rounded-full bg-gradient-to-r from-[#7c5cff] to-[#a855f7] px-4 text-sm font-medium text-white"
            >
              Trade {selected.symbol}
            </button>
          </div>
        )}
      </header>

      {/* ---------------------------------------------------------------- body */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row">
        {/* chart card */}
        <section className="flex min-h-[520px] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0914]/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-2.5">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono text-violet-200">
                {selected ? tvSymbol(selected.underlying, selected.exchangeMic) : "—"}
              </span>
              {selected && <span className="text-white/40">{selected.name.replace(/ xStock$/, "")}</span>}
              {selected && (
                <span className="rounded-full bg-emerald-300/15 px-2 py-0.5 text-[10px] font-medium text-emerald-200">Tradable on Monad</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-[11px]">
                {TIMEFRAMES.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTimeframe(id)}
                    className={cn("rounded-full px-2.5 py-1", timeframe === id ? "bg-white text-[#1c1038]" : "text-white/55 hover:text-white")}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="hidden items-center gap-1 md:flex">
                {INDICATORS.map((ind) => {
                  const on = indicators.includes(ind);
                  return (
                    <button
                      key={ind}
                      type="button"
                      onClick={() => setIndicators((cur) => (on ? cur.filter((i) => i !== ind) : [...cur, ind]))}
                      className={cn(
                        "rounded-md border px-2 py-1 text-[10px] font-medium tracking-wide",
                        on ? "border-violet-300/50 bg-violet-400/15 text-violet-100" : "border-white/10 text-white/45 hover:text-white",
                      )}
                    >
                      {ind}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 p-3">
            {selected ? (
              <TradingViewChart
                key={`${selected.symbol}-${timeframe}`}
                symbol={tvSymbol(selected.underlying, selected.exchangeMic)}
                interval={timeframe}
                indicators={indicators}
                className="absolute inset-3 overflow-hidden rounded-xl border border-white/10 bg-[#0c0716]"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/40">Waiting for the liquidity scan…</div>
            )}
          </div>
          {tech && (
            <dl className="grid grid-cols-3 gap-x-4 gap-y-2 border-t border-white/[0.07] px-4 py-3 text-xs md:grid-cols-6">
              <Stat label="RSI 14" value={tech.rsi14.toFixed(0)} tone={tech.rsi14 > 70 ? "text-rose-300" : tech.rsi14 < 30 ? "text-emerald-300" : undefined} />
              <Stat label="vs SMA50" value={formatPct(((tech.last - tech.sma50) / tech.sma50) * 100)} tone={pnlTone(tech.last - tech.sma50)} />
              <Stat label="vs SMA200" value={formatPct(((tech.last - tech.sma200) / tech.sma200) * 100)} tone={pnlTone(tech.last - tech.sma200)} />
              <Stat label="MACD hist" value={tech.macd.histogram.toFixed(2)} tone={pnlTone(tech.macd.histogram)} />
              <Stat label="Realised vol" value={`${tech.volatilityPct.toFixed(0)}%`} />
              <Stat label="52w range" value={`${formatUsd(tech.low52w).replace(/\.\d\d$/, "")}–${formatUsd(tech.high52w).replace(/\.\d\d$/, "")}`} />
            </dl>
          )}
        </section>

        {/* right panel: AI form */}
        <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-violet-300/20 bg-gradient-to-b from-[#1a1030]/95 to-[#0c0914]/95 shadow-2xl shadow-black/60 backdrop-blur-xl lg:w-[26rem]">
          <div className="flex items-center justify-between border-b border-violet-300/15 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-violet-200" />
              <h2 className="text-sm font-medium">AI basket builder</h2>
            </div>
            <ol className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-white/35">
              {(["configure", "analysis", "baskets"] as Step[]).map((s, i) => (
                <li key={s} className={cn("flex items-center gap-1", step === s && "text-violet-200")}>
                  <span className={cn("flex size-4 items-center justify-center rounded-full text-[9px]", step === s ? "bg-violet-400/30" : "bg-white/5")}>{i + 1}</span>
                  {i < 2 && <ChevronRight className="size-3 opacity-40" />}
                </li>
              ))}
            </ol>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {step === "configure" && (
              <div className="space-y-4">
                <Field label="Capital (USDC)">
                  <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-3 focus-within:border-violet-300/40">
                    <span className="text-white/40">$</span>
                    <input
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setAmount(e.target.value)}
                      className="h-10 w-full bg-transparent px-2 text-sm tabular-nums outline-none"
                    />
                    <div className="flex gap-1">
                      {[500, 1000, 5000].map((v) => (
                        <button key={v} type="button" onClick={() => setAmount(String(v))} className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/60 hover:text-white">
                          {v >= 1000 ? `${v / 1000}k` : v}
                        </button>
                      ))}
                    </div>
                  </div>
                </Field>

                <Field label="Risk level">
                  <div className="grid grid-cols-3 gap-1.5">
                    {RISKS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRisk(r.id)}
                        className={cn(
                          "rounded-xl border px-2 py-2 text-left transition",
                          risk === r.id ? "border-violet-300/60 bg-violet-400/15" : "border-white/10 bg-white/[0.03] hover:border-white/20",
                        )}
                      >
                        <p className="text-xs font-medium">{r.label}</p>
                        <p className="mt-0.5 text-[10px] leading-snug text-white/40">{r.copy}</p>
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Buckets (sectors)" hint={buckets.length ? `${buckets.length} selected` : "all sectors"}>
                  <div className="flex flex-wrap gap-1.5">
                    {BUCKETS.map((b) => {
                      const on = buckets.includes(b);
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setBuckets((cur) => (on ? cur.filter((x) => x !== b) : [...cur, b]))}
                          className={cn(
                            "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
                            on ? "border-violet-300/60 bg-violet-400/20 text-white" : "border-white/10 text-white/55 hover:text-white",
                          )}
                        >
                          {on && <Check className="size-3" />}
                          {b}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Horizon">
                  <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-1 text-xs">
                    {HORIZONS.map((h) => (
                      <button key={h.id} type="button" onClick={() => setHorizon(h.id)} className={cn("flex-1 rounded-full py-1.5", horizon === h.id ? "bg-white text-[#1c1038]" : "text-white/55")}>
                        {h.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="AI model">
                  <select
                    value={chosenModel ?? ""}
                    onChange={(e) => setModelId(e.target.value || null)}
                    className="h-10 w-full rounded-xl border border-white/10 bg-[#140c24] px-3 text-sm outline-none focus:border-violet-300/40"
                  >
                    {!models.data?.models.some((m) => m.available) && <option value="">Rule-based engine (no API key set)</option>}
                    {models.data?.models.map((m) => (
                      <option key={m.id} value={m.id} disabled={!m.available}>
                        {m.tier === "high" ? "★ " : ""}
                        {m.providerName} · {m.label}
                        {m.available ? "" : " (no key)"}
                      </option>
                    ))}
                  </select>
                  {models.data && !models.data.models.some((m) => m.available) && (
                    <p className="mt-1.5 text-[11px] leading-snug text-amber-200/80">
                      Add OPENAI_API_KEY, ANTHROPIC_API_KEY, DEEPSEEK_API_KEY or NVIDIA_API_KEY to backend/.env.local to enable model reasoning.
                    </p>
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Toggle label="News sentiment" on={useSentiment} onChange={setUseSentiment} />
                  <Toggle label="Tradable on Monad only" on={tradableOnly} onChange={setTradableOnly} />
                </div>

                <Field label={`Max names per basket · ${maxPositions}`}>
                  <input type="range" min={2} max={8} value={maxPositions} onChange={(e) => setMaxPositions(Number(e.target.value))} className="w-full accent-violet-400" />
                </Field>

                <button
                  type="button"
                  disabled={!amountOk}
                  onClick={submit}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#a855f7] text-sm font-medium text-white disabled:opacity-40"
                >
                  Run analysis <ChevronRight className="size-4" />
                </button>
                <p className="text-center text-[11px] leading-relaxed text-white/35">
                  The sector agents score each name on technicals and news; the model then proposes three baskets. Suggestions only, nothing is executed.
                </p>
              </div>
            )}

            {step === "analysis" && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                {run.isPending ? (
                  <>
                    <Loader2 className="size-8 animate-spin text-violet-200" />
                    <div>
                      <p className="text-sm font-medium">Agents are scoring the universe…</p>
                      <p className="mt-1 text-xs text-white/45">Pulling candles, computing RSI/MACD/volatility, reading the news feed, then asking {chosenModel?.split("/")[0] ?? "the rule engine"} for baskets.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-amber-200">{(run.error as Error)?.message ?? "Analysis failed."}</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setStep("configure")} className="rounded-xl border border-white/10 px-4 py-2 text-sm">Back</button>
                      <button type="button" onClick={submit} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-[#1c1038]">Retry</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === "baskets" && run.data && (
              <BasketResults
                result={run.data}
                onBack={() => setStep("configure")}
                onTrade={(h) => {
                  const stock = catalogBySymbol.get(h.symbol.toUpperCase());
                  if (stock) setTrade({ symbol: stock.symbol, name: h.name, logo: stock.logo, address: stock.address });
                }}
              />
            )}
          </div>
        </aside>
      </div>

      {trade && <TradeDialog target={trade} tradable={trade.symbol in (tradable.data?.symbols ?? {}) ? true : tradable.data?.complete ? false : null} onClose={() => setTrade(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function BasketResults({ result, onBack, onTrade }: { result: BasketResult; onBack: () => void; onTrade: (h: Basket["holdings"][number]) => void }) {
  const [open, setOpen] = useState<string>(result.baskets[0]?.id ?? "");
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white">
          <ChevronLeft className="size-3.5" /> Configure
        </button>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px]", result.status === "ok" ? "bg-violet-400/20 text-violet-100" : "bg-amber-200/15 text-amber-100")}>
          {result.status === "ok" ? result.modelId : "rule-based fallback"} · {(result.durationMs / 1000).toFixed(1)}s
        </span>
      </div>

      <div className="rounded-xl border border-violet-300/20 bg-violet-400/[0.07] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-200/70">Plan</p>
        <p className="mt-1 text-sm leading-relaxed text-white/85">{result.summary}</p>
        <p className="mt-2 text-xs leading-relaxed text-white/50">{result.marketRegime}</p>
      </div>

      <div className="space-y-2">
        {result.baskets.map((b, i) => {
          const expanded = open === b.id;
          return (
            <article
              key={b.id}
              className={cn(
                "overflow-hidden rounded-2xl",
                i === 0 ? "bg-gradient-to-br from-[#d8ccff] via-[#9b87f5] to-[#6842d6] text-[#1c1038]" : "border border-white/10 bg-white/[0.03]",
              )}
            >
              <button type="button" onClick={() => setOpen(expanded ? "" : b.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                <div>
                  <p className={cn("text-[10px] uppercase tracking-widest", i === 0 ? "text-[#2a1458]/70" : "text-white/40")}>
                    {b.risk} · {b.allocationPct.toFixed(0)}% · vol {b.expectedVolatilityPct.toFixed(0)}%
                  </p>
                  <h3 className="font-serif text-2xl italic">{b.name}</h3>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold tabular-nums">{formatUsd(b.amountUsd)}</p>
                  <p className={cn("text-[10px]", i === 0 ? "text-[#2a1458]/70" : "text-white/40")}>{b.holdings.length} names</p>
                </div>
              </button>
              {expanded && (
                <div className={cn("space-y-2 px-4 pb-4", i === 0 ? "" : "border-t border-white/10 pt-3")}>
                  <p className={cn("text-xs leading-relaxed", i === 0 ? "text-[#241447]/80" : "text-white/55")}>{b.thesis}</p>
                  <ul className="space-y-1.5">
                    {b.holdings.map((h) => {
                      const stock = catalogBySymbol.get(h.symbol.toUpperCase());
                      return (
                        <li key={h.symbol} className={cn("rounded-xl p-2.5", i === 0 ? "bg-white/35" : "bg-white/[0.04]")}>
                          <div className="flex items-center gap-2">
                            {stock && <Image src={stock.logo} alt="" width={28} height={28} className="size-7 rounded-lg bg-white/20" />}
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1.5 text-sm font-medium">
                                <span className="truncate">{h.name}</span>
                                <span className={cn("font-mono text-[10px]", i === 0 ? "text-[#2a1458]/70" : "text-violet-200")}>{h.symbol}</span>
                              </p>
                              <p className={cn("text-[10px]", i === 0 ? "text-[#2a1458]/70" : "text-white/40")}>
                                {h.sector} · score {h.score} · {h.recommendation.replace("_", " ").toLowerCase()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold tabular-nums">{h.weight.toFixed(0)}%</p>
                              <p className={cn("text-[10px] tabular-nums", i === 0 ? "text-[#2a1458]/70" : "text-white/40")}>{formatUsd(h.amountUsd)}</p>
                            </div>
                          </div>
                          <p className={cn("mt-1.5 text-[11px] leading-snug", i === 0 ? "text-[#241447]/80" : "text-white/55")}>{h.reason}</p>
                          <div className="mt-1.5 flex items-center justify-between">
                            {h.tradable ? (
                              <span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium", i === 0 ? "bg-emerald-700/20 text-emerald-900" : "bg-emerald-300/15 text-emerald-200")}>Tradable on Monad</span>
                            ) : (
                              <span className={cn("text-[10px]", i === 0 ? "text-[#2a1458]/60" : "text-white/35")}>No Monad liquidity yet</span>
                            )}
                            {h.tradable && (
                              <button type="button" onClick={() => onTrade(h)} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium", i === 0 ? "bg-[#1c1038] text-white" : "bg-white text-[#1c1038]")}>
                                Buy {formatUsd(h.amountUsd)} <ArrowUpRight className="size-3" />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {result.risks.length > 0 && (
        <div className="rounded-xl border border-amber-200/15 bg-amber-200/[0.05] p-3 text-[11px] leading-relaxed text-amber-100/80">
          <p className="mb-1 font-medium text-amber-100">Risks the model flagged</p>
          <ul className="list-disc space-y-0.5 pl-4">{result.risks.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}

      <details className="text-xs text-white/50">
        <summary className="cursor-pointer select-none">Agent scores for the universe ({result.universe.length})</summary>
        <ul className="mt-2 max-h-56 space-y-1 overflow-auto">
          {result.universe.map((u) => (
            <li key={u.symbol} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2 py-1">
              <span className="font-mono text-violet-200">{u.symbol}</span>
              <span className="truncate text-white/45">{u.sector}</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                {u.changePct != null && (u.changePct >= 0 ? <TrendingUp className="size-3 text-emerald-300" /> : <TrendingDown className="size-3 text-rose-300" />)}
                {u.score}
                {u.tradable && <Star className="size-3 text-emerald-300" />}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <p className="text-center text-[11px] text-white/35">
        Not financial advice. Names without Monad liquidity can be bought on an exchange; see <Link href="/markets" className="underline">Markets</Link>.
      </p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-white/40">
        {label}
        {hint && <span className="normal-case tracking-normal text-white/35">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn("flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs", on ? "border-violet-300/50 bg-violet-400/10" : "border-white/10 bg-white/[0.03]")}
    >
      <span>{label}</span>
      <span className={cn("relative h-4 w-7 rounded-full transition", on ? "bg-violet-400" : "bg-white/15")}>
        <span className={cn("absolute top-0.5 size-3 rounded-full bg-white transition", on ? "left-3.5" : "left-0.5")} />
      </span>
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-white/35">{label}</dt>
      <dd className={cn("mt-0.5 tabular-nums", tone)}>{value}</dd>
    </div>
  );
}
