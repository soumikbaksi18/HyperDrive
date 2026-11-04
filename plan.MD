Monad AI Stock Intelligence
Product Concept, Architecture & Build Specification
Working name: Monad Stock Intelligence
Status: Hackathon MVP specification
Target chain: Monad
Primary asset universe: NASDAQ-listed equities, prioritizing
tokenized xStocks that are available on Monad
Primary audience: Beginner investors and crypto-native users
exploring tokenized equities
1. Product Overview
Monad AI Stock Intelligence is an AI-powered stock research and
portfolio recommendation application that helps beginners understand and
explore US equities through curated, explainable stock baskets.

Instead of requiring users to research dozens of companies, interpret
financial metrics, or construct a diversified portfolio themselves, the
application collects a small amount of information about the user's
goals and risk preferences, analyzes a supported universe of stocks, and
generates suggested portfolios ("baskets").

Each basket should explain:
- Which stocks were selected and why.
- The suggested allocation for each stock.
- The investment thesis and relevant supporting data.
- The key risks and reasons the thesis could be wrong.
- The portfolio's sector concentration, volatility and diversification
  characteristics.
- The data timestamp and the assumptions used.
The product is an investment intelligence and decision-support tool,
not a promise of returns and not an autonomous trading bot. The MVP
should prioritize high-quality recommendations, transparent reasoning,
useful portfolio visualizations and a credible data pipeline. Onchain
portfolio tracking or execution can be added where integration and
liquidity are verified.
One-line pitch
An AI stock intelligence engine that turns a beginner's goals and risk
preferences into explainable, data-backed stock baskets, with a path
to exploring tokenized equities on Monad.

2. Problem
A beginner interested in US stocks faces several obstacles:
1. Information overload: There are thousands of listed companies
   and too many sources of market information.
2. Lack of financial literacy: Metrics such as P/E, revenue growth,
   volatility, beta, drawdown and correlation can be difficult to
   interpret.
3. Portfolio construction: Choosing individual stocks does not
   automatically produce a diversified portfolio.
4. Unclear risk: Beginners may focus on potential upside without
   understanding concentration, volatility or downside scenarios.
5. Fragmented access: Crypto-native users may discover tokenized
   equities but lack a simple research and portfolio-discovery
   experience.
The product should make stock research more accessible without
pretending that investing is risk-free or that AI can reliably predict
future returns.
3. Product Principles
1. Explain before encouraging action. Every recommendation must
   include a plain-language explanation and risks.
2. Data-backed, not LLM-invented. Numerical claims must come from
   structured market/fundamental data, not model memory.
3. Risk-aware by design. Allocation and suitability constraints
   must be applied by deterministic code.
4. Transparent uncertainty. Show timestamps, missing data,
   assumptions and confidence limitations.
5. No guaranteed returns. Never describe a basket as certain, safe,
   guaranteed or sure to profit.
6. Beginner-friendly UX. Explain technical metrics in simple
   language with optional deeper detail.
7. Chain-aware, not chain-dependent. Monad adds tokenized-asset
   discovery and potential onchain functionality; the research engine
   should still work if an asset has no usable Monad trading route.
8. No hidden execution. The MVP must not place trades without a
   clear, separate user action and appropriate safeguards.
4. Target Users
Primary: Beginner investor
- Has limited experience evaluating stocks.
- Wants a simple starting point.
- Needs help understanding risk and diversification.
- Prefers clear explanations over dense financial dashboards.
Secondary: Crypto-native user
- Understands wallets and onchain assets.
- Is curious about tokenized US equity exposure.
- Wants to discover and research xStocks or other supported tokenized
  equities.
- Values transparent onchain references and portfolio visibility.
Later: More experienced investor
- Wants to compare AI-generated baskets.
- Wants to customize allocations and screening criteria.
- Wants deeper analytics and portfolio monitoring.
5. Core User Journey
1. User opens the application and connects a wallet optionally.
2. User chooses Explore as a guest or connects an EVM wallet.
3. User completes a short investment-profile flow:
   - Investment horizon.
   - Risk tolerance.
   - Preferred sectors or themes.
   - Approximate investment amount (optional).
   - Preference for diversified or thematic baskets.
