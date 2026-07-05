export type AIProviderName = "sarvam" | "grok" | "ollama";

export interface AIProvider {
  name: AIProviderName;
  generate(payload: AIRequest): Promise<AIResponse>;
  health(): Promise<{ ok: boolean; message: string }>;
}

export interface AIRequest {
  messages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stream?: boolean;
  model?: string;
}

export interface AIResponse {
  content: string;
  provider: AIProviderName;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}
