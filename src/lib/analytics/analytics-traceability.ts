/**
 * Auditability + traceability for analytics payloads and exports.
 */

import { createHash } from "crypto";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";
import { analyticsSearchParamsCanonicalString } from "@/lib/analytics/report-filter-url-sync";

export type AnalyticsTraceMeta = {
  generatedAt: string;
  datasetVersion: number;
  analyticsBuildId: string;
  queryHash: string;
  canonicalFilterHash: string;
  filterSummary?: string;
};

const shortHash = (input: string): string =>
  createHash("sha256").update(input).digest("hex").slice(0, 16);

export const buildAnalyticsBuildId = (): string => {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `ab-${CI_AGGREGATION_VERSION}-${t}-${r}`;
};

export const buildAnalyticsTraceMeta = (input: {
  searchParams?: URLSearchParams | string;
  filterSummary?: string;
  buildId?: string;
}): AnalyticsTraceMeta => {
  const sp =
    typeof input.searchParams === "string"
      ? new URLSearchParams(input.searchParams.replace(/^\?/, ""))
      : input.searchParams ?? new URLSearchParams();

  const canonical = analyticsSearchParamsCanonicalString(sp);
  return {
    generatedAt: new Date().toISOString(),
    datasetVersion: CI_AGGREGATION_VERSION,
    analyticsBuildId: input.buildId ?? buildAnalyticsBuildId(),
    queryHash: shortHash(canonical),
    canonicalFilterHash: shortHash(canonical),
    filterSummary: input.filterSummary,
  };
};

export const traceMetaToExportLines = (meta: AnalyticsTraceMeta, isAr: boolean): string[] =>
  isAr
    ? [
        `معرّف التقرير: ${meta.analyticsBuildId}`,
        `وقت التوليد: ${meta.generatedAt}`,
        `إصدار البيانات: ${meta.datasetVersion}`,
        `بصمة الفلاتر: ${meta.canonicalFilterHash}`,
        meta.filterSummary ? `الفلاتر: ${meta.filterSummary}` : "",
      ].filter(Boolean)
    : [
        `Report ID: ${meta.analyticsBuildId}`,
        `Generated at: ${meta.generatedAt}`,
        `Dataset version: ${meta.datasetVersion}`,
        `Filter hash: ${meta.canonicalFilterHash}`,
        meta.filterSummary ? `Filters: ${meta.filterSummary}` : "",
      ].filter(Boolean);

export const attachTraceToPayload = <T extends Record<string, unknown>>(
  payload: T,
  meta: AnalyticsTraceMeta
): T & { trace: AnalyticsTraceMeta } => ({
  ...payload,
  trace: meta,
});
