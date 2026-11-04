import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaProvider } from './providers/ollama.provider';
import {
  GenerateOptions,
  ChatMessage,
  ChatOptions,
  LLMProvider,
} from './providers/llm-provider.interface';

@Injectable()
export class LLMService implements OnModuleInit {
  private currentProvider: LLMProvider;

  constructor(
    private readonly ollamaProvider: OllamaProvider,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initializeProvider();
  }

  private async initializeProvider() {
    const preferredProvider = this.configService.get('LLM_PROVIDER', 'ollama');

    if (preferredProvider === 'ollama') {
      const isAvailable = await this.ollamaProvider.isAvailable();
      if (isAvailable) {
        this.currentProvider = this.ollamaProvider;
        console.log('✓ LLM provider initialized: Ollama');
      } else {
        console.warn('⚠ Ollama is not available. Please start Ollama service.');
        throw new Error('No LLM provider available');
      }
    }
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    if (!this.currentProvider) {
      throw new Error('LLM provider not initialized');
    }

    try {
      return await this.currentProvider.generate(prompt, options);
    } catch (error) {
      console.error(`LLM generation failed with ${this.currentProvider.name}:`, error);
      throw error;
    }
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    if (!this.currentProvider) {
      throw new Error('LLM provider not initialized');
    }

    return await this.currentProvider.chat(messages, options);
  }

  async embed(text: string): Promise<number[]> {
    if (!this.currentProvider) {
      throw new Error('LLM provider not initialized');
    }

    return await this.currentProvider.embed(text);
  }

  getProviderName(): string {
    return this.currentProvider?.name || 'none';
  }

  async isAvailable(): Promise<boolean> {
    return this.currentProvider?.isAvailable() || false;
  }
}
