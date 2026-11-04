import { Controller, Get, Post, Body } from '@nestjs/common';
import { LLMService } from './llm.service';

@Controller('llm')
export class LLMController {
  constructor(private readonly llmService: LLMService) {}

  @Get('status')
  async getStatus() {
    const isAvailable = await this.llmService.isAvailable();
    return {
      provider: this.llmService.getProviderName(),
      available: isAvailable,
      timestamp: new Date().toISOString(),
    };
  }

  /** Model picker for the AI trading form: every provider/model, with whether its key is set. */
  @Get('models')
  models() {
    return { default: this.llmService.defaultModelId(), models: this.llmService.models() };
  }

  @Post('test')
  async testGeneration(@Body() body: { prompt: string }) {
    const { prompt } = body;
    
    if (!prompt) {
      return {
        error: 'Prompt is required',
        example: { prompt: 'Explain what P/E ratio means in 2 sentences.' },
      };
    }

    try {
      const startTime = Date.now();
      const response = await this.llmService.generate(prompt, {
        temperature: 0.7,
        maxTokens: 500,
      });
      const duration = Date.now() - startTime;

      return {
        success: true,
        prompt,
        response,
        provider: this.llmService.getProviderName(),
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: this.llmService.getProviderName(),
      };
    }
  }

  @Post('analyze-stock')
  async analyzeStock(@Body() body: { symbol: string; data: any }) {
    const { symbol, data } = body;

    const prompt = `
You are a stock analyst. Analyze the following company and provide a brief investment thesis.

Company: ${symbol}
Current Price: $${data.price || 'N/A'}
P/E Ratio: ${data.pe || 'N/A'}
Revenue Growth: ${data.revenueGrowth || 'N/A'}%
Sector: ${data.sector || 'N/A'}

Provide:
1. Investment thesis (2-3 sentences)
2. Key strengths
3. Main risks
4. Recommendation (Buy/Hold/Sell)

Keep response under 200 words.
    `.trim();

    try {
      const response = await this.llmService.generate(prompt);

      return {
        success: true,
        symbol,
        analysis: response,
        provider: this.llmService.getProviderName(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
