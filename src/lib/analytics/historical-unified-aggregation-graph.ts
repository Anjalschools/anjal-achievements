/**
 * Unified aggregation graph — participation + achievements + medals + rankings in one pipeline.
 */

import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import type { HistoricalTableType } from "@/lib/analytics/historical-comparison-table-engine";
import { resolveFamilyRowsForYear } from "@/lib/analytics/historical-activity-resolution";
import { aggregateMedalsFromRows } from "@/lib/analytics/historical-medal-aggregation";
import { extractRankingsFromRows } from "@/lib/analytics/historical-ranking-extractor";
import { resolveQualificationFromRows } from "@/lib/analytics/historical-qualification-resolution";
import { resolveSmartResultsProfile } from "@/lib/analytics/historical-smart-results-table";
import { ratioToPercentage } from "@/lib/analytics/analytics-number-formatting";

export type HistoricalOutcomeMeasures = {
  participants: number;
  qualified_students: number;
  award_winners: number;
  gold_medals: number;
  silver_medals: number;
  bronze_medals: number;
  finalists: number;
  accepted_students: number;
  rankings: number;
  first_place: number;
  ranking_score: number;
  award_rate: number | null;
  qualification_rate: number | null;
};

export type UnifiedAggregationGraph = {
  familyKey: string;
  profile: ReturnType<typeof resolveSmartResultsProfile>;
  byYear: Record<number, HistoricalOutcomeMeasures>;
  totals: HistoricalOutcomeMeasures;
  signals: {
    hasParticipation: boolean;
    hasMedals: boolean;
    hasQualification: boolean;
    hasRankings: boolean;
    hasAcceptance: boolean;
  };
  provenance: Record<
    number,
    {
      rowCount: number;
      medalFromChart: boolean;
      rankingFromKpi: boolean;
      qualFromChart: boolean;
    }
  >;
};

const emptyMeasures = (): HistoricalOutcomeMeasures => ({
  participants: 0,
  qualified_students: 0,
  award_winners: 0,
  gold_medals: 0,
  silver_medals: 0,
  bronze_medals: 0,
  finalists: 0,
  accepted_students: 0,
  rankings: 0,
  first_place: 0,
  ranking_score: 0,
  award_rate: null,
  qualification_rate: null,
});

const sumMeasures = (list: HistoricalOutcomeMeasures[]): HistoricalOutcomeMeasures => {
  const out = emptyMeasures();
  for (const m of list) {
    out.participants += m.participants;
    out.qualified_students += m.qualified_students;
    out.award_winners += m.award_winners;
    out.gold_medals += m.gold_medals;
    out.silver_medals += m.silver_medals;
    out.bronze_medals += m.bronze_medals;
    out.finalists += m.finalists;
    out.accepted_students += m.accepted_students;
    out.rankings += m.rankings;
    out.first_place += m.first_place;
    out.ranking_score = Math.max(out.ranking_score, m.ranking_score);
  }
  if (out.participants > 0) {
    out.award_rate = ratioToPercentage(out.award_winners, out.participants);
    out.qualification_rate = ratioToPercentage(out.qualified_students, out.participants);
  }
  return out;
};

