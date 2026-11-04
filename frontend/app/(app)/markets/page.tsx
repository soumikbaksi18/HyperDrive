import { Suspense } from "react";
import type { Metadata } from "next";
import { MarketsBoard } from "@/components/markets/markets-board";

export const metadata: Metadata = {
  title: "Markets",
};

export default function MarketsPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-10 text-sm text-white/50">Loading Nasdaq xStocks…</div>
      }
    >
      <MarketsBoard />
    </Suspense>
  );
}