4. The engine retrieves current and historical data for supported
   stocks.
5. The quantitative engine scores candidates and constructs one or more
   baskets.
6. The AI explanation layer converts the structured analysis into plain
   language.
7. User reviews the basket, allocation, rationale, risks and data
   freshness.
8. User can save the basket, compare it with another basket or run a
   paper portfolio.
9. Where supported, the user can inspect the corresponding tokenized
   asset and its verified Monad contract/liquidity information.
10. Actual trading, if ever enabled, happens only through a separately
    designed and reviewed execution flow.
6. Main Product Features
6.1 Investment Profile
A simple onboarding flow should collect only information that materially
affects the recommendation.

Suggested fields:
  Field                   Example values          Required for MVP
  Investment horizon      Short / Medium / Long   Yes
term                    

  Risk tolerance          Lower / Moderate /      Yes
Higher                  

  Preferred themes        AI, technology,         Optional
healthcare, energy,
broad market            

  Basket style            Diversified / Thematic  Yes
/ Both                  

  Investment amount       Optional amount and     Optional
currency                
Exclusions              Companies/sectors to    Optional
exclude
Avoid asking users to disclose unnecessary personal or financial
information. The application should clearly state that the profile is
used to tailor educational research output, not to establish that an
investment is suitable for the user.
6.2 AI-Generated Stock Baskets
The engine should initially generate three types of baskets.
A. Risk-profile baskets
- Steady Explorer: Lower-volatility, diversified candidates. Do
  not label individual stocks or equity portfolios as safe.
- Balanced Growth: A mix of established companies and growth
  exposure.
- High-Growth Explorer: Higher-volatility companies and themes,
  with clear downside warnings.
Risk labels must be relative to the supported stock universe and based
on measurable metrics. A basket of individual equities is not equivalent
to a diversified deposit or guaranteed-return product.
B. Sector and theme baskets
Examples:
- AI and Semiconductors
- Big Technology
- Healthcare Innovation
- Energy Transition
- Consumer and E-commerce
- Digital Infrastructure
The selected companies must be screened against current data and the
theme must be explained. Do not assume every named company is
NASDAQ-listed or available as a Monad token.
C. Dynamic baskets
A later feature that updates candidate lists when market conditions,
fundamentals or risk metrics change. Every refresh must show what
changed, why it changed and whether the change is material. Do not
silently alter a user's saved basket.
6.3 Basket Detail Page
Every basket should display:
- Basket name and description.
- Intended investor profile and investment horizon.
- Constituents, ticker symbols and company names.
- Suggested weights that sum to 100%.
- Current/last available price and price timestamp.
- Sector distribution.
- Historical performance for clearly stated periods, if reliable data
  is available.
- Volatility and maximum drawdown, with calculation period.
- Concentration and correlation observations.
- Investment thesis for each constituent.
- Key risks and downside scenarios.
- Data sources and last-updated timestamp.
- Whether a corresponding tokenized asset is verified as available on
  Monad.
6.4 Explain My Basket
A prominent feature that answers:
- Why was each company selected?
- What data supports the thesis?
- Why was this weight assigned?
- What are the largest risks?
- Which holdings are correlated?
- What market conditions could make the basket underperform?
- What changed since the last analysis?
The LLM should explain a structured analysis object. It must not create
unsupported facts, fabricate financial figures, or invent citations.
6.5 Basket Comparison
Allow users to compare two or three baskets across:
- Constituents and allocations.
- Sector exposure.
- Historical return (if data is available).
- Volatility.
- Maximum drawdown.
- Concentration.
- Correlation.
- Intended horizon and risk profile.
6.6 Paper Portfolio (recommended MVP extension)
Let users simulate an allocation without placing real trades.
- Start with a virtual balance.
- Allocate virtual funds across a saved basket.
- Track hypothetical value using market prices.
- Display unrealized and realized simulated P&L.
- Clearly label all results as simulated.
- Account for the selected pricing timestamp and, where feasible,
  estimated fees/slippage.
