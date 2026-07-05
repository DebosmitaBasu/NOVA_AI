import type { NextFunction, Request, Response } from "express";
import { AIService } from "../services/ai.service.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import type { AIProviderName } from "../services/ai/types.js";

export const chatController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AIService.generateResponse(req.body.provider, {
      messages: req.body.messages,
      systemPrompt: req.body.systemPrompt,
      temperature: req.body.temperature,
      topP: req.body.topP,
      maxTokens: req.body.maxTokens,
      stream: req.body.stream,
      model: req.body.model, // Ollama model override
    });

    return sendSuccess(res, 200, "AI response generated", { response: result });
  } catch (error) {
    next(error);
  }
};

export const providerStatusController = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const providerParam = _req.query.provider as string | undefined;
    const validProviders: AIProviderName[] = ["sarvam", "grok", "ollama"];
    const providerName: AIProviderName = validProviders.includes(providerParam as AIProviderName)
      ? (providerParam as AIProviderName)
      : "grok";

    const status = await AIService.getProviderStatus(providerName);
    return sendSuccess(res, 200, "Provider status fetched", { provider: providerName, status });
  } catch (error) {
    next(error);
  }
};
