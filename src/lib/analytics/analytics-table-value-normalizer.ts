/**
 * Historical table cell value normalization — single display contract for UI + export.
 */

import type { AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";
import {
  formatLocalizedNumber,
  formatPercentage,
  normalizeDecimal,
} from "@/lib/analytics/analytics-number-formatting";
import {
  formatMetricValue,
  type MetricId,
} from "@/lib/analytics/analytics-metric-registry";
import { columnKey } from "@/lib/analytics/historical-comparison-table-engine";
import type {
  HistoricalComparisonTableModel,
  HistoricalMetricColumn,
  HistoricalYearColumnGroup,
} from "@/lib/analytics/historical-comparison-table-engine";
import { getSmartResultsMetrics } from "@/lib/analytics/historical-smart-results-table";
import {
  isMedalCountMetric,
  isRateMetric,
  medalPlaceholderTooltip,
  ratePlaceholderTooltip,
  shouldShowMedalPlaceholder,
} from "@/lib/analytics/historical-results-metric-semantics";
import type { HistoricalTableType } from "@/lib/analytics/historical-comparison-table-engine";
import { mergeSlicesYears } from "@/lib/analytics/analytics-historical-year-normalizer";
import { resolveSmartSemanticValue } from "@/lib/analytics/analytics-smart-semantic-values";

export const EMPTY_DASH = "—";
export const EMPTY_NA = "N/A";

export type HistoricalMetricFormatKind = "count" | "percentage" | "score" | "average" | "na";

export type HistoricalMetricMeta = {
  key: string;
  formatKind: HistoricalMetricFormatKind;
  metricId?: MetricId;
  aggregatable: boolean;
  decimals: number;
};

const HISTORICAL_METRIC_META: Record<string, HistoricalMetricMeta> = {
  participation: { key: "participation", formatKind: "count", metricId: "participation_count", aggregatable: true, decimals: 0 },
  nomination: { key: "nomination", formatKind: "count", metricId: "qualification_rate", aggregatable: true, decimals: 0 },
  acceptance: { key: "acceptance", formatKind: "count", metricId: "acceptance_rate", aggregatable: true, decimals: 0 },
  pass: { key: "pass", formatKind: "count", metricId: "acceptance_rate", aggregatable: true, decimals: 0 },
  gold: { key: "gold", formatKind: "count", aggregatable: true, decimals: 0 },
  silver: { key: "silver", formatKind: "count", aggregatable: true, decimals: 0 },
  bronze: { key: "bronze", formatKind: "count", aggregatable: true, decimals: 0 },
  award_winners: { key: "award_winners", formatKind: "count", aggregatable: true, decimals: 0 },
  exceptional: { key: "exceptional", formatKind: "count", aggregatable: true, decimals: 0 },
  gifted: { key: "gifted", formatKind: "count", aggregatable: true, decimals: 0 },
  promising: { key: "promising", formatKind: "count", aggregatable: true, decimals: 0 },
  intensive: { key: "intensive", formatKind: "count", aggregatable: true, decimals: 0 },
  score_90: { key: "score_90", formatKind: "count", aggregatable: true, decimals: 0 },
  score_95: { key: "score_95", formatKind: "count", aggregatable: true, decimals: 0 },
  award_rate: { key: "award_rate", formatKind: "percentage", metricId: "medal_conversion", aggregatable: false, decimals: 1 },
  qualification_rate: { key: "qualification_rate", formatKind: "percentage", aggregatable: false, decimals: 1 },
  medal_rate: { key: "medal_rate", formatKind: "percentage", metricId: "medal_conversion", aggregatable: false, decimals: 1 },
  completion_rate: { key: "completion_rate", formatKind: "percentage", aggregatable: false, decimals: 1 },
  excellence_rate: { key: "excellence_rate", formatKind: "percentage", aggregatable: false, decimals: 1 },
  discovery_rate: { key: "discovery_rate", formatKind: "percentage", metricId: "talent_growth", aggregatable: false, decimals: 1 },
  avg_performance: { key: "avg_performance", formatKind: "average", aggregatable: false, decimals: 1 },
};

export const getHistoricalMetricMeta = (metricKey: string): HistoricalMetricMeta =>
  HISTORICAL_METRIC_META[metricKey] ?? {
    key: metricKey,
    formatKind: "count",
    aggregatable: true,
    decimals: 0,
  };

const coerceRaw = (raw: unknown): number | null => {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t === "." || t === "—" || t === "-" || t === "N/A" || t === "n/a") return null;
    const n = Number(t.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || Number.isNaN(raw)) return null;
    return raw;
  }
  return null;
};