Paper trading is a useful way to demonstrate the product without
depending on live token liquidity or enabling real-money execution.
7. Recommendation Engine
The engine should be a hybrid of deterministic quantitative analysis and
an LLM explanation layer.

Do not ask an LLM to freely pick stocks and invent portfolio
weights. Use code to calculate metrics, filter candidates, score
stocks and construct allocations. Use the LLM to explain the results in
accessible language.
7.1 Data ingestion
For each supported stock, collect where available:
- Ticker and company name.
- Exchange and asset type.
- Latest available price and timestamp.
- Historical daily prices.
- Volume and liquidity indicators.
- Market capitalization.
- Revenue and earnings metrics.
- Valuation metrics (such as P/E, where meaningful).
- Revenue/earnings growth.
- Sector and industry.
- Corporate actions and relevant events, if supported.
- Data source and quality/freshness metadata.
Data providers may have different coverage, licensing, rate limits and
delayed-data rules. Select a provider after checking its terms. Never
scrape or redistribute data contrary to provider terms.
7.2 Quantitative analysis
Initial metrics:
  Metric                              Purpose
  Historical return                   Describes past price movement over
a defined period

  Realized volatility                 Estimates historical price
variability

  Maximum drawdown                    Measures the largest peak-to-trough
decline in the period

  Moving averages                     Describes trend context

  RSI                                 One momentum indicator; not a
standalone buy signal

  Volume trend                        Helps identify changes in trading
activity

  Beta                                Estimates historical sensitivity to
a benchmark

  Correlation                         Identifies holdings that may move
together

  Fundamental growth                  Adds business-performance context
Valuation                           Provides context; varies by sector
and business model
All metrics must state their lookback period and calculation method.
Technical indicators should not be represented as reliable predictions.
7.3 Candidate screening
Before scoring:
1. Restrict to the configured eligible universe.
2. Exclude assets with missing or stale critical data.
3. Apply liquidity and minimum-history filters.
4. Apply user sector/theme exclusions.
5. Flag extraordinary volatility or material data gaps.
6. Separate common stocks, ETFs and tokenized representations; do not
   treat them as interchangeable.
7.4 Illustrative scoring model
An initial transparent score can combine normalized metrics:
candidate_score =
    w_fundamental * fundamental_score
  + w_momentum    * momentum_score
  + w_quality     * quality_score
  - w_risk        * risk_penalty
  - w_valuation   * valuation_penalty
Weights should be configurable and documented. The score is a
screening/ranking aid, not a forecast of return.

Example initial dimensions:
- Fundamental score: growth, profitability and balance-sheet measures
  where available.
- Momentum score: defined price trend and momentum measures.
- Quality score: consistency and financial quality indicators.
- Risk penalty: volatility, drawdown and liquidity concerns.
- Valuation penalty: sector-aware valuation measures where meaningful.
Do not compare raw valuation ratios across unrelated sectors without
normalization.
7.5 Portfolio construction
Use deterministic portfolio-construction code:
1. Select eligible candidates based on the basket objective.
2. Apply maximum single-stock weight.
3. Apply maximum sector weight.
4. Penalize excessive pairwise correlation.
5. Respect risk-profile constraints.
6. Normalize final weights to exactly 100%.
7. Explain why constraints changed the unconstrained allocation.
Possible MVP guardrails (tunable configuration, not universal investment
rules):
- Maximum single stock weight: 25%.
- Maximum sector weight: 50%.
- Minimum number of holdings: 4, if the eligible universe permits.
- Exclude assets without sufficient price history from risk
  calculations.
- Do not produce a basket if the available data cannot support the
  requested constraints.
