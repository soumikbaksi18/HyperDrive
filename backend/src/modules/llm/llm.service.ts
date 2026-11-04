import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicProvider, ANTHROPIC_MODELS } from './providers/anthropic.provider';
import { ChatCompletionsProvider, type ChatCompletionsConfig } from './providers/chat-completions.provider';
import type { ChatMessage, ChatOptions, GenerateOptions, LLMProvider } from './providers/llm-provider.interface';
import { OllamaProvider } from './providers/ollama.provider';

export type ModelChoice = {
  /** "<provider>/<model>" e.g. "deepseek/deepseek-chat" — what the UI sends back. */
  id: string;
  provider: string;
  providerName: string;
  model: string;
  label: string;
  tier: 'high' | 'standard';
  available: boolean;
};

/**
 * Registry of LLM providers (OpenAI, Anthropic, DeepSeek, NVIDIA NIM, Ollama).
 * A caller picks a model with "provider/model"; the default is the first configured provider.
 */
@Injectable()
export class LLMService implements OnModuleInit {
  private readonly logger = new Logger(LLMService.name);
  private readonly providers = new Map<string, LLMProvider>();
  private readonly catalog: ModelChoice[] = [];
  private ollamaUp = false;

  constructor(
    private readonly ollamaProvider: OllamaProvider,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const key = (name: string) => this.configService.get<string>(name)?.trim() || null;

    const chat = (p: ChatCompletionsConfig) => {
      const provider = new ChatCompletionsProvider(p);
      this.providers.set(p.id, provider);
      for (const m of p.models) {
        this.catalog.push({
          id: `${p.id}/${m.id}`,
          provider: p.id,
          providerName: p.name,
          model: m.id,
          label: m.label,
          tier: m.tier,
          available: provider.configured,
        });
      }
      return provider;
    };

    chat({
      id: 'openai',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: key('OPENAI_API_KEY'),
      defaultModel: 'gpt-4o',
      models: [
        { id: 'gpt-4o', label: 'GPT-4o', tier: 'high' },
        { id: 'gpt-4o-mini', label: 'GPT-4o mini', tier: 'standard' },
      ],
    });
    const anthropic = new AnthropicProvider(key('ANTHROPIC_API_KEY') ?? key('CLAUDE_API_KEY'));
    this.providers.set('anthropic', anthropic);
    for (const m of ANTHROPIC_MODELS) {
      this.catalog.push({
        id: `anthropic/${m.id}`,
        provider: 'anthropic',
        providerName: 'Anthropic',
        model: m.id,
        label: m.label,
        tier: m.tier,
        available: anthropic.configured,
      });
    }
    chat({
      id: 'deepseek',
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com',
      apiKey: key('DEEPSEEK_API_KEY'),
      defaultModel: 'deepseek-chat',
      models: [
        { id: 'deepseek-chat', label: 'DeepSeek V3 (chat)', tier: 'high' },
        { id: 'deepseek-reasoner', label: 'DeepSeek R1 (reasoner)', tier: 'high' },
      ],
    });
    chat({
      id: 'nvidia',
      name: 'NVIDIA NIM',
      baseUrl: this.configService.get<string>('NVIDIA_API_BASE')?.trim() || 'https://integrate.api.nvidia.com/v1',
      apiKey: key('NVIDIA_API_KEY'),
      defaultModel: this.configService.get<string>('NVIDIA_MODEL')?.trim() || 'meta/llama-3.3-70b-instruct',
      models: [
        {
          id: this.configService.get<string>('NVIDIA_MODEL')?.trim() || 'meta/llama-3.3-70b-instruct',
          label: `NVIDIA · ${this.configService.get<string>('NVIDIA_MODEL')?.trim() || 'Llama 3.3 70B'}`,
          tier: 'standard',
        },
        { id: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'NVIDIA · Nemotron 70B', tier: 'standard' },
        { id: 'deepseek-ai/deepseek-r1', label: 'NVIDIA · DeepSeek R1', tier: 'high' },
      ],
    });

    this.providers.set('ollama', this.ollamaProvider);
    this.ollamaUp = await this.ollamaProvider.isAvailable();
    this.catalog.push({
      id: 'ollama/default',
      provider: 'ollama',
      providerName: 'Ollama (local)',
      model: 'default',
      label: 'Ollama · local model',
      tier: 'standard',
      available: this.ollamaUp,
    });

    const ready = this.catalog.filter((m) => m.available).map((m) => m.id);
    this.logger.log(ready.length ? `LLM models ready: ${ready.join(', ')}` : 'No LLM provider configured; AI reasoning will use rule-based fallbacks');
  }

  models(): ModelChoice[] {
    return this.catalog;
  }

  /** First configured model, or null if nothing is set up. */
  defaultModelId(): string | null {
    return this.catalog.find((m) => m.available)?.id ?? null;
  }

  private resolve(modelId?: string | null): { provider: LLMProvider; model: string | undefined; id: string } {
    const id = modelId || this.defaultModelId();
    if (!id) throw new Error('No LLM provider is configured (set OPENAI_API_KEY, ANTHROPIC_API_KEY, DEEPSEEK_API_KEY or NVIDIA_API_KEY)');
    const slash = id.indexOf('/');
    const providerId = slash === -1 ? id : id.slice(0, slash);
    const model = slash === -1 ? undefined : id.slice(slash + 1);
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Unknown LLM provider "${providerId}"`);
    const choice = this.catalog.find((m) => m.id === id);
    if (choice && !choice.available) throw new Error(`${choice.providerName} is not configured on the backend`);
    return { provider, model: model === 'default' ? undefined : model, id };
  }

  async generate(prompt: string, options?: GenerateOptions & { modelId?: string | null }): Promise<string> {
    const { provider, model } = this.resolve(options?.modelId);
    return provider.generate(prompt, { ...options, model: model ?? options?.model });
  }

  async chat(messages: ChatMessage[], options?: ChatOptions & { modelId?: string | null }): Promise<string> {
    const { provider, model } = this.resolve(options?.modelId);
    return provider.chat(messages, { ...options, model: model ?? options?.model });
  }

  async embed(text: string): Promise<number[]> {
    return this.ollamaProvider.embed(text);
  }

  getProviderName(): string {
    return this.defaultModelId() ?? 'none';
  }

  async isAvailable(): Promise<boolean> {
    return this.defaultModelId() != null;
  }
}
