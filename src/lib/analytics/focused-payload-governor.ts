/**
 * Focused API payload size governance — prevents BSON blowups reaching the client.
 */

export const FOCUSED_PAYLOAD_WARN_BYTES = 5 * 1024 * 1024;
export const FOCUSED_PAYLOAD_CRITICAL_BYTES = 10 * 1024 * 1024;
export const FOCUSED_PAYLOAD_HARD_STOP_BYTES = 14 * 1024 * 1024;

export type FocusedPayloadGovernanceResult = {
  bytes: number;
  level: "ok" | "warning" | "critical" | "hard_stop";
  trimmed: boolean;
  blocked: boolean;
  warnings: string[];
};

const log = (tag: string, payload: Record<string, unknown>): void => {
  // eslint-disable-next-line no-console
  console.info(tag, payload);
};

export const estimateFocusedPayloadBytes = (payload: unknown): number => {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  } catch {
    return 0;
  }
};

export const validateFocusedPayloadSize = (
  payload: unknown,
  meta?: { scope?: string; correlationId?: string }
): FocusedPayloadGovernanceResult => {
  const bytes = estimateFocusedPayloadBytes(payload);
  const warnings: string[] = [];
  let level: FocusedPayloadGovernanceResult["level"] = "ok";

  if (bytes >= FOCUSED_PAYLOAD_WARN_BYTES) {
    level = "warning";
    warnings.push("payload_soft_limit");
    log("[FOCUSED_PAYLOAD_WARNING]", { scope: meta?.scope, bytes, correlationId: meta?.correlationId });
  }
  if (bytes >= FOCUSED_PAYLOAD_CRITICAL_BYTES) {
    level = "critical";
    warnings.push("payload_critical_limit");
    log("[FOCUSED_PAYLOAD_CRITICAL]", { scope: meta?.scope, bytes, correlationId: meta?.correlationId });
  }
  if (bytes >= FOCUSED_PAYLOAD_HARD_STOP_BYTES) {
    level = "hard_stop";
    warnings.push("payload_hard_stop");
    log("[FOCUSED_PAYLOAD_CRITICAL]", { scope: meta?.scope, bytes, hardStop: true, correlationId: meta?.correlationId });
  }

  return { bytes, level, trimmed: false, blocked: level === "hard_stop", warnings };
};

/** Strip heavy arrays when payload is oversized (degrade instead of crash). */
export const trimFocusedPayloadForTransport = <T extends Record<string, unknown>>(
  payload: T,
  governance: FocusedPayloadGovernanceResult
): T => {
  if (governance.level === "ok") return payload;
  const out = { ...payload, degraded: true as const };
  const mutable = out as T & { degraded: true; participants?: unknown[] };
  if (Array.isArray(mutable.participants) && mutable.participants.length > 50) {
    mutable.participants = mutable.participants.slice(0, 50);
    governance.trimmed = true;
  }
  if ("rankingPool" in out) delete out.rankingPool;
  return out;
};

export const warnFocusedPayloadOverflow = (
  bytes: number,
  scope: string,
  correlationId?: string
): void => {
  if (bytes < FOCUSED_PAYLOAD_WARN_BYTES) return;
  const tag = bytes >= FOCUSED_PAYLOAD_CRITICAL_BYTES ? "[FOCUSED_PAYLOAD_CRITICAL]" : "[FOCUSED_PAYLOAD_WARNING]";
  log(tag, { scope, bytes, correlationId });
};
