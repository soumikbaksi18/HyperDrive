import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IndexerState, IndexerStateSchema, PortfolioSnapshot, PortfolioSnapshotSchema, Trade, TradeSchema } from '../db/schemas';
import { QuotesModule } from '../quotes/quotes.module';
import { IndexerService } from './indexer.service';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { SnapshotService } from './snapshot.service';
import { TradesService } from './trades.service';

@Module({
  imports: [
    QuotesModule,
    MongooseModule.forFeature([
      { name: Trade.name, schema: TradeSchema },
      { name: IndexerState.name, schema: IndexerStateSchema },
      { name: PortfolioSnapshot.name, schema: PortfolioSnapshotSchema },
    ]),
  ],
  controllers: [PortfolioController],
  providers: [TradesService, PortfolioService, SnapshotService, IndexerService],
  exports: [IndexerService],
})
export class PortfolioModule {}
