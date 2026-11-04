"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { erc20Abi, formatUnits } from "viem";
import { useAccount, usePublicClient, useReadContract, useSendTransaction, useSwitchChain, useWriteContract } from "wagmi";
import { CheckCircle2, ExternalLink, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { hyperdriveDeskAbi } from "@/lib/desk-abi";
import { fetchDesk, requestQuote, requestSwap, syncTrade, type SignedQuote, type SwapQuote, type TradeSide } from "@/lib/api";
import { formatShares, formatUsd } from "@/lib/format";
import { portfolioKeys } from "@/lib/use-portfolio";
import { explorerTx, monadChain } from "@/lib/wagmi";

export type TradeTarget = {
  symbol: string;
  name: string;
  logo: string | null;
  address: string;
};

/** Wall clock for event handlers (kept out of render on purpose). */
const nowMs = () => Date.now();

type AnyQuote = SignedQuote | SwapQuote;
const isSwap = (q: AnyQuote): q is SwapQuote => "mode" in q && q.mode === "dex";

type Step = "idle" | "quoting" | "quoted" | "approving" | "trading" | "syncing" | "submitted" | "done";

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/user rejected|user denied/i.test(message)) return "You rejected the request in MetaMask.";
  const custom = message.match(/reverted with the following reason:\s*\n?(.+)/i)?.[1]
    ?? message.match(/Error: (\w+\(.*?\))/)?.[1];
  if (custom) return `Transaction reverted: ${custom}`;
  return message.split("\n")[0].slice(0, 220);
}