The system should return a clear failure or insufficient-data state
rather than manufacture a basket.
7.6 LLM explanation layer
Input to the LLM:
- User profile (only relevant fields).
- Candidate list and calculated metrics.
- Final allocations.
- Basket-level risk metrics.
- Data timestamps and sources.
- Known data gaps.
- Selection and exclusion reasons.
Expected output:
- Short basket summary.
- Per-stock rationale.
- Allocation explanation.
- Main risks.
- Plain-language metric explanations.
- What could invalidate the thesis.
- Explicit uncertainty statement.
The LLM must not:
- Invent live prices or financial results.
- Claim a stock will definitely rise.
- Guarantee profit or capital protection.
- Describe historical returns as expected returns.
- Hide missing or stale data.
- Present generated commentary as a verified fact.
Validate the model output against a schema before displaying it.
8. Monad and xStocks Integration
Monad is the target blockchain ecosystem for the tokenized-equity
discovery and potential onchain portfolio layer.
8.1 Asset registry
Maintain a server-side registry for each tokenized asset:
type TokenizedAsset = {
  ticker: string;
  companyName: string;
  underlyingTicker: string;
  chainId: number;
  tokenAddress: `0x${string}`;
  issuer: string;
  decimals: number;
  verified: boolean;
  verificationSource: string;
  lastVerifiedAt: string;
  dexPools: Array<{
    address: `0x${string}`;
    dex: string;
    liquidityUsd?: number;
    lastCheckedAt: string;
  }>;
  tradingEnabled: boolean;
};
The registry must be populated only from verified issuer documentation,
official deployment information or other trusted sources. Never infer a
token contract address from its ticker.
8.2 Required verification
Before showing an asset as tradable on Monad, verify:
- Official token contract address.
- Correct chain ID.
- Issuer and token-to-underlying mapping.
- Whether transfers are restricted or permissioned.
- Whether a usable DEX pool or supported execution route exists.
- Pool liquidity and trading activity.
- Current issuer/geographic eligibility restrictions.
- Whether the asset is currently supported by the intended
  integration.
A token being deployed on Monad does not prove that it has sufficient
liquidity or a supported trading route.
8.3 MVP Monad functionality
Prioritize:
- Connect EVM wallet.
- Display Monad network status.
- Show verified token contract details.
- Link to a block explorer.
- Display token balances if reliable.
- Display a verified trading route only where available.
Optional later functionality:
- User-authorized swaps through a verified route.
- Onchain basket records or saved portfolio commitments.
- Onchain transaction history.
- Portfolio performance tracking based on verified wallet activity.
Do not build a custom exchange or promise execution until the liquidity,
routing, token restrictions and transaction flow have been tested.
8.4 Compliance and access
Tokenized equities may have issuer-specific eligibility restrictions and
may not be available to every user or jurisdiction. The product must not
imply that a token gives the holder the same rights as direct ownership
of the underlying share. Before enabling execution, obtain appropriate
legal/compliance review for the product's jurisdictions, distribution,
marketing and functionality.

For the hackathon MVP, recommendations and paper portfolios are the
safest scope. Clearly distinguish research output from personalized
regulated investment advice.
9. Suggested Technical Architecture
Use a modular architecture so the market-data and recommendation engine
can operate independently from the Monad wallet layer.
Frontend
- Next.js
- TypeScript
- Tailwind CSS
- A component library such as shadcn/ui
- Lightweight charting library
- EVM wallet connection library compatible with Monad
Main frontend areas:
/
  Landing page
/onboarding
  Investment profile
/dashboard
  Overview and suggested baskets
/baskets
  Basket discovery
/baskets/[id]
  Basket detail and explanation
/compare
  Basket comparison
/paper-portfolio
  Simulated portfolio
/assets/[ticker]
  Stock and tokenized-asset detail
/settings
  User preferences and wallet
Backend
- TypeScript with Next.js route handlers or a separate Node.js API.
- Python service for quantitative analysis if Python data-science
  libraries are useful.
- PostgreSQL for users, profiles, market snapshots, baskets and paper
  portfolios.
- Redis or a job queue for caching and scheduled market-data
  refreshes, if needed.
- A schema-validated LLM provider integration.
- A market-data provider adapter so providers can be changed without
  rewriting the engine.
Smart contracts
For the MVP, keep contracts minimal. If there is no actual onchain
action beyond wallet connection and reading verified token data, a
custom smart contract may not be necessary.

Potential later contracts:
- User-owned saved-basket registry.
- Portfolio snapshot/commitment registry.
- User-authorized execution adapter, only after security and
  compliance review.
