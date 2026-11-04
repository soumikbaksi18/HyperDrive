"use client";

import Image from "next/image";
import type { Position } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatPct, formatShares, formatSignedUsd, formatUsd, pnlTone } from "@/lib/format";

/** Holdings table. `compact` drops the columns the dashboard doesn't need. */
export function PositionsTable({
  positions,
  compact = false,
  onTrade,
}: {
  positions: Position[];
  compact?: boolean;
  onTrade?: (position: Position, side: "buy" | "sell") => void;
}) {
  const cols = compact
    ? "md:grid-cols-[1.5fr_0.8fr_0.9fr_1fr_1fr]"
    : "md:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_0.9fr_1fr_0.9fr_0.7fr_auto]";

  return (
    <div className="overflow-hidden">
      <div className={cn("hidden gap-3 border-b border-white/10 px-5 py-3 text-[11px] tracking-[0.14em] text-white/40 uppercase md:grid", cols)}>
        <span>Stock</span>
        <span className="text-right">Shares</span>
        {!compact && <span className="text-right">Avg cost</span>}
        <span className="text-right">Price</span>
        <span className="text-right">Value</span>
        <span className="text-right">Unrealized</span>
        {!compact && <span className="text-right">Realized</span>}
        {!compact && <span className="text-right">Weight</span>}
        {!compact && onTrade && <span className="w-[116px]" />}
      </div>
      <ul>
        {positions.map((p) => (
          <li
            key={p.token}
            className={cn(
              "grid grid-cols-2 gap-x-3 gap-y-1 border-b border-white/10 px-4 py-3.5 text-sm last:border-b-0 md:items-center md:gap-y-0 md:px-5",
              cols,
              p.status === "closed" && "opacity-60",
            )}
          >
            <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
              {p.logo ? (
                <Image src={p.logo} alt="" width={36} height={36} className="size-9 rounded-xl bg-white/10" />
              ) : (
                <span className="size-9 rounded-xl bg-white/10" />
              )}
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                <p className="font-mono text-xs text-violet-200">
                  {p.symbol}
                  {p.status === "closed" && <span className="ml-2 font-sans text-white/40">Closed</span>}
                </p>
              </div>
            </div>
            <Cell label="Shares" value={formatShares(p.shares)} />
            {!compact && <Cell label="Avg cost" value={p.shares > 0 ? formatUsd(p.avgCost) : "—"} />}
            <Cell
              label="Price"
              value={p.currentPrice != null ? formatUsd(p.currentPrice) : "—"}
              hint={p.currentPrice != null && !p.priceIsLive ? "last fill" : undefined}
            />
            <Cell label="Value" value={formatUsd(p.marketValue)} strong />
            <Cell
              label="Unrealized"
              value={p.status === "active" ? formatSignedUsd(p.unrealizedPnl) : "—"}
              hint={p.status === "active" ? formatPct(p.unrealizedPnlPct) : undefined}
              tone={pnlTone(p.unrealizedPnl)}
            />
            {!compact && (
              <Cell label="Realized" value={formatSignedUsd(p.realizedPnl)} tone={pnlTone(p.realizedPnl)} />
            )}
            {!compact && (
              <div className="md:text-right">
                <span className="text-xs text-white/40 md:hidden">Weight </span>
                <span className="tabular-nums">{p.allocationPct.toFixed(1)}%</span>
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <span className="block h-full rounded-full bg-[#8b6cf0]" style={{ width: `${Math.min(100, p.allocationPct)}%` }} />
                </span>
              </div>
            )}
            {!compact && onTrade && (
              <div className="col-span-2 mt-2 flex gap-1.5 md:col-span-1 md:mt-0">
                <button type="button" onClick={() => onTrade(p, "buy")} className="h-8 flex-1 rounded-full bg-emerald-300/15 px-3 text-xs text-emerald-200 hover:bg-emerald-300/25 md:w-14">
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => onTrade(p, "sell")}
                  disabled={p.status === "closed"}
                  className="h-8 flex-1 rounded-full bg-rose-300/15 px-3 text-xs text-rose-200 hover:bg-rose-300/25 disabled:opacity-30 md:w-14"
                >
                  Sell
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Cell({
  label,
  value,
  hint,
  tone,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 md:block md:text-right">
      <span className="text-xs text-white/40 md:hidden">{label}</span>
      <span>
        <span className={cn("tabular-nums", tone, strong && "font-medium")}>{value}</span>
        {hint && <span className={cn("ml-1 text-[11px] md:ml-0 md:block", tone ?? "text-white/35")}>{hint}</span>}
      </span>
    </div>
  );
}
