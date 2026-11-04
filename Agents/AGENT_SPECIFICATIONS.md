# AI Agent Specifications

## Agent Design Philosophy

Each agent is a specialized analyst focused on a specific market sector. Agents combine:
1. **Quantitative Analysis**: Hard metrics and technical indicators
2. **Fundamental Analysis**: Business metrics and financial health
3. **Sentiment Analysis**: News and market sentiment
4. **LLM Enhancement**: Natural language reasoning and context

## Base Agent Template

All agents inherit from `BaseAgent` and implement:

```typescript
interface IAgent {
  // Agent identity
  sector: string;
  industries: string[];
  
  // Core methods
  analyze(stocks: Stock[]): Promise<SectorAnalysis>;
  analyzeStock(stock: Stock): Promise<StockAnalysis>;
  assessRisk(stock: Stock): Promise<RiskAssessment>;
  predictMovement(stock: Stock, timeframe: string): Promise<PredictionResult>;
  
  // Sector-specific
  getSectorSpecificMetrics(stock: Stock): Promise<SectorMetrics>;
  analyzeSectorTrends(): Promise<SectorTrends>;
}
```

---

## 1. Technology Agent

### Sector Coverage
- Software (SaaS, Enterprise, Consumer)
- Hardware (Devices, Components)
- Cloud Computing & Infrastructure
- Semiconductors (general purpose)

### Key Metrics

**Revenue Quality**
- Annual Recurring Revenue (ARR) growth
- Subscription revenue percentage
- Cloud revenue contribution
- Customer retention rate (net retention)

**Innovation Indicators**
- R&D spending as % of revenue (target: >15%)
- Patent filings per year
- New product launches
- Developer ecosystem size

**Profitability**
- Gross margin (target: >60% for software)
- Operating margin
- Free cash flow margin
- Rule of 40 (growth% + profit% >40)

**Market Position**
- Market share vs competitors
- Enterprise vs SMB customer mix
- Geographic revenue distribution

### Stock Examples
- AAPL (Apple Inc.)
- MSFT (Microsoft Corporation)
- GOOGL (Alphabet Inc.)
- META (Meta Platforms)
- ORCL (Oracle Corporation)
- CRM (Salesforce)
- ADBE (Adobe Inc.)

### Scoring Algorithm

```typescript
techScore = (
  0.25 * revenueGrowthScore +    // YoY growth, normalized
  0.20 * profitabilityScore +    // Margins, FCF
  0.20 * innovationScore +       // R&D%, patents
  0.15 * marketPositionScore +   // Market share, moat
  0.10 * valuationScore +        // P/E, P/S vs peers
  0.10 * momentumScore           // Price momentum, RSI
);
```

### Risk Factors
- Regulatory risk (antitrust, data privacy)
- Technology disruption
- Competition intensity
- Talent retention
- Customer concentration

---

## 2. AI & Semiconductors Agent

### Sector Coverage
- AI/ML companies
- GPU manufacturers
- Semiconductor design & fabrication
- AI infrastructure
- AI application companies

### Key Metrics

**AI-Specific**
- AI chip revenue growth
- Training vs inference revenue split
- AI model deployments
- Compute capacity (FLOPS)
- Energy efficiency (performance/watt)

**Semiconductor Metrics**
- Wafer capacity utilization
- Process node leadership (7nm, 5nm, 3nm)
- Design win pipeline
- Average selling price (ASP) trends
- Inventory levels (channel inventory)

**Ecosystem Strength**
- Developer adoption
- Framework integrations
- Partnership ecosystem
- Open source contributions

### Stock Examples
- NVDA (NVIDIA Corporation)
- AMD (Advanced Micro Devices)
- INTC (Intel Corporation)
- ARM (Arm Holdings)
- AVGO (Broadcom Inc.)
- QCOM (Qualcomm)
- MRVL (Marvell Technology)

### Scoring Algorithm

```typescript
aiScore = (
  0.30 * aiRevenueGrowth +       // AI-specific revenue
  0.20 * technologyLeadership +  // Process node, performance
  0.20 * marketDemand +          // Order backlog, guidance
  0.15 * ecosystemStrength +     // Developer adoption
  0.10 * valuationScore +        // Forward P/E
  0.05 * supplyChainHealth       // Fab capacity, inventory
);
```

