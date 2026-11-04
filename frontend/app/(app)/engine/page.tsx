import type { Metadata } from "next";
import { TradingEngineView } from "@/components/engine/trading-engine-view";

export const metadata: Metadata = {
  title: "Trading engine",
};

export default function TradingEnginePage() {
  return <TradingEngineView />;
}
