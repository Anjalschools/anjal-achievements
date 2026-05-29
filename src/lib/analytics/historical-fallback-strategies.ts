/**
 * Historical fallback strategies — progressive relaxation before empty states.
 */

import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";
import {
  ACTIVITY_FAMILIES,
  buildHistoricalComparisonTable,
  columnKey,
  type ActivityFamilyDef,
} from "@/lib/analytics/historical-comparison-table-engine";
import { ROW_CATEGORIES } from "@/lib/analytics/shared/historical-row-categories";
import { buildFamilyRowMatcher } from "@/lib/analytics/historical-activity-resolution";
import { getSmartResultsMetrics } from "@/lib/analytics/historical-smart-results-table";
import { injectOutcomeMeasuresIntoSlices } from "@/lib/analytics/historical-outcome-measure-injector";
import { buildCellsFromOutcomeMeasures } from "@/lib/analytics/historical-outcome-row-builder";
import type { HistoricalTableDisplayMode } from "@/lib/analytics/historical-executive-table-theme";

export type HistoricalFallbackStrategy =
  | "STRICT"
  | "RELAXED"
  | "DIMENSION_RELAXED"
  | "METRIC_RELAXED"
  | "YEAR_RELAXED"
  | "EXPLORATORY";

export type HistoricalFallbackResult<T> = {
  data: T;
  strategy: HistoricalFallbackStrategy;
  fallbackReason: string;
  fallbackReasonEn: string;
  fallbackConfidence: number;
  partial: boolean;
};

const LOG = process.env.NODE_ENV !== "production";

const familyHasSignal = (slices: HistoricalYearSlice[], family: ActivityFamilyDef): boolean => {
  const match = buildFamilyRowMatcher(family.key);
  return slices.some((s) => {
    const rows = s.payload.table.filter(match);
    return rows.some(
      (r) =>
        r.totalParticipations > 0 ||
        r.goldMedalCount > 0 ||
        r.nominationCount > 0 ||
        r.rankCount > 0
    );
  });
};

const buildExploratoryTable = (
  family: ActivityFamilyDef,
  slices: HistoricalYearSlice[]
): HistoricalComparisonTableModel | null => {
  const years = slices.map((s) => s.year);
  if (years.length === 0) return null;

  const metrics = getSmartResultsMetrics(family.tableType);
  const injection = injectOutcomeMeasuresIntoSlices(slices, family.key, family.tableType);
  const cells = buildCellsFromOutcomeMeasures(
    injection.slices,
    slices.map((year) => ({
      year: year.year,
      labelAr: `${family.labelAr} ${year.year}`,
      labelEn: `${family.labelEn} ${year.year}`,
      metrics,
    }))
  );

  const total = Object.values(cells).reduce((s, v) => s + v, 0);
  if (total <= 0) return null;

  return {
    id: `hist-exploratory-${family.key}`,
    tableType: family.tableType,
    themeId: family.themeId,
    mode: "historical",
    sectionTitleAr: "تحليل تاريخي للمسابقات",
    sectionTitleEn: "Historical competition analysis",
    activityFamilyKey: family.key,
    activityLabelAr: family.labelAr,
    activityLabelEn: family.labelEn,
    yearGroups: years.map((year) => ({
      year,
      labelAr: `${family.labelAr} ${year}`,
      labelEn: `${family.labelEn} ${year}`,
      metrics,
    })),
    rowCategories: ROW_CATEGORIES,
    rows: [
      {
        key: "all_combined",
        labelAr: "إجمالي النشاط",
        labelEn: "Activity total",
        cells,
      },
    ],
    totals: {
      rowTotals: { all_combined: total },
      columnTotals: cells,
      grandTotal: total,
      valid: true,
      issues: [],
    },
    trends: [],
    narratives: [],
  };
};

export const buildHistoricalTablesWithFallback = (input: {
  slices: HistoricalYearSlice[];
  sectionTitleAr?: string;
  sectionTitleEn?: string;
  displayMode?: HistoricalTableDisplayMode;
}): HistoricalFallbackResult<HistoricalComparisonTableModel[]> => {
  const strategies: HistoricalFallbackStrategy[] = [
    "STRICT",
    "RELAXED",
    "DIMENSION_RELAXED",
    "METRIC_RELAXED",
    "EXPLORATORY",
  ];

  for (const strategy of strategies) {
    const tables: HistoricalComparisonTableModel[] = [];

    for (const family of ACTIVITY_FAMILIES) {
      if (!familyHasSignal(input.slices, family)) continue;

      let model: HistoricalComparisonTableModel | null = null;

      if (strategy === "EXPLORATORY") {
        model = buildExploratoryTable(family, input.slices);
      } else {
        model = buildHistoricalComparisonTable({
          family,
          slices: input.slices,
          sectionTitleAr: input.sectionTitleAr,
          sectionTitleEn: input.sectionTitleEn,
          displayMode: input.displayMode ?? "executive",
        });
        if (!model && strategy !== "STRICT") {
          model = buildExploratoryTable(family, input.slices);
        }
      }

      if (model) tables.push(model);
    }

    if (tables.length > 0) {
      const confidence =
        strategy === "STRICT"
          ? 95
          : strategy === "RELAXED"
            ? 85
            : strategy === "EXPLORATORY"
              ? 45
              : 65;

      if (LOG) {
        // eslint-disable-next-line no-console
        console.info("[historical-fallback]", strategy, tables.length);
      }

      return {
        data: tables.sort((a, b) => b.totals.grandTotal - a.totals.grandTotal),
        strategy,
        fallbackReason: `تم العثور على بيانات باستراتيجية ${strategy}`,
        fallbackReasonEn: `Data resolved using ${strategy} strategy`,
        fallbackConfidence: confidence,
        partial: strategy !== "STRICT",
      };
    }
  }

  return {
    data: [],
    strategy: "EXPLORATORY",
    fallbackReason: "إشارة تاريخية جزئية فقط",
    fallbackReasonEn: "Partial historical signal only",
    fallbackConfidence: 0,
    partial: true,
  };
};