export const buildYearOutcomeMeasures = (
  slice: HistoricalYearSlice,
  familyKey: string
): { measures: HistoricalOutcomeMeasures; provenance: UnifiedAggregationGraph["provenance"][number] } => {
  const rows =
    familyKey === "aggregate"
      ? slice.payload.table ?? []
      : resolveFamilyRowsForYear(slice, familyKey);
  const participants = rows.reduce((s, r) => s + Number(r.totalParticipations ?? 0), 0);
  const kpiPart = Number(slice.payload.kpis?.totalParticipations ?? 0);
  const part = Math.max(participants, rows.length > 0 ? participants : 0);

  const medals = aggregateMedalsFromRows(rows, slice.payload.charts);
  const quals = resolveQualificationFromRows(rows, part, slice.payload.charts);
  const ranks = extractRankingsFromRows(rows, slice.payload.kpis);

  const measures: HistoricalOutcomeMeasures = {
    participants: part > 0 ? part : kpiPart,
    qualified_students: quals.qualified,
    award_winners: medals.total,
    gold_medals: medals.gold,
    silver_medals: medals.silver,
    bronze_medals: medals.bronze,
    finalists: Math.max(quals.finalists, medals.finalist),
    accepted_students: quals.accepted,
    rankings: ranks.rankings,
    first_place: ranks.firstPlace,
    ranking_score: ranks.rankingScore,
    award_rate: part > 0 ? ratioToPercentage(medals.total, part) : null,
    qualification_rate: quals.qualificationRate,
  };

  return {
    measures,
    provenance: {
      rowCount: rows.length,
      medalFromChart: medals.fromChartFallback > 0,
      rankingFromKpi: ranks.fromKpiFallback,
      qualFromChart: quals.fromChartFallback > 0,
    },
  };
};

export const buildUnifiedAggregationGraph = (
  slices: HistoricalYearSlice[],
  familyKey: string,
  tableType: HistoricalTableType
): UnifiedAggregationGraph => {
  const profile = resolveSmartResultsProfile(tableType);
  const byYear: Record<number, HistoricalOutcomeMeasures> = {};
  const provenance: UnifiedAggregationGraph["provenance"] = {};

  for (const slice of slices) {
    const { measures, provenance: prov } = buildYearOutcomeMeasures(slice, familyKey);
    byYear[slice.year] = measures;
    provenance[slice.year] = prov;
  }

  const totals = sumMeasures(Object.values(byYear));

  const signals = {
    hasParticipation: totals.participants > 0,
    hasMedals: totals.gold_medals + totals.silver_medals + totals.bronze_medals > 0,
    hasQualification: totals.qualified_students > 0,
    hasRankings: totals.rankings > 0 || totals.first_place > 0,
    hasAcceptance: totals.accepted_students > 0,
  };

  return { familyKey, profile, byYear, totals, signals, provenance };
};

export const graphHasMetricSignal = (
  graph: UnifiedAggregationGraph,
  metricKey: string
): boolean => {
  const t = graph.totals;
  switch (metricKey) {
    case "participation":
      return graph.signals.hasParticipation;
    case "nomination":
    case "qualified":
    case "qualification_rate":
      return graph.signals.hasQualification;
    case "award_winners":
    case "gold":
    case "silver":
    case "bronze":
    case "award_rate":
    case "medal_rate":
      return graph.signals.hasMedals;
    case "rankings":
    case "first_place":
    case "ranking_score":
      return graph.signals.hasRankings;
    case "acceptance":
    case "pass":
    case "finalists":
      return graph.signals.hasAcceptance || graph.signals.hasQualification;
    case "avg_performance":
    case "score_95":
    case "excellence_rate":
      return t.participants > 0 && t.ranking_score > 0;
    default:
      return Object.values(graph.byYear).some((m) => measureValueForMetric(m, metricKey) > 0);
  }
};

export const measureValueForMetric = (
  measures: HistoricalOutcomeMeasures,
  metricKey: string
): number => {
  switch (metricKey) {
    case "participation":
      return measures.participants;
    case "nomination":
    case "qualified":
      return measures.qualified_students;
    case "award_winners":
      return measures.award_winners;
    case "gold":
      return measures.gold_medals;
    case "silver":
      return measures.silver_medals;
    case "bronze":
      return measures.bronze_medals;
    case "finalists":
      return measures.finalists;
    case "acceptance":
    case "pass":
      return measures.accepted_students;
    case "rankings":
      return measures.rankings;
    case "first_place":
      return measures.first_place;
    case "ranking_score":
      return measures.ranking_score;
    case "award_rate":
    case "medal_rate":
      return measures.award_rate ?? 0;
    case "qualification_rate":
      return measures.qualification_rate ?? 0;
    default:
      return 0;
  }
};
