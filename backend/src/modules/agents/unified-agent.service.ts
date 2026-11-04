import { Injectable } from '@nestjs/common';
import { LLMService } from '../llm/llm.service';
import {
  StockData,
  StockAnalysisResult,
  AnalysisJob,
  SectorMetrics,
} from './agent.interface';

@Injectable()
export class UnifiedAgentService {
  constructor(private readonly llmService: LLMService) {}

  /**
   * Main analysis method - analyzes a stock based on its sector
   */
  async analyzeStock(
    stockData: StockData,
    job: AnalysisJob,
  ): Promise<StockAnalysisResult> {
    console.log(`🤖 Analyzing ${stockData.symbol} (${job.sector} sector)...`);

    // 1. Calculate sector-specific metrics
    const sectorMetrics = this.calculateSectorMetrics(stockData, job.sector);

    // 2. Calculate scores
    const scores = this.calculateScores(stockData, sectorMetrics);

    // 3. Determine recommendation
    const recommendation = this.determineRecommendation(scores.overall);

    // 4. Calculate confidence
    const confidence = this.calculateConfidence(stockData, scores);

    // 5. Generate AI reasoning
    const reasoning = await this.generateReasoning(
      stockData,
      job.sector,
      scores,
      sectorMetrics,
      recommendation,
    );

    // 6. Calculate price targets
    const targets = this.calculateTargets(stockData, scores);

    // 7. Generate prediction
    const prediction = this.generatePrediction(stockData, scores, confidence);

    return {
      symbol: stockData.symbol,
      sector: job.sector,
      scores,
      recommendation,
      confidence,
      reasoning,
      targets,
      prediction,
      sectorMetrics,
      analyzedAt: new Date(),
    };
  }

  /** Scores, recommendation and targets without an LLM call (reasoning is a short rule-based line). */
  async scoreOnly(stockData: StockData, job: AnalysisJob): Promise<StockAnalysisResult> {
    const sectorMetrics = this.calculateSectorMetrics(stockData, job.sector);
    const scores = this.calculateScores(stockData, sectorMetrics);
    const recommendation = this.determineRecommendation(scores.overall);
    const confidence = this.calculateConfidence(stockData, scores);
    return {
      symbol: stockData.symbol,
      sector: job.sector,
      scores,
      recommendation,
      confidence,
      reasoning: this.generateFallbackReasoning(stockData, recommendation, scores),
      targets: this.calculateTargets(stockData, scores),
      prediction: this.generatePrediction(stockData, scores, confidence),
      sectorMetrics,
      analyzedAt: new Date(),
    };
  }

  /**
   * Calculate sector-specific metrics based on the job type
   */
  private calculateSectorMetrics(
    stockData: StockData,
    sector: string,
  ): SectorMetrics {
    const { fundamentals } = stockData;

    switch (sector) {
      case 'Technology':
      case 'AI':
        return {
          revenueGrowthYoY: fundamentals.revenueGrowth || 0,
          grossMargin:
            fundamentals.netIncome && fundamentals.revenue
              ? (fundamentals.netIncome / fundamentals.revenue) * 100
              : 0,
          priceToSales:
            fundamentals.marketCap && fundamentals.revenue
              ? fundamentals.marketCap / fundamentals.revenue
              : 0,
          innovationScore: fundamentals.revenueGrowth
            ? Math.min(fundamentals.revenueGrowth / 20, 10)
            : 5,
        };

      case 'Healthcare':
        return {
          profitability:
            fundamentals.netIncome && fundamentals.revenue
              ? (fundamentals.netIncome / fundamentals.revenue) * 100
              : 0,
          stability: fundamentals.beta ? 10 - Math.abs(fundamentals.beta * 5) : 5,
          dividendStrength: fundamentals.dividendYield
            ? Math.min(fundamentals.dividendYield * 2, 10)
            : 0,
        };

      case 'Energy':
        return {
          commodityExposure: 7, // Simplified
          dividendYield: fundamentals.dividendYield || 0,
          priceVolatility: fundamentals.beta ? Math.abs(fundamentals.beta * 10) : 5,
          cashFlow:
            fundamentals.netIncome && fundamentals.revenue
              ? (fundamentals.netIncome / fundamentals.revenue) * 10
              : 5,
        };

      case 'Financial':
        return {
          profitability:
            fundamentals.netIncome && fundamentals.revenue
              ? (fundamentals.netIncome / fundamentals.revenue) * 100
              : 0,
          pe: fundamentals.pe || 0,
          dividendYield: fundamentals.dividendYield || 0,
          capitalEfficiency: fundamentals.pe ? 20 / fundamentals.pe : 0,
        };

      case 'RealEstate':
        return {
          dividendYield: fundamentals.dividendYield || 0,
          priceToBook: fundamentals.pe ? fundamentals.pe * 0.8 : 0, // Simplified
          occupancy: 8, // Would need actual data
          interestRateSensitivity: fundamentals.beta
            ? Math.abs(fundamentals.beta * 5)
            : 5,
        };

      case 'Commodities':
        return {
          commodityPriceCorrelation: 7,
          costPosition: 6,
          supplyDemand: 7,
          priceVolatility: fundamentals.beta ? Math.abs(fundamentals.beta * 10) : 5,
        };

      case 'Consumer':
        return {
          revenueGrowth: fundamentals.revenueGrowth || 0,
          brandStrength: 7, // Would need sentiment data
          marginTrend:
            fundamentals.netIncome && fundamentals.revenue
              ? (fundamentals.netIncome / fundamentals.revenue) * 10
              : 5,
          consumerSentiment: stockData.sentiment?.score
            ? (stockData.sentiment.score + 1) * 5
            : 5,
        };

      default:
        return {
          generalScore: 5,
        };
    }
  }

