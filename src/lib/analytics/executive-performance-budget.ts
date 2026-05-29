/**
 * Executive chart performance budget — degrade heavy viz when complexity grows.
 */

export type ExecutiveChartBudget = {
  chartCount: number;
  yearCount: number;
  rowCount: number;
  exceedsBudget: boolean;
  deferAdvancedCharts: boolean;
  hideHeatmap: boolean;
  hideClusterMap: boolean;
  maxVisibleCharts: number;
  reasonAr: string;
  reasonEn: string;
};

const CHART_CELL_BUDGET = 48;

export const computeExecutiveChartBudget = (input: {
  chartCount: number;
  yearCount: number;
  rowCount: number;
}): ExecutiveChartBudget => {
  const complexity = input.chartCount * Math.max(1, input.yearCount) * Math.max(1, input.rowCount);
  const exceedsBudget = complexity > CHART_CELL_BUDGET;
  const deferAdvancedCharts = exceedsBudget || input.chartCount > 6;
  return {
    ...input,
    exceedsBudget,
    deferAdvancedCharts,
    hideHeatmap: exceedsBudget && input.rowCount > 12,
    hideClusterMap: exceedsBudget && input.chartCount > 5,
    maxVisibleCharts: exceedsBudget ? 4 : 8,
    reasonAr: exceedsBudget
      ? "تم تخفيف الرسوم المتقدمة تلقائيًا لحماية الأداء"
      : "ضمن ميزانية العرض التنفيذية",
    reasonEn: exceedsBudget
      ? "Advanced charts deferred automatically for performance"
      : "Within executive rendering budget",
  };
};
