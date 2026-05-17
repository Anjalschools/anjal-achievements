/**
 * In-process ring buffer of slow/failed routes for /admin/system/health (single Render instance).
 */

export type SlowRouteEntry = {
  path: string;
  durationMs: number;
  at: string;
  correlationId: string;
  errorCode?: string;
  memoryHeapMb?: number;
  payloadBytes?: number;
  degraded?: boolean;
};

const MAX = 40;
const entries: SlowRouteEntry[] = [];

export const recordSlowRoute = (entry: SlowRouteEntry) => {
  entries.unshift(entry);
  if (entries.length > MAX) entries.length = MAX;
};

export const getSlowRouteEntries = (limit = 15): SlowRouteEntry[] => entries.slice(0, limit);

export const clearSlowRouteRegistry = () => {
  entries.length = 0;
};
