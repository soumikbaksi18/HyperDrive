import { Controller, Get, Inject } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { ChainService } from '../chain/chain.service';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { IndexerService } from '../portfolio/indexer.service';

const MONGO_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

@Controller()
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly chain: ChainService,
    private readonly indexer: IndexerService,
  ) {}

  @Get('health')
  check() {
    return {
      status: 'ok',
      service: 'hyperdrive-backend',
      timestamp: new Date().toISOString(),
      mongo: MONGO_STATES[this.mongo.readyState] ?? 'unknown',
      chainId: this.chain.chainId,
      desk: this.chain.desk,
      quoteSigner: this.chain.signer?.address ?? null,
      indexer: this.indexer.status(),
    };
  }

  /** Public desk config the frontend needs before it has a quote (USDC balance, allowance). */
  @Get('desk')
  async desk() {
    if (!this.chain.desk) {
      // No desk deployed: on Monad mainnet trades route through the DEX aggregator instead.
      if (this.chain.chainId === 143) {
        return { configured: true, mode: 'dex', chainId: 143, usdc: this.config.usdcAddress, feeBps: 0 };
      }
      return { configured: false, chainId: this.chain.chainId };
    }
    const [usdc, feeBps] = await Promise.all([this.chain.usdcAddress(), this.chain.feeBps()]);
    return { configured: true, mode: 'desk', chainId: this.chain.chainId, desk: this.chain.desk, usdc, feeBps };
  }
}
