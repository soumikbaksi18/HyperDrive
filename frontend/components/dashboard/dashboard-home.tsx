"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccount, useBalance } from "wagmi";
import { formatUnits } from "viem";
import { ArrowUpRight } from "lucide-react";
import { formatMon } from "@/lib/format";
import { nasdaqCatalog } from "@/lib/xstocks";
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
  const { address, isConnected, chainId } = useAccount();
  const { data: balance, isLoading } = useBalance({
    address,
    chainId: monadChain.id,
    query: { enabled: Boolean(address) },
  });
  const onMonad = chainId === monadChain.id;
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
            Your baskets will land here.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
            The desk is open. MetaMask can connect to Monad, and the Nasdaq
            xStock list is on Markets. Agent baskets are not generated in this
            version, so nothing here is an allocation.
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

      <section className="grid gap-4 md:grid-cols-3">
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
          detail={isConnected ? "Native MON on chain 143" : "Connect MetaMask"}
        />
        <Kpi
          label="Funded basket"
          value="None"
          detail="No basket has been approved"
        />
        <Kpi
          label="Nasdaq xStocks"
          value={String(nasdaqCatalog.count)}
          detail="Monad deployments in the catalog"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <article className="app-card rounded-3xl p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-[0.16em] text-white/45 uppercase">
              Portfolio
            </h2>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/50">
              Empty
            </span>
          </div>
          <p className="mt-6 font-serif text-5xl italic text-white/90">No position</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/50">
            When you approve a basket, its weights and the marked value belong
            in this panel. A falling market will show here as a drawdown, not
            as a new basket chosen for you.
          </p>
          <div className="mt-8 h-28 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]" />
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
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="app-card h-[132px] rounded-2xl px-5 py-4">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-white/45 uppercase">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-white/40">{detail}</p>
    </article>
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
