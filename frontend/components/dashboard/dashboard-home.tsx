"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { erc20Abi, formatUnits } from "viem";
import { ArrowUpRight } from "lucide-react";
import { PositionsTable } from "@/components/portfolio/positions-table";
import { TradeHistory } from "@/components/portfolio/trade-history";
import { fetchDesk } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMon, formatPct, formatSignedUsd, formatUsd, pnlTone } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import { usePortfolio, useTrades } from "@/lib/use-portfolio";
import { monadChain } from "@/lib/wagmi";

const SLOTS = [
  {
    name: "Steady Explorer",
    copy: "Lower-volatility Nasdaq mix, once the engine is allowed to score names.",
  },
  {
    name: "Balanced Growth",
    copy: "The middle basket. This is the one most people will compare first.",
  },
  {
    name: "High-Growth Explorer",
    copy: "A sharper basket, with the drawdown case written next to the idea.",
  },
];

export function DashboardHome() {
  const account = useAccount();
  const hydrated = useHydrated();
  const isConnected = hydrated && account.isConnected;
  const address = hydrated ? account.address : undefined;
  const chainId = hydrated ? account.chainId : undefined;
  const { data: balance, isLoading } = useBalance({
    address,
    chainId: monadChain.id,
    query: { enabled: Boolean(address) },
  });
  const onMonad = chainId === monadChain.id;
  const desk = useQuery({ queryKey: ["desk"], queryFn: fetchDesk, staleTime: 60_000 });
  const usdcAddress = desk.data?.configured ? desk.data.usdc : undefined;
  const usdc = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: monadChain.id,
    query: { enabled: Boolean(address && usdcAddress), refetchInterval: 30_000 },
  });
  const portfolio = usePortfolio();
  const recent = useTrades(5);
  const s = portfolio.data?.summary;
  const active = (portfolio.data?.positions ?? []).filter((p) => p.status === "active");
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-violet-200/70" suppressHydrationWarning>
            {greeting}
          </p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight md:text-4xl">
            {s && s.activePositions > 0
              ? `${s.activePositions} Nasdaq stock${s.activePositions === 1 ? "" : "s"} on the books.`
              : "Your Nasdaq holdings land here."}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
            Pay USDC on Monad for Nasdaq xStocks from Markets. Every fill is
            settled on-chain and tracked here and on Portfolio.
          </p>
        </div>
        <Link
          href="/markets"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-[#7c5cff] to-[#a855f7] px-4 text-sm font-medium text-white"
        >
          Open markets
          <ArrowUpRight className="size-4" />
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="Portfolio value"
          value={!isConnected ? "—" : s ? formatUsd(s.marketValue) : "Reading…"}
          detail={s ? `${s.activePositions} active · ${formatUsd(s.costBasis)} cost basis` : "Marked at xStocks prices"}
        />
        <Kpi
          label="Total PnL"
          value={!isConnected ? "—" : s ? formatSignedUsd(s.totalPnl) : "Reading…"}
          detail={s ? `${formatPct(s.totalPnlPct)} · realized ${formatSignedUsd(s.realizedPnl)}` : "Realized + unrealized"}
          tone={s ? pnlTone(s.totalPnl) : undefined}
        />
        <Kpi
          label="USDC balance"
          value={
            !isConnected
              ? "—"
              : usdc.data != null
                ? formatUsd(Number(formatUnits(usdc.data, 6)))
                : desk.data && !desk.data.configured
                  ? "Desk off"
                  : "Reading…"
          }
          detail={isConnected ? "Available to buy xStocks" : "Connect MetaMask"}
        />
        <Kpi
          label="Monad balance"
          value={
            !isConnected
              ? "—"
              : isLoading
                ? "Reading…"
                : balance
                  ? formatMon(formatUnits(balance.value, balance.decimals))
                  : "—"
          }
          detail={isConnected ? `Native MON for gas · chain ${monadChain.id}` : "Connect MetaMask"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <article className="app-card overflow-hidden rounded-3xl lg:col-span-3">
          <div className="flex items-center justify-between px-6 pt-5 pb-4">
            <h2 className="text-xs font-semibold tracking-[0.16em] text-white/45 uppercase">
              Active stocks
            </h2>
            <Link href="/portfolio" className="inline-flex items-center gap-1 text-xs text-violet-200 hover:text-white">
              Full portfolio <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          {!isConnected ? (
            <EmptyPanel text="Connect MetaMask to see the stocks you hold." />
          ) : portfolio.isError ? (
            <EmptyPanel text="The backend isn't reachable, so positions can't load right now." />
          ) : portfolio.isLoading ? (
            <EmptyPanel text="Loading positions…" />
          ) : active.length === 0 ? (
            <EmptyPanel text="No position yet. Pick a Nasdaq name on Markets and pay with USDC." cta />
          ) : (
            <div className="border-t border-white/10">
              <PositionsTable positions={active.slice(0, 6)} compact />
              {active.length > 6 && (
                <Link href="/portfolio" className="block border-t border-white/10 px-5 py-3 text-center text-xs text-white/50 hover:text-white">
                  +{active.length - 6} more on Portfolio
                </Link>
              )}
            </div>
          )}
        </article>

        <article className="app-card rounded-3xl p-6 lg:col-span-2">
          <h2 className="text-xs font-semibold tracking-[0.16em] text-white/45 uppercase">
            Wallet
          </h2>
          <p className="mt-5 text-2xl font-medium">
            {isConnected ? "MetaMask connected" : "MetaMask not connected"}
          </p>
          <p className="mt-2 break-all font-mono text-xs text-white/45">
            {address ?? "Use Connect MetaMask in the top bar."}
          </p>
          <div className="mt-6 space-y-3 text-sm">
            <Row label="Network" value={onMonad ? "Monad" : isConnected ? "Other chain" : "—"} />
            <Row label="Chain ID" value={isConnected ? String(chainId) : "—"} />
            <Row label="Expected" value={`${monadChain.name} · ${monadChain.id}`} />
          </div>
          {!onMonad && isConnected && (
            <p className="mt-4 text-xs leading-relaxed text-amber-200/90">
              Switch to Monad from the wallet menu before a later trade flow
              can read the right xStock balances.
            </p>
          )}
        </article>
      </section>

      {isConnected && (recent.data?.length ?? 0) > 0 && (
        <section className="app-card overflow-hidden rounded-3xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="text-xs font-semibold tracking-[0.16em] text-white/45 uppercase">Recent activity</h2>
            <Link href="/portfolio" className="text-xs text-violet-200 hover:text-white">All trades</Link>
          </div>
          <TradeHistory trades={recent.data ?? []} />
        </section>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-medium">Suggested baskets</h2>
            <p className="text-sm text-white/45">Reserved for the agent. Empty on purpose.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {SLOTS.map((slot, index) => (
            <article
              key={slot.name}
              className={
                index === 0
                  ? "rounded-3xl bg-gradient-to-br from-[#d8ccff] via-[#9b87f5] to-[#6842d6] p-5 text-[#1c1038]"
                  : "app-card rounded-3xl p-5"
              }
            >
              <p
                className={
                  index === 0
                    ? "text-xs text-[#2a1458]/70"
                    : "text-xs text-white/45"
                }
              >
                Basket {index + 1}
              </p>
              <h3 className="mt-6 font-serif text-3xl italic">{slot.name}</h3>
              <p
                className={
                  index === 0
                    ? "mt-3 text-sm leading-relaxed text-[#241447]/75"
                    : "mt-3 text-sm leading-relaxed text-white/55"
                }
              >
                {slot.copy}
              </p>
              <p
                className={
                  index === 0
                    ? "mt-8 text-sm font-medium text-[#2a1458]/70"
                    : "mt-8 text-sm text-white/35"
                }
              >
                Not generated
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <article className="app-card min-h-[132px] rounded-2xl px-4 py-4 md:px-5">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-white/45 uppercase">
        {label}
      </p>
      <p className={cn("mt-3 text-2xl font-semibold tracking-tight tabular-nums md:text-3xl", tone)}>{value}</p>
      <p className="mt-1 truncate text-xs text-white/40">{detail}</p>
    </article>
  );
}

function EmptyPanel({ text, cta }: { text: string; cta?: boolean }) {
  return (
    <div className="mx-6 mb-6 flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center text-sm text-white/50">
      {text}
      {cta && (
        <Link href="/markets" className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-[#1c1038]">
          Open markets
        </Link>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3">
      <span className="text-white/45">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
