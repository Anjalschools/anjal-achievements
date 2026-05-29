/**
 * Central analytics metric definitions — single source of truth for governed calculations.
 * Components must import formulas from here; do not duplicate metric math in UI layers.
 */

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";

export type AnalyticsMetricId =
  | "medalConversionRate"
  | "participationDensity"
  | "excellenceScore"
  | "internationalAchievementRate"
  | "standardizedTestAverage"
  | "weightedPerformanceScore"
  | "topActivityScore"
  | "medalDensityPerActivity";

export type AnalyticsMetricDefinition = {
  id: AnalyticsMetricId;
  labelAr: string;
  labelEn: string;
  unit: "percent" | "count" | "score" | "ratio";
  /** Minimum sample size before metric is considered reliable */
  minDenominator: number;
};

export const ANALYTICS_METRICS: Record<AnalyticsMetricId, AnalyticsMetricDefinition> = {
  medalConversionRate: {
    id: "medalConversionRate",
    labelAr: "معدل التحويل إلى ميداليات",
    labelEn: "Medal conversion rate",
    unit: "percent",
    minDenominator: 1,
  },
  participationDensity: {
    id: "participationDensity",
    labelAr: "كثافة المشاركة",
    labelEn: "Participation density",
    unit: "ratio",
    minDenominator: 1,
  },
  excellenceScore: {
    id: "excellenceScore",
    labelAr: "مؤشر التميز",
    labelEn: "Excellence score",
    unit: "percent",
    minDenominator: 1,
  },
  internationalAchievementRate: {
    id: "internationalAchievementRate",
    labelAr: "نسبة الإنجازات الدولية",
    labelEn: "International achievement rate",
    unit: "percent",
    minDenominator: 1,
  },
  standardizedTestAverage: {
    id: "standardizedTestAverage",
    labelAr: "متوسط الاختبارات المعيارية",
    labelEn: "Standardized test average",
    unit: "score",
    minDenominator: 1,
  },
  weightedPerformanceScore: {
    id: "weightedPerformanceScore",
    labelAr: "مؤشر الأداء المرجّح",
    labelEn: "Weighted performance score",
    unit: "score",
    minDenominator: 1,
  },
  topActivityScore: {
    id: "topActivityScore",
    labelAr: "أعلى نشاط",
    labelEn: "Top activity score",
    unit: "count",
    minDenominator: 0,
  },
  medalDensityPerActivity: {
    id: "medalDensityPerActivity",
    labelAr: "كثافة الميداليات لكل نشاط",
    labelEn: "Medal density per activity",
    unit: "percent",
    minDenominator: 1,
  },
};

/** Default weights for weighted performance (gold-heavy, auditable). */
export const RANKING_WEIGHT_MATRIX = {
  gold: 4,
  silver: 2.5,
  bronze: 1.5,
  rank: 2,
  nomination: 1,
  participation: 0.25,
} as const;

const round1 = (n: number): number => Math.round(n * 10) / 10;

export const countOutcomeFromPayload = (
  data: ParticipationAnalyticsPayload,
  keys: string[]
): number =>
  data.charts.resultOutcomeCompare
    .filter((x) => keys.includes(x.key))
    .reduce((s, x) => s + x.count, 0);

export const computeMedalConversionRate = (data: ParticipationAnalyticsPayload): number => {
  const total = data.kpis.totalParticipations;
  if (total < ANALYTICS_METRICS.medalConversionRate.minDenominator) return 0;
  const medals = countOutcomeFromPayload(data, ["gold", "silver", "bronze"]);
  return round1((medals / total) * 100);
};

export const computeInternationalAchievementRate = (data: ParticipationAnalyticsPayload): number =>
  data.kpis.internationalAchievementPct ?? 0;

export const computeExcellenceScore = (rows: { excellenceRatePct: number; totalParticipations: number }[]): number => {
  const weight = rows.reduce((s, r) => s + r.totalParticipations, 0);
  if (weight < ANALYTICS_METRICS.excellenceScore.minDenominator) return 0;
  const sum = rows.reduce((s, r) => s + r.excellenceRatePct * r.totalParticipations, 0);
  return round1(sum / weight);
};

export const computeParticipationDensity = (
  participations: number,
  distinctStudents: number
): number => {
  if (distinctStudents < ANALYTICS_METRICS.participationDensity.minDenominator) return 0;
  return round1(participations / distinctStudents);
};

export const computeMedalDensityPerActivity = (
  gold: number,
  silver: number,
  bronze: number,
  totalParticipations: number
): number => {
  if (totalParticipations < ANALYTICS_METRICS.medalDensityPerActivity.minDenominator) return 0;
  return round1(((gold + silver + bronze) / totalParticipations) * 100);
};

export const computeWeightedPerformanceScore = (counts: {
  gold: number;
  silver: number;
  bronze: number;
  ranks: number;
  nominations: number;
  participations: number;
}): number => {
  const w = RANKING_WEIGHT_MATRIX;
  const score =
    counts.gold * w.gold +
    counts.silver * w.silver +
    counts.bronze * w.bronze +
    counts.ranks * w.rank +
    counts.nominations * w.nomination +
    counts.participations * w.participation;
  return round1(score);
};

export const computeStandardizedTestAverage = (
  rows: { excellenceRatePct: number; totalParticipations: number }[]
): number | null => {
  const testRows = rows.filter((r) => r.totalParticipations > 0);
  if (testRows.length === 0) return null;
  return computeExcellenceScore(testRows);
};

export const ANALYTICS_DATASET_VERSION = CI_AGGREGATION_VERSION;
