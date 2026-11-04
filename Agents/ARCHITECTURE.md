# System Architecture Overview

## AI Agent Architecture Details

### Agent Communication Flow

```
User Request
     ↓
Frontend (Next.js)
     ↓
Backend API (NestJS)
     ↓
Recommendation Orchestrator
     ↓
┌────────────┬────────────┬────────────┬────────────┐
│ Tech Agent │ AI Agent   │ Healthcare │ Energy     │
│            │            │ Agent      │ Agent      │
└────┬───────┴────┬───────┴────┬───────┴────┬───────┘
     │            │            │            │
     └────────────┴────────────┴────────────┘
                      ↓
            Market Data Service
                      ↓
        ┌─────────────┴─────────────┐
        ↓                           ↓
Technical Analysis          Fundamental Analysis
        ↓                           ↓
        └─────────────┬─────────────┘
                      ↓
              LLM Service (Ollama/Grok)
                      ↓
         Structured Recommendation
                      ↓
            Risk Engine Validation
                      ↓
        Portfolio Optimizer (4 Buckets)
                      ↓
                User Response
```

### Agent Responsibility Matrix

| Agent | Primary Sectors | Key Metrics | Specialization |
|-------|----------------|-------------|----------------|
| **TechAgent** | Software, Hardware, Cloud | P/E, R&D%, Rev Growth | Innovation cycles |
| **AIAgent** | AI/ML, Semiconductors | GPU sales, AI adoption | Tech breakthroughs |
| **HealthcareAgent** | Pharma, Biotech, Devices | Pipeline, FDA approvals | Regulatory landscape |
| **EnergyAgent** | Oil, Gas, Renewables | Commodity prices, ESG | Energy transition |
| **FinancialAgent** | Banks, Insurance, Fintech | Interest rates, NIM | Credit cycles |
| **RealEstateAgent** | REITs, Homebuilders | Cap rates, occupancy | Property cycles |
| **ConsumerAgent** | Retail, E-commerce | Sales growth, margins | Consumer trends |
| **CommoditiesAgent** | Mining, Materials | Commodity prices, supply | Global supply chains |

### Data Flow Architecture

```
External APIs           Cache Layer          Application Layer        Storage Layer
─────────────          ─────────────        ──────────────────       ─────────────

Alpha Vantage  ──┐
Polygon.io     ──┼──>  Redis Cache   ──>   Market Data      ──>    PostgreSQL
Yahoo Finance  ──┘      (5-15 min)          Service                 (Prisma ORM)
                                                  │
NewsAPI        ──┐                               │
Finnhub        ──┼──>  Redis Cache   ──>   Sentiment        ──>    PostgreSQL
                  └─     (1 hour)             Analysis               (news table)
                                                  │
                                                  ↓
Ollama/Grok    ────────────────────────>   LLM Service       ──>    Analysis
(No cache)                                  (Real-time)             Results (DB)
                                                  │
                                                  ↓
                                           Agent Services
                                           (30 sec TTL)
                                                  │
                                                  ↓
                                           Recommendations   ──>    PostgreSQL
                                           Orchestrator            (portfolios)
```

## Technology Stack Deep Dive

### Backend (NestJS)

**Core Dependencies:**
```json
{
  "@nestjs/common": "^11.0.1",
  "@nestjs/core": "^11.0.1",
  "@nestjs/platform-express": "^11.0.1",
  "@nestjs/jwt": "^10.2.0",
  "@nestjs/passport": "^10.0.3",
  "@nestjs/swagger": "^7.1.17",
  "@nestjs/schedule": "^4.0.0",
  "@prisma/client": "^6.0.0",
  "prisma": "^6.0.0",
  "@bull/bullmq": "^5.0.0",
  "redis": "^4.6.0",
  "passport-jwt": "^4.0.1",
  "bcrypt": "^5.1.1",
  "class-validator": "^0.14.1",
  "class-transformer": "^0.5.1",
  "technicalindicators": "^3.1.0",
  "axios": "^1.6.0",
  "winston": "^3.11.0"
}
```

### Frontend (Next.js)

**Core Dependencies:**
```json
{
  "next": "16.4.5",
  "react": "19.3.0",
  "react-dom": "19.3.0",
  "@tanstack/react-query": "^5.0.0",
  "recharts": "^2.10.0",
  "wagmi": "^2.5.0",
  "viem": "^2.0.0",
  "react-hook-form": "^7.49.0",
  "zod": "^3.22.0",
  "@radix-ui/react-*": "latest",
  "tailwindcss": "^4.0.0",
  "lucide-react": "^0.300.0"
}
```

## Scalability Considerations

### Horizontal Scaling Strategy

1. **API Layer**: Stateless NestJS instances behind load balancer
2. **Database**: Read replicas for queries, primary for writes
3. **Cache**: Redis Cluster for distributed caching
4. **Jobs**: Multiple BullMQ workers for background processing
5. **LLM**: Provider-side scaling (Ollama can run multiple instances)

### Performance Targets

| Component | Target | Strategy |
|-----------|--------|----------|
| API Response | < 500ms p95 | Caching, DB indexes, query optimization |
| Stock Data Refresh | Every 15 min | Background jobs, parallel processing |
| Agent Analysis | < 30 sec/stock | Parallel execution, cached sub-calculations |
| Portfolio Generation | < 2 min | Optimized algorithms, agent parallelization |
| Frontend Load | < 2 sec LCP | SSR, code splitting, image optimization |

### Caching Strategy

