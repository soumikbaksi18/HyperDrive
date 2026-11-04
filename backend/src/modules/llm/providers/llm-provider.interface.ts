export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  model?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions extends GenerateOptions {
  stream?: boolean;
}

export interface LLMProvider {
  name: string;
  
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
  
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  
  embed(text: string): Promise<number[]>;
  
  isAvailable(): Promise<boolean>;
}
