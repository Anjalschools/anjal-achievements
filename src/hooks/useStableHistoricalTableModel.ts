"use client";

import { useMemo } from "react";
import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";
import type { AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";
import {
  buildStableHistoricalColumnLayout,
  buildStableHistoricalRows,
  countValidHistoricalYears,
  type StableHistoricalColumnLayout,
  type StableHistoricalRow,
} from "@/lib/analytics/analytics-table-value-normalizer";
import {
  buildSafeHistoricalModel,
  validateHistoricalTableModel,
  type HistoricalTableValidationResult,
} from "@/lib/analytics/analytics-historical-table-validator";

export type StableHistoricalTableModel = {
  model: HistoricalComparisonTableModel;
  layout: StableHistoricalColumnLayout;
  rows: StableHistoricalRow[];
  validation: HistoricalTableValidationResult;
  validYearCount: number;
  trendsEligible: boolean;
  insufficientTrendLabelAr: string;
  insufficientTrendLabelEn: string;
};

export const useStableHistoricalTableModel = (
  rawModel: HistoricalComparisonTableModel | null | undefined,
  loc: AnalyticsLocale
): StableHistoricalTableModel | null => {
  return useMemo(() => {
    if (!rawModel) return null;

    const safeModel = buildSafeHistoricalModel(rawModel);
    const layout = buildStableHistoricalColumnLayout(safeModel);
    const rows = buildStableHistoricalRows(safeModel, layout, loc);
    const validation = validateHistoricalTableModel(safeModel);
    const validYearCount = countValidHistoricalYears(layout, rows);
    const trendsEligible = validYearCount >= 2;

    return {
      model: safeModel,
      layout,
      rows,
      validation,
      validYearCount,
      trendsEligible,
      insufficientTrendLabelAr: "بيانات غير كافية للتحليل",
      insufficientTrendLabelEn: "Insufficient data for trend analysis",
    };
  }, [rawModel, loc]);
};
