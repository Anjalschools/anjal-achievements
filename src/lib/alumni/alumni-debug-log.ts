/**
 * Opt-in diagnostics for alumni admin/public routes.
 * Set ALUMNI_DEBUG=1 — do not log secrets, tokens, or full PII payloads.
 */
export const alumniDebugLog = (scope: string, payload: Record<string, unknown>): void => {
  if (process.env.ALUMNI_DEBUG !== "1") return;
  console.info(`[alumni-debug:${scope}]`, payload);
};
