import { Controller, Get, Param, Query } from '@nestjs/common';
import { HistoryService } from './history.service';

@Controller('market')
export class MarketController {
  constructor(private readonly history: HistoryService) {}

  /** Candles + technicals for an underlying ticker (NVDA, TSLA, SPY…). */
  @Get('history/:underlying')
  getHistory(@Param('underlying') underlying: string, @Query('range') range?: string, @Query('interval') interval?: string) {
    return this.history.get(underlying, range, interval);
  }
}