export type NormalizedHistoricalValue = {
  numeric: number;
  display: string;
  isEmpty: boolean;
  isMissing: boolean;
  formatKind: HistoricalMetricFormatKind;
  tooltipAr?: string;
  tooltipEn?: string;
};

export const normalizeHistoricalValue = (
  raw: unknown,
  metricKey: string,
  options?: {
    loc?: AnalyticsLocale;
    isTotalRow?: boolean;
    hasYear?: boolean;
    explicitMissing?: boolean;
    hasParticipationScope?: boolean;
    verifiedOutcomeSource?: boolean;
    exploratoryMode?: boolean;
  }
): NormalizedHistoricalValue => {
  const loc = options?.loc ?? "ar";
  const meta = getHistoricalMetricMeta(metricKey);
  const n = coerceRaw(raw);

  const smart = resolveSmartSemanticValue({
    metricKey,
    raw: n,
    loc,
    isTotalRow: options?.isTotalRow,
    hasYear: options?.hasYear,
    explicitMissing: options?.explicitMissing,
    hasParticipationScope: options?.hasParticipationScope,
    verifiedOutcomeSource: options?.verifiedOutcomeSource,
    exploratoryMode: options?.exploratoryMode,
    aggregatable: meta.aggregatable,
    decimals: meta.decimals,
  });

  return {
    numeric: smart.numeric,
    display: smart.display,
    isEmpty: smart.isEmpty,
    isMissing: smart.isMissing,
    formatKind: meta.formatKind,
    tooltipAr: smart.tooltipAr,
    tooltipEn: smart.tooltipEn,
  };
};

export type StableColumnSpec = {
  year: number;
  metricKey: string;
  columnKey: string;
  colIndex: number;
  minWidthPx: number;
  metric: HistoricalMetricColumn;
  yearLabelAr: string;
  yearLabelEn: string;
};

export type StableHistoricalColumnLayout = {
  headerDepth: 2;
  totalColumns: number;
  labelColumnWidthPx: number;
  yearColumnMinWidthPx: number;
  columns: StableColumnSpec[];
  yearGroups: HistoricalYearColumnGroup[];
  yearHeaderSpans: Array<{ year: number; colSpan: number; labelAr: string; labelEn: string }>;
};

export const buildStableHistoricalColumnLayout = (
  model: HistoricalComparisonTableModel
): StableHistoricalColumnLayout => {
  const canonicalMetrics = getSmartResultsMetrics(model.tableType);

  const timelineYears = mergeSlicesYears(model.yearGroups.map((g) => g.year));

  const yearGroups: HistoricalYearColumnGroup[] = timelineYears.map((year) => {
    const existing = model.yearGroups.find((g) => g.year === year);
    const metrics = canonicalMetrics;
    return {
      year,
      labelAr: existing?.labelAr ?? `${model.activityLabelAr} ${year}-${year + 1}`,
      labelEn: existing?.labelEn ?? `${model.activityLabelEn} ${year}-${year + 1}`,
      metrics,
    };
  });

  const columns: StableColumnSpec[] = [];
  let colIndex = 0;
  const yearHeaderSpans: StableHistoricalColumnLayout["yearHeaderSpans"] = [];

  for (const yg of yearGroups) {
    yearHeaderSpans.push({
      year: yg.year,
      colSpan: yg.metrics.length,
      labelAr: yg.labelAr,
      labelEn: yg.labelEn,
    });
    for (const m of yg.metrics) {
      columns.push({
        year: yg.year,
        metricKey: m.key,
        columnKey: columnKey(yg.year, m.key),
        colIndex,
        minWidthPx: m.key === "participation" ? 72 : m.key.includes("rate") ? 64 : 56,
        metric: m,
        yearLabelAr: yg.labelAr,
        yearLabelEn: yg.labelEn,
      });
      colIndex += 1;
    }
  }

  return {
    headerDepth: 2,
    totalColumns: columns.length + 1,
    labelColumnWidthPx: 140,
    yearColumnMinWidthPx: 56,
    columns,
    yearGroups,
    yearHeaderSpans,
  };
};

