"use client";

import { ExternalLink } from "lucide-react";
import type { TradeRecord } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatShares, formatUsd, shortAddress } from "@/lib/format";
import { explorerTx } from "@/lib/wagmi";

export function TradeHistory({ trades }: { trades: TradeRecord[] }) {
  if (trades.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-white/45">No trades yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-[11px] tracking-[0.14em] text-white/40 uppercase">
            <th className="px-5 py-3 font-normal">Time</th>
            <th className="py-3 font-normal">Side</th>
            <th className="py-3 font-normal">Stock</th>
            <th className="py-3 text-right font-normal">Shares</th>
            <th className="py-3 text-right font-normal">Price</th>
            <th className="py-3 text-right font-normal">USDC</th>
            <th className="py-3 text-right font-normal">Fee</th>
            <th className="px-5 py-3 text-right font-normal">Tx</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const link = explorerTx(t.txHash);
            return (
              <tr key={`${t.txHash}-${t.logIndex}`} className="border-b border-white/5 last:border-b-0">
                <td className="px-5 py-3 text-white/60">{formatDateTime(t.timestamp)}</td>
                <td className="py-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs capitalize",
                      t.side === "buy" ? "bg-emerald-300/15 text-emerald-200" : "bg-rose-300/15 text-rose-200",
                    )}
                  >
                    {t.side}
                  </span>
                </td>
                <td className="py-3 font-mono text-xs text-violet-200">{t.symbol}</td>
                <td className="py-3 text-right tabular-nums">{formatShares(t.sharesDecimal)}</td>
                <td className="py-3 text-right tabular-nums">{formatUsd(t.priceUsd)}</td>
                <td className="py-3 text-right tabular-nums">
                  {t.side === "buy" ? "−" : "+"}
                  {formatUsd(t.usdcAmountUsd)}
                </td>
                <td className="py-3 text-right text-white/50 tabular-nums">{formatUsd(t.feeUsd)}</td>
                <td className="px-5 py-3 text-right font-mono text-xs">
                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-white/60 hover:text-white">
                      {shortAddress(t.txHash)} <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="text-white/45">{shortAddress(t.txHash)}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
