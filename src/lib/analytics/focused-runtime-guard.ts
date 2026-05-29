/**
 * Server-side focused aggregation runtime guard — memory, timing, degraded mode.
 */

export const FOCUSED_HEAP_DEGRADED_MB = 650;
export const FOCUSED_AGG_LIGHT_MODE_MS = 15_000;
export const FOCUSED_RANKING_POOL_MAX = 600;
export const FOCUSED_RANKING_POOL_DEGRADED = 200;

export type FocusedRuntimeSnapshot = {
  heapUsedMb: number;
  degraded: boolean;
  lightMode: boolean;
  rankingPoolLimit: number;
};

const log = (tag: string, payload: Record<string, unknown>): void => {
  // eslint-disable-next-line no-console
  console.info(tag, payload);
};

export const readFocusedRuntimeSnapshot = (): FocusedRuntimeSnapshot => {
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const degraded = heapUsedMb > FOCUSED_HEAP_DEGRADED_MB;
  if (degraded) {
    log("[FOCUSED_MEMORY_SPIKE]", { heapUsedMb, rssMb: Math.round(mem.rss / 1024 / 1024) });
    log("[FOCUSED_RUNTIME_DEGRADED]", { reason: "heap_threshold", heapUsedMb });
  }
  return {
    heapUsedMb,
    degraded,
    lightMode: degraded,
    rankingPoolLimit: degraded ? FOCUSED_RANKING_POOL_DEGRADED : FOCUSED_RANKING_POOL_MAX,
  };
};

export const recordFocusedAggregationTiming = (input: {
  scope: string;
  durationMs: number;
  correlationId?: string;
  rowCount?: number;
}): { lightMode: boolean } => {
  log("[FOCUSED_AGGREGATION_END]", input);
  if (input.durationMs > FOCUSED_AGG_LIGHT_MODE_MS) {
    log("[FOCUSED_AGG_TIMEOUT]", { ...input, thresholdMs: FOCUSED_AGG_LIGHT_MODE_MS });
    log("[FOCUSED_AGGREGATION_DEGRADED]", { reason: "slow_aggregation", ...input });
    return { lightMode: true };
  }
  return { lightMode: false };
};

export const logFocusedAggregationStart = (scope: string, correlationId?: string): void => {
  log("[FOCUSED_AGGREGATION_START]", { scope, correlationId });
};
