"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ProviderNotFoundError,
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { ChevronDown, LogOut, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { shortAddress } from "@/lib/format";
import { monadChain } from "@/lib/wagmi";

type ConnectWalletButtonProps = {
  className?: string;
  compact?: boolean;
};

function walletErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not connect.";
  if (/user rejected|user denied|connection request reset/i.test(message)) {
    return null;
  }
  if (error instanceof ProviderNotFoundError || /provider not found/i.test(message)) {
    return "Install the MetaMask extension, then reload this page.";
  }
  if (/already pending|wallet_requestPermissions/i.test(message)) {
    return "MetaMask already has a request open. Approve or reject it, then try again.";
  }
  return message.length > 180 ? `${message.slice(0, 180)}…` : message;
}

export function ConnectWalletButton({
  className,
  compact = false,
}: ConnectWalletButtonProps) {
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onMonad = chainId === monadChain.id;
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const connectMetaMask = async () => {
    setError(null);
    const connector =
      connectors.find((item) => item.id === "metaMask") ??
      connectors.find((item) => item.name.toLowerCase().includes("metamask")) ??
      connectors[0];

    if (!connector) {
      setError("MetaMask connector is missing from the app config.");
      setOpen(true);
      return;
    }

    try {
      await connectAsync({ connector, chainId: monadChain.id });
      setOpen(false);
    } catch (err) {
      const message = walletErrorMessage(err);
      if (message) {
        setError(message);
        setOpen(true);
      }
    }
  };

  const switchToMonad = async () => {
    setError(null);
    try {
      await switchChainAsync({ chainId: monadChain.id });
    } catch (err) {
      const message = walletErrorMessage(err);
      if (message) setError(message);
    }
  };

  if (!mounted) {
    return (
      <span
        className={cn(
          "inline-flex h-10 items-center rounded-full bg-white/10 px-4 text-sm text-white/70",
          className,
        )}
      >
        Connect MetaMask
      </span>
    );
  }

  if (isConnected && address) {
    return (
      <div ref={panelRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "inline-flex h-10 max-w-[16rem] items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 text-sm text-white backdrop-blur-md transition hover:bg-white/15",
            className,
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              onMonad ? "bg-emerald-300" : "bg-amber-300",
            )}
          />
          <span className="truncate font-mono text-xs">
            {shortAddress(address)}
          </span>
          {!compact && (
            <span className="hidden text-xs text-white/60 sm:inline">
              {onMonad ? "Monad" : "Wrong network"}
            </span>
          )}
          <ChevronDown className="size-3.5 opacity-70" />
        </button>
        {open && (
          <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-white/10 bg-[#160c28]/95 p-3 text-left shadow-2xl backdrop-blur-xl">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
              MetaMask
            </p>
            <p className="mt-2 break-all font-mono text-xs text-white/80">{address}</p>
            <p className="mt-2 text-xs text-white/55">
              {onMonad
                ? `Connected on ${monadChain.name} · chain ${monadChain.id}`
                : `Switch to ${monadChain.name} before you trade xStocks.`}
            </p>
            {error && <p className="mt-2 text-xs text-amber-200">{error}</p>}
            {!onMonad && (
              <button
                type="button"
                onClick={switchToMonad}
                disabled={isSwitching}
                className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-sm font-medium text-[#2a1458] disabled:opacity-60"
              >
                {isSwitching ? "Switching…" : "Switch to Monad"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-200 hover:bg-white/5"
            >
              <LogOut className="size-3.5" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={connectMetaMask}
        disabled={isPending}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/15 disabled:opacity-60",
          className,
        )}
      >
        <Wallet className="size-4" />
        {isPending ? "Connecting…" : "Connect MetaMask"}
      </button>
      {error && open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-amber-200/20 bg-[#160c28] p-3 text-left text-xs leading-relaxed text-amber-100 shadow-2xl">
          {error}{" "}
          {/install/i.test(error) && (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Get MetaMask
            </a>
          )}
        </div>
      )}
    </div>
  );
}
