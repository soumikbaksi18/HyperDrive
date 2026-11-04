# xStocks.fi Integration Plan

## Overview

[xStocks.fi](https://xstocks.fi) provides tokenized US equities and ETFs backed 1:1 by underlying assets. This integration enables users to:
- Discover tokenized stocks on Monad blockchain
- View AI recommendations for stocks available as xStocks
- Potentially execute trades through xStocks partners
- Track tokenized equity portfolios onchain

## Key xStocks Features

- **1,393+ Tokenized Assets**: US stocks and ETFs
- **$43B+ Transaction Volume**: Proven liquidity
- **24/7 Trading**: Unlike traditional markets
- **1:1 Asset Backed**: Each token backed by real equity
- **Multi-Chain**: Ethereum, Solana, **Monad**, BSC, Arbitrum, Optimism, TON, Tron, and more
- **Fractional**: Purchase from $1
- **Permissionless**: Freely transferable
- **110+ Countries**: Global access (excluding US, UK, CA, AU)

## Integration Architecture

```
┌──────────────────────────────────────────────────────────┐
│           HyperDrive Stock Intelligence                   │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  AI Recommendation Engine                          │ │
│  │  (Analyzes all NASDAQ stocks)                      │ │
│  └───────────────────┬────────────────────────────────┘ │
│                      │                                    │
│                      ↓                                    │
│  ┌────────────────────────────────────────────────────┐ │
│  │  xStocks Availability Check                        │ │
│  │  • Query xStocks API for token availability        │ │
│  │  • Match NASDAQ symbols with xStocks tokens        │ │
│  │  • Get contract addresses on Monad                 │ │
│  └───────────────────┬────────────────────────────────┘ │
│                      │                                    │
│                      ↓                                    │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Enhanced Recommendations                          │ │
│  │  • Mark stocks available as xStocks               │ │
│  │  • Show 24/7 trading availability                 │ │
│  │  • Display fractional purchase option             │ │
│  │  • Link to xStocks trading venues                 │ │
│  └───────────────────┬────────────────────────────────┘ │
│                      │                                    │
│                      ↓                                    │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Wallet Integration (Monad)                        │ │
│  │  • Connect wallet via Wagmi                       │ │
│  │  • View xStocks token balances                    │ │
│  │  • Track portfolio on Monad                       │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────────┐
│              xStocks Partner Ecosystem                    │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Kraken   │  │ ByBit    │  │ Jupiter  │  │ Alpaca  │ │
│  │ (CEX)    │  │ (CEX)    │  │ (DEX)    │  │ (API)   │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Data Integration (Week 2)

#### 1.1 xStocks API Research
- [ ] Investigate xStocks API endpoints (if public)
- [ ] Determine authentication requirements
- [ ] Identify rate limits
- [ ] Document available data fields

#### 1.2 Token Registry Database Schema

```prisma
model XStockToken {
  id              String   @id @default(cuid())
  
  // Stock identification
  stockId         String
  stock           Stock    @relation(fields: [stockId], references: [id])
  symbol          String   // e.g., "AAPL"
  
  // xStocks metadata
  tokenSymbol     String   // e.g., "xAAPL"
  tokenName       String   // e.g., "xStocks Apple Inc."
  
  // Multi-chain support
  chains          XStockChain[]
  
  // Trading info
  isActive        Boolean  @default(true)
  tradingVolume24h Float?
  fractionalMin   Float    @default(1.0) // Minimum purchase $1
  
  // Metadata
  xStocksUrl      String?
  lastVerified    DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([symbol])
  @@index([symbol, isActive])
}

model XStockChain {
  id              String   @id @default(cuid())
  
  xStockTokenId   String
  xStockToken     XStockToken @relation(fields: [xStockTokenId], references: [id])
  
  // Chain info
  chainId         Int      // e.g., 143 for Monad Mainnet
  chainName       String   // e.g., "Monad"
  
  // Contract details
  tokenAddress    String   // 0x... contract address
  decimals        Int      @default(18)
  
  // Liquidity info
  dexPools        Json?    // Array of DEX pool addresses
  liquidityUsd    Float?
  
  // Verification
  verified        Boolean  @default(false)
  verifiedAt      DateTime?
  
  @@unique([xStockTokenId, chainId])
  @@index([chainId, tokenAddress])
}
```

#### 1.3 xStocks Data Service

```typescript
// backend/src/modules/xstocks/xstocks.service.ts
@Injectable()
export class XStocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Fetch all available xStocks tokens
   * This may require scraping or API access
   */
  async fetchAvailableXStocks(): Promise<XStockToken[]> {
    // TODO: Implement based on xStocks API/data source
    // For now, we can manually curate top tokens
    return this.prisma.xStockToken.findMany({
      where: { isActive: true },
      include: { chains: true },
    });
  }

  /**
   * Check if a stock symbol is available as xStock
   */
  async isAvailableAsXStock(symbol: string): Promise<boolean> {
    const xStock = await this.prisma.xStockToken.findUnique({
      where: { symbol },
    });
    return !!xStock && xStock.isActive;
  }

  /**
   * Get xStock token details for Monad chain
   */
  async getMonadTokenDetails(symbol: string): Promise<XStockChain | null> {
    const xStock = await this.prisma.xStockToken.findUnique({
      where: { symbol },
      include: {
        chains: {
          where: {
            OR: [
              { chainId: 143 },   // Monad Mainnet
              { chainId: 10143 }, // Monad Testnet
            ],
          },
        },
      },
    });

    return xStock?.chains[0] || null;
  }

  /**
   * Enrich stock recommendation with xStocks availability
   */
  async enrichRecommendation(
    recommendation: StockRecommendation,
  ): Promise<EnrichedRecommendation> {
    const xStockAvailable = await this.isAvailableAsXStock(
      recommendation.symbol,
    );

    let xStockDetails = null;
    if (xStockAvailable) {
      xStockDetails = await this.getMonadTokenDetails(recommendation.symbol);
    }

    return {
      ...recommendation,
      xStocks: {
        available: xStockAvailable,
        monadDetails: xStockDetails,
        benefits: xStockAvailable
          ? [
              '24/7 trading availability',
              'Fractional purchases from $1',
              'Onchain transparency',
              'Permissionless transfers',
            ]
          : null,
      },
    };
  }
}
```

### Phase 2: Frontend Integration (Week 5-6)

#### 2.1 xStocks Badge Component

```tsx
// frontend/components/stocks/XStocksBadge.tsx
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';

