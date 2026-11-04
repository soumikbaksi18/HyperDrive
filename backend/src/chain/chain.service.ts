import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  createPublicClient,
  defineChain,
  erc20Abi,
  http,
  type Address,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { monad } from 'viem/chains';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { hyperdriveDeskAbi } from './desk-abi';

/** Read access to Monad plus the quote signer key. */
@Injectable()
export class ChainService {
  readonly client: PublicClient;
  readonly signer: PrivateKeyAccount | null;
  private feeCache: { bps: number; at: number } | null = null;
  private decimalsCache = new Map<string, number>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    const chain =
      config.chainId === monad.id
        ? monad
        : defineChain({
            id: config.chainId,
            name: `chain-${config.chainId}`,
            nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
            rpcUrls: { default: { http: [config.rpcUrl] } },
          });
    this.client = createPublicClient({ chain, transport: http(config.rpcUrl) }) as PublicClient;
    this.signer = config.quoteSignerKey ? privateKeyToAccount(config.quoteSignerKey) : null;
  }

  get chainId() {
    return this.config.chainId;
  }

  get desk(): Address | null {
    return this.config.deskAddress;
  }

  requireDesk(): Address {
    if (!this.config.deskAddress) {
      throw new ServiceUnavailableException('Trading desk is not configured (DESK_ADDRESS).');
    }
    return this.config.deskAddress;
  }

  requireSigner(): PrivateKeyAccount {
    if (!this.signer) {
      throw new ServiceUnavailableException('Quote signer is not configured (QUOTE_SIGNER_PRIVATE_KEY).');
    }
    return this.signer;
  }

  async feeBps(fresh = false): Promise<number> {
    if (!fresh && this.feeCache && Date.now() - this.feeCache.at < 60_000) return this.feeCache.bps;
    const bps = await this.client.readContract({
      address: this.requireDesk(),
      abi: hyperdriveDeskAbi,
      functionName: 'feeBps',
    });
    this.feeCache = { bps: Number(bps), at: Date.now() };
    return this.feeCache.bps;
  }

  /** Decimals as the desk recorded them at listing; 0 listed=false means the desk won't trade it. */
  async listing(token: Address): Promise<{ listed: boolean; decimals: number }> {
    const [listed, decimals] = await this.client.readContract({
      address: this.requireDesk(),
      abi: hyperdriveDeskAbi,
      functionName: 'listings',
      args: [token],
    });
    if (listed) this.decimalsCache.set(token.toLowerCase(), decimals);
    return { listed, decimals };
  }

  /** xStocks are 18 decimals on Monad; cached after the first listing read. */
  tokenDecimals(token: string): number {
    return this.decimalsCache.get(token.toLowerCase()) ?? 18;
  }

  async balanceOf(token: Address, owner: Address): Promise<bigint> {
    return this.client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner],
    });
  }

  async quoteSignerOnChain(): Promise<Address> {
    return this.client.readContract({
      address: this.requireDesk(),
      abi: hyperdriveDeskAbi,
      functionName: 'quoteSigner',
    });
  }

  async usdcAddress(): Promise<Address> {
    return this.client.readContract({
      address: this.requireDesk(),
      abi: hyperdriveDeskAbi,
      functionName: 'usdc',
    });
  }
}
