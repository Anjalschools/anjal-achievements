/**
 * Historical results resolution engine — single source of truth for outcome aggregation.
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import type {
  HistoricalComparisonTableModel,
  HistoricalMetricColumn,
  HistoricalTableType,
  HistoricalYearColumnGroup,
} from "@/lib/analytics/historical-comparison-table-engine";
import { ACTIVITY_FAMILIES } from "@/lib/analytics/historical-comparison-table-engine";
import { columnKey } from "@/lib/analytics/historical-comparison-table-engine";
import type { HistoricalRowCategory } from "@/lib/analytics/shared/historical-row-categories";
import {
  buildFamilyRowMatcher,
  resolveFamilyRowsForYear,
} from "@/lib/analytics/historical-activity-resolution";
import {
  aggregateOutcomeMetricsFromRows,
  buildHistoricalOutcomeGraph,
  type HistoricalOutcomeGraph,
} from "@/lib/analytics/historical-outcome-model";
import {
  computeHistoricalRate,
  computeHistoricalMetricValue,
  isRateMetric,
} from "@/lib/analytics/historical-results-metric-semantics";
import { rankingMetricValue } from "@/lib/analytics/historical-ranking-engine";
import { stableAnalyticsHash } from "@/lib/analytics/analytics-historical-cache-v2";
import { injectOutcomeMeasuresIntoSlices } from "@/lib/analytics/historical-outcome-measure-injector";
import { buildHistoricalOutcomeRows } from "@/lib/analytics/historical-outcome-row-builder";
import type { UnifiedAggregationGraph } from "@/lib/analytics/historical-unified-aggregation-graph";
import { logHistoricalResultsDebug } from "@/lib/analytics/historical-results-debugger";

export type HistoricalOutcomeGap = {
  hasParticipation: boolean;
  hasAwardData: boolean;
  messageAr: string | null;
  messageEn: string | null;
  missingYears: number[];
};

const resultsGraphCache = new Map<string, HistoricalOutcomeGraph>();

export const buildResultsFingerprint = (
  familyKey: string,
  slices: HistoricalYearSlice[]
): string =>
  stableAnalyticsHash({
    family: familyKey,
    years: slices.map((s) => s.year).join(","),
    rows: slices
      .map((s) => {
        const rows = resolveFamilyRowsForYear(s, familyKey);
        const m = aggregateOutcomeMetricsFromRows(rows);
        return `${s.year}:${m.participation}:${m.gold}:${m.qualified}`;
      })
      .join("|"),
    v: "outcome-v1",
  });

export const resolveHistoricalOutcomeGraph = (
  familyKey: string,
  slices: HistoricalYearSlice[],
  rowKey = "activity_total"
): HistoricalOutcomeGraph => {
  const fp = buildResultsFingerprint(familyKey, slices);
  const cached = resultsGraphCache.get(fp);
  if (cached) return cached;
  const graph = buildHistoricalOutcomeGraph(familyKey, slices, rowKey);
  resultsGraphCache.set(fp, graph);
  if (resultsGraphCache.size > 48) {
    const first = resultsGraphCache.keys().next().value;
    if (first) resultsGraphCache.delete(first);
  }
  return graph;
};

export const invalidateHistoricalResultsCache = (): void => {
  resultsGraphCache.clear();
};

export const resolveMetricFromRows = (
  rows: ParticipationActivityRow[],
  metricKey: string
): number => {
  if (metricKey === "rankings") return rankingMetricValue(rows, "rankings");
  if (metricKey === "first_place") return rankingMetricValue(rows, "first_place");
  if (metricKey === "ranking_score") return rankingMetricValue(rows, "ranking_score");
  if (metricKey === "qualified") {
    return rows.reduce((s, r) => s + r.nominationCount, 0);
  }
  if (metricKey === "finalists") {
    return rows.reduce((s, r) => s + (r.rankCount > 0 ? 1 : 0), 0);
  }
  if (isRateMetric(metricKey)) {
    const rate = computeHistoricalRate(
      rows,
      metricKey as Parameters<typeof computeHistoricalRate>[1]
    );
    return rate ?? 0;
  }
  return computeHistoricalMetricValue(
    rows,
    metricKey as Parameters<typeof computeHistoricalMetricValue>[1]
  );
};

export const detectHistoricalOutcomeGapFromUnified = (
  unified: UnifiedAggregationGraph
): HistoricalOutcomeGap => {
  const hasParticipation = unified.signals.hasParticipation;
  const hasAwardData =
    unified.signals.hasMedals ||
    unified.signals.hasQualification ||
    unified.signals.hasRankings ||
    unified.signals.hasAcceptance;

  const missingYears = Object.entries(unified.byYear)
    .filter(([, m]) => m.participants > 0 && m.award_winners <= 0 && m.qualified_students <= 0)
    .map(([y]) => Number(y));

  return {
    hasParticipation,
    hasAwardData,
    missingYears,
    messageAr:
      hasParticipation && !hasAwardData
        ? "لا توجد بيانات نتائج/تتويج مرتبطة بهذه المشاركات"
        : missingYears.length > 0
          ? `سنوات بمشاركة دون نتائج: ${missingYears.join("، ")}`
          : null,
    messageEn:
      hasParticipation && !hasAwardData
        ? "No award/qualification results linked to these participations"
        : missingYears.length > 0
          ? `Years with participation but no outcomes: ${missingYears.join(", ")}`
          : null,
  };
};

/** @deprecated use detectHistoricalOutcomeGapFromUnified */
export const detectHistoricalOutcomeGap = (graph: HistoricalOutcomeGraph): HistoricalOutcomeGap => {
  const hasParticipation = graph.signals.hasParticipation;
  const hasAwardData =
    graph.signals.hasMedals ||
    graph.signals.hasQualification ||
    graph.signals.hasRankings ||
    graph.signals.hasAcceptance;
  const missingYears = graph.signals.missingOutcomeYears;

  return {
    hasParticipation,
    hasAwardData,
    missingYears,
    messageAr:
      hasParticipation && !hasAwardData
        ? "لا توجد بيانات نتائج/تتويج مسجّلة لهذه السنوات — تُعرض المشاركات فقط"
        : missingYears.length > 0
          ? `سنوات بمشاركة دون نتائج: ${missingYears.join("، ")}`
          : null,
    messageEn:
      hasParticipation && !hasAwardData
        ? "No award/qualification results recorded for these years — showing participation only"
        : missingYears.length > 0
          ? `Years with participation but no outcomes: ${missingYears.join(", ")}`
          : null,
  };
};