  /**
   * Calculate all scores (technical, fundamental, sentiment, risk)
   */
  private calculateScores(
    stockData: StockData,
    sectorMetrics: SectorMetrics,
  ): StockAnalysisResult['scores'] {
    // Technical Score (0-100)
    const technical = this.calculateTechnicalScore(stockData);

    // Fundamental Score (0-100)
    const fundamental = this.calculateFundamentalScore(stockData, sectorMetrics);

    // Sentiment Score (0-100)
    const sentiment = this.calculateSentimentScore(stockData);

    // Risk Score (0-100, lower is riskier)
    const risk = this.calculateRiskScore(stockData);

    // Overall Score (weighted average)
    const overall =
      technical * 0.25 +
      fundamental * 0.35 +
      sentiment * 0.2 +
      risk * 0.2;

    return {
      overall: Math.round(overall),
      technical: Math.round(technical),
      fundamental: Math.round(fundamental),
      sentiment: Math.round(sentiment),
      risk: Math.round(risk),
    };
  }

  private calculateTechnicalScore(stockData: StockData): number {
    const { price, technical } = stockData;
    let score = 50; // Base score

    // RSI Analysis
    if (technical.rsi < 30) score += 15; // Oversold - bullish
    else if (technical.rsi > 70) score -= 15; // Overbought - bearish
    else if (technical.rsi >= 40 && technical.rsi <= 60) score += 5; // Neutral zone

    // Moving Average Analysis
    if (price.current > technical.sma20) score += 10;
    if (price.current > technical.sma50) score += 10;
    if (price.current > technical.sma200) score += 15;

    // MACD Analysis
    if (technical.macd.histogram > 0) score += 10; // Bullish momentum
    else score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateFundamentalScore(
    stockData: StockData,
    sectorMetrics: SectorMetrics,
  ): number {
    const { fundamentals } = stockData;
    let score = 50;

    // P/E Ratio (lower is better, but not too low)
    if (fundamentals.pe) {
      if (fundamentals.pe > 5 && fundamentals.pe < 20) score += 20;
      else if (fundamentals.pe >= 20 && fundamentals.pe < 30) score += 10;
      else if (fundamentals.pe >= 30) score -= 10;
    }

    // Revenue Growth
    if (fundamentals.revenueGrowth) {
      if (fundamentals.revenueGrowth > 20) score += 20;
      else if (fundamentals.revenueGrowth > 10) score += 15;
      else if (fundamentals.revenueGrowth > 5) score += 10;
      else if (fundamentals.revenueGrowth < 0) score -= 15;
    }

    // Dividend Yield (stability indicator)
    if (fundamentals.dividendYield && fundamentals.dividendYield > 2) {
      score += 10;
    }

    // Sector-specific metrics bonus
    const avgSectorMetric =
      Object.values(sectorMetrics).reduce((sum: number, val: any) => {
        return sum + (typeof val === 'number' ? val : 0);
      }, 0) / Object.keys(sectorMetrics).length;

    score += avgSectorMetric;

    return Math.max(0, Math.min(100, score));
  }

  private calculateSentimentScore(stockData: StockData): number {
    if (!stockData.sentiment) return 50; // Neutral if no sentiment data

    // Convert sentiment from -1 to 1 to 0 to 100
    const sentimentScore = (stockData.sentiment.score + 1) * 50;

    // Adjust based on news volume
    const newsBonus = Math.min(stockData.sentiment.newsCount / 10, 10);

    return Math.max(0, Math.min(100, sentimentScore + newsBonus));
  }

  private calculateRiskScore(stockData: StockData): number {
    const { fundamentals, technical } = stockData;
    let score = 70; // Start with moderate-low risk

    // Beta (volatility)
    if (fundamentals.beta) {
      if (fundamentals.beta < 0.8) score += 20; // Low volatility
      else if (fundamentals.beta > 1.5) score -= 30; // High volatility
    }

    // RSI extremes increase risk
    if (technical.rsi < 20 || technical.rsi > 80) score -= 15;

    // Price below long-term average increases risk
    if (stockData.price.current < technical.sma200) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine buy/hold/sell recommendation based on overall score
   */
  private determineRecommendation(
    overallScore: number,
  ): StockAnalysisResult['recommendation'] {
    if (overallScore >= 80) return 'STRONG_BUY';
    if (overallScore >= 65) return 'BUY';
    if (overallScore >= 45) return 'HOLD';
    if (overallScore >= 30) return 'SELL';
    return 'STRONG_SELL';
  }

  /**
   * Calculate confidence level (0-1)
   */
  private calculateConfidence(
    stockData: StockData,
    scores: StockAnalysisResult['scores'],
  ): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence if we have complete data
    if (stockData.fundamentals.pe) confidence += 0.1;
    if (stockData.fundamentals.revenueGrowth) confidence += 0.1;
    if (stockData.sentiment) confidence += 0.1;

    // Higher confidence if scores align
    const scoreVariance = Math.abs(
      Math.max(
        scores.technical,
        scores.fundamental,
        scores.sentiment,
      ) -
        Math.min(
          scores.technical,
          scores.fundamental,
          scores.sentiment,
        ),
    );

    if (scoreVariance < 20) confidence += 0.15; // Scores align well
    else if (scoreVariance > 40) confidence -= 0.15; // Scores diverge

    // Lower confidence for extreme RSI
    if (stockData.technical.rsi < 20 || stockData.technical.rsi > 80) {
      confidence -= 0.1;
    }

    return Math.max(0.2, Math.min(0.95, confidence));
  }

  /**
   * Generate AI reasoning using LLM
   */
  private async generateReasoning(
    stockData: StockData,
    sector: string,
    scores: StockAnalysisResult['scores'],
    sectorMetrics: SectorMetrics,
    recommendation: string,
  ): Promise<string> {
    const prompt = this.buildAnalysisPrompt(
      stockData,
      sector,
      scores,
      sectorMetrics,
      recommendation,
    );

    try {
      const reasoning = await this.llmService.generate(prompt, {
        temperature: 0.7,
        maxTokens: 500,
      });
      return reasoning;
    } catch (error) {
      console.error('LLM generation failed:', error);
      return this.generateFallbackReasoning(stockData, recommendation, scores);
    }
  }

  private buildAnalysisPrompt(
    stockData: StockData,
    sector: string,
    scores: any,
    sectorMetrics: SectorMetrics,
    recommendation: string,
  ): string {
    return `
You are a ${sector} sector stock analyst. Provide a concise investment analysis.

Company: ${stockData.companyName} (${stockData.symbol})
Sector: ${sector}
Current Price: $${stockData.price.current.toFixed(2)}

Technical Indicators:
- RSI: ${stockData.technical.rsi.toFixed(1)} ${stockData.technical.rsi < 30 ? '(Oversold)' : stockData.technical.rsi > 70 ? '(Overbought)' : '(Neutral)'}
- Price vs SMA200: ${stockData.price.current > stockData.technical.sma200 ? 'Above' : 'Below'} (${((stockData.price.current / stockData.technical.sma200 - 1) * 100).toFixed(1)}%)
- MACD: ${stockData.technical.macd.histogram > 0 ? 'Bullish' : 'Bearish'} momentum

Fundamentals:
- P/E Ratio: ${stockData.fundamentals.pe?.toFixed(1) || 'N/A'}
- Market Cap: $${(stockData.fundamentals.marketCap / 1e9).toFixed(2)}B
- Revenue Growth: ${stockData.fundamentals.revenueGrowth?.toFixed(1) || 'N/A'}%
${stockData.fundamentals.dividendYield ? `- Dividend Yield: ${stockData.fundamentals.dividendYield.toFixed(2)}%` : ''}

Sector Metrics: ${JSON.stringify(sectorMetrics, null, 2)}

Scores:
- Technical: ${scores.technical}/100
- Fundamental: ${scores.fundamental}/100
- Sentiment: ${scores.sentiment}/100
- Risk: ${scores.risk}/100 (higher = less risky)

Recommendation: ${recommendation}

Provide a structured 3-paragraph analysis:

1. **Current Valuation & Position**: Assess current price levels, valuation metrics, and technical setup. Is it fairly valued?

2. **${sector}-Specific Analysis**: Evaluate sector-specific factors, competitive position, and growth prospects relevant to ${sector}.

3. **Investment Thesis**: Clear recommendation rationale with key catalysts and main risks.

Keep response under 250 words. Be direct and data-driven.
    `.trim();
  }

  private generateFallbackReasoning(
    stockData: StockData,
    recommendation: string,
    scores: any,
  ): string {
    return `
${stockData.companyName} (${stockData.symbol}) - ${recommendation}

Current technical setup shows RSI at ${stockData.technical.rsi.toFixed(1)} with price ${stockData.price.current > stockData.technical.sma200 ? 'above' : 'below'} its 200-day moving average. 

Fundamental analysis reveals a P/E ratio of ${stockData.fundamentals.pe?.toFixed(1) || 'N/A'} with ${stockData.fundamentals.revenueGrowth ? `${stockData.fundamentals.revenueGrowth.toFixed(1)}% revenue growth` : 'growth data pending'}.

Overall score: ${scores.overall}/100 (Technical: ${scores.technical}, Fundamental: ${scores.fundamental}, Sentiment: ${scores.sentiment}, Risk: ${scores.risk})

Recommendation: ${recommendation} based on combined technical and fundamental analysis.
    `.trim();
  }

  /**
   * Calculate entry, exit, and stop-loss targets
   */
  private calculateTargets(
    stockData: StockData,
    scores: any,
  ): StockAnalysisResult['targets'] {
    const currentPrice = stockData.price.current;

    // Entry point: slightly below current for BUY, at current for HOLD
    const entryPoint =
      scores.overall >= 65 ? currentPrice * 0.98 : currentPrice;

    // Target price based on score (upside potential)
    let targetMultiplier = 1.0;
    if (scores.overall >= 80) targetMultiplier = 1.25; // 25% upside
    else if (scores.overall >= 65) targetMultiplier = 1.15; // 15% upside
    else if (scores.overall >= 50) targetMultiplier = 1.08; // 8% upside

    const targetPrice = currentPrice * targetMultiplier;

    // Stop loss: 8-12% below entry depending on risk
    const stopLossPercent = scores.risk > 70 ? 0.92 : 0.88;
    const stopLoss = entryPoint * stopLossPercent;

    // Exit point: between current and target
    const exitPoint = currentPrice + (targetPrice - currentPrice) * 0.7;

    return {
      entryPoint: parseFloat(entryPoint.toFixed(2)),
      exitPoint: parseFloat(exitPoint.toFixed(2)),
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      targetPrice: parseFloat(targetPrice.toFixed(2)),
    };
  }

  /**
   * Generate bullish/bearish prediction
   */
  private generatePrediction(
    stockData: StockData,
    scores: any,
    confidence: number,
  ): StockAnalysisResult['prediction'] {
    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';

    if (scores.overall >= 65 && scores.technical >= 60) {
      direction = 'bullish';
    } else if (scores.overall <= 40 && scores.technical <= 40) {
      direction = 'bearish';
    }

    // Timeframe based on technical indicators
    const timeframe =
      stockData.technical.rsi < 35 || stockData.technical.rsi > 65
        ? 'short-term (1-3 months)'
        : 'medium-term (3-6 months)';

    return {
      direction,
      timeframe,
      confidence: parseFloat(confidence.toFixed(2)),
    };
  }

  /**
   * Batch analyze multiple stocks
   */
  async analyzeMultipleStocks(
    stocks: Array<{ data: StockData; job: AnalysisJob }>,
  ): Promise<StockAnalysisResult[]> {
    console.log(`🤖 Analyzing ${stocks.length} stocks in batch...`);

    const results = await Promise.allSettled(
      stocks.map(({ data, job }) => this.analyzeStock(data, job)),
    );

    return results
      .filter((result) => result.status === 'fulfilled')
      .map((result: any) => result.value);
  }
}
