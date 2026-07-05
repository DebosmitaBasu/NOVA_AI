import { BaseProvider } from "./base.provider.js";
import { parseChatCompletionContent } from "./parseResponse.js";
import type { AIRequest, AIResponse } from "./types.js";

export class SarvamProvider extends BaseProvider {
  constructor(apiKey: string, baseUrl: string) {
    super("sarvam", apiKey, baseUrl);
  }

  private getChatCompletionsUrl(): string {
    const normalizedBase = this.baseUrl.replace(/\/$/, "");
    return normalizedBase.endsWith("/v1")
      ? `${normalizedBase}/chat/completions`
      : `${normalizedBase}/v1/chat/completions`;
  }

  async generate(payload: AIRequest): Promise<AIResponse> {
    if (!this.apiKey) {
      throw new Error("Sarvam AI API key is not configured");
    }

    const response = await fetch(this.getChatCompletionsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": this.apiKey,
      },
      body: JSON.stringify({
        model: "sarvam-30b",
        messages: payload.messages,
        temperature: payload.temperature ?? 0.7,
        top_p: payload.topP ?? 0.9,
        max_tokens: payload.maxTokens ?? 600,
        stream: payload.stream ?? false,
        reasoning_effort: null,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sarvam request failed: ${errorText || response.statusText}`);
    }

    const rawText = await response.text();

    return {
      content: parseChatCompletionContent(rawText),
      provider: "sarvam",
    };
  }
}
