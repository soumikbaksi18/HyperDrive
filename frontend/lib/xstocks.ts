import catalog from "@/data/nasdaq-monad-xstocks.json";

export type NasdaqXStock = {
  symbol: string;
  name: string;
  underlying: string;
  logo: string;
  address: string;
  halted: boolean;
  period: string | null;
  openNow: boolean;
};

export type NasdaqCatalog = {
  source: string;
  network: string;
  chainId: number;
  exchangeMic: string;
  exchange: string;
  fetchedAt: string;
  count: number;
  stocks: NasdaqXStock[];
};

export const nasdaqCatalog = catalog as NasdaqCatalog;

const allowedSymbols = new Set(
  nasdaqCatalog.stocks.map((stock) => stock.symbol.toUpperCase()),
);

export function isCatalogSymbol(symbol: string) {
  return allowedSymbols.has(symbol.toUpperCase());
}
