/**
 * Client/server-safe executive analytics runtime health registry.
 * Development: exposed on window.__EXEC_ANALYTICS_RUNTIME__
 */

export type ExecFacetScope =
  | "summary"
  | "participants"
  | "charts"
  | "trends"
  | "insights"
  | "compare"
  | "executive"
  | "full"
  | "export"
  | string;

export type ExecAnalyticsRuntimeSnapshot = {
  updatedAt: string;
  activeFacets: Record<string, { startedAt: number; correlationId?: string }>;
  inflightRequests: Record<string, { scope: string; startedAt: number }>;
  abortedTotal: number;
  hydrationDurationsMs: Partial<Record<string, number>>;
  chartRenderDurationsMs: Record<string, number>;
  memorySpikes: Array<{ heapMb: number; at: string }>;
  cacheHits: number;
  cacheMisses: number;
  degradedFacets: Record<string, number>;
  facetRetries: Record<string, number>;
  runtimeWarnings: Array<{ tag: string; at: string; detail?: Record<string, unknown> }>;
  exportRuntimeActive: boolean;
  lastExportDurationMs: number | null;
};

const MAX_WARNINGS = 40;
const MAX_MEMORY_SPIKES = 20;

const state: ExecAnalyticsRuntimeSnapshot = {
  updatedAt: new Date().toISOString(),
  activeFacets: {},
  inflightRequests: {},
  abortedTotal: 0,
  hydrationDurationsMs: {},
  chartRenderDurationsMs: {},
  memorySpikes: [],
  cacheHits: 0,
  cacheMisses: 0,
  degradedFacets: {},
  facetRetries: {},
  runtimeWarnings: [],
  exportRuntimeActive: false,
  lastExportDurationMs: null,
};

const listeners = new Set<() => void>();

const touch = (): void => {
  state.updatedAt = new Date().toISOString();
  listeners.forEach((l) => l());
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    (window as Window & { __EXEC_ANALYTICS_RUNTIME__?: ExecAnalyticsRuntimeSnapshot }).__EXEC_ANALYTICS_RUNTIME__ =
      getExecAnalyticsRuntimeSnapshot();
  }
};

const logDev = (tag: string, detail: Record<string, unknown>): void => {
  if (process.env.NODE_ENV === "production") return;
  // eslint-disable-next-line no-console
  console.info(tag, detail);
};

export const subscribeExecAnalyticsRuntime = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getExecAnalyticsRuntimeSnapshot = (): ExecAnalyticsRuntimeSnapshot => ({
  ...state,
  activeFacets: { ...state.activeFacets },
  inflightRequests: { ...state.inflightRequests },
  hydrationDurationsMs: { ...state.hydrationDurationsMs },
  chartRenderDurationsMs: { ...state.chartRenderDurationsMs },
  memorySpikes: [...state.memorySpikes],
  degradedFacets: { ...state.degradedFacets },
  facetRetries: { ...state.facetRetries },
  runtimeWarnings: [...state.runtimeWarnings],
});

export const recordExecRuntimeWarning = (
  tag: string,
  detail?: Record<string, unknown>
): void => {
  state.runtimeWarnings.unshift({
    tag,
    at: new Date().toISOString(),
    detail,
  });
  if (state.runtimeWarnings.length > MAX_WARNINGS) {
    state.runtimeWarnings.length = MAX_WARNINGS;
  }
  logDev(tag, detail ?? {});
  touch();
};

export const recordExecFacetStart = (scope: ExecFacetScope, key: string, correlationId?: string): void => {
  state.activeFacets[key] = { startedAt: Date.now(), correlationId };
  touch();
};

export const recordExecFacetEnd = (scope: ExecFacetScope, key: string): void => {
  const startedAt = state.activeFacets[key]?.startedAt;
  delete state.activeFacets[key];
  if (startedAt != null) {
    recordExecHydrationDuration(scope, Date.now() - startedAt);
  }
  touch();
};

export const recordExecInflightStart = (requestKey: string, scope: ExecFacetScope): void => {
  state.inflightRequests[requestKey] = { scope: String(scope), startedAt: Date.now() };
  touch();
};

export const recordExecInflightEnd = (requestKey: string): void => {
  delete state.inflightRequests[requestKey];
  touch();
};

export const recordExecRequestAborted = (requestKey: string, scope?: ExecFacetScope): void => {
  state.abortedTotal += 1;
  delete state.inflightRequests[requestKey];
  logDev("[FOCUSED_FETCH_ABORT]", { requestKey, scope });
  touch();
};

export const recordExecHydrationDuration = (scope: ExecFacetScope, durationMs: number): void => {
  state.hydrationDurationsMs[String(scope)] = durationMs;
  touch();
};

export const recordExecChartRenderDuration = (chartId: string, durationMs: number): void => {
  state.chartRenderDurationsMs[chartId] = durationMs;
  touch();
};

export const recordExecMemorySpike = (heapMb: number): void => {
  state.memorySpikes.unshift({ heapMb, at: new Date().toISOString() });
  if (state.memorySpikes.length > MAX_MEMORY_SPIKES) state.memorySpikes.pop();
  recordExecRuntimeWarning("[FOCUSED_MEMORY_SPIKE]", { heapMb });
  touch();
};

export const recordExecCacheHit = (): void => {
  state.cacheHits += 1;
  touch();
};

export const recordExecCacheMiss = (): void => {
  state.cacheMisses += 1;
  touch();
};

export const recordExecDegradedFacet = (scope: ExecFacetScope): void => {
  const k = String(scope);
  state.degradedFacets[k] = (state.degradedFacets[k] ?? 0) + 1;
  touch();
};

export const recordExecFacetRetry = (scope: ExecFacetScope): void => {
  const k = String(scope);
  state.facetRetries[k] = (state.facetRetries[k] ?? 0) + 1;
  touch();
};

export const recordExecExportRuntimeStart = (): void => {
  state.exportRuntimeActive = true;
  logDev("[EXEC_EXPORT_RUNTIME_START]", { at: new Date().toISOString() });
  touch();
};

export const recordExecExportRuntimeEnd = (durationMs?: number): void => {
  state.exportRuntimeActive = false;
  if (durationMs != null) state.lastExportDurationMs = durationMs;
  logDev("[EXEC_EXPORT_RUNTIME_END]", { durationMs });
  touch();
};

/** Sample client heap when available (Chrome). */
export const sampleExecClientMemory = (): void => {
  if (typeof performance === "undefined") return;
  const mem = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
  if (!mem?.usedJSHeapSize) return;
  const heapMb = Math.round(mem.usedJSHeapSize / 1024 / 1024);
  if (heapMb > 450) recordExecMemorySpike(heapMb);
};

export const initExecAnalyticsRuntimeDevExpose = (): void => {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") return;
  (window as Window & { __EXEC_ANALYTICS_RUNTIME__?: ExecAnalyticsRuntimeSnapshot }).__EXEC_ANALYTICS_RUNTIME__ =
    getExecAnalyticsRuntimeSnapshot();
  subscribeExecAnalyticsRuntime(() => {
    (window as Window & { __EXEC_ANALYTICS_RUNTIME__?: ExecAnalyticsRuntimeSnapshot }).__EXEC_ANALYTICS_RUNTIME__ =
      getExecAnalyticsRuntimeSnapshot();
  });
};
