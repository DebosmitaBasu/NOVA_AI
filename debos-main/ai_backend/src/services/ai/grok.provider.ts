import { BaseProvider } from "./base.provider.js";
import { parseChatCompletionContent } from "./parseResponse.js";
import type { AIRequest, AIResponse } from "./types.js";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const XAI_BASE_URL = "https://api.x.ai/v1";

export class GrokProvider extends BaseProvider {
  constructor(apiKey: string, baseUrl: string) {
    super("grok", apiKey, baseUrl);
  }

  private resolveConfig(): { baseUrl: string; model: string } {
    const isGroqKey = this.apiKey.startsWith("gsk_");

    if (isGroqKey) {
      return {
        baseUrl: GROQ_BASE_URL,
        model: "llama-3.3-70b-versatile",
      };
    }

    const normalizedBase = this.baseUrl.replace(/\/$/, "");
    const resolvedBase = normalizedBase.includes("groq.com") ? GROQ_BASE_URL : normalizedBase || XAI_BASE_URL;

    if (resolvedBase.includes("groq.com")) {
      return {
        baseUrl: GROQ_BASE_URL,
        model: "llama-3.3-70b-versatile",
      };
    }

    return {
      baseUrl: resolvedBase.endsWith("/v1") ? resolvedBase : `${resolvedBase}/v1`,
      model: "grok-4.3",
    };
  }

  private getChatCompletionsUrl(baseUrl: string): string {
    const normalizedBase = baseUrl.replace(/\/$/, "");
    return normalizedBase.endsWith("/v1")
      ? `${normalizedBase}/chat/completions`
      : `${normalizedBase}/v1/chat/completions`;
  }

  async generate(payload: AIRequest): Promise<AIResponse> {
    if (!this.apiKey) {
      throw new Error("Grok API key is not configured");
    }

    const { baseUrl, model } = this.resolveConfig();

    const response = await fetch(this.getChatCompletionsUrl(baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: payload.messages,
        temperature: payload.temperature ?? 0.7,
        top_p: payload.topP ?? 0.9,
        max_tokens: payload.maxTokens ?? 600,
        stream: payload.stream ?? false,
        ...(model.startsWith("grok") ? { reasoning_effort: "none" } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let friendlyMessage = "Grok request failed. Check your API key in ai_backend/.env";

      try {
        const parsed = JSON.parse(errorText) as { error?: string | { message?: string } };
        const apiError = typeof parsed.error === "string" ? parsed.error : parsed.error?.message;
        if (apiError?.toLowerCase().includes("api key")) {
          friendlyMessage = "Grok API key is invalid. Add a valid xAI key (xai-...) or Groq key (gsk_...) to ai_backend/.env";
        }
      } catch {
        // Keep default friendly message.
      }

      throw new Error(friendlyMessage);
    }

    const rawText = await response.text();

    return {
      content: parseChatCompletionContent(rawText),
      provider: "grok",
    };
  }

  async health(): Promise<{ ok: boolean; message: string }> {
    if (!this.apiKey) {
      return { ok: false, message: "grok provider is missing an API key" };
    }

    const isGroqKey = this.apiKey.startsWith("gsk_");
    return {
      ok: true,
      message: isGroqKey ? "grok provider is configured (via Groq)" : "grok provider is configured (via xAI)",
    };
  }
}