### Risk Factors
- Chip supply constraints
- Geopolitical risk (Taiwan, China)
- Cyclical demand patterns
- Customer concentration (hyperscalers)
- Technology transitions

---

## 3. Healthcare Agent

### Sector Coverage
- Pharmaceuticals
- Biotechnology
- Medical Devices
- Healthcare Services
- Health Insurance

### Key Metrics

**Pipeline Value**
- Drugs in Phase I, II, III trials
- Expected peak sales
- Patent expiration timeline
- Biosimilar competition risk

**Regulatory**
- FDA approval rate
- Regulatory compliance record
- Clinical trial success rate
- Post-market surveillance issues

**Financial Health**
- Gross margin (pharma target: >70%)
- R&D efficiency (spend vs approvals)
- Commercial execution (launch success)
- Reimbursement landscape

**Demographics**
- Aging population trends
- Disease prevalence
- Healthcare spending growth

### Stock Examples
- JNJ (Johnson & Johnson)
- PFE (Pfizer Inc.)
- UNH (UnitedHealth Group)
- ABBV (AbbVie Inc.)
- TMO (Thermo Fisher Scientific)
- MRNA (Moderna Inc.)
- VRTX (Vertex Pharmaceuticals)

### Scoring Algorithm

```typescript
healthcareScore = (
  0.30 * pipelineValue +         // Future drugs/devices
  0.20 * regulatoryRisk +        // FDA approval path
  0.20 * commercialExecution +   // Sales effectiveness
  0.15 * financialStrength +     // Profitability, debt
  0.10 * valuationScore +        // P/E, EV/EBITDA
  0.05 * demographicTrends       // Market growth
);
```

### Risk Factors
- Patent cliffs
- FDA rejection or delays
- Pricing pressure (government, PBMs)
- Clinical trial failures
- Litigation risk

---

## 4. Energy Agent

### Sector Coverage
- Oil & Gas (Exploration, Production, Refining)
- Renewable Energy (Solar, Wind)
- Utilities (Electric, Gas)
- Energy Infrastructure
- Battery & Storage

### Key Metrics

**Commodity Exposure**
- Oil price correlation
- Natural gas exposure
- Renewable energy capacity (MW)
- Energy storage capacity (MWh)

**Operational**
- Production volumes
- Reserve replacement ratio
- Capacity factor (renewables)
- Transmission/distribution miles

**Financial**
- Breakeven oil price
- Free cash flow yield
- Dividend yield
- Debt-to-EBITDA ratio

**ESG & Transition**
- Carbon intensity
- Renewable energy mix
- ESG ratings
- Transition capital allocation

### Stock Examples
- XOM (Exxon Mobil)
- CVX (Chevron Corporation)
- NEE (NextEra Energy)
- ENPH (Enphase Energy)
- FSLR (First Solar)
- OXY (Occidental Petroleum)

### Scoring Algorithm

```typescript
energyScore = (
  0.25 * commodityOutlook +      // Oil/gas price forecasts
  0.20 * operationalEfficiency + // Production costs
  0.20 * transitionReadiness +   // Renewable investments
  0.15 * dividendSustainability+ // FCF/dividend coverage
  0.10 * valuationScore +        // P/CF, EV/EBITDA
  0.10 * esgScore                // ESG ratings, regulations
);
```

### Risk Factors
- Commodity price volatility
- Regulatory changes (carbon tax)
- Energy transition speed
- Geopolitical instability
- Stranded asset risk

---

## 5. Financial Services Agent

### Sector Coverage
- Commercial Banks
- Investment Banks
- Insurance
- Fintech
- Payment Processors
- Asset Managers

### Key Metrics

**Banking Metrics**
- Net Interest Margin (NIM)
- Loan-to-deposit ratio
- Non-performing loan ratio
- Tier 1 capital ratio
- Return on equity (ROE)

**Fintech/Payments**
- Transaction volume growth
- Take rate (revenue per transaction)
- Customer acquisition cost (CAC)
- Churn rate
- Cross-sell ratio

**Insurance**
- Combined ratio (<100% is profitable)
- Loss ratio
- Premium growth
- Investment income

