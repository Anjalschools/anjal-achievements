/**
 * Analytics counting contract — single source for KPI / charts / tables alignment.
 * Does not change API payloads; derives governed counts from ParticipationAnalyticsPayload.
 */

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import { computeMedalConversionRate } from "@/lib/analytics/analytics-metrics-definitions";
import { outcomeCount } from "@/lib/analytics/participation-dashboard-derivations";

export type ParticipationCountingSnapshot = {
  participationCount: number;
  uniqueStudentsCount: number;
  medalWinningParticipations: number;
  nonMedalParticipations: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  rankCount: number;
  nominationCount: number;
  participationOnlyCount: number;
  achievementCount: number;
  medalConversionRatePct: number;
};

export type AnalyticsCountingDebugMeta = {
  outcomeChartSum: number;
  kpiTotalParticipations: number;
  kpiDistinctStudents: number;
  tableRowSum: number;
  inSync: boolean;
  notes: string[];
};

export const buildParticipationCountingSnapshot = (
  data: ParticipationAnalyticsPayload
): ParticipationCountingSnapshot => {
  const participationCount = data.kpis.totalParticipations;
  const uniqueStudentsCount = data.kpis.distinctStudents;
  const goldCount = outcomeCount(data, "gold");
  const silverCount = outcomeCount(data, "silver");
  const bronzeCount = outcomeCount(data, "bronze");
  const rankCount = outcomeCount(data, "rank") + outcomeCount(data, "ranks");
  const nominationCount = outcomeCount(data, "nomination");
  const participationOnlyCount = outcomeCount(data, "participation");
  const medalWinningParticipations = goldCount + silverCount + bronzeCount;
  const outcomeTagged =
    medalWinningParticipations + rankCount + nominationCount + participationOnlyCount;
  const nonMedalParticipations = Math.max(0, participationCount - medalWinningParticipations);

  return {
    participationCount,
    uniqueStudentsCount,
    medalWinningParticipations,
    nonMedalParticipations,
    goldCount,
    silverCount,
    bronzeCount,
    rankCount,
    nominationCount,
    participationOnlyCount,
    achievementCount: participationCount,
    medalConversionRatePct: computeMedalConversionRate(data),
  };
};

export const buildAnalyticsCountingDebugMeta = (
  data: ParticipationAnalyticsPayload
): AnalyticsCountingDebugMeta => {
  const snap = buildParticipationCountingSnapshot(data);
  const outcomeChartSum = data.charts.resultOutcomeCompare.reduce((s, x) => s + x.count, 0);
  const tableRowSum = data.table.reduce((s, r) => s + r.totalParticipations, 0);
  const notes: string[] = [];
  if (outcomeChartSum < snap.participationCount * 0.85) {
    notes.push("outcome_chart_under_tags_participation_total");
  }
  if (tableRowSum !== snap.participationCount && data.table.length > 0) {
    notes.push(`table_row_sum_${tableRowSum}_vs_kpi_${snap.participationCount}`);
  }
  const inSync =
    snap.participationCount === data.kpis.totalParticipations &&
    snap.uniqueStudentsCount === data.kpis.distinctStudents &&
    notes.length === 0;

  return {
    outcomeChartSum,
    kpiTotalParticipations: data.kpis.totalParticipations,
    kpiDistinctStudents: data.kpis.distinctStudents,
    tableRowSum,
    inSync,
    notes,
  };
};
