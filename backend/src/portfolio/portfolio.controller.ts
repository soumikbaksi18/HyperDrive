import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsString } from 'class-validator';
import { getAddress, isAddress } from 'viem';
import { PortfolioService } from './portfolio.service';
import { SnapshotService } from './snapshot.service';
import { TradesService } from './trades.service';

class SyncTradeDto {
  @IsString() txHash!: string;
}

function wallet(param: string) {
  if (!isAddress(param)) throw new BadRequestException('wallet must be an address');
  return getAddress(param);
}

@Controller()
export class PortfolioController {
  constructor(
    private readonly portfolio: PortfolioService,
    private readonly trades: TradesService,
    private readonly snapshots: SnapshotService,
  ) {}

  /** Positions, cost basis, realized + unrealized PnL. `?onchain=1` also reads wallet balances. */
  @Get('portfolio/:wallet')
  get(@Param('wallet') param: string, @Query('onchain') onchain?: string) {
    return this.portfolio.get(wallet(param), { onchain: onchain === '1' || onchain === 'true' });
  }

  @Get('portfolio/:wallet/trades')
  history(@Param('wallet') param: string, @Query('limit') limit?: string) {
    const n = Math.min(Math.max(Number(limit) || 100, 1), 500);
    return this.trades.forWallet(wallet(param), n);
  }

  @Get('portfolio/:wallet/history')
  valueHistory(@Param('wallet') param: string, @Query('days') days?: string) {
    const span = Math.min(Math.max(Number(days) || 30, 1), 365);
    return this.snapshots.history(wallet(param), new Date(Date.now() - span * 86_400_000));
  }

  /** Index a desk transaction immediately instead of waiting for the poller. */
  @Post('trades/sync')
  async sync(@Body() body: SyncTradeDto) {
    const { touched, trades } = await this.trades.syncTransaction(body.txHash);
    for (const w of touched) await this.snapshots.record(w);
    return { trades };
  }
}