export const buildOutcomeCellsForCategory = (
  slices: HistoricalYearSlice[],
  familyKey: string,
  yearGroups: HistoricalYearColumnGroup[],
  categoryMatcher: (row: ParticipationActivityRow) => boolean
): Record<string, number> => {
  const cells: Record<string, number> = {};
  const matchFamily = buildFamilyRowMatcher(familyKey);

  for (const slice of slices) {
    const familyRows = resolveFamilyRowsForYear(slice, familyKey);
    const catRows = familyRows.filter(categoryMatcher);
    for (const group of yearGroups) {
      if (group.year !== slice.year) continue;
      for (const metric of group.metrics) {
        const ck = columnKey(slice.year, metric.key);
        if (isRateMetric(metric.key)) {
          const rate = computeHistoricalRate(
            catRows,
            metric.key as Parameters<typeof computeHistoricalRate>[1]
          );
          if (rate != null) cells[ck] = rate;
          continue;
        }
        cells[ck] = resolveMetricFromRows(catRows, metric.key);
      }
    }
  }
  return cells;
};

export const buildActivityTotalRow = (
  slices: HistoricalYearSlice[],
  familyKey: string,
  yearGroups: HistoricalYearColumnGroup[]
): { key: string; labelAr: string; labelEn: string; cells: Record<string, number> } | null => {
  const cells = buildOutcomeCellsForCategory(slices, familyKey, yearGroups, () => true);
  if (!Object.values(cells).some((v) => v > 0)) return null;
  return {
    key: "activity_total",
    labelAr: "إجمالي النشاط",
    labelEn: "Activity total",
    cells,
  };
};

export type ResolvedHistoricalTablePayload = {
  graph: HistoricalOutcomeGraph;
  unifiedGraph: UnifiedAggregationGraph;
  outcomeGap: HistoricalOutcomeGap;
  dataRows: Array<{
    key: string;
    labelAr: string;
    labelEn: string;
    cells: Record<string, number>;
  }>;
};

export const resolveHistoricalTablePayload = (input: {
  familyKey: string;
  slices: HistoricalYearSlice[];
  yearGroups: HistoricalYearColumnGroup[];
  rowCategories: HistoricalRowCategory[];
  rowMatchesCategory: (row: ParticipationActivityRow, cat: HistoricalRowCategory) => boolean;
  tableType?: HistoricalTableType;
}): ResolvedHistoricalTablePayload | null => {
  const inferredTableType =
    input.tableType ??
    (ACTIVITY_FAMILIES.find((f) => f.key === input.familyKey)?.tableType ?? "medals");

  const injection = injectOutcomeMeasuresIntoSlices(
    input.slices,
    input.familyKey,
    inferredTableType
  );

  const graph = resolveHistoricalOutcomeGraph(input.familyKey, injection.slices);

  const dataRows = buildHistoricalOutcomeRows({
    bundle: injection,
    yearGroups: input.yearGroups,
    familyKey: input.familyKey,
    rowCategories: input.rowCategories,
    rowMatchesCategory: (row, cat) => input.rowMatchesCategory(row, cat as HistoricalRowCategory),
  });

  if (dataRows.length === 0) return null;

  const outcomeGap = detectHistoricalOutcomeGapFromUnified(injection.unifiedGraph);

  return {
    graph,
    unifiedGraph: injection.unifiedGraph,
    outcomeGap,
    dataRows,
  };
};

export const attachOutcomeMetadata = (
  model: HistoricalComparisonTableModel,
  gap: HistoricalOutcomeGap
): HistoricalComparisonTableModel & { outcomeGap?: HistoricalOutcomeGap } => ({
  ...model,
  outcomeGap: gap,
  narratives: [
    ...model.narratives,
    ...(gap.messageAr
      ? [
          {
            id: "outcome_gap",
            priority: 90,
            bodyAr: gap.messageAr,
            bodyEn: gap.messageEn ?? gap.messageAr,
          },
        ]
      : []),
  ],
});

export const metricsWithOutcomeSignal = (
  graph: HistoricalOutcomeGraph,
  metrics: HistoricalMetricColumn[]
): HistoricalMetricColumn[] =>
  metrics.filter((m) => {
    if (m.key === "participation") return graph.signals.hasParticipation;
    if (["gold", "silver", "bronze", "award_winners", "award_rate", "medal_rate"].includes(m.key)) {
      return graph.signals.hasMedals;
    }
    if (["nomination", "qualification_rate", "qualified"].includes(m.key)) {
      return graph.signals.hasQualification;
    }
    if (["rankings", "first_place", "ranking_score"].includes(m.key)) {
      return graph.signals.hasRankings;
    }
    if (["acceptance", "pass"].includes(m.key)) {
      return graph.signals.hasAcceptance;
    }
    return true;
  });
