/**
 * Whether the admin UI should expose AI review columns / heavy AI affordances.
 * Default: off unless explicitly enabled or an OpenAI key is configured (future GPT layer).
 */
export const isAiReviewUiEnabled = (): boolean => {
  const explicit = process.env.AI_REVIEW_UI_ENABLED?.trim();
  if (explicit === "0" || explicit === "false") return false;
  if (explicit === "1" || explicit === "true") return true;
  return Boolean(process.env.OPENAI_API_KEY?.trim());
};
