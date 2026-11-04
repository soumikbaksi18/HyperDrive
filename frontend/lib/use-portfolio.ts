"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { fetchHistory, fetchPortfolio, fetchTrades } from "@/lib/api";

export const portfolioKeys = {
  all: (wallet?: string) => ["portfolio", wallet?.toLowerCase()] as const,
};

/** Positions + PnL for the connected wallet, refreshed every 30s (prices move). */
export function usePortfolio() {
  const { address } = useAccount();
  return useQuery({
    queryKey: [...portfolioKeys.all(address), "summary"],
    queryFn: () => fetchPortfolio(address!),
    enabled: Boolean(address),
    refetchInterval: 30_000,
  });
}

export function useTrades(limit = 100) {
  const { address } = useAccount();
  return useQuery({
    queryKey: [...portfolioKeys.all(address), "trades", limit],
    queryFn: () => fetchTrades(address!, limit),
    enabled: Boolean(address),
    refetchInterval: 30_000,
  });
}

export function useValueHistory(days = 30) {
  const { address } = useAccount();
  return useQuery({
    queryKey: [...portfolioKeys.all(address), "history", days],
    queryFn: () => fetchHistory(address!, days),
    enabled: Boolean(address),
    refetchInterval: 60_000,
  });
}
