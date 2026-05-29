/**
 * Real totals engine — per-metric aggregation + rate recomputation (not sum of rates).
 */

import { columnKey } from "@/lib/analytics/historical-comparison-table-engine";
import { isRateMetric } from "@/lib/analytics/historical-results-metric-semantics";
import { ratioToPercentage } from "@/lib/analytics/analytics-number-formatting";
import type { TableTotalsBundle } from "@/lib/analytics/analytics-table-total-contract";

const COUNT_METRICS = [
  "participation",
  "nomination",
  "award_winners",
  "gold",
  "silver",
  "bronze",
  "rankings",
  "first_place",
  "acceptance",
  "finalists",
  "qualified",
] as const;

const metricFromColumnKey = (colKey: string): string => {
  const parts = colKey.split("__");
  return parts[parts.length - 1] ?? colKey;
};

const yearFromColumnKey = (colKey: string): number => {
  const parts = colKey.split("__");
  return Number(parts[0]) || 0;
};

export const buildRealHistoricalTotals = (
  rows: Array<{ key: string; cells: Record<string, number> }>
): TableTotalsBundle => {
  const dataRows = rows.filter((r) => r.key !== "__total__" && r.key !== "activity_total");
  const columnKeys = new Set<string>();
  for (const row of dataRows) {
    Object.keys(row.cells).forEach((k) => columnKeys.add(k));
  }

  const columnTotals: Record<string, number> = {};
  const rowTotals: Record<string, number> = {};

  for (const row of dataRows) {
    let rowSum = 0;
    for (const [col, val] of Object.entries(row.cells)) {
      const metric = metricFromColumnKey(col);
      const n = typeof val === "number" && Number.isFinite(val) ? val : 0;
      if (isRateMetric(metric)) continue;
      columnTotals[col] = (columnTotals[col] ?? 0) + n;
      rowSum += n;
    }
    rowTotals[row.key] = rowSum;
  }

  for (const col of columnKeys) {
    const metric = metricFromColumnKey(col);
    if (!isRateMetric(metric)) continue;
    const year = yearFromColumnKey(col);
    const partCol = columnKey(year, "participation");
    const part = columnTotals[partCol] ?? 0;
    if (part <= 0) {
      columnTotals[col] = 0;
      continue;
    }
    if (metric === "award_rate" || metric === "medal_rate") {
      const awardCol = columnKey(year, "award_winners");
      const medals =
        (columnTotals[awardCol] ?? 0) ||
        (columnTotals[columnKey(year, "gold")] ?? 0) +
          (columnTotals[columnKey(year, "silver")] ?? 0) +
          (columnTotals[columnKey(year, "bronze")] ?? 0);
      columnTotals[col] = ratioToPercentage(medals, part);
    } else if (metric === "qualification_rate") {
      const qual = columnTotals[columnKey(year, "nomination")] ?? 0;
      columnTotals[col] = ratioToPercentage(qual, part);
    }
  }

  const grandTotal = Object.values(rowTotals).reduce((s, v) => s + v, 0);

  return {
    rowTotals,
    columnTotals,
    grandTotal,
    valid: true,
    issues: [],
  };
};

export const appendRealTotalsRow = (
  rows: Array<{ key: string; labelAr: string; labelEn: string; cells: Record<string, number> }>,
  totalLabelAr: string,
  totalLabelEn: string
): Array<{
  key: string;
  labelAr: string;
  labelEn: string;
  cells: Record<string, number>;
  isTotal?: boolean;
}> => {
  const totals = buildRealHistoricalTotals(rows);
  return [
    ...rows,
    {
      key: "__total__",
      labelAr: totalLabelAr,
      labelEn: totalLabelEn,
      cells: { ...totals.columnTotals },
      isTotal: true,
    },
  ];
};

export { COUNT_METRICS };