interface XStocksBadgeProps {
  available: boolean;
  symbol?: string;
}

export function XStocksBadge({ available, symbol }: XStocksBadgeProps) {
  if (!available) return null;

  return (
    <Tooltip content="Available as tokenized equity on Monad via xStocks.fi">
      <Badge variant="secondary" className="bg-violet-500/20 text-violet-300">
        <span className="mr-1">⚡</span>
        xStocks
      </Badge>
    </Tooltip>
  );
}
```

#### 2.2 Enhanced Stock Card

```tsx
// frontend/components/stocks/StockCard.tsx
export function StockCard({ stock, recommendation }: StockCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{stock.symbol}</h3>
          <p className="text-sm text-zinc-400">{stock.companyName}</p>
        </div>
        
        <div className="flex gap-2">
          <RecommendationBadge type={recommendation.type} />
          <XStocksBadge 
            available={recommendation.xStocks?.available} 
            symbol={stock.symbol}
          />
        </div>
      </div>

      {recommendation.xStocks?.available && (
        <div className="mt-4 rounded-lg bg-violet-950/30 p-3 border border-violet-800/30">
          <p className="text-xs font-medium text-violet-300 mb-2">
            Tokenized Trading Available
          </p>
          <ul className="text-xs text-zinc-400 space-y-1">
            {recommendation.xStocks.benefits?.map((benefit, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-violet-400">•</span>
                {benefit}
              </li>
            ))}
          </ul>
          <a
            href={`https://xstocks.fi/stock/${stock.symbol}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-xs text-violet-400 hover:text-violet-300"
          >
            View on xStocks.fi →
          </a>
        </div>
      )}

      {/* Rest of stock card content */}
    </div>
  );
}
```

#### 2.3 Monad Wallet Integration

```tsx
// frontend/components/wallet/MonadWallet.tsx
'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { monadTestnet, monadMainnet } from '@/lib/chains';

export function MonadWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h3 className="font-semibold mb-4">Monad Wallet</h3>
      
      {!isConnected ? (
        <button
          onClick={() => connect({ connector: connectors[0] })}
          className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500"
        >
          Connect Wallet
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg bg-zinc-950 p-3">
            <p className="text-xs text-zinc-500 mb-1">Connected Address</p>
            <p className="font-mono text-xs text-zinc-300">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
          
          <XStocksPortfolio address={address} />
          
          <button
            onClick={() => disconnect()}
            className="w-full rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
```

#### 2.4 xStocks Portfolio Viewer

```tsx
// frontend/components/wallet/XStocksPortfolio.tsx
'use client';

import { useXStocksBalance } from '@/lib/hooks/useXStocksBalance';

export function XStocksPortfolio({ address }: { address: string }) {
  const { balances, isLoading } = useXStocksBalance(address);

  if (isLoading) return <div>Loading portfolio...</div>;

  if (!balances || balances.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-zinc-500">
        No xStocks holdings found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-zinc-400">xStocks Holdings</h4>
      {balances.map((holding) => (
        <div
          key={holding.symbol}
          className="flex items-center justify-between rounded-lg bg-zinc-950 p-3"
        >
          <div>
            <p className="font-medium text-sm">{holding.symbol}</p>
            <p className="text-xs text-zinc-500">{holding.balance} tokens</p>
          </div>
          <div className="text-right">
            <p className="font-medium text-sm">${holding.value.toFixed(2)}</p>
            <p className="text-xs text-zinc-500">
              ${holding.price.toFixed(2)}/token
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Phase 3: Enhanced Features (Week 7-8)

#### 3.1 xStocks Filter in Recommendations

```tsx
// Add filter option to only show stocks available as xStocks
<FilterBar>
  <Checkbox
    id="xstocks-only"
    label="Show only xStocks available tokens"
    checked={filters.xStocksOnly}
    onChange={(checked) => setFilters({ ...filters, xStocksOnly: checked })}
  />
</FilterBar>
```

#### 3.2 Trading Links

```tsx
// Link to xStocks partner exchanges
<div className="grid grid-cols-2 gap-3 mt-4">
  <a
    href={`https://www.kraken.com/trade/x${symbol}-usd`}
    className="rounded-lg border border-zinc-700 p-3 text-center hover:bg-zinc-800"
  >
    <p className="text-sm font-medium">Trade on Kraken</p>
  </a>
  <a
    href={`https://www.bybit.com/trade/x${symbol}`}
    className="rounded-lg border border-zinc-700 p-3 text-center hover:bg-zinc-800"
  >
    <p className="text-sm font-medium">Trade on ByBit</p>
  </a>
</div>
```

#### 3.3 24/7 Trading Status

```tsx
// Show that xStocks trade 24/7 unlike traditional markets
<div className="flex items-center gap-2 text-sm">
  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
  <span className="text-zinc-400">24/7 Trading Active</span>
</div>
```

## Integration Checklist

### Backend
- [ ] Create xStocks module and service
- [ ] Add database schema for xStock tokens
- [ ] Implement xStocks availability check
- [ ] Enrich recommendations with xStocks data
- [ ] Add API endpoints for xStocks data
- [ ] Create job to sync xStocks availability

### Frontend
- [ ] Add xStocks badge component
- [ ] Integrate Wagmi for Monad wallet
- [ ] Create xStocks portfolio viewer
- [ ] Add xStocks filter to recommendations
- [ ] Display 24/7 trading status
- [ ] Link to partner exchanges

### Data
- [ ] Manually curate top 100 xStocks tokens
- [ ] Verify Monad contract addresses
- [ ] Set up monitoring for new xStocks
- [ ] Track xStocks trading volumes

## Benefits of Integration

1. **Unique Value Proposition**: Only platform combining AI stock analysis with tokenized equity access
2. **24/7 Trading**: Users can act on recommendations anytime
3. **Fractional Access**: Lower barrier to entry ($1 minimum)
4. **Onchain Transparency**: Verifiable holdings and transactions
5. **Global Access**: Available in 110+ countries
6. **Monad Native**: Leverages existing blockchain integration

## Risk Considerations

1. **Geographic Restrictions**: xStocks not available in US, UK, CA, AU
2. **Regulatory Compliance**: Users responsible for local regulations
3. **Liquidity**: Not all xStocks may have deep liquidity
4. **Price Differences**: Tokenized prices may diverge from traditional markets
5. **Smart Contract Risk**: Users must understand onchain risks

## Disclaimers Required

```
⚠️ xStocks Trading Notice:
- xStocks are tokenized representations, not direct equity ownership
- Not available to US, UK, Canadian, or Australian residents
- Always verify your eligibility before trading
- Understand smart contract and blockchain risks
- This platform provides analysis only, not trading services
```

## Partner Integration Opportunities

Future potential partnerships:
1. **Kraken**: Direct integration for US-eligible users
2. **ByBit**: CEX integration
3. **Jupiter**: DEX aggregation on Solana (cross-chain)
4. **Alpaca**: API-based trading integration

## Timeline

- **Week 2**: Research xStocks data sources, create database schema
- **Week 5**: Frontend badges and availability display
- **Week 6**: Wallet integration and portfolio viewer
- **Week 7**: Enhanced filters and trading links
- **Week 8**: Polish and documentation

---

**Next Steps**: 
1. Research xStocks API/data access
2. Curate list of top tokenized stocks
3. Verify Monad contract addresses
4. Implement availability checking service
