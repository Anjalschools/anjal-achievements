/**
 * Analytics counting perspective — clarifies what numbers represent (participation vs student vs achievement).
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import { t, type AnalyticsLocale, type SemanticKey } from "@/lib/analytics/analytics-semantic-registry";

export type AnalyticsCountPerspective =
  | "participation"
  | "student"
  | "achievement"
  | "record"
  | "result";

export const ANALYTICS_COUNT_PERSPECTIVES: AnalyticsCountPerspective[] = [
  "participation",
  "student",
  "achievement",
  "record",
  "result",
];

const PERSPECTIVE_LABEL_KEYS: Record<AnalyticsCountPerspective, SemanticKey> = {
  participation: "perspective.participation",
  student: "perspective.student",
  achievement: "perspective.achievement",
  record: "perspective.record",
  result: "perspective.result",
};

const PERSPECTIVE_DESC_KEYS: Record<AnalyticsCountPerspective, SemanticKey> = {
  participation: "perspective.desc.participation",
  student: "perspective.desc.student",
  achievement: "perspective.desc.achievement",
  record: "perspective.desc.record",
  result: "perspective.desc.result",
};

const TOTAL_COLUMN_KEYS: Record<AnalyticsCountPerspective, SemanticKey> = {
  participation: "column.totalParticipations",
  student: "column.studentCount",
  achievement: "column.achievementCount",
  record: "column.recordCount",
  result: "column.resultCount",
};

export const perspectiveLabel = (p: AnalyticsCountPerspective, loc: AnalyticsLocale): string =>
  t(PERSPECTIVE_LABEL_KEYS[p], loc);

export const perspectiveDescription = (p: AnalyticsCountPerspective, loc: AnalyticsLocale): string =>
  t(PERSPECTIVE_DESC_KEYS[p], loc);

export const totalColumnLabel = (p: AnalyticsCountPerspective, loc: AnalyticsLocale): string =>
  t(TOTAL_COLUMN_KEYS[p], loc);

export const totalColumnTooltip = (p: AnalyticsCountPerspective, loc: AnalyticsLocale): string =>
  t(`tooltip.column.${p}` as SemanticKey, loc);

/** Primary metric value for table total column under each perspective */
export const metricValueForPerspective = (
  row: ParticipationActivityRow,
  perspective: AnalyticsCountPerspective
): number => {
  switch (perspective) {
    case "student":
      return row.distinctParticipants;
    case "achievement":
      return row.approvedAchievements;
    case "record":
      return row.totalParticipations;
    case "result":
      return row.goldMedalCount + row.silverMedalCount + row.bronzeMedalCount + row.rankCount;
    case "participation":
    default:
      return row.totalParticipations;
  }
};

export const perspectiveLevelTag = (p: AnalyticsCountPerspective, loc: AnalyticsLocale): string => {
  const tags: Record<AnalyticsCountPerspective, SemanticKey> = {
    participation: "perspective.level.participation",
    student: "perspective.level.student",
    achievement: "perspective.level.achievement",
    record: "perspective.level.record",
    result: "perspective.level.result",
  };
  return t(tags[p], loc);
};

/** URL / external aliases (participations, students, …) → canonical perspective */
export const PERSPECTIVE_URL_ALIASES: Record<string, AnalyticsCountPerspective> = {
  participations: "participation",
  participation: "participation",
  students: "student",
  student: "student",
  achievements: "achievement",
  achievement: "achievement",
  records: "record",
  record: "record",
  results: "result",
  result: "result",
};

export const parsePerspectiveParam = (raw: string | null | undefined): AnalyticsCountPerspective => {
  const key = String(raw ?? "").trim().toLowerCase();
  return PERSPECTIVE_URL_ALIASES[key] ?? "participation";
};

export const perspectiveToUrlValue = (p: AnalyticsCountPerspective): string => {
  const map: Record<AnalyticsCountPerspective, string> = {
    participation: "participations",
    student: "students",
    achievement: "achievements",
    record: "records",
    result: "results",
  };
  return map[p];
};

export const exportReportTitleSuffix = (p: AnalyticsCountPerspective, loc: AnalyticsLocale): string =>
  t(`export.report.${p}` as SemanticKey, loc);

export const globalPrimaryKpiForPerspective = (
  data: import("@/lib/achievement-participation-analytics").ParticipationAnalyticsPayload,
  perspective: AnalyticsCountPerspective
): { value: number; labelKey: SemanticKey } => {
  const k = data.kpis;
  const table = data.table;
  const achievements = table.reduce((s, r) => s + r.approvedAchievements, 0);
  const results = table.reduce(
    (s, r) => s + r.goldMedalCount + r.silverMedalCount + r.bronzeMedalCount + r.rankCount,
    0
  );
  switch (perspective) {
    case "student":
      return { value: k.distinctStudents, labelKey: "kpi.participatingStudents" };
    case "achievement":
      return { value: achievements, labelKey: "column.achievementCount" };
    case "record":
      return { value: k.totalParticipations, labelKey: "column.recordCount" };
    case "result":
      return { value: results, labelKey: "column.resultCount" };
    case "participation":
    default:
      return { value: k.totalParticipations, labelKey: "kpi.totalParticipations" };
  }
};

/** Scale a participation slice count to the active perspective (client interpretation). */
export const scaleSliceToPerspective = (
  sliceParticipations: number,
  data: import("@/lib/achievement-participation-analytics").ParticipationAnalyticsPayload,
  perspective: AnalyticsCountPerspective
): number => {
  const totalP = data.kpis.totalParticipations || 1;
  const { value: global } = globalPrimaryKpiForPerspective(data, perspective);
  if (perspective === "participation" || perspective === "record") return sliceParticipations;
  return Math.round((sliceParticipations / totalP) * global);
};

export const activityHorizontalValueForPerspective = (
  row: { studentCount: number; participationCount?: number },
  perspective: AnalyticsCountPerspective
): number => {
  if (perspective === "student") return row.studentCount;
  return row.participationCount ?? row.studentCount;
};
