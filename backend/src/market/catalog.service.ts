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
};

/** The Nasdaq-on-Monad xStocks list, shared with the frontend (frontend/data). */
@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);
  private readonly bySymbol = new Map<string, CatalogStock>();
  private readonly byAddress = new Map<string, CatalogStock>();

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
    this.logger.log(`Loaded ${this.bySymbol.size} xStocks from ${file}`);
  }

  bySymbolOrNull(symbol: string) {
    return this.bySymbol.get(symbol.trim().toUpperCase()) ?? null;
  }

  byAddressOrNull(address: string) {
    return this.byAddress.get(address.toLowerCase()) ?? null;
  }
}
