/**
 * Optional pipeline snapshots for local diagnosis only.
 * Enable with DEBUG_ATTACHMENT_AI=1 (never enable in shared production logs).
 */

const MAX_STRING_SNAP = 8000;

export const isDebugAttachmentAi = (): boolean => process.env.DEBUG_ATTACHMENT_AI === "1";

/**
 * Logs a structured snapshot to stderr. Long strings are truncated in output.
 */
export const debugAttachmentAiSnap = (phase: string, data: Record<string, unknown>): void => {
  if (!isDebugAttachmentAi()) return;
  try {
    const out = JSON.stringify(
      data,
      (_key, value) => {
        if (typeof value === "string" && value.length > MAX_STRING_SNAP) {
          return `${value.slice(0, MAX_STRING_SNAP)}…[truncated, total ${value.length} chars]`;
        }
        return value;
      },
      2
    );
    // eslint-disable-next-line no-console
    console.error(`[DEBUG_ATTACHMENT_AI] ${phase}`, out);
  } catch {
    // eslint-disable-next-line no-console
    console.error(`[DEBUG_ATTACHMENT_AI] ${phase}`, "(snap serialization failed)");
  }
};
