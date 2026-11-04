import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { getAddress } from 'viem';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { PortfolioSnapshot } from '../db/schemas';
import { PortfolioService } from './portfolio.service';
import { TradesService } from './trades.service';

/** Periodically records each wallet's marked value so the portfolio page can chart it. */
@Injectable()
export class SnapshotService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SnapshotService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectModel(PortfolioSnapshot.name) private readonly snapshots: Model<PortfolioSnapshot>,
    private readonly portfolio: PortfolioService,
    private readonly trades: TradesService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.snapshotIntervalMs <= 0) return;
    this.timer = setInterval(() => {
      this.recordAll().catch((error: Error) => this.logger.warn(`snapshot sweep failed: ${error.message}`));
    }, this.config.snapshotIntervalMs);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async record(wallet: string) {
    const view = await this.portfolio.get(getAddress(wallet));
    const { marketValue, costBasis, realizedPnl, unrealizedPnl, netInvested } = view.summary;
    await this.snapshots.create({
      wallet: wallet.toLowerCase(),
      at: new Date(),
      marketValue,
      costBasis,
      realizedPnl,
      unrealizedPnl,
      netInvested,
    });
  }

  async recordAll() {
    const wallets = await this.trades.distinctTraders();
    for (const wallet of wallets) {
      await this.record(wallet).catch((error: Error) =>
        this.logger.warn(`snapshot ${wallet} failed: ${error.message}`),
      );
    }
  }

  history(wallet: string, since: Date) {
    return this.snapshots
      .find({ wallet: wallet.toLowerCase(), at: { $gte: since } }, { _id: 0, __v: 0, wallet: 0 })
      .sort({ at: 1 })
      .lean();
  }
}
