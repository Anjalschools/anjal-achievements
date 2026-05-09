/**
 * Optional OpenAI hook — disabled by default to avoid latency and extra dependencies.
 * When implementing: call from {@link runAlumniAssistantRecommend} only if env enables it,
 * keep strict timeouts, and fall back to internal logic on any failure.
 */
export const isAlumniAssistantOpenAIEnabled = (): boolean =>
  process.env.ALUMNI_ASSISTANT_OPENAI === "1" && Boolean(process.env.OPENAI_API_KEY?.trim());

export const tryEnrichAssistantFocusWithOpenAI = async (_query: string): Promise<string | null> => {
  if (!isAlumniAssistantOpenAIEnabled()) return null;
  return null;
};
