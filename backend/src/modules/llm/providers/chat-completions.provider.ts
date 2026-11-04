import { Logger } from '@nestjs/common';
import type { ChatMessage, ChatOptions, GenerateOptions, LLMProvider } from './llm-provider.interface';

export type ChatCompletionsConfig = {
  /** Provider id used in API/UI, e.g. "openai" | "deepseek" | "nvidia". */
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string | null;
  defaultModel: string;
  /** Model ids this provider offers in the UI picker. */
  models: { id: string; label: string; tier: 'high' | 'standard' }[];
};

/**
 * OpenAI-compatible chat/completions provider. Used for OpenAI, DeepSeek and NVIDIA NIM,
 * which all speak the same wire format (Emperor-style raw fetch, no SDK).
 */
export class ChatCompletionsProvider implements LLMProvider {
  private readonly logger = new Logger(ChatCompletionsProvider.name);
  readonly name: string;

  constructor(readonly config: ChatCompletionsConfig) {
    this.name = config.id;
  }

  get configured() {
    return Boolean(this.config.apiKey);
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    if (!this.config.apiKey) throw new Error(`${this.config.name} API key is not configured`);
    const model = options?.model || this.config.defaultModel;
    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 1800,
        stream: false,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    const body = (await res.json().catch(() => null)) as
      | { choices?: { message?: { content?: string; reasoning_content?: string } }[]; error?: { message?: string } }
      | null;
    if (!res.ok || !body?.choices?.length) {
      const message = body?.error?.message ?? `HTTP ${res.status}`;
      this.logger.warn(`${this.config.name}/${model}: ${message}`);
      throw new Error(`${this.config.name} request failed: ${message}`);
    }
    const msg = body.choices[0].message;
    // DeepSeek reasoner puts the answer in reasoning_content when content is empty.
    return (msg?.content?.trim() || msg?.reasoning_content?.trim()) ?? '';
  }

  async embed(): Promise<number[]> {
    throw new Error(`${this.config.name} embeddings are not wired`);
  }

  async isAvailable(): Promise<boolean> {
    return this.configured;
  }
}
