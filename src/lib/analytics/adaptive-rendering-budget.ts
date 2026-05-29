/**
 * Adaptive rendering budget — auto-condense when years × metrics × rows exceed threshold.
 */

import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";
import type { HistoricalTableDisplayMode } from "@/lib/analytics/historical-executive-table-theme";

export type RenderingBudget = {
  cellCount: number;
  exceedsBudget: boolean;
  recommendedMode: HistoricalTableDisplayMode;
  recommendedYearsPerBlock: number;
  reasonAr: string;
  reasonEn: string;
};

const DEFAULT_CELL_BUDGET = 120;

export const computeRenderingBudget = (
  model: HistoricalComparisonTableModel,
  displayMode: HistoricalTableDisplayMode = "executive"
): RenderingBudget => {
  const yearCount = model.yearGroups.length;
  const metricCount = model.yearGroups[0]?.metrics.length ?? 0;
  const rowCount = model.rows.filter((r) => !r.isTotal).length;
  const cellCount = yearCount * metricCount * Math.max(1, rowCount);
  const exceedsBudget = cellCount > DEFAULT_CELL_BUDGET;

  let recommendedMode: HistoricalTableDisplayMode = displayMode;
  if (exceedsBudget && displayMode === "analyst") {
    recommendedMode = "executive";
  } else if (exceedsBudget && displayMode === "executive") {
    recommendedMode = "compact";
  }

  const recommendedYearsPerBlock = exceedsBudget ? 2 : yearCount;

  return {
    cellCount,
    exceedsBudget,
    recommendedMode,
    recommendedYearsPerBlock,
    reasonAr: exceedsBudget
      ? "حجم الجدول كبير — تم تفعيل الوضع الم condensed تلقائيًا"
      : "ضمن ميزانية العرض",
    reasonEn: exceedsBudget
      ? "Large table — condensed mode applied automatically"
      : "Within rendering budget",
  };
};

export const resolveEffectiveDisplayMode = (
  requested: HistoricalTableDisplayMode,
  model: HistoricalComparisonTableModel
): HistoricalTableDisplayMode => {
  const budget = computeRenderingBudget(model, requested);
  if (budget.exceedsBudget && requested === "analyst") return budget.recommendedMode;
  if (budget.exceedsBudget && requested === "executive" && budget.cellCount > DEFAULT_CELL_BUDGET * 2) {
    return "compact";
  }
  return requested;
};
