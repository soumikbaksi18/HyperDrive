"use client";

import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    TradingView?: { widget: new (options: Record<string, unknown>) => unknown };
  }
}

const SCRIPT_SRC = "https://s3.tradingview.com/tv.js";
const INDICATOR_STUDIES: Record<string, string> = {
  RSI: "RSI@tv-basicstudies",
  MACD: "MACD@tv-basicstudies",
  BB: "BB@tv-basicstudies",
  EMA: "MAExp@tv-basicstudies",
  SMA: "MASimple@tv-basicstudies",
  VWAP: "VWAP@tv-basicstudies",
  ATR: "ATR@tv-basicstudies",
  OBV: "OBV@tv-basicstudies",
};
export const INDICATORS = Object.keys(INDICATOR_STUDIES);

function loadScript(): Promise<void> {
  if (window.TradingView) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      const poll = window.setInterval(() => {
        if (window.TradingView) {
          window.clearInterval(poll);
          resolve();
        }
      }, 100);
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("TradingView script failed to load"));
    document.head.appendChild(script);
  });
}

/**
 * TradingView Advanced Chart embed (ported from arcgenesis), pointed at the Nasdaq
 * underlying of an xStock, e.g. NASDAQ:NVDA. Dark theme with a transparent background so the
 * purple shell shows through.
 */
export function TradingViewChart({
  symbol,
  interval = "D",
  indicators = [],
  className,
}: {
  symbol: string;
  interval?: string;
  indicators?: string[];
  className?: string;
}) {
  const containerId = `tv-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const ref = useRef<HTMLDivElement>(null);
  const studiesKey = indicators.join(",");

  useEffect(() => {
    let cancelled = false;
    const node = ref.current;
    void loadScript()
      .then(() => {
        if (cancelled || !node || !window.TradingView) return;
        node.innerHTML = "";
        const studies = studiesKey
          .split(",")
          .filter(Boolean)
          .map((k) => INDICATOR_STUDIES[k])
          .filter(Boolean);
        new window.TradingView.widget({
          autosize: true,
          symbol,
          interval,
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#0c0716",
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_side_toolbar: false,
          hide_legend: false,
          save_image: false,
          allow_symbol_change: false,
          withdateranges: true,
          details: false,
          container_id: containerId,
          backgroundColor: "rgba(12, 7, 22, 0)",
          gridColor: "rgba(167, 139, 250, 0.08)",
          studies: studies.length ? studies : undefined,
          overrides: {
            "mainSeriesProperties.candleStyle.upColor": "#6ee7b7",
            "mainSeriesProperties.candleStyle.downColor": "#fda4af",
            "mainSeriesProperties.candleStyle.borderUpColor": "#6ee7b7",
            "mainSeriesProperties.candleStyle.borderDownColor": "#fda4af",
            "mainSeriesProperties.candleStyle.wickUpColor": "#6ee7b7",
            "mainSeriesProperties.candleStyle.wickDownColor": "#fda4af",
            "paneProperties.background": "#0c0716",
            "paneProperties.backgroundType": "solid",
          },
        });
      })
      .catch(() => null);
    return () => {
      cancelled = true;
      if (node) node.innerHTML = "";
    };
  }, [symbol, interval, studiesKey, containerId]);

  return (
    <div className={className}>
      <div id={containerId} ref={ref} className="tradingview-widget-container h-full w-full" />
    </div>
  );
}
