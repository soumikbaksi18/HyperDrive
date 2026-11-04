import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hyperdrive",
    short_name: "Hyperdrive",
    description: "AI baskets for Nasdaq xStocks on Monad.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0716",
    theme_color: "#6d28d9",
  };
}
