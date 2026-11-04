import { Logger } from '@nestjs/common';
import type { ChatMessage, ChatOptions, GenerateOptions, LLMProvider } from './llm-provider.interface';

export const ANTHROPIC_MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', tier: 'high' as const },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', tier: 'high' as const },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', tier: 'standard' as const },
];

/** Anthropic Messages API (system prompt is a top-level field, not a message). */
export class AnthropicProvider implements LLMProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  readonly name = 'anthropic';
  readonly defaultModel = ANTHROPIC_MODELS[0].id;

  constructor(private readonly apiKey: string | null) {}

  get configured() {
    return Boolean(this.apiKey);
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    if (!this.apiKey) throw new Error('Anthropic API key is not configured');
    const model = options?.model || this.defaultModel;
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: options?.maxTokens ?? 1800,
        temperature: options?.temperature ?? 0.3,
        system: system || undefined,
        messages: messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: AbortSignal.timeout(90_000),
    });
    const body = (await res.json().catch(() => null)) as
      | { content?: { type: string; text?: string }[]; error?: { message?: string } }
      | null;
    if (!res.ok || !body?.content) {
      const message = body?.error?.message ?? `HTTP ${res.status}`;
      this.logger.warn(`anthropic/${model}: ${message}`);
      throw new Error(`Anthropic request failed: ${message}`);
    }
    return body.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('')
      .trim();
  }

  async embed(): Promise<number[]> {
    throw new Error('Anthropic embeddings are not available');
  }

  async isAvailable(): Promise<boolean> {
    return this.configured;
  }
}
