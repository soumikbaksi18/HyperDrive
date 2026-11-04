import catalog from "@/data/monad-xstocks.json";
import sectorMap from "@/data/xstock-sectors.json";

export type NasdaqXStock = {
  symbol: string;
  name: string;
  underlying: string;
  logo: string;
  address: string;
  halted: boolean;
  period: string | null;
  openNow: boolean;
  /** Listing venue of the underlying (MIC + display name), e.g. XNAS / Nasdaq. */
  exchangeMic: string;
  exchange: string;
};

/** Every xStock with a Monad deployment (all exchanges), from the public xStocks asset list. */
export type NasdaqCatalog = {
  source: string;
  network: string;
  chainId: number;
  fetchedAt: string;
  count: number;
  stocks: NasdaqXStock[];
};

export const nasdaqCatalog = catalog as NasdaqCatalog;
/** Clearer alias: the catalog now spans every exchange, not just Nasdaq. */
export const xstocksCatalog = nasdaqCatalog;

/** Exchange filter options: the larger venues by name, the long tail grouped as "Other". */
const MAIN_EXCHANGES = ["Nasdaq", "NYSE", "NYSE Arca", "London", "Hong Kong", "Xetra", "Paris"] as const;
export type ExchangeGroup = (typeof MAIN_EXCHANGES)[number] | "Other";
export const EXCHANGE_GROUPS: ExchangeGroup[] = [...MAIN_EXCHANGES, "Other"];

export function exchangeGroup(stock: NasdaqXStock): ExchangeGroup {
  return (MAIN_EXCHANGES as readonly string[]).includes(stock.exchange)
    ? (stock.exchange as ExchangeGroup)
    : "Other";
}

export function isExchangeGroup(value: string | null): value is ExchangeGroup {
  return value != null && (EXCHANGE_GROUPS as readonly string[]).includes(value);
}

export const exchangeCounts: Record<ExchangeGroup, number> = Object.fromEntries(
  EXCHANGE_GROUPS.map((group) => [group, nasdaqCatalog.stocks.filter((s) => exchangeGroup(s) === group).length]),
) as Record<ExchangeGroup, number>;

const allowedSymbols = new Set(
  nasdaqCatalog.stocks.map((stock) => stock.symbol.toUpperCase()),
);

export function isCatalogSymbol(symbol: string) {
  return allowedSymbols.has(symbol.toUpperCase());
}

/** Sector filter options. AI overlaps Tech; "Other" holds names outside the eight sectors. */
export const SECTORS = [
  "Tech",
  "AI",
  "Healthcare",
  "Energy",
  "Financial",
  "Real Estate",
  "Commodities",
  "Consumer",
  "Other",
] as const;

export type Sector = (typeof SECTORS)[number];

const sectorsByUnderlying = sectorMap as Record<string, Sector[]>;

/** Curated sector tags for an underlying Nasdaq ticker (data/xstock-sectors.json). */
export function sectorsFor(underlying: string): Sector[] {
  return sectorsByUnderlying[underlying.toUpperCase()] ?? ["Other"];
}

export function isSector(value: string | null): value is Sector {
  return value != null && (SECTORS as readonly string[]).includes(value);
}

/** Catalog stock count per sector, for the dropdown badges. */
export const sectorCounts: Record<Sector, number> = Object.fromEntries(
  SECTORS.map((sector) => [
    sector,
    nasdaqCatalog.stocks.filter((stock) => sectorsFor(stock.underlying).includes(sector)).length,
  ]),
) as Record<Sector, number>;
