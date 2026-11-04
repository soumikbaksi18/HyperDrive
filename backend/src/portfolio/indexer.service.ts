import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { getAbiItem } from 'viem';
import { ChainService } from '../chain/chain.service';
import { hyperdriveDeskAbi } from '../chain/desk-abi';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { IndexerState } from '../db/schemas';
import { SnapshotService } from './snapshot.service';
import { TradesService } from './trades.service';

const TRADE_EVENT = getAbiItem({ abi: hyperdriveDeskAbi, name: 'Trade' });
/** Upper bound on block ranges per tick, so one tick can't run for minutes while catching up. */
const MAX_CHUNKS_PER_TICK = 25;

/**
 * Polls the desk's `Trade` logs from the last stored block to the chain head and saves them.
 * The cursor lives in Mongo, so a restart resumes where it stopped and nothing is skipped.
 */
@Injectable()
export class IndexerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(IndexerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastError: string | null = null;
  private lastBlock: number | null = null;
  private headBlock: number | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectModel(IndexerState.name) private readonly state: Model<IndexerState>,
    private readonly chain: ChainService,
    private readonly trades: TradesService,
    private readonly snapshots: SnapshotService,
  ) {}

  onApplicationBootstrap() {
    if (!this.config.indexerEnabled) return this.logger.log('Indexer disabled (INDEXER_ENABLED=false)');
    if (!this.chain.desk) return this.logger.warn('Indexer idle: DESK_ADDRESS is not set');
    this.logger.log(`Indexing Trade events from ${this.chain.desk} every ${this.config.indexerPollMs}ms`);
    this.timer = setInterval(() => void this.tick(), this.config.indexerPollMs);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  status() {
    return {
      enabled: this.config.indexerEnabled && Boolean(this.chain.desk),
      lastBlock: this.lastBlock,
      headBlock: this.headBlock,
      lag: this.lastBlock != null && this.headBlock != null ? this.headBlock - this.lastBlock : null,
      lastError: this.lastError,
    };
  }

  private async cursorInvalid(lastBlock: number, hash: string | undefined, head: number) {
    if (lastBlock > head) return true;
    if (!hash) return false;
    const block = await this.chain.client.getBlock({ blockNumber: BigInt(lastBlock) }).catch(() => null);
    return !block || block.hash !== hash;
  }

  private get key() {
    return `trades:${this.chain.chainId}:${this.chain.desk?.toLowerCase()}`;
  }

  async tick() {
    if (this.running || !this.chain.desk) return;
    this.running = true;
    try {
      const head = Number(await this.chain.client.getBlockNumber());
      this.headBlock = head;
      const deployBlock = Number(this.config.deskDeployBlock);
      let saved = await this.state.findOne({ key: this.key }).lean();

      // Chain reset (local sandbox restarted) or reorg past the cursor: start over cleanly.
      if (saved && (await this.cursorInvalid(saved.lastBlock, saved.lastBlockHash, head))) {
        const purged = await this.trades.purgeDesk(this.chain.desk);
        await this.state.deleteOne({ key: this.key });
        this.logger.warn(`Chain no longer matches indexer cursor at block ${saved.lastBlock}; purged ${purged} trades and re-indexing`);
        saved = null;
      }

      // Re-scan a trailing window each tick: a lagging RPC node may have returned no logs for the
      // newest blocks last time. Ingest is idempotent, so overlap is harmless.
      let from = saved
        ? Math.max(deployBlock, saved.lastBlock + 1 - this.config.indexerRewindBlocks)
        : deployBlock;
      const touched = new Set<string>();

      for (let chunk = 0; chunk < MAX_CHUNKS_PER_TICK && from <= head; chunk++) {
        const to = Math.min(from + this.config.indexerBlockRange - 1, head);
        const logs = await this.chain.client.getLogs({
          address: this.chain.desk,
          event: TRADE_EVENT,
          fromBlock: BigInt(from),
          toBlock: BigInt(to),
        });
        if (logs.length) for (const w of await this.trades.ingest(logs)) touched.add(w);
        // Only advance the cursor (re-scanned blocks are behind it), always storing a block with its own hash.
        if (to > (saved?.lastBlock ?? -1)) {
          const block = await this.chain.client.getBlock({ blockNumber: BigInt(to) });
          await this.state.updateOne(
            { key: this.key },
            { $set: { lastBlock: to, lastBlockHash: block.hash } },
            { upsert: true },
          );
          this.lastBlock = to;
        }
        from = to + 1;
      }

      for (const wallet of touched) await this.snapshots.record(wallet);
      this.lastError = null;
    } catch (error) {
      this.lastError = (error as Error).message.split('\n')[0];
      this.logger.warn(`Indexer tick failed: ${this.lastError}`);
    } finally {
      this.running = false;
    }
  }
}
