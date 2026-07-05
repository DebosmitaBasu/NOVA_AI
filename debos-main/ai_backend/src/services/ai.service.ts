import ApiError from "../utils/ApiError.js";
import { ProviderFactory } from "./ai/providerFactory.js";
import type { AIProviderName, AIRequest, AIResponse } from "./ai/types.js";

const FALLBACK_ORDER: Record<AIProviderName, AIProviderName[]> = {
  grok: ["sarvam", "ollama"],
  sarvam: ["grok", "ollama"],
  ollama: ["grok", "sarvam"],
};

export class AIService {
  static async generateResponse(providerName: AIProviderName, payload: AIRequest): Promise<AIResponse> {
    const providersToTry = [providerName, ...FALLBACK_ORDER[providerName]];
    let lastError: Error | null = null;

    for (const name of providersToTry) {
      if (!AIService.isProviderConfigured(name)) {
        continue;
      }

      try {
        const provider = ProviderFactory.create(name);
        const response = await provider.generate(payload);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("AI provider request failed");
      }
    }

    const message = lastError?.message ?? "AI provider request failed";
    throw new ApiError(502, message);
  }

  static async getProviderStatus(providerName: AIProviderName): Promise<{ ok: boolean; message: string }> {
    const provider = ProviderFactory.create(providerName);
    return provider.health();
  }

  private static isProviderConfigured(providerName: AIProviderName): boolean {
    if (providerName === "sarvam") {
      return true; // will throw at runtime if key missing
    }
    if (providerName === "ollama") {
      return true; // no key needed — local Ollama
    }
    return true; // grok — will throw at runtime if key missing
  }
}