Avoid putting private profile information or sensitive user data
onchain.
High-level architecture
                       ┌──────────────────────┐
                       │     Next.js UI       │
                       │ Onboarding / Baskets │
                       └──────────┬───────────┘
                                  │
                       ┌──────────▼───────────┐
                       │      Backend API     │
                       │ Auth / Profiles / API│
                       └──────┬────────┬──────┘
                              │        │
                ┌─────────────▼─┐    ┌─▼────────────────┐
                │ Market Data   │    │ Basket Service   │
                │ Provider(s)   │    │ Orchestration    │
                └──────┬────────┘    └───────┬──────────┘
                       │                     │
                ┌──────▼────────┐    ┌───────▼──────────┐
                │ Data Normalize│    │ Quant Engine     │
                │ & Validation  │    │ Scoring / Risk   │
                └──────┬────────┘    │ Optimization     │
                       │             └───────┬──────────┘
                       │                     │
                       │             ┌───────▼──────────┐
                       │             │ LLM Explanation  │
                       │             │ Structured Input │
                       │             └───────┬──────────┘
                       │                     │
                       └──────────┬──────────┘
                                  │
                         ┌────────▼─────────┐
                         │    PostgreSQL    │
                         │ Data / Baskets   │
                         └──────────────────┘

       Optional onchain read layer:
       Frontend / Backend → Monad RPC → Verified Asset Registry
10. Suggested Repository Structure
Start with a single repository and keep the boundaries clear.
monad-stock-intelligence/
├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── styles/
├── services/
│   ├── api/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── index.ts
│   └── quant-engine/
│       ├── data/
│       ├── indicators/
│       ├── scoring/
│       ├── portfolio/
│       └── tests/
├── packages/
│   ├── shared-types/
│   ├── validation/
│   └── asset-registry/
├── contracts/
│   └── src/
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── ARCHITECTURE.md
│   └── DATA_SOURCES.md
├── prisma/
│   └── schema.prisma
├── .env.example
├── README.md
└── package.json
This is a suggested structure, not a requirement to create every folder
on day one. Start with the web app and a single recommendation service
if that is faster.

13. UX and Visual Direction
The product should feel like a modern financial intelligence platform,
not a complicated institutional trading terminal.
Design principles
- Premium, clean dashboard.
- Beginner-friendly language.
- Strong visual hierarchy.
- Calm colors and restrained use of green/red.
- Charts that explain rather than overwhelm.
- Clear distinction between facts, model interpretations and user
  assumptions.
- Responsive desktop and mobile layouts.
Key screens
1. Landing page
- Product headline and value proposition.
- Explanation of how AI baskets work.
- Example basket cards.
- Monad/xStocks integration explanation.
- Clear risk disclaimer.
2. Onboarding
A short, conversational investment-profile wizard with progress
indication.
3. Dashboard
- Welcome and profile summary.
- Recommended baskets.
- Market overview.
- Saved baskets.
- Data freshness indicator.
4. Basket discovery
- Risk-profile categories.
- Sector/theme categories.
- Search and filters.
- Basket comparison.
5. Basket detail
- Allocation donut/bar chart.
- Holding list.
- Performance chart with date range and benchmark.
- Risk metrics.
- AI explanation.
- "What could go wrong?" section.
- Data sources and timestamp.
6. Asset detail
- Company overview.
- Price chart.
- Fundamentals and technical indicators.
- Relevant news/events, if available.
- Tokenized asset status on Monad, if verified.
7. Paper portfolio
- Virtual balance.
- Holdings and weights.
- Simulated performance.
- Activity history.
- Clear simulation label.
14. Hackathon MVP Scope
The hackathon goal is to demonstrate a complete, understandable product
loop. Do not attempt to build a full brokerage, institutional-grade
financial-data platform or autonomous trading system.
Must have
1. Responsive landing page.
2. Investment-profile onboarding.
3. A supported stock universe with reliable data for a small set of
   tickers.
4. Quantitative metrics for each supported ticker.
5. Deterministic stock screening and basket construction.
6. At least three generated baskets:
   - Lower-volatility diversified example.
   - Balanced growth example.
   - Thematic growth example.
