"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { RefreshCw } from "lucide-react";
import { TradeDialog, type TradeTarget } from "@/components/trade/trade-dialog";
import type { TradeSide } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatPct, formatSignedUsd, formatUsd, pnlTone } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import { usePortfolio, useTrades, useValueHistory } from "@/lib/use-portfolio";
import { PositionsTable } from "./positions-table";
import { TradeHistory } from "./trade-history";
import { ValueChart } from "./value-chart";

type Filter = "active" | "closed" | "all";
const RANGES = [7, 30, 90] as const;

export function PortfolioView() {
  const account = useAccount();
  const isConnected = useHydrated() && account.isConnected;
  const portfolio = usePortfolio();
  const trades = useTrades(200);
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const history = useValueHistory(days);
  const [filter, setFilter] = useState<Filter>("active");
  const [trade, setTrade] = useState<{ target: TradeTarget; side: TradeSide } | null>(null);

  if (!isConnected) {
    return (
      <Shell>
        <div className="app-card rounded-3xl px-6 py-16 text-center">
          <p className="text-lg font-medium">Connect MetaMask to see your portfolio</p>
          <p className="mt-2 text-sm text-white/50">Positions and PnL are tracked per wallet from on-chain desk trades.</p>
        </div>
      </Shell>
    );
  }

  if (portfolio.isError) {
    return (
      <Shell>
        <div className="app-card rounded-3xl px-6 py-12 text-center text-sm text-amber-200">
          Couldn&apos;t load the portfolio: {(portfolio.error as Error).message}. Is the backend running?
        </div>
      </Shell>
    );
  }

  const data = portfolio.data;
  const s = data?.summary;
  const positions = (data?.positions ?? []).filter((p) => filter === "all" || p.status === filter);

  return (
    <Shell
      action={
        <button
          type="button"
          onClick={() => { void portfolio.refetch(); void trades.refetch(); void history.refetch(); }}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-sm text-white/70 hover:bg-white/5"
        >
          <RefreshCw className={cn("size-3.5", portfolio.isFetching && "animate-spin")} />
          {data ? `Priced ${formatDateTime(data.pricedAt)}` : "Loading…"}
        </button>
      }
    >
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Market value" value={s ? formatUsd(s.marketValue) : "…"} detail={s ? `${s.activePositions} active position${s.activePositions === 1 ? "" : "s"}` : ""} />
        <Stat
          label="Total PnL"
          value={s ? formatSignedUsd(s.totalPnl) : "…"}
          detail={s ? `${formatPct(s.totalPnlPct)} on ${formatUsd(s.totalBought)} bought` : ""}
          tone={s && pnlTone(s.totalPnl)}
        />
        <Stat
          label="Unrealized PnL"
          value={s ? formatSignedUsd(s.unrealizedPnl) : "…"}
          detail={s ? `${formatPct(s.unrealizedPnlPct)} on ${formatUsd(s.costBasis)} cost` : ""}
          tone={s && pnlTone(s.unrealizedPnl)}
        />
        <Stat
          label="Realized PnL"
          value={s ? formatSignedUsd(s.realizedPnl) : "…"}
          detail={s ? `${formatUsd(s.totalSold)} sold · ${formatUsd(s.fees)} fees` : ""}
          tone={s && pnlTone(s.realizedPnl)}
        />
      </section>

      <section className="app-card rounded-3xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Value over time</h2>
            <p className="text-xs text-white/40">Net invested = USDC bought minus USDC received from sells</p>
          </div>
          <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-1 text-xs">
            {RANGES.map((d) => (
              <button key={d} type="button" onClick={() => setDays(d)} className={cn("rounded-full px-3 py-1", days === d ? "bg-white text-[#1c1038]" : "text-white/60")}>
                {d}D
              </button>
            ))}
          </div>
        </div>
        <ValueChart points={history.data ?? []} />
      </section>

      <section className="app-card overflow-hidden rounded-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-medium">Holdings</h2>
          <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-1 text-xs">
            {(
              [
                ["active", `Active ${s ? `(${s.activePositions})` : ""}`],
                ["closed", `Closed ${s ? `(${s.closedPositions})` : ""}`],
                ["all", "All"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setFilter(id)} className={cn("rounded-full px-3 py-1", filter === id ? "bg-white text-[#1c1038]" : "text-white/60")}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {portfolio.isLoading ? (
          <p className="px-5 py-10 text-center text-sm text-white/45">Loading positions…</p>
        ) : positions.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-white/45">
            {filter === "closed" ? "No closed positions." : "No positions yet."}{" "}
            <Link href="/markets" className="text-violet-200 underline">Buy a Nasdaq xStock</Link>
          </div>
        ) : (
          <PositionsTable
            positions={positions}
            onTrade={(p, side) =>
              setTrade({ side, target: { symbol: p.symbol, name: p.name, logo: p.logo, address: p.token } })
            }
          />
        )}
        {data?.positions.some((p) => p.onchainShares != null && Math.abs(p.onchainShares - p.shares) > 1e-9) && (
          <p className="border-t border-white/10 px-5 py-3 text-xs text-amber-200/90">
            Some wallet balances differ from desk trades (tokens moved in or out outside Hyperdrive). PnL covers desk trades only.
          </p>
        )}
      </section>

      <section className="app-card overflow-hidden rounded-3xl">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-medium">Trade history</h2>
        </div>
        {trades.isLoading ? (
          <p className="px-5 py-10 text-center text-sm text-white/45">Loading trades…</p>
        ) : (
          <TradeHistory trades={trades.data ?? []} />
        )}
      </section>

      {trade && <TradeDialog target={trade.target} initialSide={trade.side} onClose={() => setTrade(null)} />}
    </Shell>
  );
}

function Shell({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-violet-300 uppercase">Portfolio</p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight">Positions &amp; PnL</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
            Average-cost basis from your on-chain desk trades, marked at the latest xStocks price. Fees are part of cost basis.
          </p>
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}

function Stat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: string | null }) {
  return (
    <article className="app-card rounded-2xl px-4 py-4 md:px-5">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-white/45 uppercase">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums md:text-3xl", tone)}>{value}</p>
      <p className="mt-1 truncate text-xs text-white/40">{detail}</p>
    </article>
  );
}
