import { Global, Module } from '@nestjs/common';
import { ChainService } from './chain/chain.service';
import { APP_CONFIG, loadConfig } from './config/configuration';
import { CatalogService } from './market/catalog.service';
import { HistoryService } from './market/history.service';
import { MarketController } from './market/market.controller';
import { PricesService } from './market/prices.service';

@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: loadConfig },
    ChainService,
    CatalogService,
    PricesService,
    HistoryService,
  ],
  controllers: [MarketController],
  exports: [APP_CONFIG, ChainService, CatalogService, PricesService, HistoryService],
})
export class CoreModule {}