7. Explain My Basket with structured, data-grounded output.
8. Basket detail page with allocations and risk information.
9. Data timestamps and disclaimers.
10. Monad wallet connection or a verified Monad asset discovery view, if
    feasible.
Strong additions
- Basket comparison.
- Paper portfolio.
- Verified xStocks asset registry.
- Monad explorer links.
- Historical backtesting with a clearly defined methodology.
Explicitly out of scope for the first MVP
- Fully autonomous live trading.
- Guaranteed-return or profit-prediction features.
- Copy trading.
- Real-money prediction markets.
- Custom DEX or order book.
- User deposits or custody.
- Unverified token swaps.
- Complex onchain portfolio management.
- Claims that AI recommendations outperform the market.
15. Build Plan
Phase 0 --- Project foundation
- Create repository and Next.js application.
- Set up TypeScript, styling and linting.
- Create shared types and environment configuration.
- Add a basic landing page and dashboard shell.
- Document supported data providers.
Deliverable: Running application with core navigation.
Phase 1 --- Market data
- Select a market-data provider and verify its terms.
- Build provider adapter.
- Fetch price history and available fundamentals for a small ticker
  universe.
- Normalize provider responses.
- Store snapshots and source timestamps.
- Add missing/stale-data handling.
Deliverable: Reliable structured data for the supported stock
universe.
Phase 2 --- Quantitative engine
- Calculate returns and volatility.
- Calculate drawdown, moving averages and RSI.
- Calculate correlations.
- Build deterministic candidate screening.
- Build constrained basket allocation.
- Add unit tests for metric calculations and allocation constraints.
Deliverable: Reproducible baskets generated without relying on an
LLM to select weights.
Phase 3 --- AI explanations
- Define a strict input/output schema.
- Feed the model only validated metrics and facts.
- Generate summaries, per-stock rationales and risk explanations.
- Validate model output.
- Add fallback explanations if the LLM is unavailable.
- Test for fabricated figures and unsupported certainty.
Deliverable: Explainable, schema-valid basket analysis.
Phase 4 --- User experience
- Build onboarding.
- Build basket discovery.
- Build basket details.
- Build comparison.
- Add charts and clear data freshness.
- Add accessible explanations of financial terms.
Deliverable: Complete beginner-facing recommendation flow.
Phase 5 --- Monad integration
- Verify official Monad network configuration.
- Create the tokenized asset registry.
- Verify contract addresses and issuer mappings.
- Read verified token metadata/balances where supported.
- Add explorer links.
- Only show trading availability after checking an actual supported
  route and liquidity.
Deliverable: Credible Monad-aware tokenized-asset discovery.
Phase 6 --- Demo hardening
- Test empty, stale and partial data.
- Test invalid user profiles.
- Test allocation sums and maximum weights.
- Test LLM failure and malformed responses.
- Check responsive layouts.
- Prepare demo user profiles and deterministic sample data.
- Clearly label any mock or simulated functionality.
Deliverable: Stable hackathon demonstration.
16. Testing and Acceptance Criteria
The MVP is ready to demo when:
- A new user can complete onboarding.
- The engine can generate at least three distinct baskets from the
  supported universe.
- Every basket's allocations sum to 100% within a defined
  floating-point tolerance.
- No allocation exceeds configured constraints.
- Basket generation is deterministic for the same input data and
  methodology version, apart from explicitly stochastic explanation
  text.
- Every displayed numerical metric has a source, timestamp and
  calculation period.
- Missing data is visible and does not silently become zero.
- The explanation layer does not invent prices, metrics or guaranteed
  outcomes.
- The user can inspect why each asset was selected.
- The interface clearly communicates historical performance versus
  hypothetical or future outcomes.
- Monad token addresses are displayed only after verification.
- No real transaction is submitted without explicit user action.
17. Security, Privacy and Risk
- Never store private keys or seed phrases.
- Use wallet signatures only for clearly explained authentication or
  ownership checks.
- Keep secrets server-side.
- Validate all API inputs and model outputs.
- Apply API rate limits.
- Avoid putting personal investment profiles onchain.
- Keep a record of data source, methodology version and generation
  timestamp.
- Do not allow prompt injection from news or external content to
  override system rules.
