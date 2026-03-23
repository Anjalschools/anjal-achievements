/**
 * OpenAI configuration from environment only (never exposed to the client).
 */

export const getOpenAiApiKey = (): string | undefined => {
  const k = process.env.OPENAI_API_KEY?.trim();
  return k || undefined;
};

/** Default: cost-efficient model suitable for structured JSON tasks. */
export const getOpenAiModel = (): string => process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

export const isOpenAiConfigured = (): boolean => Boolean(getOpenAiApiKey());

/**
 * Master switch for AI assist features (form + reviewer drafts).
 * Set AI_ASSIST_ENABLED=false to disable even when a key exists.
 */
export const isAiAssistEnabled = (): boolean => {
  const v = process.env.AI_ASSIST_ENABLED?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return isOpenAiConfigured();
};
