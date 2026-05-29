/**
 * Executive cell & year highlighting for historical tables.
 */

import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";
import { columnKey } from "@/lib/analytics/historical-comparison-table-engine";
import { isRateMetric } from "@/lib/analytics/historical-results-metric-semantics";

export type CellHighlightKind =
  | "peak_year"
  | "trough_year"
  | "best_rate"
  | "growth"
  | "warning"
  | null;

export type CellHighlightMap = Record<string, CellHighlightKind>;

const dataRows = (model: HistoricalComparisonTableModel) =>
  model.rows.filter((r) => !r.isTotal);

export const buildExecutiveCellHighlights = (
  model: HistoricalComparisonTableModel
): CellHighlightMap => {
  const highlights: CellHighlightMap = {};
  const rows = dataRows(model);
  if (rows.length === 0 || model.yearGroups.length < 2) return highlights;

  const years = model.yearGroups.map((g) => g.year);
  const partByYear = new Map<number, number>();
  for (const y of years) {
    const sum = rows.reduce((s, r) => s + (r.cells[columnKey(y, "participation")] ?? 0), 0);
    partByYear.set(y, sum);
  }

  let peakYear = years[0]!;
  let troughYear = years[0]!;
  for (const y of years) {
    if ((partByYear.get(y) ?? 0) > (partByYear.get(peakYear) ?? 0)) peakYear = y;
    if ((partByYear.get(y) ?? 0) < (partByYear.get(troughYear) ?? Infinity)) troughYear = y;
  }

  for (const yg of model.yearGroups) {
    for (const m of yg.metrics) {
      const ck = columnKey(yg.year, m.key);
      if (yg.year === peakYear && m.key === "participation") {
        highlights[ck] = "peak_year";
      } else if (yg.year === troughYear && m.key === "participation") {
        highlights[ck] = "trough_year";
      }
    }
  }

  for (const mKey of ["award_rate", "qualification_rate", "completion_rate"]) {
    let bestKey = "";
    let bestVal = -1;
    for (const yg of model.yearGroups) {
      if (!yg.metrics.some((m) => m.key === mKey)) continue;
      for (const row of rows) {
        const ck = columnKey(yg.year, mKey);
        const v = row.cells[ck] ?? 0;
        if (v > bestVal) {
          bestVal = v;
          bestKey = ck;
        }
      }
    }
    if (bestKey && bestVal > 0) highlights[bestKey] = "best_rate";
  }

  const first = years[0]!;
  const last = years[years.length - 1]!;
  const firstPart = partByYear.get(first) ?? 0;
  const lastPart = partByYear.get(last) ?? 0;
  if (firstPart > 0) {
    const delta = ((lastPart - firstPart) / firstPart) * 100;
    if (delta >= 15) {
      for (const m of model.yearGroups.find((g) => g.year === last)?.metrics ?? []) {
        if (m.key === "participation") highlights[columnKey(last, m.key)] = "growth";
      }
    } else if (delta <= -15) {
      for (const m of model.yearGroups.find((g) => g.year === last)?.metrics ?? []) {
        if (m.key === "participation") highlights[columnKey(last, m.key)] = "warning";
      }
    }
  }

  return highlights;
};

export const yearColumnBadge = (
  year: number,
  highlights: CellHighlightMap,
  model: HistoricalComparisonTableModel,
  isAr: boolean
): string | null => {
  const hasPeak = model.yearGroups
    .find((g) => g.year === year)
    ?.metrics.some((m) => highlights[columnKey(year, m.key)] === "peak_year");
  if (hasPeak) return isAr ? "ذروة" : "Peak";
  const hasWarn = model.yearGroups
    .find((g) => g.year === year)
    ?.metrics.some((m) => highlights[columnKey(year, m.key)] === "warning");
  if (hasWarn) return isAr ? "تراجع" : "Decline";
  return null;
};
