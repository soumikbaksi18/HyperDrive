"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, ExternalLink } from "lucide-react";
import Image from "next/image";
import { formatCatalogDate, formatUsd, shortAddress } from "@/lib/format";
import { cn } from "@/lib/cn";
import { nasdaqCatalog, type NasdaqXStock } from "@/lib/xstocks";

const PAGE_SIZE = 12;

type SessionFilter = "all" | "open" | "halted";

export function MarketsBoard() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<SessionFilter>("all");
  const [page, setPage] = useState(0);
  const [paramSeen, setParamSeen] = useState(initialQuery);
  const [quotes, setQuotes] = useState<Record<string, number | null>>({});
  const knownQuotes = useRef<Record<string, number | null>>({});
  const [pending, setPending] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);

  if (initialQuery !== paramSeen) {
    setParamSeen(initialQuery);
    setQuery(initialQuery);
    setPage(0);
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return nasdaqCatalog.stocks.filter((stock) => {
      if (filter === "halted" && !stock.halted) return false;
      if (filter === "open" && (stock.halted || !stock.openNow)) return false;
      if (!needle) return true;
      return (
        stock.symbol.toLowerCase().includes(needle) ||
        stock.name.toLowerCase().includes(needle) ||
        stock.underlying.toLowerCase().includes(needle)
      );
    });
  }, [filter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const visibleKey = visible.map((stock) => stock.symbol).join(",");

  useEffect(() => {
    const symbols = visibleKey.split(",").filter(Boolean);
    const missing = symbols.filter((symbol) => !(symbol in knownQuotes.current));
    if (missing.length === 0) return;

    const controller = new AbortController();
    let ignore = false;
    setPending(missing.join(","));

    fetch(`/api/quotes?symbols=${encodeURIComponent(missing.join(","))}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Quote request failed");
        return (await response.json()) as { quotes?: Record<string, number | null> };
      })
      .then((body) => {
        if (ignore) return;
        const patch: Record<string, number | null> = {};
        for (const symbol of missing) patch[symbol] = body.quotes?.[symbol] ?? null;
        knownQuotes.current = { ...knownQuotes.current, ...patch };
        setQuotes((current) => ({ ...current, ...patch }));
      })
      .catch((error: unknown) => {
        if (ignore || (error instanceof DOMException && error.name === "AbortError")) return;
        const patch: Record<string, number | null> = {};
        for (const symbol of missing) patch[symbol] = null;
        knownQuotes.current = { ...knownQuotes.current, ...patch };
        setQuotes((current) => ({ ...current, ...patch }));
      })
      .finally(() => {
        if (!ignore) setPending("");
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [visibleKey]);

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(address);
      window.setTimeout(() => setCopied((current) => (current === address ? null : current)), 1400);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-violet-300 uppercase">
            Nasdaq on Monad
          </p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight">xStocks markets</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
            {nasdaqCatalog.count} Nasdaq-listed names with a Monad deployment in
            the xStocks public catalog, read {formatCatalogDate(nasdaqCatalog.fetchedAt)}.
            Quotes are the latest xStocks price-data figure and are not an
            executable offer.
          </p>
        </div>
        <p className="text-sm text-white/45">
          {filtered.length} shown
          {query.trim() ? ` for “${query.trim()}”` : ""}
        </p>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="block w-full md:max-w-md">
          <span className="sr-only">Search stocks</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search ticker, xStock, or company"
            className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm outline-none placeholder:text-white/30 focus:border-violet-300/40"
          />
        </label>
        <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm">
          {(
            [
              ["all", "All"],
              ["open", "Session open"],
              ["halted", "Halted"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setFilter(id);
                setPage(0);
              }}
              className={cn(
                "rounded-full px-3 py-1.5",
                filter === id ? "bg-white text-[#1c1038]" : "text-white/60 hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="app-card rounded-3xl px-6 py-16 text-center text-sm text-white/50">
          No Nasdaq xStock matches that search.
        </div>
      ) : (
        <div className="app-card overflow-hidden rounded-3xl">
          <div className="hidden grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_1fr] gap-3 border-b border-white/10 px-5 py-3 text-[11px] tracking-[0.14em] text-white/40 uppercase md:grid">
            <span>Name</span>
            <span>Nasdaq</span>
            <span>Quote</span>
            <span>Session</span>
            <span>Monad contract</span>
          </div>
          <ul>
            {visible.map((stock) => (
              <StockRow
                key={stock.symbol}
                stock={stock}
                quote={quotes[stock.symbol]}
                loading={pending.split(",").includes(stock.symbol) && !(stock.symbol in quotes)}
                copied={copied === stock.address}
                onCopy={() => copyAddress(stock.address)}
              />
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-white/55">
        <button
          type="button"
          disabled={safePage === 0}
          onClick={() => setPage(Math.max(0, safePage - 1))}
          className="rounded-full border border-white/10 px-4 py-2 disabled:opacity-30"
        >
          Previous
        </button>
        <span>
          Page {safePage + 1} of {pageCount}
        </span>
        <button
          type="button"
          disabled={safePage >= pageCount - 1}
          onClick={() => setPage(safePage + 1)}
          className="rounded-full border border-white/10 px-4 py-2 disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function StockRow({
  stock,
  quote,
  loading,
  copied,
  onCopy,
}: {
  stock: NasdaqXStock;
  quote: number | null | undefined;
  loading: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  const status = stock.halted ? "Halted" : stock.openNow ? "Open" : "Closed";

  return (
    <li className="grid gap-3 border-b border-white/10 px-4 py-4 last:border-b-0 md:grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_1fr] md:items-center md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Image
          src={stock.logo}
          alt=""
          width={40}
          height={40}
          className="size-10 rounded-xl bg-white/10 object-cover"
        />
        <div className="min-w-0">
          <p className="truncate font-medium">{stock.name.replace(/ xStock$/, "")}</p>
          <p className="font-mono text-xs text-violet-200">{stock.symbol}</p>
        </div>
      </div>
      <p className="text-sm text-white/70">{stock.underlying}</p>
      <p className="text-sm font-medium tabular-nums">
        {loading || quote === undefined ? (
          <span className="text-white/35">Loading…</span>
        ) : quote == null ? (
          <span className="text-white/35">Unavailable</span>
        ) : (
          formatUsd(quote)
        )}
      </p>
      <p className="text-sm">
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-1 text-xs",
            stock.halted
              ? "bg-rose-400/15 text-rose-200"
              : stock.openNow
                ? "bg-emerald-300/15 text-emerald-200"
                : "bg-white/8 text-white/55",
          )}
        >
          {status}
        </span>
        {stock.period && (
          <span className="mt-1 block text-[11px] text-white/35 capitalize">
            {stock.period}
          </span>
        )}
      </p>
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono text-white/70">{shortAddress(stock.address)}</span>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-lg p-1.5 text-white/45 hover:bg-white/10 hover:text-white"
          aria-label={`Copy ${stock.symbol} contract`}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
        <a
          href={`https://monadscan.com/token/${stock.address}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg p-1.5 text-white/45 hover:bg-white/10 hover:text-white"
          aria-label={`View ${stock.symbol} on Monadscan`}
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </li>
  );
}
