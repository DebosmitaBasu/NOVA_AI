import { env } from "../../config/env.js";
import { GrokProvider } from "./grok.provider.js";
import { SarvamProvider } from "./sarvam.provider.js";
import { OllamaProvider } from "./ollama.provider.js";
import type { AIProvider, AIProviderName } from "./types.js";

export class ProviderFactory {
  static create(providerName: AIProviderName): AIProvider {
    switch (providerName) {
      case "sarvam":
        return new SarvamProvider(env.SARVAM_API_KEY, env.SARVAM_BASE_URL);
      case "grok":
        return new GrokProvider(env.GROK_API_KEY, env.GROK_BASE_URL);
      case "ollama":
        return new OllamaProvider(env.OLLAMA_BASE_URL);
      default:
        return new GrokProvider(env.GROK_API_KEY, env.GROK_BASE_URL);
    }
  }
}
