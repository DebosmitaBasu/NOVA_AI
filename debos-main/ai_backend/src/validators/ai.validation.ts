import { z } from "zod";

export const aiChatSchema = z.object({
  provider: z.enum(["sarvam", "grok", "ollama"]).default("grok"),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1, "Message content is required"),
      }),
    )
    .min(1),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().positive().max(4000).optional(),
  stream: z.boolean().optional(),
  model: z.string().optional(), // For Ollama model selection
});

export type AIChatInput = z.infer<typeof aiChatSchema>;