**Interest Rate Sensitivity**
- Duration gap
- Deposit beta
- Variable vs fixed rate exposure

### Stock Examples
- JPM (JPMorgan Chase)
- BAC (Bank of America)
- V (Visa Inc.)
- MA (Mastercard)
- PYPL (PayPal Holdings)
- AXP (American Express)
- BLK (BlackRock)

### Scoring Algorithm

```typescript
financialScore = (
  0.25 * profitabilityMetrics +  // ROE, NIM
  0.20 * assetQuality +          // NPL ratio, provisions
  0.20 * growthMetrics +         // Volume, revenue growth
  0.15 * capitalStrength +       // Tier 1 capital
  0.10 * valuationScore +        // P/B, P/E
  0.10 * interestRateImpact      // Rate sensitivity
);
```

### Risk Factors
- Credit risk (loan defaults)
- Interest rate risk
- Regulatory capital requirements
- Cybersecurity threats
- Technology disruption

---

## 6. Real Estate Agent

### Sector Coverage
- REITs (Residential, Commercial, Industrial)
- Homebuilders
- Real Estate Services
- PropTech

### Key Metrics

**REIT Metrics**
- Funds From Operations (FFO)
- FFO per share growth
- Occupancy rate
- Same-store NOI growth
- Cap rate trends

**Property Types**
- Office (vacancy risk)
- Retail (e-commerce impact)
- Industrial/Logistics (e-commerce boom)
- Residential (housing demand)
- Data Centers (cloud growth)

**Valuation**
- Price-to-FFO ratio
- Dividend yield
- Net Asset Value (NAV)
- Debt-to-EBITDA

**Market Conditions**
- Interest rate environment
- Housing supply/demand
- Migration patterns
- Remote work impact

### Stock Examples
- PLD (Prologis) - Industrial
- AMT (American Tower) - Infrastructure
- EQIX (Equinix) - Data Centers
- SPG (Simon Property) - Retail
- O (Realty Income) - Net Lease

### Scoring Algorithm

```typescript
realEstateScore = (
  0.30 * ffoGrowth +             // FFO/share growth
  0.25 * propertyTypeOutlook +   // Sector-specific demand
  0.20 * occupancyTrends +       // Occupancy, lease spreads
  0.15 * dividendYield +         // Current + sustainability
  0.10 * valuationScore          // P/FFO, yield spread
);
```

### Risk Factors
- Interest rate sensitivity
- Property type obsolescence
- Geographic concentration
- Tenant credit risk
- Remote work trends

---

## 7. Consumer & Retail Agent

### Sector Coverage
- E-commerce
- Consumer Goods (Staples, Discretionary)
- Retail Chains
- Restaurants
- Entertainment & Media

### Key Metrics

**E-commerce**
- GMV (Gross Merchandise Value) growth
- Take rate
- Customer lifetime value (LTV)
- Active customer growth
- Fulfillment costs

**Retail**
- Same-store sales growth
- Foot traffic trends
- E-commerce penetration
- Inventory turnover
- Gross margin

**Brand Strength**
- Brand equity scores
- Customer loyalty (NPS)
- Social media engagement
- Market share trends

**Consumer Health**
- Consumer confidence index
- Disposable income growth
- Employment rates
- Savings rate

### Stock Examples
- AMZN (Amazon)
- WMT (Walmart)
- COST (Costco)
- NKE (Nike)
- SBUX (Starbucks)
- HD (Home Depot)
- TGT (Target)

### Scoring Algorithm

```typescript
consumerScore = (
  0.25 * salesGrowthTrends +     // Comps, GMV
  0.20 * marginExpansion +       // Gross + operating margin
  0.20 * brandStrength +         // Brand equity, loyalty
  0.15 * consumerHealth +        // Macro indicators
  0.10 * valuationScore +        // P/E, P/S
  0.10 * competitivePosition     // Market share, moat
);
```

### Risk Factors
- Consumer spending cycles
- Competition intensity
- Margin pressure
- Supply chain disruptions
- Shifting consumer preferences

---

## 8. Commodities Agent

### Sector Coverage
- Mining (Gold, Copper, Lithium)
- Agricultural Commodities
- Industrial Materials
- Chemicals
- Precious Metals

### Key Metrics