export type StableHistoricalRow = {
  key: string;
  labelAr: string;
  labelEn: string;
  isTotal: boolean;
  cells: Record<string, NormalizedHistoricalValue>;
};

export const buildStableHistoricalRows = (
  model: HistoricalComparisonTableModel,
  layout: StableHistoricalColumnLayout,
  loc: AnalyticsLocale
): StableHistoricalRow[] =>
  model.rows.map((row) => {
    const cells: Record<string, NormalizedHistoricalValue> = {};
    for (const col of layout.columns) {
      const hasKey = Object.prototype.hasOwnProperty.call(row.cells, col.columnKey);
      const raw = hasKey ? row.cells[col.columnKey] : undefined;
      const partKey = columnKey(col.year, "participation");
      const partRaw = row.cells[partKey] ?? 0;
      const participationScope = typeof partRaw === "number" ? partRaw : 0;

      let normalized = normalizeHistoricalValue(raw, col.metricKey, {
        loc,
        isTotalRow: Boolean(row.isTotal),
        hasYear: layout.yearGroups.some((g) => g.year === col.year),
        explicitMissing: !hasKey,
        hasParticipationScope: participationScope > 0,
        verifiedOutcomeSource: Boolean(
          model.unifiedGraph?.signals?.hasMedals ||
            model.unifiedGraph?.signals?.hasRankings ||
            model.unifiedGraph?.signals?.hasQualification ||
            model.unifiedGraph?.signals?.hasAcceptance
        ),
        exploratoryMode: false,
      });

      if (
        !row.isTotal &&
        shouldShowMedalPlaceholder(col.metricKey, normalized.numeric, participationScope)
      ) {
        normalized = {
          ...normalized,
          display: EMPTY_DASH,
          isEmpty: true,
          tooltipAr: medalPlaceholderTooltip(true),
          tooltipEn: medalPlaceholderTooltip(false),
        } as NormalizedHistoricalValue & { tooltipAr?: string; tooltipEn?: string };
      }

      if (!hasKey && isRateMetric(col.metricKey)) {
        normalized = {
          numeric: 0,
          display: EMPTY_DASH,
          isEmpty: true,
          isMissing: false,
          formatKind: "percentage",
          tooltipAr: ratePlaceholderTooltip(true),
          tooltipEn: ratePlaceholderTooltip(false),
        } as NormalizedHistoricalValue & { tooltipAr?: string; tooltipEn?: string };
      }

      cells[col.columnKey] = normalized;
    }
    return {
      key: row.key,
      labelAr: row.labelAr,
      labelEn: row.labelEn,
      isTotal: Boolean(row.isTotal),
      cells,
    };
  });

export const countValidHistoricalYears = (
  layout: StableHistoricalColumnLayout,
  rows: StableHistoricalRow[]
): number => {
  const yearsWithData = new Set<number>();
  for (const row of rows) {
    if (row.isTotal) continue;
    for (const col of layout.columns) {
      const cell = row.cells[col.columnKey];
      if (cell && !cell.isEmpty && cell.numeric > 0) {
        yearsWithData.add(col.year);
      }
    }
  }
  return yearsWithData.size;
};
