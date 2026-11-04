import { Inject, Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getAddress, type Address } from 'viem';
import { APP_CONFIG, type AppConfig } from '../config/configuration';

export type CatalogStock = {
  symbol: string;
  name: string;
  underlying: string;
  logo: string;
  address: Address;
  halted: boolean;
  exchangeMic?: string;
  exchange?: string;
};

/** The Nasdaq-on-Monad xStocks list, shared with the frontend (frontend/data). */
@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);
  private readonly bySymbol = new Map<string, CatalogStock>();
  private readonly byAddress = new Map<string, CatalogStock>();
  private readonly sectors = new Map<string, string[]>();

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const file = path.resolve(process.cwd(), config.catalogPath);
    const raw = JSON.parse(readFileSync(file, 'utf8')) as {
      stocks: (Omit<CatalogStock, 'address'> & { address: string })[];
    };
    for (const row of raw.stocks) {
      const stock: CatalogStock = { ...row, address: getAddress(row.address) };
      this.bySymbol.set(stock.symbol.toUpperCase(), stock);
      this.byAddress.set(stock.address.toLowerCase(), stock);
    }
    try {
      const sectorFile = path.join(path.dirname(file), 'xstock-sectors.json');
      const map = JSON.parse(readFileSync(sectorFile, 'utf8')) as Record<string, string[]>;
      for (const [ticker, tags] of Object.entries(map)) this.sectors.set(ticker.toUpperCase(), tags);
    } catch (error) {
      this.logger.warn(`No sector map loaded: ${(error as Error).message}`);
    }
    this.logger.log(`Loaded ${this.bySymbol.size} xStocks from ${file} (${this.sectors.size} sector-tagged)`);
  }

  bySymbolOrNull(symbol: string) {
    return this.bySymbol.get(symbol.trim().toUpperCase()) ?? null;
  }

  byAddressOrNull(address: string) {
    return this.byAddress.get(address.toLowerCase()) ?? null;
  }

  /** Curated sector tags for an underlying ticker (frontend/data/xstock-sectors.json). */
  sectorsFor(underlying: string): string[] {
    return this.sectors.get(underlying.toUpperCase()) ?? ['Other'];
  }

  allStocks(): CatalogStock[] {
    return [...this.bySymbol.values()];
  }
}
