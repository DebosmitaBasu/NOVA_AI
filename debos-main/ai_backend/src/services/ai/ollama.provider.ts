import type { AIRequest, AIResponse } from "./types.js";
import { BaseProvider } from "./base.provider.js";

const OLLAMA_BASE_URL = "http://localhost:11434";

export class OllamaProvider extends BaseProvider {
  private readonly ollamaBaseUrl: string;

  constructor(baseUrl?: string) {
    // Ollama needs no API key — pass empty string
    super("ollama", "", baseUrl || OLLAMA_BASE_URL);
    this.ollamaBaseUrl = (baseUrl || OLLAMA_BASE_URL).replace(/\/$/, "");
  }

  async generate(payload: AIRequest): Promise<AIResponse> {
    const model = payload.model || "llama3";

    // Build messages array (Ollama uses the same OpenAI-compatible format)
    const messages = payload.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Try OpenAI-compatible endpoint first (/v1/chat/completions)
    const response = await fetch(`${this.ollamaBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        temperature: payload.temperature ?? 0.7,
        top_p: payload.topP ?? 0.9,
        max_tokens: payload.maxTokens ?? 600,
        stream: false,
      }),
    }).catch(async () => {
      // Fallback: native Ollama /api/chat endpoint
      return fetch(`${this.ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature: payload.temperature ?? 0.7,
            top_p: payload.topP ?? 0.9,
            num_predict: payload.maxTokens ?? 600,
          },
        }),
      });
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama request failed: ${errorText || response.statusText}. Make sure Ollama is running (ollama serve) and the model is pulled (ollama pull ${model}).`
      );
    }

    const rawText = await response.text();

    // Try to parse as OpenAI-compatible response
    try {
      const parsed = JSON.parse(rawText) as {
        choices?: Array<{ message?: { content?: string }; text?: string }>;
        message?: { content?: string };
      };

      // OpenAI-compatible format
      if (parsed.choices?.[0]?.message?.content) {
        return { content: parsed.choices[0].message.content, provider: "ollama" };
      }

      // Native Ollama /api/chat format
      if (parsed.message?.content) {
        return { content: parsed.message.content, provider: "ollama" };
      }
    } catch {
      // If not JSON, return raw text
      return { content: rawText.trim(), provider: "ollama" };
    }

    return { content: "Ollama returned an empty response.", provider: "ollama" };
  }

  async health(): Promise<{ ok: boolean; message: string }> {
    try {
      const response = await fetch(`${this.ollamaBaseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        return { ok: false, message: "Ollama is running but returned an error" };
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const modelCount = data.models?.length ?? 0;

      return {
        ok: true,
        message:
          modelCount > 0
            ? `Ollama online — ${modelCount} model${modelCount === 1 ? "" : "s"} available`
            : "Ollama online — no models pulled yet (run: ollama pull llama3)",
      };
    } catch {
      return {
        ok: false,
        message: "Ollama is not running. Start it with: ollama serve",
      };
    }
  }
}