```typescript
// Cache TTL by data type
const CACHE_TTL = {
  STOCK_PRICE: 60,          // 1 minute
  STOCK_FUNDAMENTALS: 3600, // 1 hour
  TECHNICAL_INDICATORS: 300, // 5 minutes
  NEWS: 1800,               // 30 minutes
  AGENT_ANALYSIS: 3600,     // 1 hour
  RECOMMENDATIONS: 7200,    // 2 hours
  USER_PORTFOLIO: 300,      // 5 minutes
};
```

## Security Architecture

### Authentication Flow

```
1. User registers/logs in
2. Backend generates JWT (access + refresh)
3. Access token expires in 15 min
4. Refresh token expires in 7 days
5. Frontend stores tokens in httpOnly cookies
6. Every API request includes access token
7. If expired, refresh token is used to get new access token
8. If refresh expired, user must re-login
```

### Authorization Levels

| Resource | Public | Authenticated | Admin |
|----------|--------|---------------|-------|
| Stock list | ✓ | ✓ | ✓ |
| Stock details | ✓ | ✓ | ✓ |
| Recommendations | ✗ | ✓ | ✓ |
| Create portfolio | ✗ | ✓ | ✓ |
| Backtesting | ✗ | ✓ | ✓ |
| Admin panel | ✗ | ✗ | ✓ |

### Data Protection

1. **Encryption at rest**: PostgreSQL encryption
2. **Encryption in transit**: HTTPS/TLS 1.3
3. **Secrets management**: Environment variables, never in code
4. **API keys**: Rotate quarterly, scope limited
5. **User data**: Minimal collection, GDPR compliant
6. **Audit logs**: All sensitive operations logged

## Monitoring & Observability

### Logging Strategy

```typescript
// Winston logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Log levels by component
// ERROR: System failures, critical issues
// WARN: Degraded performance, fallbacks triggered
// INFO: Business events, user actions
// DEBUG: Detailed execution flow (dev only)
```

### Metrics to Track

**Application Metrics:**
- Request rate (req/sec)
- Error rate (%)
- Response time (p50, p95, p99)
- Active users
- Database query time
- Cache hit rate

**Business Metrics:**
- Recommendations generated
- Portfolios created
- Stocks analyzed per day
- Agent execution time
- Backtesting runs
- User retention

**Infrastructure Metrics:**
- CPU usage
- Memory usage
- Database connections
- Redis memory
- Disk I/O
- Network throughput

## Disaster Recovery

### Backup Strategy

1. **Database**: Daily automated backups, 30-day retention
2. **User data**: Hourly incremental backups
3. **Configuration**: Version controlled in Git
4. **Secrets**: Backed up in secure vault

### Recovery Procedures

| Scenario | RTO | RPO | Procedure |
|----------|-----|-----|-----------|
| Database failure | 1 hour | 15 min | Restore from latest backup, replay transaction log |
| API server failure | 5 min | 0 | Auto-restart, load balancer redirects |
| Cache failure | 1 min | 0 | Fallback to database, restart Redis |
| Data corruption | 4 hours | 1 hour | Restore from backup, verify integrity |

## Development Workflow

### Git Workflow

```
main (production)
  ↑
staging (pre-production testing)
  ↑
develop (integration)
  ↑
feature/*, bugfix/*, hotfix/* (individual branches)
```

### CI/CD Pipeline

```
1. Developer pushes to feature branch
2. GitHub Actions runs:
   - Linting (ESLint)
   - Type checking (TypeScript)
   - Unit tests (Jest)
   - Build verification
3. If all pass, PR can be created
4. Code review required
5. Merge to develop triggers:
   - Integration tests
   - Deploy to staging
6. Staging verification
7. Merge to main triggers:
   - Full test suite
   - Deploy to production
   - Smoke tests
```

### Local Development Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd HyperDrive

# 2. Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ../contracts && npm install

# 3. Start infrastructure
docker-compose up -d postgres redis

# 4. Setup database
cd backend
npx prisma migrate dev
npx prisma db seed

# 5. Install Ollama
# macOS: brew install ollama
# Start: ollama serve
# Download model: ollama pull llama3.3

# 6. Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with API keys

# 7. Start services
cd backend && npm run start:dev  # Port 3001
cd frontend && npm run dev        # Port 3000

# 8. Verify
# Backend: http://localhost:3001/api/health
# Frontend: http://localhost:3000
```

## Integration Points

### External Service Integration

| Service | Purpose | Fallback |
|---------|---------|----------|
| Alpha Vantage | Market data (primary) | Polygon.io |
| Polygon.io | Market data (secondary) | Yahoo Finance |
| Yahoo Finance | Market data (fallback) | Cached data |
| NewsAPI | News & sentiment | Finnhub |
| Finnhub | News & sentiment | Skip sentiment |
| Ollama | LLM (local) | Grok/xAI |
| Grok/xAI | LLM (cloud) | Rule-based logic |

### Future Integrations

1. **Monad Blockchain**
   - Smart contract interaction
   - xStocks token metadata
   - Wallet connection (Wagmi)
   - Transaction history

2. **Additional Data Sources**
   - Twitter/X API for sentiment
   - Reddit sentiment analysis
   - Earnings call transcripts
   - SEC filings (EDGAR)

3. **Notification Services**
   - Email (SendGrid)
   - SMS (Twilio)
   - Push notifications (FCM)
   - Webhooks

4. **Analytics**
   - Google Analytics
   - Mixpanel
   - PostHog
   - Custom event tracking
