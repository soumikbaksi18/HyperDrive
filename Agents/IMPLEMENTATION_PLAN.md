# AI-Powered Stock Analysis and Recommendation Engine
## Comprehensive Implementation Plan

**Project**: HyperDrive - Monad Stock Intelligence  
**Version**: 1.0  
**Date**: November 4, 2026  
**Status**: Technical Implementation Specification

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Project Analysis](#2-current-project-analysis)
3. [System Architecture](#3-system-architecture)
4. [AI Agent Architecture](#4-ai-agent-architecture)
5. [Data Sources & Integration](#5-data-sources--integration)
6. [Database Schema](#6-database-schema)
7. [Backend Services](#7-backend-services)
8. [Frontend Integration](#8-frontend-integration)
9. [LLM Integration Strategy](#9-llm-integration-strategy)
10. [Implementation Phases](#10-implementation-phases)
11. [Folder Structure](#11-folder-structure)
12. [API Specifications](#12-api-specifications)
13. [Security & Compliance](#13-security--compliance)
14. [Testing Strategy](#14-testing-strategy)
15. [Deployment Plan](#15-deployment-plan)

---

## 1. Executive Summary

### Objective
Build an intelligent stock analysis platform that analyzes NASDAQ-listed stocks across multiple sectors (AI, technology, commodities, real estate, energy, healthcare) using specialized AI agents powered by Ollama (with future migration path to Grok/xAI).

### Core Capabilities
- **Multi-Sector AI Agents**: Specialized agents for different market sectors
- **Centralized Recommendation Engine**: Aggregates insights from all agents
- **Portfolio Buckets**: 3-4 curated investment strategies based on risk profiles
- **Personalized User Buckets**: Custom portfolio creation and management
- **Market Analysis**: Bullish/bearish predictions with supporting data
- **Historical Backtesting**: Validate recommendations against historical data
- **NOT INCLUDED**: No tokenization, cryptocurrency, or token-based investments

### Key Design Principles
- **Modular Architecture**: Easy provider switching (Ollama → Grok)
- **Data-Driven**: All recommendations backed by real market data
- **Transparent**: Clear reasoning for every recommendation
- **Risk-Aware**: Comprehensive risk assessments and confidence scores
- **Reusable Components**: Leverage existing NestJS, Next.js, and Monad infrastructure

---

## 2. Current Project Analysis

### 2.1 Existing Infrastructure

#### ✅ Frontend (Next.js 16.4.5)
- **Framework**: Next.js with App Router
- **Styling**: Tailwind CSS 4.0
- **TypeScript**: Fully typed
- **UI Components**: Basic health monitoring panel
- **Port**: 3000
- **Reusable**: Layout, styling system, API client pattern

#### ✅ Backend (NestJS 11.0.1)
- **Framework**: NestJS with TypeScript
- **Architecture**: Modular with controllers, services, modules
- **CORS**: Configured for frontend communication
- **Health Check**: Existing health endpoint pattern
- **Port**: 3001 with `/api` prefix
- **Reusable**: Module structure, controller pattern, health monitoring

#### ✅ Contracts (Solidity + Hardhat 3)
- **Blockchain**: Monad (Testnet: 10143, Mainnet: 143)
- **EVM Version**: Osaka (Solidity 0.8.31)
- **Tooling**: Hardhat 3 with Viem
- **Reusable**: Smart contract deployment infrastructure (for future tokenization if needed)

### 2.2 Architecture Gaps to Address

1. **Database Layer**: No database configured (need PostgreSQL + Prisma/TypeORM)
2. **Authentication**: No user auth system
3. **External APIs**: No market data integration
4. **AI/LLM Integration**: No Ollama or LLM infrastructure
5. **Background Jobs**: No job queue for data fetching/analysis
6. **Caching Layer**: No Redis for performance optimization
7. **Agent System**: No AI agent architecture

### 2.3 Components to Preserve

- ✅ Monorepo structure (frontend/backend/contracts)
- ✅ NestJS modular architecture
- ✅ Next.js App Router pattern
- ✅ TypeScript configuration
- ✅ Health check pattern
- ✅ API client pattern (`lib/api.ts`)
- ✅ Monad blockchain integration (for future xStocks)

---

## 3. System Architecture

### 3.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   Next.js Frontend (Port 3000)                           │  │
│  │   - Dashboard, Stock Explorer, Portfolio Manager         │  │
│  │   - Recommendation Viewer, Backtesting UI                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API / GraphQL
┌────────────────────────────▼────────────────────────────────────┐
│                      APPLICATION LAYER                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   NestJS Backend (Port 3001)                             │  │
│  │                                                           │  │
│  │   ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │   │   Auth      │  │  User        │  │  Portfolio   │  │  │
│  │   │   Module    │  │  Module      │  │  Module      │  │  │
│  │   └─────────────┘  └──────────────┘  └──────────────┘  │  │
│  │                                                           │  │
│  │   ┌─────────────────────────────────────────────────┐   │  │
│  │   │   Recommendation Engine Orchestrator            │   │  │
│  │   │   - Aggregates multi-agent insights             │   │  │
│  │   │   - Generates portfolio buckets                 │   │  │
│  │   │   - Risk scoring & confidence calculation       │   │  │
│  │   └─────────────────────────────────────────────────┘   │  │
│  │                                                           │  │
│  │   ┌─────────────────────────────────────────────────┐   │  │
│  │   │   Market Data Service                           │   │  │
│  │   │   - Provider abstraction layer                  │   │  │
│  │   │   - Data normalization & validation             │   │  │
│  │   │   - Historical data management                  │   │  │
│  │   └─────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      AI AGENT LAYER                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   Sector-Specific AI Agents (Microservices/Modules)     │  │
│  │                                                           │  │
│  │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │   │   Tech   │ │    AI    │ │ Healthcare│ │  Energy  │  │  │
│  │   │  Agent   │ │  Agent   │ │  Agent    │ │  Agent   │  │  │
│  │   └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  │                                                           │  │
│  │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │   │Financial │ │ RealEstate│ │Commodities│ │ Consumer │  │  │
│  │   │ Agent    │ │  Agent    │ │  Agent    │ │  Agent   │  │  │
│  │   └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  │                                                           │  │
│  │   Each agent analyzes:                                   │  │
│  │   • Fundamentals • Technical indicators • News          │  │
│  │   • Market sentiment • Risk metrics • Predictions       │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      LLM INTEGRATION LAYER                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   LLM Provider Abstraction                               │  │
│  │                                                           │  │
│  │   ┌─────────────────────┐    ┌─────────────────────┐   │  │
│  │   │  Ollama Provider    │◄───┤  Provider Interface │   │  │
│  │   │  (Local - MVP)      │    │  (Strategy Pattern) │   │  │
│  │   └─────────────────────┘    └─────────────────────┘   │  │
│  │                                        │                 │  │
│  │   ┌─────────────────────┐             │                 │  │
│  │   │  Grok/xAI Provider  │◄────────────┘                 │  │
│  │   │  (Future Migration) │                               │  │
│  │   └─────────────────────┘                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      DATA LAYER                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │   PostgreSQL   │  │     Redis      │  │  Market Data    │  │
│  │   - Users      │  │   - Cache      │  │   APIs          │  │
│  │   - Portfolios │  │   - Sessions   │  │   - Alpha Vantage│ │
│  │   - Stocks     │  │   - Job Queue  │  │   - Polygon.io  │  │
│  │   - Analysis   │  └────────────────┘  │   - Yahoo Finance│ │
│  └────────────────┘                      └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Technology Stack

#### Frontend Stack
- **Framework**: Next.js 16.4.5 (React 19.3.0)
- **Styling**: Tailwind CSS 4.0
- **State Management**: React Context API + SWR/TanStack Query
- **Charts**: Recharts or Lightweight Charts
- **Forms**: React Hook Form + Zod validation
- **Wallet Connection**: Wagmi (for future Monad integration)

#### Backend Stack
- **Framework**: NestJS 11.0.1
- **Language**: TypeScript 5.7.3
- **Database ORM**: Prisma (recommended) or TypeORM
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Job Queue**: BullMQ
- **Validation**: class-validator + class-transformer
- **API Documentation**: Swagger/OpenAPI

#### AI & Analytics Stack
- **LLM (MVP)**: Ollama (local)
- **LLM (Future)**: Grok/xAI API
- **Data Analysis**: Python microservice optional (pandas, numpy, scipy)
- **Technical Indicators**: technicalindicators npm package or ta-lib
- **Backtesting**: Custom engine built on historical data

#### Data Sources
- **Market Data**: Alpha Vantage (free tier) or Polygon.io
- **News**: NewsAPI or Finnhub
- **Fundamentals**: Financial Modeling Prep or IEX Cloud
- **Alternative**: Yahoo Finance (yfinance Python library)

#### DevOps & Infrastructure
- **Containerization**: Docker + Docker Compose
- **Monitoring**: Logging (Winston/Pino) + Error tracking (Sentry)
- **CI/CD**: GitHub Actions
- **Hosting**: Vercel (frontend) + Railway/Render (backend)

---

## 4. AI Agent Architecture

### 4.1 Agent Design Pattern

Each sector-specific agent follows a standardized architecture:

```typescript
interface IAgent {
  sector: string;
  analyze(stocks: Stock[]): Promise<SectorAnalysis>;
  recommend(analysis: SectorAnalysis, userProfile: UserProfile): Promise<Recommendation[]>;
  assessRisk(stock: Stock): Promise<RiskAssessment>;
  predictMovement(stock: Stock, timeframe: string): Promise<PredictionResult>;
}
```

### 4.2 Sector-Specific Agents

#### 1. **Technology Agent**
- **Focus**: Software, hardware, semiconductors, cloud computing
- **Key Metrics**: P/E ratio, revenue growth, R&D spending, market share
- **Example Stocks**: AAPL, MSFT, GOOGL, NVDA, AMD, INTC
- **Specialization**: Growth trends, competitive positioning, innovation cycles

#### 2. **AI & Semiconductors Agent**
- **Focus**: AI companies, chip manufacturers, AI infrastructure
- **Key Metrics**: GPU sales, AI adoption rates, patent filings, compute capacity
- **Example Stocks**: NVDA, AMD, ARM, AVGO, INTC
- **Specialization**: AI market trends, chip shortage impacts, technology breakthroughs

#### 3. **Healthcare Agent**
- **Focus**: Pharmaceuticals, biotech, medical devices, health services
- **Key Metrics**: Pipeline value, FDA approvals, patent expirations, clinical trials
- **Example Stocks**: JNJ, PFE, UNH, ABBV, TMO
- **Specialization**: Regulatory landscape, drug development timelines, demographic trends

#### 4. **Energy Agent**
- **Focus**: Oil & gas, renewable energy, utilities, battery technology
- **Key Metrics**: Oil prices, production capacity, renewable adoption, ESG scores
- **Example Stocks**: XOM, CVX, NEE, ENPH, FSLR
- **Specialization**: Commodity price correlations, regulatory changes, energy transition

#### 5. **Financial Services Agent**
- **Focus**: Banks, insurance, fintech, payment processors
- **Key Metrics**: Interest rates, loan quality, digital adoption, regulatory capital
- **Example Stocks**: JPM, BAC, V, MA, PYPL
- **Specialization**: Interest rate sensitivity, credit cycles, digital disruption

#### 6. **Real Estate Agent**
- **Focus**: REITs, homebuilders, real estate services
- **Key Metrics**: Occupancy rates, cap rates, rental yields, interest rate sensitivity
- **Example Stocks**: PLD, AMT, EQIX, SPG, O
- **Specialization**: Property market cycles, location analysis, cap rate trends

#### 7. **Consumer & Retail Agent**
- **Focus**: E-commerce, consumer goods, retail chains, entertainment
- **Key Metrics**: Sales growth, margin trends, consumer sentiment, e-commerce penetration
- **Example Stocks**: AMZN, WMT, COST, NKE, SBUX
- **Specialization**: Consumer behavior trends, seasonal patterns, brand strength

#### 8. **Commodities Agent**
- **Focus**: Mining, agriculture, materials, precious metals
- **Key Metrics**: Commodity prices, supply/demand, geopolitical risk, inventory levels
- **Example Stocks**: FCX, NEM, DD, APD, NUE
- **Specialization**: Global supply chains, commodity cycles, inflation hedging

### 4.3 Agent Analysis Workflow

```
Stock Data Input
      ↓
┌─────────────────────────┐
│  1. Data Collection     │
│  - Price history        │
│  - Fundamentals         │
│  - News & sentiment     │
│  - Technical indicators │
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│  2. Sector Analysis     │
│  - Sector-specific      │
│    metrics calculation  │
│  - Peer comparison      │
│  - Industry trends      │
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│  3. LLM Enhancement     │
│  - Structured prompt    │
│  - Context injection    │
│  - Reasoning generation │
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│  4. Risk Assessment     │
│  - Volatility analysis  │
│  - Drawdown calculation │
│  - Correlation check    │
│  - Confidence scoring   │
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│  5. Recommendation      │
│  - Buy/Hold/Sell signal │
│  - Entry/Exit points    │
│  - Position sizing      │
│  - Time horizon         │
└──────────┬──────────────┘
           ↓
    Output to Orchestrator
```

### 4.4 Centralized Recommendation Engine

The orchestrator aggregates insights from all agents:

```typescript
class RecommendationOrchestrator {
  constructor(
    private agents: IAgent[],
    private riskEngine: RiskEngine,
    private portfolioOptimizer: PortfolioOptimizer
  ) {}

  async generateRecommendations(
    userProfile: UserProfile
  ): Promise<PortfolioBucket[]> {
    // 1. Collect all agent analyses
    const agentAnalyses = await Promise.all(
      this.agents.map(agent => agent.analyze(this.stocks))
    );

    // 2. Score and rank stocks
    const rankedStocks = this.scoreStocks(agentAnalyses);

    // 3. Apply risk filters based on user profile
    const filteredStocks = this.riskEngine.filter(
      rankedStocks,
      userProfile.riskTolerance
    );

    // 4. Construct portfolio buckets
    const buckets = this.portfolioOptimizer.createBuckets(
      filteredStocks,
      userProfile
    );

    // 5. Generate explanations via LLM
    const enrichedBuckets = await this.enrichWithExplanations(buckets);

    return enrichedBuckets;
  }
}
```

### 4.5 Portfolio Bucket Strategies

#### Bucket 1: Conservative Growth (Low Risk)
- **Allocation**: 70% large-cap stable, 20% bonds/utilities, 10% growth
- **Target Volatility**: < 15% annualized
- **Focus**: Dividend-paying stocks, established companies
- **Risk Profile**: Capital preservation with modest growth

#### Bucket 2: Balanced Growth (Medium Risk)
- **Allocation**: 50% large-cap, 30% mid-cap growth, 20% emerging sectors
- **Target Volatility**: 15-25% annualized
- **Focus**: Mix of value and growth
- **Risk Profile**: Moderate growth potential with diversification

#### Bucket 3: Aggressive Growth (High Risk)
- **Allocation**: 30% large-cap tech, 40% small/mid-cap growth, 30% high-growth sectors
- **Target Volatility**: 25-40% annualized
- **Focus**: High-growth companies, emerging technologies
- **Risk Profile**: Maximum growth potential, higher volatility

#### Bucket 4: Sector-Themed (Variable Risk)
- **Allocation**: Concentrated in specific sector (e.g., AI, Clean Energy)
- **Target Volatility**: Varies by sector
- **Focus**: Thematic investing based on market trends
- **Risk Profile**: Sector-specific risk, less diversification

---

## 5. Data Sources & Integration

### 5.1 Market Data Provider Abstraction

```typescript
interface IMarketDataProvider {
  name: string;
  rateLimit: RateLimitConfig;
  
  // Core data methods
  getStockPrice(symbol: string): Promise<StockPrice>;
  getHistoricalPrices(symbol: string, range: DateRange): Promise<PriceHistory>;
  getCompanyFundamentals(symbol: string): Promise<Fundamentals>;
  getRealtimeQuote(symbol: string): Promise<Quote>;
  
  // Advanced data
  getFinancialStatements(symbol: string): Promise<FinancialStatements>;
  getNewsForStock(symbol: string, limit: number): Promise<NewsItem[]>;
  getMarketSentiment(symbol: string): Promise<SentimentScore>;
}
```

### 5.2 Recommended Providers (MVP)

#### Primary: Alpha Vantage (Free Tier)
- **Pros**: Free tier available, good coverage, simple API
- **Cons**: Rate limited (5 calls/min free, 500/day)
- **Best For**: MVP/prototype
- **Endpoints**: Stock prices, fundamentals, technical indicators

```typescript
class AlphaVantageProvider implements IMarketDataProvider {
  private baseUrl = 'https://www.alphavantage.co/query';
  private apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  
  async getHistoricalPrices(symbol: string, range: DateRange) {
    const response = await fetch(
      `${this.baseUrl}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${this.apiKey}`
    );
    return this.normalize(await response.json());
  }
}
```

#### Alternative: Polygon.io
- **Pros**: Generous free tier, real-time data, WebSocket support
- **Cons**: Requires signup
- **Best For**: Production with real-time needs

#### Fallback: Yahoo Finance (via yfinance)
- **Pros**: Free, unlimited, comprehensive
- **Cons**: Unofficial API, may break, no SLA
- **Best For**: Backup data source

### 5.3 Data Normalization Layer

```typescript
interface NormalizedStockData {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  
  price: {
    current: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: Date;
  };
  
  fundamentals: {
    marketCap: number;
    pe: number;
    eps: number;
    dividendYield: number;
    beta: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
  };
  
  technical: {
    sma20: number;
    sma50: number;
    sma200: number;
    rsi: number;
    macd: {
      value: number;
      signal: number;
      histogram: number;
    };
  };
  
  metadata: {
    provider: string;
    lastUpdated: Date;
    dataQuality: 'high' | 'medium' | 'low';
  };
}
```

### 5.4 Data Fetching Strategy

```typescript
class MarketDataService {
  private providers: IMarketDataProvider[];
  private cache: Redis;
  
  async fetchStockData(symbol: string): Promise<NormalizedStockData> {
    // 1. Check cache first
    const cached = await this.cache.get(`stock:${symbol}`);
    if (cached && !this.isStale(cached)) {
      return cached;
    }
    
    // 2. Try primary provider
    try {
      const data = await this.providers[0].getStockData(symbol);
      await this.cache.set(`stock:${symbol}`, data, 'EX', 300); // 5 min cache
      return data;
    } catch (error) {
      // 3. Fallback to secondary provider
      return this.fetchWithFallback(symbol);
    }
  }
  
  // Background job to refresh all tracked stocks
  @Cron('*/15 * * * *') // Every 15 minutes
  async refreshTrackedStocks() {
    const symbols = await this.getTrackedSymbols();
    await Promise.allSettled(
      symbols.map(symbol => this.fetchStockData(symbol))
    );
  }
}
```

---

## 6. Database Schema

### 6.1 Prisma Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// USER & AUTHENTICATION
// ============================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?
  walletAddress String?   @unique
  
  profile       UserProfile?
  portfolios    Portfolio[]
  watchlists    Watchlist[]
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@index([email])
  @@index([walletAddress])
}

model UserProfile {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  riskTolerance     RiskLevel @default(MEDIUM)
  investmentHorizon InvestmentHorizon @default(LONG_TERM)
  investmentAmount  Float?
  
  preferences       Json     // Sector preferences, exclusions, etc.
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
}

enum InvestmentHorizon {
  SHORT_TERM   // < 1 year
  MEDIUM_TERM  // 1-3 years
  LONG_TERM    // 3+ years
}

// ============================================
// STOCKS & MARKET DATA
// ============================================

model Stock {
  id            String   @id @default(cuid())
  symbol        String   @unique
  companyName   String
  sector        String
  industry      String
  exchange      String   @default("NASDAQ")
  
  isActive      Boolean  @default(true)
  lastAnalyzed  DateTime?
  
  prices        StockPrice[]
  fundamentals  StockFundamentals[]
  analyses      StockAnalysis[]
  news          NewsItem[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([symbol])
  @@index([sector])
}

model StockPrice {
  id        String   @id @default(cuid())
  stockId   String
  stock     Stock    @relation(fields: [stockId], references: [id], onDelete: Cascade)
  
  date      DateTime
  open      Float
  high      Float
  low       Float
  close     Float
  volume    BigInt
  
  provider  String   // Data source
  
  @@unique([stockId, date])
  @@index([stockId, date])
}

model StockFundamentals {
  id              String   @id @default(cuid())
  stockId         String
  stock           Stock    @relation(fields: [stockId], references: [id], onDelete: Cascade)
  
  marketCap       Float
  pe              Float?
  eps             Float?
  dividendYield   Float?
  beta            Float?
  revenue         Float?
  netIncome       Float?
  
  asOfDate        DateTime
  provider        String
  
  createdAt       DateTime @default(now())
  
  @@index([stockId, asOfDate])
}

// ============================================
// AI ANALYSIS & RECOMMENDATIONS
// ============================================

model StockAnalysis {
  id              String   @id @default(cuid())
  stockId         String
  stock           Stock    @relation(fields: [stockId], references: [id], onDelete: Cascade)
  
  agentType       String   // e.g., "tech", "healthcare", "energy"
  
  score           Float    // Overall score 0-100
  confidence      Float    // Confidence level 0-1
  
  recommendation  RecommendationType
  
  reasoning       String   @db.Text // LLM-generated explanation
  
  technicalScore  Float
  fundamentalScore Float
  sentimentScore  Float
  riskScore       Float
  
  entryPoint      Float?
  exitPoint       Float?
  stopLoss        Float?
  targetPrice     Float?
  
  prediction      Json     // Bullish/bearish prediction data
  
  analyzedAt      DateTime @default(now())
  
  @@index([stockId, analyzedAt])
  @@index([agentType])
}

enum RecommendationType {
  STRONG_BUY
  BUY
  HOLD
  SELL
  STRONG_SELL
}

model NewsItem {
  id          String   @id @default(cuid())
  stockId     String
  stock       Stock    @relation(fields: [stockId], references: [id], onDelete: Cascade)
  
  title       String
  summary     String   @db.Text
  url         String
  source      String
  sentiment   Float?   // -1 to 1
  
  publishedAt DateTime
  createdAt   DateTime @default(now())
  
  @@index([stockId, publishedAt])
}

// ============================================
// PORTFOLIOS & BUCKETS
// ============================================

model Portfolio {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  name        String
  description String?
  type        PortfolioType
  
  holdings    PortfolioHolding[]
  
  isPublic    Boolean  @default(false)
  isPaper     Boolean  @default(true) // Paper trading vs real
  
  initialValue Float?
  currentValue Float?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([userId])
}

enum PortfolioType {
  CONSERVATIVE
  BALANCED
  AGGRESSIVE
  SECTOR_THEMED
  CUSTOM
}

model PortfolioHolding {
  id          String   @id @default(cuid())
  portfolioId String
  portfolio   Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
  
  symbol      String
  quantity    Float
  weight      Float    // Percentage allocation
  
  entryPrice  Float
  entryDate   DateTime
  
  notes       String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([portfolioId, symbol])
  @@index([portfolioId])
}

model Watchlist {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  name        String
  symbols     String[] // Array of stock symbols
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([userId])
}

// ============================================
// BACKTESTING
// ============================================

model BacktestResult {
  id              String   @id @default(cuid())
  
  strategyName    String
  strategyConfig  Json
  
  symbols         String[]
  startDate       DateTime
  endDate         DateTime
  
  initialCapital  Float
  finalValue      Float
  totalReturn     Float
  annualizedReturn Float
  maxDrawdown     Float
  sharpeRatio     Float
  winRate         Float
  
  trades          Json     // Array of trade details
  
  createdAt       DateTime @default(now())
  
  @@index([strategyName])
  @@index([createdAt])
}
```

### 6.2 Database Seeding Strategy

```typescript
// prisma/seed.ts
async function seedNasdaqStocks() {
  const nasdaqStocks = [
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', industry: 'Internet' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors' },
    { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers' },
    // Add 50-100 liquid NASDAQ stocks across sectors
  ];
  
  for (const stock of nasdaqStocks) {
    await prisma.stock.upsert({
      where: { symbol: stock.symbol },
      update: {},
      create: stock,
    });
  }
}
```

---

## 7. Backend Services

### 7.1 NestJS Module Structure

```
backend/src/
├── app.module.ts
├── main.ts
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   └── filters/
├── config/
│   ├── database.config.ts
│   ├── redis.config.ts
│   └── llm.config.ts
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts
│   │   └── dto/
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── dto/
│   ├── stocks/
│   │   ├── stocks.module.ts
│   │   ├── stocks.controller.ts
│   │   ├── stocks.service.ts
│   │   └── dto/
│   ├── market-data/
│   │   ├── market-data.module.ts
│   │   ├── market-data.service.ts
│   │   ├── providers/
│   │   │   ├── provider.interface.ts
│   │   │   ├── alpha-vantage.provider.ts
│   │   │   ├── polygon.provider.ts
│   │   │   └── yahoo-finance.provider.ts
│   │   └── jobs/
│   │       └── data-refresh.job.ts
│   ├── agents/
│   │   ├── agents.module.ts
│   │   ├── base-agent.ts
│   │   ├── agent.interface.ts
│   │   ├── tech-agent.service.ts
│   │   ├── ai-agent.service.ts
│   │   ├── healthcare-agent.service.ts
│   │   ├── energy-agent.service.ts
│   │   ├── financial-agent.service.ts
│   │   ├── realestate-agent.service.ts
│   │   ├── consumer-agent.service.ts
│   │   └── commodities-agent.service.ts
│   ├── recommendations/
│   │   ├── recommendations.module.ts
│   │   ├── recommendations.controller.ts
│   │   ├── recommendations.service.ts
│   │   ├── orchestrator.service.ts
│   │   ├── risk-engine.service.ts
│   │   └── portfolio-optimizer.service.ts
│   ├── analysis/
│   │   ├── analysis.module.ts
│   │   ├── technical-analysis.service.ts
│   │   ├── fundamental-analysis.service.ts
│   │   └── sentiment-analysis.service.ts
│   ├── portfolios/
│   │   ├── portfolios.module.ts
│   │   ├── portfolios.controller.ts
│   │   ├── portfolios.service.ts
│   │   └── dto/
│   ├── backtesting/
│   │   ├── backtesting.module.ts
│   │   ├── backtesting.controller.ts
│   │   ├── backtesting.service.ts
│   │   └── strategies/
│   └── llm/
│       ├── llm.module.ts
│       ├── llm.service.ts
│       ├── providers/
│       │   ├── llm-provider.interface.ts
│       │   ├── ollama.provider.ts
│       │   └── grok.provider.ts
│       └── prompts/
│           ├── analysis-prompts.ts
│           ├── recommendation-prompts.ts
│           └── explanation-prompts.ts
└── prisma/
    ├── schema.prisma
    └── migrations/
```

### 7.2 Key Service Implementations

#### Base Agent Service

```typescript
// modules/agents/base-agent.ts
export abstract class BaseAgent implements IAgent {
  constructor(
    protected readonly marketDataService: MarketDataService,
    protected readonly analysisService: AnalysisService,
    protected readonly llmService: LLMService,
    protected readonly prisma: PrismaService,
  ) {}

  abstract sector: string;
  abstract getSectorSpecificMetrics(stock: Stock): Promise<any>;

  async analyze(stocks: Stock[]): Promise<SectorAnalysis> {
    const analyses = await Promise.all(
      stocks
        .filter(s => s.sector === this.sector)
        .map(stock => this.analyzeStock(stock))
    );
    
    return {
      sector: this.sector,
      stockAnalyses: analyses,
      sectorTrends: await this.analyzeSectorTrends(),
      timestamp: new Date(),
    };
  }

  protected async analyzeStock(stock: Stock): Promise<StockAnalysis> {
    // 1. Fetch market data
    const marketData = await this.marketDataService.fetchStockData(stock.symbol);
    
    // 2. Calculate technical indicators
    const technical = await this.analysisService.analyzeTechnicals(marketData);
    
    // 3. Analyze fundamentals
    const fundamental = await this.analysisService.analyzeFundamentals(marketData);
    
    // 4. Get sector-specific insights
    const sectorMetrics = await this.getSectorSpecificMetrics(stock);
    
    // 5. Calculate sentiment
    const sentiment = await this.analysisService.analyzeSentiment(stock.symbol);
    
    // 6. Generate LLM reasoning
    const reasoning = await this.generateReasoning({
      stock,
      technical,
      fundamental,
      sectorMetrics,
      sentiment,
    });
    
    // 7. Calculate scores and recommendation
    const scores = this.calculateScores(technical, fundamental, sentiment);
    const recommendation = this.determineRecommendation(scores);
    
    return {
      stockId: stock.id,
      agentType: this.sector,
      ...scores,
      recommendation,
      reasoning,
      analyzedAt: new Date(),
    };
  }

  protected async generateReasoning(data: any): Promise<string> {
    const prompt = this.buildAnalysisPrompt(data);
    return await this.llmService.generate(prompt);
  }

  protected abstract buildAnalysisPrompt(data: any): string;
}
```

#### Technology Agent Implementation

```typescript
// modules/agents/tech-agent.service.ts
@Injectable()
export class TechAgentService extends BaseAgent {
  sector = 'Technology';

  async getSectorSpecificMetrics(stock: Stock) {
    const fundamentals = await this.marketDataService.getFundamentals(stock.symbol);
    
    return {
      rdSpendingRatio: fundamentals.rdExpense / fundamentals.revenue,
      revenueGrowthYoY: this.calculateGrowth(fundamentals.revenue, fundamentals.revenuePY),
      cloudRevenue: fundamentals.cloudRevenue,
      subscriptionRevenue: fundamentals.subscriptionRevenue,
      grossMargin: fundamentals.grossProfit / fundamentals.revenue,
      freeGeneratedCashFlow: fundamentals.operatingCashFlow - fundamentals.capex,
    };
  }

  protected buildAnalysisPrompt(data: any): string {
    return `
You are a technology sector stock analyst. Analyze the following company and provide investment reasoning.

Company: ${data.stock.companyName} (${data.stock.symbol})
Sector: ${data.stock.industry}

Technical Indicators:
- Current Price: $${data.technical.currentPrice}
- RSI: ${data.technical.rsi}
- Moving Averages: SMA20: $${data.technical.sma20}, SMA50: $${data.technical.sma50}
- MACD: ${data.technical.macd.value} (Signal: ${data.technical.macd.signal})

Fundamental Metrics:
- P/E Ratio: ${data.fundamental.pe}
- Revenue Growth (YoY): ${data.sectorMetrics.revenueGrowthYoY}%
- R&D Spending Ratio: ${data.sectorMetrics.rdSpendingRatio}%
- Gross Margin: ${data.sectorMetrics.grossMargin}%
- Free Cash Flow: $${data.sectorMetrics.freeCashFlow}

Market Sentiment: ${data.sentiment.score} (${data.sentiment.label})

Provide a structured analysis covering:
1. Current valuation assessment
2. Growth trajectory and innovation potential
3. Competitive positioning
4. Key risks and concerns
5. Investment thesis (2-3 sentences)

Keep response under 300 words. Be objective and data-driven.
    `.trim();
  }
}
```

#### Recommendation Orchestrator

```typescript
// modules/recommendations/orchestrator.service.ts
@Injectable()
export class RecommendationOrchestrator {
  constructor(
    private readonly techAgent: TechAgentService,
    private readonly aiAgent: AIAgentService,
    private readonly healthcareAgent: HealthcareAgentService,
    private readonly energyAgent: EnergyAgentService,
    private readonly financialAgent: FinancialAgentService,
    private readonly realEstateAgent: RealEstateAgentService,
    private readonly consumerAgent: ConsumerAgentService,
    private readonly commoditiesAgent: CommoditiesAgentService,
    private readonly riskEngine: RiskEngineService,
    private readonly portfolioOptimizer: PortfolioOptimizerService,
    private readonly prisma: PrismaService,
  ) {}

  async generateRecommendations(
    userProfile: UserProfile,
  ): Promise<PortfolioBucket[]> {
    // 1. Get all active stocks
    const stocks = await this.prisma.stock.findMany({
      where: { isActive: true },
    });

    // 2. Run all agents in parallel
    const agents = [
      this.techAgent,
      this.aiAgent,
      this.healthcareAgent,
      this.energyAgent,
      this.financialAgent,
      this.realEstateAgent,
      this.consumerAgent,
      this.commoditiesAgent,
    ];

    const analyses = await Promise.all(
      agents.map(agent => agent.analyze(stocks))
    );

    // 3. Aggregate and score all stocks
    const stockScores = this.aggregateScores(analyses);

    // 4. Filter by risk tolerance
    const filteredStocks = await this.riskEngine.filterByRisk(
      stockScores,
      userProfile.riskTolerance,
    );

    // 5. Generate portfolio buckets
    const buckets = await this.portfolioOptimizer.createBuckets(
      filteredStocks,
      userProfile,
    );

    // 6. Save to database
    await this.saveRecommendations(buckets);

    return buckets;
  }

  private aggregateScores(analyses: SectorAnalysis[]): ScoredStock[] {
    const stockMap = new Map<string, any[]>();

    // Group analyses by stock
    for (const sectorAnalysis of analyses) {
      for (const stockAnalysis of sectorAnalysis.stockAnalyses) {
        const existing = stockMap.get(stockAnalysis.stockId) || [];
        existing.push(stockAnalysis);
        stockMap.set(stockAnalysis.stockId, existing);
      }
    }

    // Calculate aggregate scores
    return Array.from(stockMap.entries()).map(([stockId, analyses]) => {
      const avgScore = analyses.reduce((sum, a) => sum + a.score, 0) / analyses.length;
      const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;
      
      return {
        stockId,
        score: avgScore,
        confidence: avgConfidence,
        analyses,
      };
    });
  }
}
```

---

## 9. LLM Integration Strategy

### 9.1 Provider Abstraction Interface

```typescript
// modules/llm/providers/llm-provider.interface.ts
export interface LLMProvider {
  name: string;
  
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
  
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  
  embed(text: string): Promise<number[]>;
  
  isAvailable(): Promise<boolean>;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  model?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

### 9.2 Ollama Provider (MVP)

```typescript
// modules/llm/providers/ollama.provider.ts
@Injectable()
export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  private baseUrl: string;
  private defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get('OLLAMA_BASE_URL', 'http://localhost:11434');
    this.defaultModel = this.configService.get('OLLAMA_MODEL', 'llama3.3');
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options?.model || this.defaultModel,
        prompt,
        temperature: options?.temperature || 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options?.model || this.defaultModel,
        messages,
        temperature: options?.temperature || 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama chat failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### 9.3 Grok Provider (Future)

```typescript
// modules/llm/providers/grok.provider.ts
@Injectable()
export class GrokProvider implements LLMProvider {
  name = 'grok';
  private apiKey: string;
  private baseUrl = 'https://api.x.ai/v1';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get('GROK_API_KEY');
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'user', content: prompt }
    ];
    return this.chat(messages, options);
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options?.model || 'grok-beta',
        messages,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Grok API failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
```

### 9.4 LLM Service with Provider Switching

```typescript
// modules/llm/llm.service.ts
@Injectable()
export class LLMService {
  private currentProvider: LLMProvider;

  constructor(
    private readonly ollamaProvider: OllamaProvider,
    private readonly grokProvider: GrokProvider,
    private readonly configService: ConfigService,
  ) {
    this.initializeProvider();
  }

  private async initializeProvider() {
    const preferredProvider = this.configService.get('LLM_PROVIDER', 'ollama');
    
    if (preferredProvider === 'grok' && await this.grokProvider.isAvailable()) {
      this.currentProvider = this.grokProvider;
    } else if (await this.ollamaProvider.isAvailable()) {
      this.currentProvider = this.ollamaProvider;
    } else {
      throw new Error('No LLM provider available');
    }
    
    console.log(`Using LLM provider: ${this.currentProvider.name}`);
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    try {
      return await this.currentProvider.generate(prompt, options);
    } catch (error) {
      console.error(`LLM generation failed with ${this.currentProvider.name}:`, error);
      // Implement fallback logic if needed
      throw error;
    }
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    return await this.currentProvider.chat(messages, options);
  }

  // Switch provider at runtime
  async switchProvider(providerName: 'ollama' | 'grok') {
    const provider = providerName === 'grok' ? this.grokProvider : this.ollamaProvider;
    
    if (await provider.isAvailable()) {
      this.currentProvider = provider;
      console.log(`Switched to LLM provider: ${providerName}`);
    } else {
      throw new Error(`Provider ${providerName} is not available`);
    }
  }
}
```

### 9.5 Environment Configuration

```bash
# .env
# LLM Configuration
LLM_PROVIDER=ollama  # Options: ollama, grok

# Ollama (Local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.3  # or mistral, mixtral, etc.

# Grok/xAI (Future)
GROK_API_KEY=your_grok_api_key_here
GROK_MODEL=grok-beta
```

---

## 10. Implementation Phases

### Phase 0: Foundation Setup (Week 1)

#### Goals
- Set up development environment
- Configure database and migrations
- Establish project structure

#### Tasks
1. **Database Setup**
   - [ ] Install PostgreSQL and Redis
   - [ ] Configure Prisma with schema
   - [ ] Run initial migrations
   - [ ] Create seed data for 50 NASDAQ stocks

2. **Backend Infrastructure**
   - [ ] Add Prisma to NestJS backend
   - [ ] Set up environment configuration
   - [ ] Add Redis for caching
   - [ ] Configure logging (Winston/Pino)

3. **LLM Setup**
   - [ ] Install Ollama locally
   - [ ] Download llama3.3 or mistral model
   - [ ] Test Ollama API connectivity
   - [ ] Create LLM provider abstraction

4. **Development Tools**
   - [ ] Set up Docker Compose for local dev
   - [ ] Configure hot reload for backend
   - [ ] Set up API documentation (Swagger)

**Deliverables**: Working local environment with database, Redis, and Ollama

---

### Phase 1: Market Data Integration (Week 1-2)

#### Goals
- Integrate market data providers
- Build data fetching and normalization pipeline
- Set up background jobs

#### Tasks
1. **Provider Integration**
   - [ ] Implement Alpha Vantage provider
   - [ ] Create provider abstraction interface
   - [ ] Add Yahoo Finance fallback
   - [ ] Implement rate limiting

2. **Data Services**
   - [ ] Create MarketDataService
   - [ ] Build data normalization layer
   - [ ] Implement caching strategy
   - [ ] Add error handling and retries

3. **Background Jobs**
   - [ ] Install BullMQ
   - [ ] Create stock price refresh job
   - [ ] Create fundamentals refresh job
   - [ ] Set up job scheduling (every 15 min for prices)

4. **API Endpoints**
   - [ ] GET /api/stocks - List all stocks
   - [ ] GET /api/stocks/:symbol - Get stock details
   - [ ] GET /api/stocks/:symbol/prices - Get price history
   - [ ] GET /api/stocks/:symbol/fundamentals - Get fundamentals

**Deliverables**: Working market data pipeline with 50+ stocks updating regularly

---

### Phase 2: Technical & Fundamental Analysis (Week 2-3)

#### Goals
- Implement technical indicators
- Build fundamental analysis engine
- Create sentiment analysis pipeline

#### Tasks
1. **Technical Analysis**
   - [ ] Install technicalindicators library
   - [ ] Calculate: SMA, EMA, RSI, MACD, Bollinger Bands
   - [ ] Calculate volatility and beta
   - [ ] Implement trend detection

2. **Fundamental Analysis**
   - [ ] Revenue/earnings growth calculations
   - [ ] Valuation metrics (P/E, P/B, P/S)
   - [ ] Profitability ratios (ROE, ROA, margins)
   - [ ] Sector-specific metric calculations

3. **Sentiment Analysis**
   - [ ] Integrate news API (NewsAPI or Finnhub)
   - [ ] Basic sentiment scoring (simple LLM-based)
   - [ ] Store news items in database
   - [ ] Calculate aggregate sentiment scores

4. **API Endpoints**
   - [ ] GET /api/analysis/technical/:symbol
   - [ ] GET /api/analysis/fundamental/:symbol
   - [ ] GET /api/analysis/sentiment/:symbol

**Deliverables**: Complete analysis pipeline producing structured data

---

### Phase 3: AI Agent Development (Week 3-4)

#### Goals
- Implement all 8 sector-specific agents
- Create base agent class
- Build agent testing framework

#### Tasks
1. **Base Agent Architecture**
   - [ ] Create BaseAgent abstract class
   - [ ] Define IAgent interface
   - [ ] Implement common analysis logic
   - [ ] Create LLM prompt templates

2. **Sector Agents Implementation**
   - [ ] TechAgent (Technology sector)
   - [ ] AIAgent (AI & Semiconductors)
   - [ ] HealthcareAgent (Pharmaceuticals, biotech)
   - [ ] EnergyAgent (Oil, gas, renewables)
   - [ ] FinancialAgent (Banks, fintech)
   - [ ] RealEstateAgent (REITs)
   - [ ] ConsumerAgent (Retail, e-commerce)
   - [ ] CommoditiesAgent (Mining, materials)

3. **Agent Logic**
   - [ ] Sector-specific metric calculation
   - [ ] Score calculation algorithms
   - [ ] Recommendation logic (Buy/Hold/Sell)
   - [ ] Confidence score calculation
   - [ ] Entry/exit point calculation

4. **Testing**
   - [ ] Unit tests for each agent
   - [ ] Test with known good/bad stocks
   - [ ] Validate LLM output quality
   - [ ] Performance benchmarking

**Deliverables**: 8 working agents producing stock analyses

---

### Phase 4: Recommendation Engine (Week 4-5)

#### Goals
- Build recommendation orchestrator
- Implement portfolio optimization
- Create risk engine

#### Tasks
1. **Orchestrator**
   - [ ] Implement RecommendationOrchestrator
   - [ ] Aggregate multi-agent analyses
   - [ ] Score normalization across agents
   - [ ] Conflict resolution logic

2. **Portfolio Optimizer**
   - [ ] Conservative bucket strategy
   - [ ] Balanced bucket strategy
   - [ ] Aggressive bucket strategy
   - [ ] Sector-themed bucket strategy
   - [ ] Weight optimization algorithms
   - [ ] Diversification constraints

3. **Risk Engine**
   - [ ] Risk tolerance filtering
   - [ ] Volatility calculations
   - [ ] Correlation analysis
   - [ ] Maximum drawdown calculations
   - [ ] Portfolio-level risk metrics

4. **API Endpoints**
   - [ ] POST /api/recommendations/generate
   - [ ] GET /api/recommendations/buckets
   - [ ] GET /api/recommendations/:id

**Deliverables**: Working recommendation engine generating portfolio buckets

---

### Phase 5: Frontend Development (Week 5-6)

#### Goals
- Build responsive UI for stock analysis
- Create portfolio management interface
- Implement recommendation viewer

#### Tasks
1. **Core Pages**
   - [ ] Landing page with features
   - [ ] Dashboard with portfolio overview
   - [ ] Stock explorer with search/filters
   - [ ] Stock detail page with charts
   - [ ] Recommendation viewer

2. **Components**
   - [ ] StockCard component
   - [ ] PriceChart component (using Recharts)
   - [ ] PortfolioBucket component
   - [ ] RiskMeter component
   - [ ] RecommendationCard component

3. **State Management**
   - [ ] Set up TanStack Query
   - [ ] Create API hooks
   - [ ] Implement optimistic updates
   - [ ] Add loading/error states

4. **Styling**
   - [ ] Design system setup
   - [ ] Dark mode theme
   - [ ] Responsive layouts
   - [ ] Accessibility compliance

**Deliverables**: Functional frontend connected to backend APIs

---

### Phase 6: User Features (Week 6-7)

#### Goals
- Implement user authentication
- Build portfolio management
- Create watchlists

#### Tasks
1. **Authentication**
   - [ ] JWT-based auth
   - [ ] User registration/login
   - [ ] Optional wallet connection (Wagmi)
   - [ ] Session management

2. **User Profiles**
   - [ ] Investment profile onboarding
   - [ ] Risk tolerance questionnaire
   - [ ] Sector preference selection
   - [ ] Profile editing

3. **Portfolio Management**
   - [ ] Create custom portfolios
   - [ ] Add/remove holdings
   - [ ] Paper trading simulation
   - [ ] Portfolio performance tracking

4. **Watchlists**
   - [ ] Create/edit watchlists
   - [ ] Add stocks to watchlist
   - [ ] Watchlist monitoring

**Deliverables**: Complete user features with persistence

---

### Phase 7: Backtesting & Validation (Week 7-8)

#### Goals
- Build backtesting engine
- Validate agent recommendations
- Performance metrics

#### Tasks
1. **Backtesting Engine**
   - [ ] Historical simulation framework
   - [ ] Strategy execution logic
   - [ ] Transaction cost modeling
   - [ ] Rebalancing logic

2. **Metrics Calculation**
   - [ ] Total return
   - [ ] Annualized return
   - [ ] Sharpe ratio
   - [ ] Maximum drawdown
   - [ ] Win rate
   - [ ] Alpha and beta

3. **Validation**
   - [ ] Test recommendations on 1-year historical data
   - [ ] Compare against benchmarks (S&P 500, NASDAQ)
   - [ ] Analyze agent accuracy
   - [ ] Identify failure modes

4. **UI**
   - [ ] Backtesting results page
   - [ ] Performance charts
   - [ ] Comparison tables

**Deliverables**: Validated system with historical performance data

---

### Phase 8: Polish & Optimization (Week 8)

#### Goals
- Performance optimization
- UI/UX refinement
- Documentation

#### Tasks
1. **Performance**
   - [ ] Optimize database queries
   - [ ] Implement aggressive caching
   - [ ] Reduce API calls
   - [ ] Frontend bundle optimization

2. **UX Improvements**
   - [ ] Loading states polish
   - [ ] Error message improvements
   - [ ] Onboarding flow refinement
   - [ ] Mobile responsiveness

3. **Documentation**
   - [ ] API documentation
   - [ ] User guide
   - [ ] Agent architecture docs
   - [ ] Deployment guide

4. **Testing**
   - [ ] End-to-end tests
   - [ ] Load testing
   - [ ] Security audit
   - [ ] Browser compatibility

**Deliverables**: Production-ready application

---

## 11. Folder Structure

```
HyperDrive/
├── Agents/
│   ├── IMPLEMENTATION_PLAN.md (this file)
│   ├── ARCHITECTURE.md
│   ├── AGENT_SPECIFICATIONS.md
│   ├── DATA_SOURCES.md
│   └── API_DOCUMENTATION.md
│
├── frontend/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx (Dashboard)
│   │   │   ├── stocks/
│   │   │   │   ├── page.tsx (Stock Explorer)
│   │   │   │   └── [symbol]/
│   │   │   │       └── page.tsx (Stock Detail)
│   │   │   ├── recommendations/
│   │   │   │   ├── page.tsx (Recommendations List)
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx (Bucket Detail)
│   │   │   ├── portfolios/
│   │   │   │   ├── page.tsx (My Portfolios)
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx (Portfolio Detail)
│   │   │   ├── backtesting/
│   │   │   │   └── page.tsx
│   │   │   └── watchlists/
│   │   │       └── page.tsx
│   │   ├── api/ (Route handlers)
│   │   │   └── auth/
│   │   ├── layout.tsx
│   │   └── page.tsx (Landing)
│   ├── components/
│   │   ├── ui/ (shadcn components)
│   │   ├── stocks/
│   │   │   ├── StockCard.tsx
│   │   │   ├── StockList.tsx
│   │   │   ├── PriceChart.tsx
│   │   │   └── TechnicalIndicators.tsx
│   │   ├── portfolios/
│   │   │   ├── PortfolioBucket.tsx
│   │   │   ├── PortfolioChart.tsx
│   │   │   └── HoldingsList.tsx
│   │   ├── recommendations/
│   │   │   ├── RecommendationCard.tsx
│   │   │   ├── ExplanationPanel.tsx
│   │   │   └── RiskMeter.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Footer.tsx
│   ├── lib/
│   │   ├── api.ts (API client)
│   │   ├── hooks/
│   │   │   ├── useStocks.ts
│   │   │   ├── useRecommendations.ts
│   │   │   └── usePortfolios.ts
│   │   ├── utils/
│   │   └── types/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── common/
│   │   ├── config/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── stocks/
│   │   │   ├── market-data/
│   │   │   │   ├── market-data.module.ts
│   │   │   │   ├── market-data.service.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── provider.interface.ts
│   │   │   │   │   ├── alpha-vantage.provider.ts
│   │   │   │   │   └── yahoo-finance.provider.ts
│   │   │   │   └── jobs/
│   │   │   ├── agents/
│   │   │   │   ├── agents.module.ts
│   │   │   │   ├── base-agent.ts
│   │   │   │   ├── agent.interface.ts
│   │   │   │   ├── tech-agent.service.ts
│   │   │   │   ├── ai-agent.service.ts
│   │   │   │   ├── healthcare-agent.service.ts
│   │   │   │   ├── energy-agent.service.ts
│   │   │   │   ├── financial-agent.service.ts
│   │   │   │   ├── realestate-agent.service.ts
│   │   │   │   ├── consumer-agent.service.ts
│   │   │   │   └── commodities-agent.service.ts
│   │   │   ├── recommendations/
│   │   │   │   ├── recommendations.module.ts
│   │   │   │   ├── orchestrator.service.ts
│   │   │   │   ├── risk-engine.service.ts
│   │   │   │   └── portfolio-optimizer.service.ts
│   │   │   ├── analysis/
│   │   │   │   ├── technical-analysis.service.ts
│   │   │   │   ├── fundamental-analysis.service.ts
│   │   │   │   └── sentiment-analysis.service.ts
│   │   │   ├── portfolios/
│   │   │   ├── backtesting/
│   │   │   ├── llm/
│   │   │   │   ├── llm.module.ts
│   │   │   │   ├── llm.service.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── llm-provider.interface.ts
│   │   │   │   │   ├── ollama.provider.ts
│   │   │   │   │   └── grok.provider.ts
│   │   │   │   └── prompts/
│   │   │   └── health/ (existing)
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── seed.ts
│   │       └── migrations/
│   ├── test/
│   ├── package.json
│   └── .env.example
│
├── contracts/ (existing - for future xStocks)
│   └── (keep as-is for now)
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 12. API Specifications

### 12.1 Core Endpoints

#### Stocks

```
GET    /api/stocks
GET    /api/stocks/:symbol
GET    /api/stocks/:symbol/prices?range=1M
GET    /api/stocks/:symbol/fundamentals
GET    /api/stocks/search?q=AAPL
GET    /api/stocks/sectors
GET    /api/stocks/sectors/:sector
```

#### Analysis

```
GET    /api/analysis/technical/:symbol
GET    /api/analysis/fundamental/:symbol
GET    /api/analysis/sentiment/:symbol
GET    /api/analysis/:symbol/comprehensive
```

#### Recommendations

```
POST   /api/recommendations/generate
GET    /api/recommendations/buckets
GET    /api/recommendations/:id
GET    /api/recommendations/history
```

#### Portfolios

```
GET    /api/portfolios
POST   /api/portfolios
GET    /api/portfolios/:id
PATCH  /api/portfolios/:id
DELETE /api/portfolios/:id
POST   /api/portfolios/:id/holdings
DELETE /api/portfolios/:id/holdings/:holdingId
GET    /api/portfolios/:id/performance
```

#### Backtesting

```
POST   /api/backtesting/run
GET    /api/backtesting/results/:id
GET    /api/backtesting/results
```

#### Users

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/users/me
PATCH  /api/users/me/profile
GET    /api/users/me/watchlists
POST   /api/users/me/watchlists
```

### 12.2 WebSocket Events (Future)

```
SUBSCRIBE  stock:prices:{symbol}
SUBSCRIBE  recommendations:updates
SUBSCRIBE  portfolio:performance:{portfolioId}
```

---

## 13. Security & Compliance

### 13.1 Security Measures

1. **Authentication & Authorization**
   - JWT tokens with expiration
   - Refresh token rotation
   - Rate limiting per user
   - API key validation for services

2. **Data Protection**
   - No storage of sensitive financial credentials
   - Encrypted environment variables
   - HTTPS only in production
   - CORS configuration

3. **Input Validation**
   - All inputs validated with class-validator
   - SQL injection prevention (Prisma ORM)
   - XSS prevention (React escaping)
   - CSRF tokens for mutations

4. **API Security**
   - Rate limiting (100 req/min per IP)
   - API key rotation
   - Request signing
   - Audit logging

### 13.2 Compliance Considerations

⚠️ **Important Disclaimers**

1. **Not Financial Advice**
   - Clear disclaimers on all pages
   - "For informational purposes only"
   - "Past performance does not guarantee future results"
   - "Consult a licensed financial advisor"

2. **No Guaranteed Returns**
   - Never promise specific returns
   - Always show risks
   - Emphasize uncertainty
   - Display confidence scores honestly

3. **Data Attribution**
   - Credit all data sources
   - Comply with API terms of service
   - Display data timestamps
   - Indicate data freshness

4. **Regulatory Awareness**
   - Not a registered investment advisor (RIA)
   - Not a broker-dealer
   - Educational/analytical tool only
   - Geographic restrictions where applicable

### 13.3 Terms of Service & Privacy

```markdown
## Key Terms

1. The platform provides stock analysis and educational content only
2. Users are responsible for their own investment decisions
3. No guarantees on data accuracy or recommendation performance
4. We do not custody funds or execute trades
5. We collect minimal personal data (email, preferences)
6. Data is not sold to third parties
7. Users can delete their accounts and data at any time
```

---

## 14. Testing Strategy

### 14.1 Backend Testing

```typescript
// Example: Agent Unit Test
describe('TechAgentService', () => {
  it('should analyze tech stock correctly', async () => {
    const stock = createMockStock('AAPL');
    const analysis = await techAgent.analyzeStock(stock);
    
    expect(analysis.score).toBeGreaterThan(0);
    expect(analysis.confidence).toBeLessThanOrEqual(1);
    expect(analysis.recommendation).toBeDefined();
    expect(analysis.reasoning).toContain('Apple');
  });

  it('should calculate sector-specific metrics', async () => {
    const metrics = await techAgent.getSectorSpecificMetrics(stock);
    
    expect(metrics.rdSpendingRatio).toBeGreaterThan(0);
    expect(metrics.revenueGrowthYoY).toBeDefined();
  });
});
```

### 14.2 Integration Testing

```typescript
describe('Recommendation Flow', () => {
  it('should generate portfolio recommendations', async () => {
    const userProfile = createMockProfile({ riskTolerance: 'MEDIUM' });
    
    const buckets = await recommendationOrchestrator.generateRecommendations(userProfile);
    
    expect(buckets).toHaveLength(4);
    expect(buckets[0].type).toBe('CONSERVATIVE');
    expect(buckets[0].holdings).not.toBeEmpty();
    
    const totalWeight = buckets[0].holdings.reduce((sum, h) => sum + h.weight, 0);
    expect(totalWeight).toBeCloseTo(100, 1);
  });
});
```

### 14.3 E2E Testing

```typescript
// Using Playwright
test('user can view stock recommendations', async ({ page }) => {
  await page.goto('/dashboard');
  
  await page.click('[data-testid="generate-recommendations"]');
  
  await page.waitForSelector('[data-testid="portfolio-bucket"]');
  
  const buckets = await page.$$('[data-testid="portfolio-bucket"]');
  expect(buckets.length).toBeGreaterThan(0);
});
```

---

## 15. Deployment Plan

### 15.1 Infrastructure

#### Development
```yaml
# docker-compose.yml
version: '3.9'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: hyperdrive
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://dev:dev@postgres:5432/hyperdrive
      REDIS_URL: redis://redis:6379
      OLLAMA_BASE_URL: http://host.docker.internal:11434
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
  
  frontend:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001/api
    ports:
      - "3000:3000"
    depends_on:
      - backend
```

#### Production

**Frontend**: Vercel
- Automatic deployments from main branch
- Edge network for global performance
- Environment variables configured in dashboard

**Backend**: Railway or Render
- PostgreSQL managed database
- Redis managed cache
- Environment variables
- Auto-scaling based on traffic

**Monitoring**
- Sentry for error tracking
- LogRocket for session replay
- Custom Prometheus metrics
- Grafana dashboards

### 15.2 Environment Variables

```bash
# Backend .env
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379

# LLM
LLM_PROVIDER=grok
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.3
GROK_API_KEY=your_key

# Market Data
ALPHA_VANTAGE_API_KEY=your_key
POLYGON_API_KEY=your_key

# Authentication
JWT_SECRET=your_secret
JWT_EXPIRATION=7d

# External Services
SENTRY_DSN=your_dsn
```

```bash
# Frontend .env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_CHAIN_ID=10143
NEXT_PUBLIC_RPC_URL=https://testnet-rpc.monad.xyz
```

---

## 16. Success Metrics & KPIs

### 16.1 Technical Metrics
- **API Response Time**: < 500ms p95
- **Data Freshness**: < 15 min for prices
- **Agent Analysis Time**: < 30 sec per stock
- **Recommendation Generation**: < 2 min for full portfolio
- **Uptime**: > 99.5%

### 16.2 Product Metrics
- **Recommendation Accuracy**: Track % of profitable recommendations over 30/60/90 days
- **User Engagement**: Daily active users, session duration
- **Feature Adoption**: % users creating custom portfolios
- **Backtesting Results**: Historical performance vs benchmarks

### 16.3 Agent Performance
- **Agent Consensus**: How often agents agree on recommendations
- **Confidence Correlation**: Relationship between confidence and actual outcomes
- **Sector Coverage**: Number of stocks analyzed per sector
- **Analysis Quality**: Manual review of LLM-generated reasoning

---

## 17. Future Enhancements

### Phase 9+ (Post-MVP)

1. **Monad Integration** 
   - xStocks token discovery
   - On-chain portfolio tracking
   - DEX integration for trading

2. **Advanced Features**
   - Real-time alerts and notifications
   - AI chatbot for Q&A
   - Custom agent creation by users
   - Social features (share portfolios)
   - Options and derivatives analysis

3. **Machine Learning**
   - Deep learning price prediction models
   - Sentiment analysis with transformers
   - Reinforcement learning for portfolio optimization
   - Anomaly detection

4. **Mobile App**
   - React Native mobile app
   - Push notifications
   - Mobile-first portfolio tracking

5. **Premium Features**
   - Advanced backtesting
   - Real-time data
   - Unlimited recommendations
   - Priority support

---

## 18. Risk Mitigation

### 18.1 Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| API rate limits | High | Implement caching, multiple providers, upgrade to paid tiers |
| LLM unavailability | High | Provider abstraction, fallback to rule-based logic |
| Data quality issues | Medium | Multiple data sources, validation, flagging stale data |
| Performance bottlenecks | Medium | Redis caching, database optimization, CDN for frontend |
| Database failure | High | Automated backups, replica databases, monitoring |

### 18.2 Product Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Poor recommendation accuracy | High | Extensive backtesting, confidence thresholds, disclaimers |
| User trust issues | High | Transparency, explain reasoning, show data sources |
| Regulatory concerns | High | Legal review, clear disclaimers, geographic restrictions |
| Competition | Medium | Focus on unique agent architecture, superior UX |
| Low user adoption | Medium | Marketing, educational content, onboarding optimization |

---

## 19. Team & Responsibilities

### Recommended Team Structure

1. **Full-Stack Developer** (You)
   - Overall architecture
   - Backend services
   - Frontend development
   - DevOps & deployment

2. **Data Engineer** (Optional)
   - Data pipeline optimization
   - ETL processes
   - Database optimization
   - Data quality monitoring

3. **ML/AI Specialist** (Optional)
   - Agent algorithm refinement
   - LLM prompt engineering
   - Backtesting optimization
   - Model performance tuning

4. **Designer** (Optional)
   - UI/UX design
   - Brand identity
   - Marketing materials

---

## 20. Getting Started Checklist

### Immediate Next Steps

- [ ] Review this implementation plan
- [ ] Set up local PostgreSQL and Redis
- [ ] Install and configure Ollama
- [ ] Create initial Prisma schema
- [ ] Run database migrations
- [ ] Add market data provider (Alpha Vantage)
- [ ] Test data fetching for 5-10 stocks
- [ ] Implement first agent (TechAgent)
- [ ] Create basic frontend dashboard
- [ ] Test end-to-end flow

### Week 1 Goals

- [ ] Complete Phase 0: Foundation Setup
- [ ] Begin Phase 1: Market Data Integration
- [ ] Have 50 stocks in database with live data
- [ ] Basic API endpoints working
- [ ] LLM provider connected and tested

---

## Conclusion

This implementation plan provides a comprehensive roadmap for building an AI-powered stock analysis and recommendation engine integrated with your existing HyperDrive infrastructure. The architecture is designed to be:

- **Modular**: Easy to add new agents, providers, or features
- **Scalable**: Can handle growing data and user load
- **Maintainable**: Clear separation of concerns and well-documented
- **Future-Proof**: Ready for Grok migration and Monad integration

The 8-week timeline is aggressive but achievable with focused effort. Each phase builds on the previous one, allowing for incremental testing and validation.

**Key Success Factors:**
1. Start with quality data pipeline (Phase 1)
2. Validate agent logic with backtesting (Phase 7)
3. Keep UI simple and intuitive (Phase 5)
4. Prioritize transparency and clear communication
5. Test extensively before launch

**Remember**: This is an educational and analytical tool, not financial advice. All recommendations should be accompanied by clear risk disclosures and confidence metrics.

---

**Questions or need clarification on any section? I'm ready to help implement any phase!**
