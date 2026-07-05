interface ChatCompletionPayload {
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
    };
  }>;
}

export function parseChatCompletionContent(rawText: string): string {
  if (!rawText) {
    return "I could not generate a reply right now.";
  }

  try {
    const data = JSON.parse(rawText) as ChatCompletionPayload;
    const message = data.choices?.[0]?.message;
    const content = message?.content?.trim();
    const reasoningContent = message?.reasoning_content?.trim();

    if (content) {
      return content;
    }

    if (reasoningContent) {
      return reasoningContent;
    }
  } catch {
    return rawText;
  }

  return "I could not generate a reply right now.";
}
