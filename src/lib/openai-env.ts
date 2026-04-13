/**
 * OpenAI configuration from environment only (never exposed to the client).
 */

const normalizeApiKey = (raw: string | undefined): string | undefined => {
  if (raw === undefined) return undefined;
  let k = raw.trim();
  if (!k) return undefined;
  if (k.charCodeAt(0) === 0xfeff) k = k.slice(1).trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  return k || undefined;
};

export const getOpenAiApiKey = (): string | undefined => normalizeApiKey(process.env.OPENAI_API_KEY);

/** Default: cost-efficient model suitable for structured JSON tasks. */
export const getOpenAiModel = (): string => process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

export const isOpenAiConfigured = (): boolean => Boolean(getOpenAiApiKey());

/**
 * Master switch for AI assist features (form + reviewer drafts).
 * Set AI_ASSIST_ENABLED=false (or off/no/disabled) to disable even when a key exists.
 * When unset, AI is on iff OPENAI_API_KEY is present (after normalization).
 */
export const isAiAssistEnabled = (): boolean => {
  const v = process.env.AI_ASSIST_ENABLED?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no" || v === "disabled") return false;
  return isOpenAiConfigured();
};

export type OpenAiRuntimeDiagnostics = {
  routeName: string;
  hasOpenAiKey: boolean;
  aiAssistEnabled: boolean;
};

/**
 * Safe diagnostics when AI_DEBUG=1 — never logs the key or any secret.
 */
export const logOpenAiRuntimeDiagnostics = (routeName: string): void => {
  if (process.env.AI_DEBUG !== "1") return;
  const hasOpenAiKey = Boolean(getOpenAiApiKey());
  const aiAssist = isAiAssistEnabled();
  // eslint-disable-next-line no-console
  console.log("[openai-env:diagnostics]", { routeName, hasOpenAiKey, aiAssistEnabled: aiAssist });
};
