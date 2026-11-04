import { Suspense } from "react";
import type { Metadata } from "next";
import { PortfolioView } from "@/components/portfolio/portfolio-view";

export const metadata: Metadata = {
  title: "Portfolio",
};

export default function PortfolioPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-10 text-sm text-white/50">Loading portfolio…</div>
      }
    >
      <PortfolioView />
    </Suspense>
  );
}
