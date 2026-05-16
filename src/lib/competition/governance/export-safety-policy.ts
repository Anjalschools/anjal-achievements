import {
  DEFAULT_COMPETITION_SCALABILITY_POLICY,
  clampExportCharts,
  clampParticipantExportMax,
  clampPdfSections,
  type ScalabilityDegradationNotice,
  buildDegradationNotices,
  type ScalabilityClampResult,
} from "@/lib/competition/governance/scalability-policy";

/** Export safety caps — retries, timeouts, degraded mode. */
export type ExportSafetyPolicy = {
  rowCap: number;
  retryCap: number;
  chartCap: number;
  timeoutMs: number;
  degradedMode: boolean;
};

export const DEFAULT_EXPORT_SAFETY_POLICY: ExportSafetyPolicy = {
  rowCap: DEFAULT_COMPETITION_SCALABILITY_POLICY.maxParticipantExports,
  retryCap: 3,
  chartCap: DEFAULT_COMPETITION_SCALABILITY_POLICY.maxExportCharts,
  timeoutMs: 90_000,
  degradedMode: false,
};

export type ExportSafetyContext = {
  requestedRows: number;
  requestedCharts: number;
  pdfSections: string[];
  attempt: number;
};

export type ExportSafetyResolution = {
  policy: ExportSafetyPolicy;
  safeRowCap: number;
  safeChartCap: number;
  safePdfSections: string[];
  degraded: boolean;
  notices: ScalabilityDegradationNotice[];
  shouldAbort: boolean;
  abortReason?: string;
};

export const resolveExportSafety = (ctx: ExportSafetyContext): ExportSafetyResolution => {
  const policy = { ...DEFAULT_EXPORT_SAFETY_POLICY };
  const clamps: ScalabilityClampResult<unknown>[] = [];

  if (ctx.attempt > policy.retryCap) {
    return {
      policy,
      safeRowCap: 0,
      safeChartCap: 0,
      safePdfSections: [],
      degraded: true,
      notices: [],
      shouldAbort: true,
      abortReason: "retry_cap_exceeded",
    };
  }

  const safeRowCap = clampParticipantExportMax(ctx.requestedRows);
  const safeChartCap = clampExportCharts(ctx.requestedCharts);
  const sectionClamp = clampPdfSections(ctx.pdfSections);
  clamps.push(sectionClamp);

  const degraded = sectionClamp.truncated || safeRowCap < ctx.requestedRows || safeChartCap < ctx.requestedCharts;
  if (degraded) policy.degradedMode = true;

  return {
    policy,
    safeRowCap,
    safeChartCap,
    safePdfSections: sectionClamp.value,
    degraded,
    notices: buildDegradationNotices(clamps),
    shouldAbort: false,
  };
};

export const exportTimeoutMs = (policy: ExportSafetyPolicy = DEFAULT_EXPORT_SAFETY_POLICY): number =>
  policy.timeoutMs;
