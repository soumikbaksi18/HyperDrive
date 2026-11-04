import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { UnifiedAgentService } from './unified-agent.service';
import { StockData, AnalysisJob } from './agent.interface';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentService: UnifiedAgentService) {}

  @Post('analyze')
  async analyzeStock(
    @Body() body: { stockData: StockData; job: AnalysisJob },
  ) {
    const { stockData, job } = body;

    try {
      const analysis = await this.agentService.analyzeStock(stockData, job);

      return {
        success: true,
        analysis,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('analyze-batch')
  async analyzeBatch(
    @Body()
    body: {
      stocks: Array<{ data: StockData; job: AnalysisJob }>;
    },
  ) {
    const { stocks } = body;

    try {
      const analyses = await this.agentService.analyzeMultipleStocks(stocks);

      return {
        success: true,
        count: analyses.length,
        analyses,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('test/:sector')
  async testSectorAnalysis(@Param('sector') sector: string) {
    // Mock stock data for testing
    const mockStock: StockData = {
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
      sector: sector,
      industry: 'Consumer Electronics',
      price: {
        current: 175.43,
        open: 174.2,
        high: 176.5,
        low: 173.8,
        close: 175.43,
        volume: 58000000,
      },
      fundamentals: {
        marketCap: 2750000000000,
        pe: 28.5,
        eps: 6.15,
        dividendYield: 0.5,
        beta: 1.2,
        revenue: 394000000000,
        netIncome: 100000000000,
        revenueGrowth: 8.2,
      },
      technical: {
        sma20: 172.5,
        sma50: 168.3,
        sma200: 165.8,
        rsi: 58.3,
        macd: {
          value: 2.3,
          signal: 1.8,
          histogram: 0.5,
        },
      },
      sentiment: {
        score: 0.6,
        newsCount: 15,
      },
    };

    const job: AnalysisJob = {
      sector: sector as any,
    };

    try {
      const analysis = await this.agentService.analyzeStock(mockStock, job);

      return {
        success: true,
        message: `Test analysis for ${sector} sector`,
        analysis,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
