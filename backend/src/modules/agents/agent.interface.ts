export interface StockData {
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
  };
  
  fundamentals: {
    marketCap: number;
    pe?: number;
    eps?: number;
    dividendYield?: number;
    beta?: number;
    revenue?: number;
    netIncome?: number;
    revenueGrowth?: number;
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
  
  sentiment?: {
    score: number; // -1 to 1
    newsCount: number;
  };
}

export interface SectorMetrics {
  [key: string]: any;
}

export interface StockAnalysisResult {
  symbol: string;
  sector: string;
  
  scores: {
    overall: number; // 0-100
    technical: number;
    fundamental: number;
    sentiment: number;
    risk: number;
  };
  
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number; // 0-1
  
  reasoning: string; // LLM-generated explanation
  
  targets: {
    entryPoint?: number;
    exitPoint?: number;
    stopLoss?: number;
    targetPrice?: number;
  };
  
  prediction: {
    direction: 'bullish' | 'bearish' | 'neutral';
    timeframe: string;
    confidence: number;
  };
  
  sectorMetrics: SectorMetrics;
  
  analyzedAt: Date;
}

export interface AnalysisJob {
  sector: 
    | 'Technology'
    | 'AI'
    | 'Healthcare'
    | 'Energy'
    | 'Financial'
    | 'RealEstate'
    | 'Commodities'
    | 'Consumer';
}