- Treat market/news content as untrusted input.
- Use a clear disclaimer that historical performance does not predict
  future results.
- Have legal/compliance experts review the product before offering
  personalized regulated advice or real-money execution.
18. Demo Story
A strong hackathon demo can follow this sequence:
1. Introduce a beginner who wants exposure to US equities but does not
   know how to construct a portfolio.
2. Complete the short investment-profile onboarding.
3. Generate three baskets for different risk profiles or themes.
4. Open one basket and inspect the allocations.
5. Ask the AI to explain why each stock was selected.
6. Open the risk view and show concentration, volatility and
   correlation.
7. Compare two baskets.
8. Save one to a paper portfolio.
9. Show the Monad-aware tokenized-asset view and verify one supported
   asset's contract details, if available.
The key demo moment is not simply that the AI generates a list of
stocks. It is that the user can understand the portfolio, inspect the
underlying evidence and see the risks.
19. Product Success Metrics
For the hackathon, measure:
- Time from onboarding to first generated basket.
- Percentage of users who open a basket detail page.
- Percentage of users who inspect risk explanations.
- Percentage of users who save or compare a basket.
- Data coverage and freshness across supported tickers.
- Basket generation success rate.
- Number of unsupported or invalid model claims detected in testing.
Do not use short-term hypothetical portfolio returns as the primary
product success metric.
20. Open Decisions
Resolve these before expanding scope:
1. Working name: What will the product be called?
2. Initial universe: Which NASDAQ-listed stocks and which verified
   Monad xStocks should be supported?
3. Data provider: Which provider offers the required
   price/fundamental coverage under acceptable terms?
4. AI provider: Which LLM will generate explanations?
5. Recommendation style: Risk-based, sector-based, goal-based or a
   combination?
6. Paper portfolio: Include it in the hackathon demo?
7. Wallet: Is wallet connection optional or required?
8. Onchain scope: Read-only asset discovery or a small onchain
   feature?
9. User geography: Which jurisdictions will the product serve, and
   what restrictions apply to tokenized assets?
10. Methodology: What transparent scoring and allocation rules will
    be used?
Recommended initial choices:
- Combine risk-profile and sector/theme baskets.
- Support a small, well-covered stock universe first.
- Make wallet connection optional.
- Build recommendations and paper portfolios before real execution.
- Use deterministic portfolio construction and an LLM for
  explanations.
- Integrate Monad through verified asset discovery rather than
  inventing a trading route.
21. Instructions for Codex
Use this document as the product source of truth.

Before implementing:
1. Inspect the existing repository and preserve any working code.
2. Summarize the current project structure and identify missing pieces.
3. Propose a short implementation plan with milestones.
4. Identify the market-data provider and its limitations before
   building dependent features.
5. Separate market-data ingestion, quantitative analysis, portfolio
   construction and LLM explanation into distinct modules.
6. Define shared TypeScript types and validation schemas before wiring
   the UI.
7. Build a thin vertical slice first: onboarding → data-backed basket
   generation → basket detail.
8. Use deterministic fixtures for local development when external APIs
   are unavailable, and label fixture data clearly.
9. Do not fabricate market data, xStocks contracts, liquidity or Monad
   trading routes.
10. Add tests for financial calculations, allocation constraints and
    data-quality handling.
11. Keep the MVP small; do not add live trading unless explicitly
    requested.
First task to give Codex
Read this specification and inspect the repository. Do not start
implementing the entire application immediately. First propose the
architecture, identify the smallest useful vertical slice, list
required environment variables and external data dependencies, and
flag any product or integration assumptions that need verification.
Then wait for approval before making broad architectural changes.

Final Product Positioning
Monad AI Stock Intelligence helps people move from stock-market
curiosity to informed portfolio exploration.

It combines:
- AI-powered stock research.
- Quantitative screening and portfolio construction.
- Beginner-friendly, explainable stock baskets.
- Risk and diversification analysis.
- Tokenized-equity discovery on Monad.
- Optional simulated portfolio tracking.
The differentiator is not an AI claiming to know which stock will go up.
It is an engine that turns complex financial information into
transparent, understandable and risk-aware portfolio ideas.