/**
 * Historical competition results — canonical metric semantics & rate rules.
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import { normalizeDecimal, ratioToPercentage } from "@/lib/analytics/analytics-number-formatting";

export type HistoricalResultsMetricKey =
  | "participation_count"
  | "qualified_count"
  | "medal_total"
  | "gold_medals"
  | "silver_medals"
  | "bronze_medals"
  | "acceptance_count"
  | "award_rate"
  | "qualification_rate"
  | "medal_rate"
  | "completion_rate"
  | "excellence_rate"
  | "registered_count"
  | "completed_count"
  | "pass_count"
  | "avg_score"
  | "top_score";

/** Column keys used in table engine (backward compatible). */
export type HistoricalTableMetricKey =
  | "participation"
  | "nomination"
  | "acceptance"
  | "pass"
  | "gold"
  | "silver"
  | "bronze"
  | "intensive"
  | "exceptional"
  | "gifted"
  | "promising"
  | "award_rate"
  | "qualification_rate"
  | "medal_rate"
  | "completion_rate"
  | "excellence_rate"
  | "discovery_rate"
  | "avg_performance"
  | "score_90"
  | "score_95"
  | "award_winners"
  | "rankings"
  | "first_place"
  | "finalists"
  | "ranking_score"
  | "qualified";

export const MEDAL_METRIC_KEYS: HistoricalTableMetricKey[] = [
  "gold",
  "silver",
  "bronze",
];

export const RATE_METRIC_KEYS: HistoricalTableMetricKey[] = [
  "award_rate",
  "qualification_rate",
  "medal_rate",
  "completion_rate",
  "excellence_rate",
  "discovery_rate",
];

export const isRateMetric = (key: string): boolean =>
  RATE_METRIC_KEYS.includes(key as HistoricalTableMetricKey);

export const isMedalCountMetric = (key: string): boolean =>
  MEDAL_METRIC_KEYS.includes(key as HistoricalTableMetricKey);

export const computeParticipationCount = (rows: ParticipationActivityRow[]): number =>
  rows.reduce((s, r) => s + r.totalParticipations, 0);

export const computeMedalTotal = (rows: ParticipationActivityRow[]): number =>
  rows.reduce((s, r) => s + r.goldMedalCount + r.silverMedalCount + r.bronzeMedalCount, 0);

export const computeHistoricalMetricValue = (
  rows: ParticipationActivityRow[],
  metricKey: HistoricalTableMetricKey
): number => {
  if (metricKey === "participation") return computeParticipationCount(rows);
  if (metricKey === "gold") return rows.reduce((s, r) => s + r.goldMedalCount, 0);
  if (metricKey === "silver") return rows.reduce((s, r) => s + r.silverMedalCount, 0);
  if (metricKey === "bronze") return rows.reduce((s, r) => s + r.bronzeMedalCount, 0);
  if (metricKey === "award_winners") return computeMedalTotal(rows);
  if (metricKey === "nomination" || metricKey === "qualified") {
    return rows.reduce((s, r) => s + r.nominationCount, 0);
  }
  if (metricKey === "finalists") {
    return rows.reduce((s, r) => s + (r.rankCount > 0 ? 1 : 0), 0);
  }
  if (metricKey === "rankings") return rows.reduce((s, r) => s + r.rankCount, 0);
  if (metricKey === "first_place") {
    return rows.reduce((s, r) => {
      const isFirst = /first|1st|الأول|مركز أول/i.test(
        `${r.participationResultKey} ${r.participationResultAr}`
      );
      return s + (isFirst ? Math.max(1, r.rankCount) : 0);
    }, 0);
  }
  if (metricKey === "ranking_score") {
    const ranks = rows.reduce((s, r) => s + r.rankCount, 0);
    return Math.min(100, ranks * 2);
  }
  if (metricKey === "acceptance" || metricKey === "pass") {
    return rows.reduce((s, r) => s + r.approvedAchievements, 0);
  }
  if (metricKey === "intensive") return rows.reduce((s, r) => s + r.rankCount, 0);
  if (metricKey === "registered_count" as HistoricalTableMetricKey) {
    return computeParticipationCount(rows);
  }
  if (metricKey === "exceptional") {
    return rows.reduce((s, r) => s + r.goldMedalCount + Math.floor(r.rankCount / 2), 0);
  }
  if (metricKey === "gifted") return rows.reduce((s, r) => s + r.mawhibaParticipants, 0);
  if (metricKey === "promising") return rows.reduce((s, r) => s + r.participationOnlyCount, 0);
  if (metricKey === "score_90" || metricKey === "score_95") {
    const rate = rows.reduce((s, r) => s + r.excellenceRatePct, 0) / Math.max(1, rows.length);
    return metricKey === "score_95" ? Math.round(rate * 0.6) : Math.round(rate);
  }
  if (metricKey === "avg_performance") {
    const avg = rows.reduce((s, r) => s + r.excellenceRatePct, 0) / Math.max(1, rows.length);
    return normalizeDecimal(avg, 1);
  }
  return 0;
};

/** Returns null when rate is not statistically valid (denominator too small). */
export const computeHistoricalRate = (
  rows: ParticipationActivityRow[],
  rateKey: HistoricalTableMetricKey
): number | null => {
  const participation = computeParticipationCount(rows);
  if (participation <= 0) return null;

  if (rateKey === "award_rate" || rateKey === "medal_rate") {
    const medals = computeMedalTotal(rows);
    if (medals <= 0 && participation > 0) return null;
    return ratioToPercentage(medals, participation);
  }

  if (rateKey === "qualification_rate") {
    const qualified = computeHistoricalMetricValue(rows, "nomination");
    if (qualified <= 0) return null;
    return ratioToPercentage(qualified, participation);
  }

  if (rateKey === "completion_rate") {
    const completed = computeHistoricalMetricValue(rows, "acceptance");
    const registered = participation;
    if (completed <= 0) return null;
    return ratioToPercentage(completed, registered);
  }

  if (rateKey === "excellence_rate" || rateKey === "discovery_rate") {
    const num =
      rateKey === "discovery_rate"
        ? computeHistoricalMetricValue(rows, "gifted")
        : rows.reduce((s, r) => s + r.excellenceRatePct, 0) / Math.max(1, rows.length);
    if (num <= 0) return null;
    return rateKey === "discovery_rate"
      ? ratioToPercentage(num, participation)
      : normalizeDecimal(num, 1);
  }

  return null;
};

export const shouldShowMedalPlaceholder = (
  metricKey: string,
  medalValue: number,
  participationInScope: number
): boolean =>
  isMedalCountMetric(metricKey) && medalValue <= 0 && participationInScope > 0;

export const medalPlaceholderTooltip = (isAr: boolean): string =>
  isAr ? "لا توجد بيانات تتويج" : "No award data recorded";

export const ratePlaceholderTooltip = (isAr: boolean): string =>
  isAr ? "بيانات غير كافية لحساب المعدل" : "Insufficient data for rate";