**Commodity Prices**
- Current vs historical prices
- Supply/demand balance
- Inventory levels
- Forward curves

**Operational**
- Production costs (all-in sustaining costs)
- Reserve life (years of production)
- Capacity utilization
- Exploration success

**Financial**
- Free cash flow
- Debt levels
- Dividend policy
- Hedging strategy

**Macro Drivers**
- Industrial production growth
- Infrastructure spending
- EV adoption (for lithium, copper)
- Inflation expectations

### Stock Examples
- FCX (Freeport-McMoRan) - Copper
- NEM (Newmont) - Gold
- ALB (Albemarle) - Lithium
- DD (DuPont) - Materials
- APD (Air Products) - Industrial Gases
- NUE (Nucor) - Steel

### Scoring Algorithm

```typescript
commoditiesScore = (
  0.30 * commodityPriceOutlook + // Price forecasts
  0.25 * costPosition +          // Low-cost producer?
  0.20 * supplyDemandBalance +   // Market tightness
  0.15 * financialStrength +     // FCF, debt
  0.10 * valuationScore          // P/CF, EV/EBITDA
);
```

### Risk Factors
- Commodity price volatility
- Geopolitical supply risks
- Environmental regulations
- Currency fluctuations
- Demand shocks

---

## Agent Orchestration Logic

### Multi-Agent Consensus

When multiple agents analyze the same stock (e.g., Tesla analyzed by both Tech and Consumer agents):

```typescript
function aggregateAgentScores(analyses: StockAnalysis[]): AggregateScore {
  const weights = calculateAgentWeights(analyses);
  
  return {
    score: weightedAverage(analyses.map(a => a.score), weights),
    confidence: Math.min(...analyses.map(a => a.confidence)), // Conservative
    recommendation: mostCommonRecommendation(analyses),
    reasoning: combineReasoning(analyses),
    consensusLevel: calculateConsensus(analyses), // 0-1
  };
}
```

### Conflict Resolution

When agents disagree:
1. **High consensus (>80%)**: Use majority recommendation
2. **Medium consensus (50-80%)**: Downgrade to HOLD, lower confidence
3. **Low consensus (<50%)**: Flag as "Divergent views", require manual review

### Confidence Scoring

```typescript
function calculateConfidence(analysis: StockAnalysis): number {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence for:
  confidence += analysis.dataQuality === 'high' ? 0.2 : 0;
  confidence += analysis.technicalAlignment ? 0.1 : 0;
  confidence += analysis.fundamentalAlignment ? 0.1 : 0;
  confidence += analysis.sentimentAlignment ? 0.1 : 0;
  
  // Decrease confidence for:
  confidence -= analysis.dataGaps ? 0.2 : 0;
  confidence -= analysis.highVolatility ? 0.1 : 0;
  confidence -= analysis.recentNews.negative ? 0.1 : 0;
  
  return Math.max(0, Math.min(1, confidence));
}
```

---

## Agent Testing & Validation

### Unit Testing

Each agent must pass:
1. **Metric Calculation**: Verify correct calculation of sector-specific metrics
2. **Scoring Logic**: Test edge cases in scoring algorithms
3. **LLM Prompt**: Validate prompt structure and output parsing
4. **Error Handling**: Test with missing/incomplete data

### Integration Testing

1. **Multi-Stock Analysis**: Test with 10+ stocks
2. **Sector Trends**: Verify sector-level aggregations
3. **Performance**: Analysis must complete in <30 seconds per stock
4. **Consistency**: Same input should produce same output (excluding LLM variation)

### Backtesting Validation

Each agent's historical recommendations are tested:
- **12-month forward returns**: What % of BUY recommendations outperformed?
- **Risk-adjusted returns**: Sharpe ratio of agent recommendations
- **Drawdown**: Maximum portfolio drawdown from recommendations
- **Win rate**: % of profitable recommendations

Target: >55% win rate, Sharpe >0.5

---

## Agent Maintenance

### Quarterly Reviews
- Update sector-specific metrics based on market changes
- Retrain scoring algorithms if underperforming
- Review and update LLM prompts
- Add new stocks to coverage universe

### Annual Overhauls
- Major scoring algorithm updates
- Add new agent types if needed
- Sunset underperforming agents
- Comprehensive backtest validation
