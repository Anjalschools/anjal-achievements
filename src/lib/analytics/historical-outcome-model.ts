/**
 * Unified historical outcome model — normalized outcome graph across participation & results.
 */

import type {
  ParticipationActivityRow,
  ParticipationAnalyticsPayload,
} from "@/lib/achievement-participation-analytics";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import type { CanonicalActivityId } from "@/lib/analytics/historical-activity-taxonomy";
import { resolveFamilyRowsForYear } from "@/lib/analytics/historical-activity-resolution";
import { buildYearOutcomeMeasures } from "@/lib/analytics/historical-unified-aggregation-graph";

export type OutcomeKind =
  | "participation"
  | "qualification"
  | "acceptance"
  | "award"
  | "medal"
  | "ranking"
  | "testing"
  | "progression";

export type HistoricalOutcomeMetrics = {
  participation: number;
  qualified: number;
  accepted: number;
  awardWinners: number;
  gold: number;
  silver: number;
  bronze: number;
  rankings: number;
  firstPlace: number;
  finalists: number;
  distinctStudents: number;
  awardRate: number | null;
  qualificationRate: number | null;
  competitionStrength: number;
  awardDensity: number;
};

export type HistoricalOutcomeYearNode = {
  year: number;
  rowKey: string;
  metrics: HistoricalOutcomeMetrics;
  sourceRowCount: number;
};

export type HistoricalOutcomeGraph = {
  familyKey: CanonicalActivityId | string;
  years: number[];
  nodes: HistoricalOutcomeYearNode[];
  signals: {
    hasParticipation: boolean;
    hasMedals: boolean;
    hasQualification: boolean;
    hasRankings: boolean;
    hasAcceptance: boolean;
    missingOutcomeYears: number[];
  };
};

const emptyMetrics = (): HistoricalOutcomeMetrics => ({
  participation: 0,
  qualified: 0,
  accepted: 0,
  awardWinners: 0,
  gold: 0,
  silver: 0,
  bronze: 0,
  rankings: 0,
  firstPlace: 0,
  finalists: 0,
  distinctStudents: 0,
  awardRate: null,
  qualificationRate: null,
  competitionStrength: 0,
  awardDensity: 0,
});

export const aggregateOutcomeMetricsFromRows = (
  rows: ParticipationActivityRow[]
): HistoricalOutcomeMetrics => {
  if (rows.length === 0) return emptyMetrics();
  const { measures } = buildYearOutcomeMeasures(
    {
      year: 0,
      payload: {
        ok: true,
        generatedAt: "",
        filters: {},
        kpis: { totalParticipations: 0 } as ParticipationAnalyticsPayload["kpis"],
        charts: {} as ParticipationAnalyticsPayload["charts"],
        activityOptions: [],
        focusedActivity: null,
        table: rows,
        tableTotal: rows.length,
        page: 1,
        pageSize: rows.length,
      },
    },
    "aggregate"
  );
  return {
    participation: measures.participants,
    qualified: measures.qualified_students,
    accepted: measures.accepted_students,
    awardWinners: measures.award_winners,
    gold: measures.gold_medals,
    silver: measures.silver_medals,
    bronze: measures.bronze_medals,
    rankings: measures.rankings,
    firstPlace: measures.first_place,
    finalists: measures.finalists,
    distinctStudents: 0,
    awardRate: measures.award_rate,
    qualificationRate: measures.qualification_rate,
    competitionStrength: measures.ranking_score,
    awardDensity: measures.award_rate ?? 0,
  };
};

export const buildHistoricalOutcomeGraph = (
  familyKey: string,
  slices: HistoricalYearSlice[],
  rowKey = "activity_total"
): HistoricalOutcomeGraph => {
  const nodes: HistoricalOutcomeYearNode[] = slices.map((slice) => {
    const { measures } = buildYearOutcomeMeasures(slice, familyKey);
    return {
      year: slice.year,
      rowKey,
      metrics: {
        participation: measures.participants,
        qualified: measures.qualified_students,
        accepted: measures.accepted_students,
        awardWinners: measures.award_winners,
        gold: measures.gold_medals,
        silver: measures.silver_medals,
        bronze: measures.bronze_medals,
        rankings: measures.rankings,
        firstPlace: measures.first_place,
        finalists: measures.finalists,
        distinctStudents: 0,
        awardRate: measures.award_rate,
        qualificationRate: measures.qualification_rate,
        competitionStrength: measures.ranking_score,
        awardDensity: measures.award_rate ?? 0,
      },
      sourceRowCount: resolveFamilyRowsForYear(slice, familyKey).length,
    };
  });

  const hasParticipation = nodes.some((n) => n.metrics.participation > 0);
  const hasMedals = nodes.some((n) => n.metrics.gold + n.metrics.silver + n.metrics.bronze > 0);
  const hasQualification = nodes.some((n) => n.metrics.qualified > 0);
  const hasRankings = nodes.some((n) => n.metrics.rankings > 0);
  const hasAcceptance = nodes.some((n) => n.metrics.accepted > 0);
  const missingOutcomeYears = nodes
    .filter((n) => n.metrics.participation > 0 && n.metrics.awardWinners <= 0 && n.metrics.qualified <= 0)
    .map((n) => n.year);

  return {
    familyKey,
    years: slices.map((s) => s.year),
    nodes,
    signals: {
      hasParticipation,
      hasMedals,
      hasQualification,
      hasRankings,
      hasAcceptance,
      missingOutcomeYears,
    },
  };
};

export const outcomeKindForMetricKey = (metricKey: string): OutcomeKind => {
  if (["gold", "silver", "bronze", "award_winners", "award_rate", "medal_rate"].includes(metricKey)) {
    return "medal";
  }
  if (["nomination", "qualification_rate", "qualified"].includes(metricKey)) return "qualification";
  if (["acceptance", "pass"].includes(metricKey)) return "acceptance";
  if (["rankings", "first_place", "ranking_score"].includes(metricKey)) return "ranking";
  if (["participation", "students"].includes(metricKey)) return "participation";
  return "award";
};
