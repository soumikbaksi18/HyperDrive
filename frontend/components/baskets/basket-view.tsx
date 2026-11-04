"use client";

import Image from "next/image";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { erc20Abi, formatUnits } from "viem";
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { CheckCircle2, ExternalLink, Layers, Loader2 } from "lucide-react";
import { basketRouterAbi } from "@/lib/basket-abi";
import { fetchBasket, requestBasketQuote, syncTrade, type BasketQuote } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatShares, formatUsd, shortAddress } from "@/lib/format";
import { portfolioKeys } from "@/lib/use-portfolio";
import { explorerTx, monadChain } from "@/lib/wagmi";
import { nasdaqCatalog } from "@/lib/xstocks";

const logoBySymbol = new Map(nasdaqCatalog.stocks.map((s) => [s.symbol, s.logo]));
const COLORS = ["#8b6cf0", "#1f9483"];

type Step = "idle" | "quoting" | "approving" | "swapping" | "syncing" | "done";

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/user rejected|user denied/i.test(message)) return "You rejected the request in MetaMask.";
  return message.split("\n")[0].slice(0, 220);
}

export function BasketView() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: monadChain.id });
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const queryClient = useQueryClient();

  const info = useQuery({ queryKey: ["basket"], queryFn: fetchBasket, refetchInterval: 30_000 });
  const b = info.data?.deployed ? info.data : null;

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [quote, setQuote] = useState<BasketQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const usdcBal = useReadContract({
    address: b?.usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: monadChain.id,
    query: { enabled: Boolean(address && b) },
  });
  const shareBal = useReadContract({
    address: b?.basket,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: monadChain.id,
    query: { enabled: Boolean(address && b) },
  });
  const held = side === "buy"
    ? usdcBal.data != null ? Number(formatUnits(usdcBal.data, 6)) : null
    : shareBal.data != null ? Number(formatUnits(shareBal.data, 18)) : null;
  const busy = step === "quoting" || step === "approving" || step === "swapping" || step === "syncing";

  const execute = async () => {
    if (!address || !publicClient || !b) return;
    setError(null);
    setTxHash(null);
    try {
      if (chainId !== monadChain.id) await switchChainAsync({ chainId: monadChain.id });
      setStep("quoting");
      const q = await requestBasketQuote({ trader: address, side, amount: amount.trim() });
      setQuote(q);

      const amountIn = BigInt(q.amountIn);
      const allowance = await publicClient.readContract({
        address: q.tokenIn,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, q.router],
      });
      if (allowance < amountIn) {
        setStep("approving");
        const h = await writeContractAsync({ address: q.tokenIn, abi: erc20Abi, functionName: "approve", args: [q.router, amountIn], chainId: monadChain.id });
        await publicClient.waitForTransactionReceipt({ hash: h });
      }

      setStep("swapping");
      const hash = await writeContractAsync({
        address: q.router,
        abi: basketRouterAbi,
        functionName: "swapExactIn",
        args: [q.poolKey, q.zeroForOne, amountIn, BigInt(q.minAmountOut), q.hookData, address, BigInt(q.deadline)],
        chainId: monadChain.id,
      });
      setTxHash(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (receipt.status !== "success") throw new Error("The swap reverted on-chain (price moved past the minimum). Nothing was traded.");

      setStep("syncing");
      await syncTrade(hash).catch(() => null);
      await queryClient.invalidateQueries({ queryKey: portfolioKeys.all(address) });
      await queryClient.invalidateQueries({ queryKey: ["basket"] });
      void usdcBal.refetch();
      void shareBal.refetch();
      setStep("done");
    } catch (err) {
      setError(errorText(err));
      setStep("idle");
    }
  };

  const numeric = Number(amount);
  const insufficient = held != null && numeric > held;
  const explorer = txHash ? explorerTx(txHash) : null;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 md:px-6">
      <header>
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
          <Layers className="size-3.5" /> Stock baskets · Uniswap v4
        </p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight md:text-4xl">One token, a basket of stocks</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
          Pay USDC once and receive a single basket token. A Uniswap v4 hook splits your USDC across the
          component xStocks on Monad and mints shares backed 1:1 by what it bought. Sell the token back into
          the same pool any time for USDC.
        </p>
      </header>

      {info.isLoading ? (
        <div className="app-card rounded-3xl p-10 text-center text-sm text-white/45">Loading basket…</div>
      ) : !b ? (
        <div className="app-card rounded-3xl p-10 text-center text-sm text-white/55">
          {info.isError ? "Backend is offline." : "The NVDA + TSLA basket contract is not deployed on Monad yet."}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <section className="space-y-4 lg:col-span-3">
            <article className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#d8ccff] via-[#9b87f5] to-[#6842d6] p-6 text-[#1c1038]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-[#2a1458]/70">{b.symbol} · ERC-20 on Monad</p>
                  <h2 className="mt-2 font-serif text-4xl italic">NVIDIA + Tesla</h2>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#2a1458]/70">NAV / share</p>
                  <p className="text-3xl font-semibold tabular-nums">{formatUsd(b.navPerShare)}</p>
                </div>
              </div>
              <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-white/30">
                {b.components.map((c, i) => (
                  <span key={c.symbol} style={{ width: `${c.liveWeight}%`, background: COLORS[i % COLORS.length] }} className="h-full border-r-2 border-[#9b87f5] last:border-r-0" />
                ))}
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-4 text-sm">
                <div><dt className="text-xs text-[#2a1458]/70">Total value</dt><dd className="font-semibold tabular-nums">{formatUsd(b.tvl)}</dd></div>
                <div><dt className="text-xs text-[#2a1458]/70">Supply</dt><dd className="font-semibold tabular-nums">{formatShares(b.totalSupply)}</dd></div>
                <div><dt className="text-xs text-[#2a1458]/70">Your shares</dt><dd className="font-semibold tabular-nums">{shareBal.data != null ? formatShares(Number(formatUnits(shareBal.data, 18))) : "—"}</dd></div>
              </dl>
            </article>

            <article className="app-card rounded-3xl p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">What one share holds</h3>
              <ul className="mt-4 space-y-3">
                {b.components.map((c, i) => (
                  <li key={c.symbol} className="flex items-center gap-3">
                    <span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {logoBySymbol.get(c.symbol) && <Image src={logoBySymbol.get(c.symbol)!} alt="" width={32} height={32} className="size-8 rounded-lg bg-white/10" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.symbol}</p>
                      <p className="text-xs text-white/45">{formatShares(c.perShare)} per share · {c.price != null ? formatUsd(c.price) : "—"}</p>
                    </div>
                    <div className="text-right text-sm tabular-nums">
                      <p>{c.liveWeight.toFixed(1)}%</p>
                      <p className="text-xs text-white/40">target {c.targetWeight}%</p>
                    </div>
                  </li>
                ))}
              </ul>
              <dl className="mt-5 space-y-1.5 border-t border-white/10 pt-4 text-xs text-white/50">
                <Row label="Basket token" value={shortAddress(b.basket)} />
                <Row label="v4 hook" value={shortAddress(b.hook)} />
                <Row label="v4 PoolManager" value={shortAddress(b.poolManager)} />
              </dl>
            </article>
          </section>

          <aside className="rounded-3xl border border-violet-300/20 bg-gradient-to-b from-[#1a1030]/95 to-[#0c0914]/95 p-5 lg:col-span-2">
            {step === "done" && quote ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto size-10 text-emerald-300" />
                <p className="mt-3 text-lg font-medium">
                  {quote.side === "buy" ? `Bought ~${formatShares(Number(quote.expectedOutDecimal))} ${quote.symbol}` : `Sold for ~${formatUsd(Number(quote.expectedOutDecimal))}`}
                </p>
                <p className="mt-1 text-sm text-white/50">Settled through the Uniswap v4 pool and saved to your portfolio.</p>
                {explorer && (
                  <a href={explorer} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-violet-200 underline">
                    View transaction <ExternalLink className="size-3.5" />
                  </a>
                )}
                <button type="button" onClick={() => { setStep("idle"); setAmount(""); setQuote(null); }} className="mt-6 w-full rounded-xl bg-white py-2.5 text-sm font-medium text-[#1c1038]">
                  New order
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm">
                  {(["buy", "sell"] as const).map((s) => (
                    <button key={s} type="button" disabled={busy} onClick={() => { setSide(s); setAmount(""); setError(null); }}
                      className={cn("rounded-full py-1.5 capitalize", side === s ? (s === "buy" ? "bg-emerald-300 text-[#062a1c]" : "bg-rose-300 text-[#3a0a14]") : "text-white/60")}>
                      {s}
                    </button>
                  ))}
                </div>
                <label className="mt-4 block">
                  <span className="flex justify-between text-xs text-white/45">
                    <span>{side === "buy" ? "You pay" : "You sell"}</span>
                    <span>Balance: {held == null ? "—" : side === "buy" ? formatUsd(held) : `${formatShares(held)} ${b.symbol}`}</span>
                  </span>
                  <div className="mt-1.5 flex items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 focus-within:border-violet-300/40">
                    <input inputMode="decimal" value={amount} disabled={busy} placeholder="0.00"
                      onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setAmount(e.target.value)}
                      className="h-12 min-w-0 flex-1 bg-transparent text-lg tabular-nums outline-none placeholder:text-white/25" />
                    {held != null && held > 0 && (
                      <button type="button" onClick={() => setAmount(side === "buy" ? formatUnits(usdcBal.data ?? BigInt(0), 6) : formatUnits(shareBal.data ?? BigInt(0), 18))}
                        className="mr-2 rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-white/70">Max</button>
                    )}
                    <span className="text-sm text-white/50">{side === "buy" ? "USDC" : b.symbol}</span>
                  </div>
                </label>

                {side === "buy" && numeric > 0 && b.navPerShare > 0 && (
                  <div className="mt-4 space-y-1.5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm">
                    <Row label="≈ shares" value={formatShares(numeric / b.navPerShare)} />
                    {b.components.map((c) => (
                      <Row key={c.symbol} label={`→ ${c.symbol}`} value={formatUsd((numeric * c.liveWeight) / 100)} />
                    ))}
                  </div>
                )}
                {quote && step !== "idle" && (
                  <p className="mt-3 text-xs text-white/45">Minimum out: {quote.minOutDecimal} {quote.side === "buy" ? quote.symbol : "USDC"}</p>
                )}
                {error && <p className="mt-3 text-sm text-amber-200">{error}</p>}

                <button type="button" onClick={execute}
                  disabled={busy || !address || numeric <= 0 || insufficient || (side === "buy" && numeric < 1)}
                  className={cn("mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-medium disabled:opacity-40",
                    side === "buy" ? "bg-gradient-to-r from-[#7c5cff] to-[#a855f7] text-white" : "bg-rose-300 text-[#3a0a14]")}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {!address ? "Connect MetaMask"
                    : step === "quoting" ? "Routing both legs…"
                    : step === "approving" ? `Approve ${side === "buy" ? "USDC" : b.symbol} in MetaMask…`
                    : step === "swapping" ? "Confirm the v4 swap in MetaMask…"
                    : step === "syncing" ? "Saving to your portfolio…"
                    : insufficient ? `Not enough ${side === "buy" ? "USDC" : b.symbol}`
                    : side === "buy" && numeric > 0 && numeric < 1 ? "Minimum is $1"
                    : side === "buy" ? `Buy ${b.symbol}` : `Sell ${b.symbol}`}
                </button>
                <p className="mt-3 text-center text-[11px] leading-relaxed text-white/35">
                  One swap in the {b.symbol}/USDC Uniswap v4 pool. The hook buys (or sells) every component in the same
                  transaction; it reverts if you&apos;d get less than the minimum.
                </p>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-white/45">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
