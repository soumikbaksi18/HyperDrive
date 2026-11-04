"use client";

import { useMemo, useRef, useState } from "react";
import type { Snapshot } from "@/lib/api";
import { formatDateTime, formatSignedUsd, formatUsd } from "@/lib/format";

// Validated against the #120d1c surface (dataviz validator, dark mode).
const VALUE = "#8b6cf0";
const INVESTED = "#1f9483";

const W = 720;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 24, left: 56 };

/** Market value vs net invested over time, from backend portfolio snapshots. */
export function ValueChart({ points }: { points: Snapshot[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (points.length < 2) return null;
    const t0 = Date.parse(points[0].at);
    const t1 = Date.parse(points[points.length - 1].at);
    const values = points.flatMap((p) => [p.marketValue, p.netInvested]);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    const pad = Math.max((hi - lo) * 0.12, hi * 0.01, 1);
    lo = Math.max(0, lo - pad);
    hi += pad;
    const x = (at: string) => PAD.left + ((Date.parse(at) - t0) / Math.max(1, t1 - t0)) * (W - PAD.left - PAD.right);
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
    const line = (key: "marketValue" | "netInvested") =>
      points.map((p, i) => `${i ? "L" : "M"}${x(p.at).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
    const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3);
    return { x, y, ticks, value: line("marketValue"), invested: line("netInvested") };
  }, [points]);

  if (!geo) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-center text-sm text-white/40">
        The chart fills in as snapshots accumulate:<br />one after every trade, plus one every 15 minutes.
      </div>
    );
  }

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((event.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(geo.x(points[i].at) - px) < Math.abs(geo.x(points[best].at) - px)) best = i;
    }
    setHover(best);
  };

  const active = hover != null ? points[hover] : null;
  const last = points[points.length - 1];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-white/60">
        <Legend color={VALUE} label="Market value" />
        <Legend color={INVESTED} label="Net invested" dashed />
      </div>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-[220px] w-full touch-none"
          preserveAspectRatio="none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`Portfolio value ${formatUsd(last.marketValue)} against net invested ${formatUsd(last.netInvested)}`}
        >
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={geo.y(t)} y2={geo.y(t)} stroke="rgba(255,255,255,0.07)" vectorEffect="non-scaling-stroke" />
              <text x={PAD.left - 8} y={geo.y(t) + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,0.4)">
                {formatUsd(t).replace(/\.\d\d$/, "")}
              </text>
            </g>
          ))}
          <path d={geo.invested} fill="none" stroke={INVESTED} strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          <path d={geo.value} fill="none" stroke={VALUE} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {active && (
            <>
              <line x1={geo.x(active.at)} x2={geo.x(active.at)} y1={PAD.top} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.25)" vectorEffect="non-scaling-stroke" />
              <circle cx={geo.x(active.at)} cy={geo.y(active.marketValue)} r="4" fill={VALUE} stroke="#120d1c" strokeWidth="2" />
              <circle cx={geo.x(active.at)} cy={geo.y(active.netInvested)} r="4" fill={INVESTED} stroke="#120d1c" strokeWidth="2" />
            </>
          )}
        </svg>
        {active && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-52 rounded-xl border border-white/10 bg-[#1a1328]/95 p-3 text-xs shadow-xl"
            style={{
              left: `${Math.min(70, Math.max(0, (geo.x(active.at) / W) * 100 - 10))}%`,
            }}
          >
            <p className="text-white/50">{formatDateTime(active.at)}</p>
            <TipRow color={VALUE} label="Market value" value={formatUsd(active.marketValue)} />
            <TipRow color={INVESTED} label="Net invested" value={formatUsd(active.netInvested)} />
            <TipRow label="Total PnL" value={formatSignedUsd(active.unrealizedPnl + active.realizedPnl)} />
          </div>
        )}
      </div>
      <details className="mt-2 text-xs text-white/45">
        <summary className="cursor-pointer select-none">Show data table</summary>
        <div className="mt-2 max-h-48 overflow-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-white/35">
              <tr><th className="py-1">Time</th><th>Market value</th><th>Net invested</th><th>Total PnL</th></tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.at} className="border-t border-white/5 text-white/65">
                  <td className="py-1">{formatDateTime(p.at)}</td>
                  <td>{formatUsd(p.marketValue)}</td>
                  <td>{formatUsd(p.netInvested)}</td>
                  <td>{formatSignedUsd(p.unrealizedPnl + p.realizedPnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="18" height="4" aria-hidden>
        <line x1="0" x2="18" y1="2" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "5 3" : undefined} />
      </svg>
      {label}
    </span>
  );
}

function TipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <p className="mt-1.5 flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-white/55">
        {color && <span className="size-2 rounded-full" style={{ background: color }} />}
        {label}
      </span>
      <span className="font-medium text-white tabular-nums">{value}</span>
    </p>
  );
}
