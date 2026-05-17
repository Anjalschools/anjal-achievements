/**
 * Query / aggregation safety guards for heavy Mongo workloads.
 */

export const DEFAULT_ROUTE_TIMEOUT_MS = 28_000;
export const DEFAULT_AGGREGATION_TIMEOUT_MS = 22_000;
export const DEFAULT_CRON_TIMEOUT_MS = 120_000;

export class QueryTimeoutError extends Error {
  readonly code = "ROUTE_TIMEOUT";
  constructor(label: string, ms: number) {
    super(`${label} exceeded ${ms}ms`);
    this.name = "QueryTimeoutError";
  }
}

export const withTimeout = async <T>(
  label: string,
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } catch (e) {
    if (controller.signal.aborted) {
      throw new QueryTimeoutError(label, ms);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
};

/** Cap chart/table rows after aggregation. */
export const capRows = <T>(rows: T[], max: number): { rows: T[]; truncated: boolean } => {
  if (rows.length <= max) return { rows, truncated: false };
  return { rows: rows.slice(0, max), truncated: true };
};

export const MAX_AGGREGATION_RESULT_ROWS = 5000;
export const MAX_CHART_SLICES = 24;
