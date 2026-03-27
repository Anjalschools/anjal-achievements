export type SecurityEventKind = "login_failure" | "access_denied" | "rate_limited";

/**
 * Lightweight security telemetry (console only; no DB).
 * Never log secrets, tokens, or full request bodies.
 */
export const warnSecurityEvent = (
  kind: SecurityEventKind,
  meta?: Record<string, string | number | boolean | undefined>
) => {
  const safe = meta
    ? Object.fromEntries(
        Object.entries(meta).filter(([, v]) => v !== undefined && v !== "")
      )
    : undefined;
  console.warn("[security]", kind, safe && Object.keys(safe).length ? JSON.stringify(safe) : "");
};
