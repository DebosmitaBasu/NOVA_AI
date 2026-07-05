import type { AIProvider, AIProviderName, AIRequest, AIResponse } from "./types.js";

export abstract class BaseProvider implements AIProvider {
  constructor(public readonly name: AIProviderName, protected readonly apiKey: string, protected readonly baseUrl: string) {}

  abstract generate(payload: AIRequest): Promise<AIResponse>;

  async health(): Promise<{ ok: boolean; message: string }> {
    return {
      ok: Boolean(this.apiKey),
      message: this.apiKey ? `${this.name} provider is configured` : `${this.name} provider is missing an API key`,
    };
  }
}