export function TradeDialog({
  target,
  initialSide = "buy",
  tradable = null,
  onClose,
}: {
  target: TradeTarget;
  initialSide?: TradeSide;
  /** DEX mode only: false = no USDC liquidity for this asset on Monad (from the backend scan). */
  tradable?: boolean | null;
  onClose: () => void;
}) {
  const { address, chainId } = useAccount();
  const onChain = chainId === monadChain.id;
  const publicClient = usePublicClient({ chainId: monadChain.id });
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const queryClient = useQueryClient();

  const [side, setSide] = useState<TradeSide>(initialSide);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [quote, setQuote] = useState<AnyQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const desk = useQuery({ queryKey: ["desk"], queryFn: fetchDesk, staleTime: 60_000 });
  const deskConfig = desk.data?.configured ? desk.data : null;
  const dexMode = deskConfig?.mode === "dex";

  const usdcBalance = useReadContract({
    address: deskConfig?.usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: monadChain.id,
    query: { enabled: Boolean(address && deskConfig) },
  });
  const tokenBalance = useReadContract({
    address: target.address as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: monadChain.id,
    query: { enabled: Boolean(address) },
  });

  const usdcHeld = usdcBalance.data != null ? Number(formatUnits(usdcBalance.data, 6)) : null;
  const sharesHeld = tokenBalance.data != null ? Number(formatUnits(tokenBalance.data, 18)) : null;

  const secondsLeft = quote ? Math.max(0, Math.floor((Date.parse(quote.expiresAt) - now) / 1000)) : 0;
  const expired = Boolean(quote) && secondsLeft === 0;
  const busy = step === "quoting" || step === "approving" || step === "trading" || step === "syncing";

  useEffect(() => {
    if (!quote) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [quote]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const reset = () => {
    setQuote(null);
    setStep("idle");
    setError(null);
  };

  /** One click: lock a signed price, then go straight to MetaMask. */
  const getQuote = async () => {
    if (!address) return setError("Connect MetaMask first.");
    setError(null);
    setStep("quoting");
    let signed: AnyQuote;
    try {
      const body = { trader: address, symbol: target.symbol, side, amount: amount.trim() };
      signed = dexMode ? await requestSwap(body) : await requestQuote(body);
    } catch (err) {
      setError(errorText(err));
      setStep("idle");
      return;
    }
    setQuote(signed);
    await (isSwap(signed) ? executeSwap(signed) : execute(signed));
  };

  /** Mainnet path: approve the aggregator router, then send the router call it built for this wallet. */
  const executeSwap = async (q: SwapQuote) => {
    if (!address || !publicClient) return;
    setError(null);
    let submitted: `0x${string}` | null = null;
    try {
      if (!onChain) await switchChainAsync({ chainId: monadChain.id });
      const amountIn = BigInt(q.amountIn);
      const allowance = await publicClient.readContract({
        address: q.tokenIn,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, q.router],
      });
      if (allowance < amountIn) {
        setStep("approving");
        const approveHash = await writeContractAsync({
          address: q.tokenIn,
          abi: erc20Abi,
          functionName: "approve",
          args: [q.router, amountIn],
          chainId: monadChain.id,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }
      if (Date.parse(q.expiresAt) <= nowMs()) {
        // Route is stale after a slow approval; rebuild it so the min-out reflects the current pool.
        q = await requestSwap({ trader: address, symbol: target.symbol, side, amount: amount.trim() });
        setQuote(q);
      }

      setStep("trading");
      const hash = await sendTransactionAsync({
        to: q.router,
        data: q.data,
        value: BigInt(q.value || "0"),
        chainId: monadChain.id,
      });
      setTxHash(hash);
      submitted = hash;
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (receipt.status !== "success") {
        submitted = null;
        throw new Error("Swap reverted on-chain (price moved past your slippage limit). Nothing was traded.");
      }
      setStep("syncing");
      await afterSettle(hash);
      setStep("done");
    } catch (err) {
      if (submitted) {
        setStep("submitted");
        setError("Submitted, but confirmation is taking a while. Don't resubmit. Your portfolio updates once it lands.");
        const hash = submitted;
        void publicClient
          .waitForTransactionReceipt({ hash, timeout: 600_000 })
          .then(async (receipt) => {
            if (receipt.status !== "success") return setError("The swap reverted. Nothing was traded.");
            await afterSettle(hash);
            setError(null);
            setStep("done");
          })
          .catch(() => null);
        return;
      }
      setError(errorText(err));
      setStep("quoted");
    }
  };

  const execute = async (signed: SignedQuote) => {
    if (!address || !publicClient) return;
    let q = signed;
    let submitted: string | null = null;
    setError(null);
    try {
      if (!onChain) await switchChainAsync({ chainId: monadChain.id });

      const spend = side === "buy" ? q.usdc : q.quote.token;
      const amountIn = BigInt(q.quote.amountIn);
      const allowance = await publicClient.readContract({
        address: spend,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, q.desk],
      });
      if (allowance < amountIn) {
        setStep("approving");
        const approveHash = await writeContractAsync({
          address: spend,
          abi: erc20Abi,
          functionName: "approve",
          args: [q.desk, amountIn],
          chainId: monadChain.id,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      if (Date.parse(q.expiresAt) <= nowMs() + 5_000) {
        // Approval took a while; lock a fresh price before the trade itself.
        q = await requestQuote({ trader: address, symbol: target.symbol, side, amount: amount.trim() });
        setQuote(q);
      }

      setStep("trading");
      const args = [
        {
          trader: q.quote.trader,
          token: q.quote.token,
          side: q.quote.side,
          amountIn,
          price: BigInt(q.quote.price),
          deadline: BigInt(q.quote.deadline),
          nonce: q.quote.nonce,
        },
        q.signature,
        BigInt(q.expectedOut),
      ] as const;
      const hash = await writeContractAsync({
        address: q.desk,
        abi: hyperdriveDeskAbi,
        functionName: side,
        args,
        chainId: monadChain.id,
      });
      setTxHash(hash);
      submitted = hash;
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (receipt.status !== "success") {
        submitted = null; // reverted: nothing settled, safe to try again
        throw new Error("Transaction reverted on-chain.");
      }

      setStep("syncing");
      await afterSettle(hash);
      setStep("done");
    } catch (err) {
      if (submitted) {
        // The trade was broadcast but we couldn't confirm it. Never send the user back to
        // quoting here: a second click could buy twice. Keep watching in the background.
        setStep("submitted");
        setError("Submitted, but confirmation is taking a while. Don't resubmit. Your portfolio updates once it lands.");
        const hash = submitted as `0x${string}`;
        void publicClient
          .waitForTransactionReceipt({ hash, timeout: 600_000 })
          .then(async (receipt) => {
            if (receipt.status !== "success") {
              setError("The transaction reverted. Nothing was traded.");
              return;
            }
            await afterSettle(hash);
            setError(null);
            setStep("done");
          })
          .catch(() => null);
        return;
      }
      setError(errorText(err));
      setStep("quoted");
    }
  };

  /** Index the fill now (the poller would anyway), then refresh every view of the wallet. */
  const afterSettle = async (hash: string) => {
    let synced = await syncTrade(hash).then(() => true).catch(() => false);
    for (let attempt = 0; !synced && attempt < 4; attempt++) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      synced = await syncTrade(hash).then(() => true).catch(() => false);
    }
    await queryClient.invalidateQueries({ queryKey: portfolioKeys.all(address) });
    await queryClient.invalidateQueries({ queryKey: ["readContract"] });
    void usdcBalance.refetch();
    void tokenBalance.refetch();
  };

  const unitLabel = side === "buy" ? "USDC" : target.symbol;
  const maxAmount = side === "buy" ? usdcHeld : sharesHeld;
  const numeric = Number(amount);
  const insufficient = maxAmount != null && numeric > maxAmount;
  const belowMin = side === "buy" && numeric > 0 && numeric < 1;
  const noLiquidity = dexMode && tradable === false;
  const explorer = txHash ? explorerTx(txHash) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-title"
        className="relative z-10 w-full max-w-md rounded-t-3xl border border-white/10 bg-[#120d1c] p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {target.logo && (
              <Image src={target.logo} alt="" width={40} height={40} className="size-10 rounded-xl bg-white/10" />
            )}
            <div>
              <h2 id="trade-title" className="font-medium">{target.name}</h2>
              <p className="font-mono text-xs text-violet-200">{target.symbol}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/5 disabled:opacity-30"
            aria-label="Close trade dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        {step === "done" && quote ? (
          <div className="mt-6 text-center">
            <CheckCircle2 className="mx-auto size-10 text-emerald-300" />
            <p className="mt-3 text-lg font-medium">
              {side === "buy"
                ? `Bought ${formatShares(Number(quote.expectedOutDecimal))} ${target.symbol}`
                : `Sold for ${formatUsd(Number(quote.expectedOutDecimal))}`}
            </p>
            <p className="mt-1 text-sm text-white/50">Settled on {monadChain.name} and saved to your portfolio.</p>
            {explorer && (
              <a href={explorer} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-violet-200 underline">
                View transaction <ExternalLink className="size-3.5" />
              </a>
            )}
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => { reset(); setAmount(""); setTxHash(null); }} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm">
                New order
              </button>
              <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-white py-2.5 text-sm font-medium text-[#1c1038]">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm">
              {(["buy", "sell"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => { setSide(s); setAmount(""); reset(); }}
                  className={cn(
                    "rounded-full py-1.5 capitalize",
                    side === s ? (s === "buy" ? "bg-emerald-300 text-[#062a1c]" : "bg-rose-300 text-[#3a0a14]") : "text-white/60",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <label className="mt-4 block">
              <span className="flex justify-between text-xs text-white/45">
                <span>{side === "buy" ? "You pay" : "You sell"}</span>
                <span>
                  Balance:{" "}
                  {maxAmount == null ? "—" : side === "buy" ? formatUsd(maxAmount) : `${formatShares(maxAmount)} ${target.symbol}`}
                </span>
              </span>
              <div className="mt-1.5 flex items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 focus-within:border-violet-300/40">
                <input
                  inputMode="decimal"
                  value={amount}
                  disabled={busy}
                  onChange={(e) => {
                    if (/^\d*\.?\d*$/.test(e.target.value)) {
                      setAmount(e.target.value);
                      if (quote) reset();
                    }
                  }}
                  placeholder="0.00"
                  className="h-12 min-w-0 flex-1 bg-transparent text-lg tabular-nums outline-none placeholder:text-white/25"
                />
                {maxAmount != null && maxAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => { setAmount(side === "buy" ? formatUnits(usdcBalance.data ?? BigInt(0), 6) : formatUnits(tokenBalance.data ?? BigInt(0), 18)); reset(); }}
                    className="mr-2 rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-white/70"
                  >
                    Max
                  </button>
                )}
                <span className="text-sm text-white/50">{unitLabel}</span>
              </div>
            </label>

            {quote && (
              <dl className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm">
                <Row label="Price" value={`${formatUsd(quote.priceUsd)} / share`} />
                {isSwap(quote) ? (
                  <>
                    {quote.marketPriceUsd != null && (
                      <Row label="xStocks price" value={`${formatUsd(quote.marketPriceUsd)} / share`} />
                    )}
                    <Row label="Route" value={`${quote.venue} · ${(quote.slippageBps / 100).toFixed(2)}% max slippage`} />
                  </>
                ) : (
                  <Row label="Fee" value={`${formatUsd(quote.feeUsd)} (${(quote.feeBps / 100).toFixed(2)}%)`} />
                )}
                <Row
                  label="You receive"
                  value={side === "buy" ? `${formatShares(Number(quote.expectedOutDecimal))} ${target.symbol}` : formatUsd(Number(quote.expectedOutDecimal))}
                  strong
                />
                {isSwap(quote) && (
                  <Row
                    label="Minimum"
                    value={side === "buy" ? `${formatShares(Number(quote.minOutDecimal))} ${target.symbol}` : formatUsd(Number(quote.minOutDecimal))}
                  />
                )}
                <p className={cn("pt-1 text-xs", expired ? "text-amber-200" : "text-white/40")}>
                  {isSwap(quote)
                    ? expired
                      ? "Route is stale. Clicking again rebuilds it."
                      : `Route valid for ${secondsLeft}s.`
                    : expired
                      ? "Price lock expired. Clicking again locks a new one."
                      : `Price locked for ${secondsLeft}s.`}
                </p>
              </dl>
            )}

            {noLiquidity && (
              <div className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] p-3 text-xs leading-relaxed text-amber-100/90">
                <p className="font-medium text-amber-100">No on-chain liquidity for {target.symbol} on Monad yet</p>
                <p className="mt-1">
                  The token exists on Monad, but no DEX pool trades it against USDC, so a wallet
                  can&apos;t buy it right now. New {target.symbol} is minted only by the issuer for
                  KYC-onboarded clients (xStocks xChange), or you can buy on a supporting exchange and
                  withdraw to Monad. Filter Markets by <span className="text-emerald-200">Tradable now</span>{" "}
                  for assets you can buy here.
                </p>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-amber-200">{error}</p>}
            {desk.data && !desk.data.configured && (
              <p className="mt-3 text-sm text-amber-200">The trading desk isn&apos;t configured on the backend yet.</p>
            )}

            <button
              type="button"
              disabled={busy || step === "submitted" || !address || !amount || numeric <= 0 || !deskConfig || insufficient || belowMin || (noLiquidity && side === "buy")}
              onClick={quote && !expired && step === "quoted" ? () => void (isSwap(quote) ? executeSwap(quote) : execute(quote)) : getQuote}
              className={cn(
                "mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-medium disabled:opacity-40",
                side === "buy" ? "bg-emerald-300 text-[#062a1c]" : "bg-rose-300 text-[#3a0a14]",
              )}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {!address
                ? "Connect MetaMask to trade"
                : step === "quoting"
                  ? dexMode ? "Finding the best route…" : "Getting a signed quote…"
                  : step === "approving"
                    ? `Approve ${side === "buy" ? "USDC" : target.symbol} in MetaMask…`
                    : step === "trading"
                      ? "Confirm the trade in MetaMask…"
                      : step === "submitted"
                        ? "Waiting for confirmation…"
                        : step === "syncing"
                        ? "Saving to your portfolio…"
                        : insufficient
                          ? `Not enough ${side === "buy" ? "USDC" : target.symbol}`
                          : belowMin
                            ? "Minimum order is $1"
                            : quote && !expired && step === "quoted"
                              ? `Retry ${side}`
                              : `${side === "buy" ? "Buy" : "Sell"} ${target.symbol}`}
            </button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-white/35">
              {dexMode
                ? `Swaps from your wallet on ${monadChain.name} through on-chain DEX liquidity. You get at least the minimum shown or the swap reverts.`
                : `Settles atomically on ${monadChain.name} through the Hyperdrive desk at the signed xStocks price. You get at least the amount shown or the transaction reverts.`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-white/45">{label}</dt>
      <dd className={cn("text-right tabular-nums", strong && "font-medium text-white")}>{value}</dd>
    </div>
  );
}
