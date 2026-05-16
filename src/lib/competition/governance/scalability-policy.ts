/**
 * Competition intelligence scalability guards — graceful degradation, not hard crashes.
 */

export type CompetitionScalabilityPolicy = {
  maxCompareRows: number;
  maxExportCharts: number;
  maxParticipantExports: number;
  maxTrendWindowYears: number;
  maxPdfSections: number;
  maxSnapshotList: number;
  maxReplayPayloadKb: number;
};

export const DEFAULT_COMPETITION_SCALABILITY_POLICY: CompetitionScalabilityPolicy = {
  maxCompareRows: 2,
  maxExportCharts: 12,
  maxParticipantExports: 800,
  maxTrendWindowYears: 15,
  maxPdfSections: 14,
  maxSnapshotList: 120,
  maxReplayPayloadKb: 512,
};

export type ScalabilityClampResult<T> = {
  value: T;
  truncated: boolean;
  originalCount?: number;
  policyKey?: keyof CompetitionScalabilityPolicy;
};

export const clampArray = <T>(
  rows: T[],
  max: number,
  policyKey: keyof CompetitionScalabilityPolicy
): ScalabilityClampResult<T[]> => {
  if (rows.length <= max) return { value: rows, truncated: false, originalCount: rows.length };
  return {
    value: rows.slice(0, max),
    truncated: true,
    originalCount: rows.length,
    policyKey,
  };
};

export const clampCompareTargets = (
  targets: string[],
  policy: CompetitionScalabilityPolicy = DEFAULT_COMPETITION_SCALABILITY_POLICY
): ScalabilityClampResult<string[]> =>
  clampArray(targets, policy.maxCompareRows, "maxCompareRows");

export const clampTrendYears = <T extends { year?: number; academicYear?: number }>(
  rows: T[],
  policy: CompetitionScalabilityPolicy = DEFAULT_COMPETITION_SCALABILITY_POLICY
): ScalabilityClampResult<T[]> => {
  const sorted = [...rows].sort((a, b) => {
    const ya = a.year ?? a.academicYear ?? 0;
    const yb = b.year ?? b.academicYear ?? 0;
    return yb - ya;
  });
  return clampArray(sorted, policy.maxTrendWindowYears, "maxTrendWindowYears");
};

export const clampExportCharts = (
  count: number,
  policy: CompetitionScalabilityPolicy = DEFAULT_COMPETITION_SCALABILITY_POLICY
): number => Math.min(count, policy.maxExportCharts);

export const clampParticipantExportMax = (
  requested: number,
  policy: CompetitionScalabilityPolicy = DEFAULT_COMPETITION_SCALABILITY_POLICY
): number => Math.min(Math.max(1, requested), policy.maxParticipantExports);

export const clampPdfSections = (
  sections: string[],
  policy: CompetitionScalabilityPolicy = DEFAULT_COMPETITION_SCALABILITY_POLICY
): ScalabilityClampResult<string[]> =>
  clampArray(sections, policy.maxPdfSections, "maxPdfSections");

export type ScalabilityDegradationNotice = {
  code: string;
  messageAr: string;
  messageEn: string;
};

export const buildDegradationNotices = (
  clamps: ScalabilityClampResult<unknown>[]
): ScalabilityDegradationNotice[] => {
  const notices: ScalabilityDegradationNotice[] = [];
  for (const c of clamps) {
    if (!c.truncated || !c.policyKey) continue;
    notices.push({
      code: `truncated_${c.policyKey}`,
      messageAr: `تم اقتصار النتائج وفق سياسة التوسع (${String(c.policyKey)})`,
      messageEn: `Results capped per scalability policy (${String(c.policyKey)})`,
    });
  }
  return notices;
};
