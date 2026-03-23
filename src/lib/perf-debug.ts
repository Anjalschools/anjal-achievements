/**
 * Opt-in server timing logs. Set PERF_DEBUG=1 in .env.local to enable.
 * Keeps production logs clean by default.
 */

const perfEnabled = (): boolean =>
  process.env.PERF_DEBUG === "1" || process.env.AI_DEBUG === "1";

export const perfLog = (message: string, extra?: Record<string, unknown>): void => {
  if (!perfEnabled()) return;
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[PERF] ${message}`, extra);
  } else {
    console.log(`[PERF] ${message}`);
  }
};

export const perfNow = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

export const perfElapsed = (label: string, startMs: number): void => {
  if (!perfEnabled()) return;
  const ms = Math.round(perfNow() - startMs);
  console.log(`[PERF] ${label}=${ms}ms`);
};
