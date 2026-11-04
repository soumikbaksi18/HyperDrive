import type { Metadata } from "next";
import { Suspense } from "react";
import { InsightsView } from "@/components/insights/insights-view";

export const metadata: Metadata = {
  title: "Insights",
  description: "Nasdaq and xStock headlines with sentiment analysis for Hyperdrive traders.",
};

export default function InsightsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-violet-200/60">
          Loading market intelligence…
        </div>
      }
    >
      <InsightsView />
    </Suspense>
  );
}
