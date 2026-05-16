/**
 * Competition Intelligence — structured observability (no PII, no large payloads).
 * Enable with COMPETITION_INTEL_DEBUG=1 (Node) or NEXT_PUBLIC_COMPETITION_INTEL_DEBUG=1 (browser).
 */

import { isCompetitionIntelDebugEnabled, competitionIntelDebug, competitionIntelWarn } from "./competition-intelligence-diagnostics";

export type CiAggregationSeverity = "ok" | "warn" | "severe" | "critical";

export type CiCacheStatus = "hit" | "miss" | "none" | "stale" | "snapshot_fallback";

export type CiObservabilityMeta = {
  generatedAt: string;
  serverFacetMs: number;
  cacheHit: boolean;
  cacheAgeMs: number;
  source: "route-memory" | "snapshot" | "none";
  recomputeReason?: "cache_miss" | "nocache_bypass" | "cold" | "stale_revalidate" | "snapshot_fallback";
  aggregationVersion?: number;
  cacheLifecycle?: "fresh" | "stale" | "expired" | "snapshot_fallback";
  trustStatus?: string;
  scalabilityWarnings?: string[];
};

export const createCorrelationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ci_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

/** Truncate opaque strings for logs (filters summary, keys). */
export const ciRedactLine = (s: string, max = 160): string => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
};

export const classifyAggregationMs = (ms: number): CiAggregationSeverity => {
  if (ms >= 2500) return "critical";
  if (ms >= 1200) return "severe";
  if (ms >= 500) return "warn";
  return "ok";
};

export const logAggregationHealth = (params: {
  facet: string;
  durationMs: number;
  filterSummary: string;
  resultSize: number;
  cacheStatus: CiCacheStatus;
}) => {
  const sev = classifyAggregationMs(params.durationMs);
  const line = {
    kind: "aggregation",
    facet: params.facet,
    ms: params.durationMs,
    severity: sev,
    filters: ciRedactLine(params.filterSummary),
    resultSize: params.resultSize,
    cache: params.cacheStatus,
  };
  if (!isCompetitionIntelDebugEnabled()) {
    if (sev !== "ok") {
      // eslint-disable-next-line no-console
      console.warn("[ci-aggregation]", line);
    }
    return;
  }
  if (sev === "ok") {
    competitionIntelDebug("[ci-aggregation]", line);
  } else {
    competitionIntelWarn("[ci-aggregation]", line);
  }
};

export const logCacheIntel = (params: {
  scope: string;
  hit: boolean;
  ageMs?: number;
  keyChars?: number;
  reason?: string;
}) => {
  if (!isCompetitionIntelDebugEnabled()) return;
  competitionIntelDebug("[ci-cache]", {
    scope: params.scope,
    hit: params.hit,
    ageMs: params.ageMs ?? null,
    keyChars: params.keyChars ?? null,
    reason: params.reason,
  });
};

export const logCompareIntel = (params: {
  durationMs: number;
  cacheHit: boolean;
  filterSummary: string;
}) => {
  if (!isCompetitionIntelDebugEnabled()) return;
  competitionIntelDebug("[ci-compare]", {
    ms: params.durationMs,
    cacheHit: params.cacheHit,
    filters: ciRedactLine(params.filterSummary),
  });
};

export const logExportIntel = (params: {
  correlationId: string;
  phase: string;
  durationMs: number;
  retryAttempt?: number;
  failedSections?: string[];
  extra?: Record<string, string | number | boolean | null | undefined>;
}) => {
  if (!isCompetitionIntelDebugEnabled()) return;
  competitionIntelDebug("[ci-export]", {
    correlationId: params.correlationId,
    phase: params.phase,
    ms: params.durationMs,
    attempt: params.retryAttempt ?? 1,
    failedSections: params.failedSections?.length ? params.failedSections : undefined,
    ...params.extra,
  });
};

export const logChartRenderIntel = (params: { chartId: string; durationMs: number; virtualized?: boolean }) => {
  if (!isCompetitionIntelDebugEnabled()) return;
  competitionIntelDebug("[ci-chart]", {
    chartId: params.chartId,
    ms: params.durationMs,
    virtualized: params.virtualized ?? false,
  });
};

export const logVirtualizationIntel = (params: { active: boolean; rowCount: number; threshold: number }) => {
  if (!isCompetitionIntelDebugEnabled()) return;
  competitionIntelDebug("[ci-virtualization]", params);
};

export const logEmptyDatasetIntel = (params: { surface: string; reasonCodes: string[]; filterSummary: string }) => {
  if (!isCompetitionIntelDebugEnabled()) return;
  competitionIntelDebug("[ci-empty]", {
    surface: params.surface,
    reasons: params.reasonCodes,
    filters: ciRedactLine(params.filterSummary),
  });
};

export const logStudentIntelTrust = (params: {
  duplicateIds: number;
  growthSanityFails: number;
  durationMs?: number;
}) => {
  if (!isCompetitionIntelDebugEnabled()) return;
  competitionIntelDebug("[ci-student-trust]", params);
};

export const logSnapshotGenerationIntel = (params: {
  granularity: string;
  durationMs: number;
  trendRows: number;
  trustStatus: string;
}) => {
  if (!isCompetitionIntelDebugEnabled()) return;
  competitionIntelDebug("[ci-snapshot]", params);
};

export const logCacheRegenerationIntel = (params: {
  scope: string;
  durationMs: number;
  reason: string;
  stale?: boolean;
}) => {
  if (!isCompetitionIntelDebugEnabled()) return;
  competitionIntelDebug("[ci-cache-regen]", params);
};

export const logStaleDatasetIntel = (params: { scope: string; ageMs: number; thresholdMs: number }) => {
  if (!isCompetitionIntelDebugEnabled()) return;
  competitionIntelWarn("[ci-stale-dataset]", params);
};

export const logCompareOverloadIntel = (params: { compareCount: number; maxAllowed: number }) => {
  if (!isCompetitionIntelDebugEnabled()) return;
  competitionIntelWarn("[ci-compare-overload]", params);
};

export const logPdfMemoryPressureIntel = (params: {
  estimatedRows: number;
  chartCount: number;
  degraded: boolean;
}) => {
  if (!isCompetitionIntelDebugEnabled()) return;
  competitionIntelWarn("[ci-pdf-memory]", params);
};

export const measureServerMs = async <T>(
  facet: string,
  meta: { filterSummary: string; cacheStatus: CiCacheStatus; getResultSize?: (r: T) => number },
  fn: () => Promise<T>
): Promise<T> => {
  const t0 = Date.now();
  const out = await fn();
  const ms = Date.now() - t0;
  logAggregationHealth({
    facet,
    durationMs: ms,
    filterSummary: meta.filterSummary,
    resultSize: meta.getResultSize ? meta.getResultSize(out) : 0,
    cacheStatus: meta.cacheStatus,
  });
  return out;
};
