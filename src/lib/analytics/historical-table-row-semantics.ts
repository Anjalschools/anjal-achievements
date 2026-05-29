/**
 * Historical table row hierarchy — activity, scope, stage, total (no duplicate labels).
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import type { HistoricalRowCategory } from "@/lib/analytics/shared/historical-row-categories";
import { rowMatchesCategory } from "@/lib/analytics/shared/historical-row-matcher";

export type HistoricalRowTier = "activity" | "scope" | "stage" | "total";

export type SemanticHistoricalRow = {
  key: string;
  labelAr: string;
  labelEn: string;
  tier: HistoricalRowTier;
  cells: Record<string, number>;
  isTotal?: boolean;
};

export const classifyRowTier = (rowKey: string): HistoricalRowTier => {
  if (rowKey === "__total__") return "total";
  if (rowKey === "activity_total") return "activity";
  if (rowKey.startsWith("scope_")) return "scope";
  return "stage";
};

/** Remove activity_total when it duplicates the only data row */
export const dedupeActivityTotalRow = (
  rows: Array<{ key: string; labelAr: string; labelEn: string; cells: Record<string, number> }>
): typeof rows => {
  const nonTotal = rows.filter((r) => r.key !== "__total__");
  const activityTotal = nonTotal.find((r) => r.key === "activity_total");
  const others = nonTotal.filter((r) => r.key !== "activity_total");

  if (!activityTotal) return rows;
  if (others.length === 0) return [activityTotal];

  const sameAsSum = others.every((row) => {
    const keys = Object.keys(activityTotal.cells);
    return keys.every((k) => (row.cells[k] ?? 0) <= (activityTotal.cells[k] ?? 0));
  });

  if (others.length >= 2 && sameAsSum) {
    return others;
  }
  return nonTotal;
};

export const orderHistoricalRows = (
  rows: Array<{
    key: string;
    labelAr: string;
    labelEn: string;
    cells: Record<string, number>;
    isTotal?: boolean;
  }>
): typeof rows => {
  const tierOrder: Record<HistoricalRowTier, number> = {
    activity: 0,
    scope: 1,
    stage: 2,
    total: 99,
  };
  return [...rows].sort((a, b) => {
    const ta = tierOrder[classifyRowTier(a.key)] ?? 50;
    const tb = tierOrder[classifyRowTier(b.key)] ?? 50;
    if (ta !== tb) return ta - tb;
    return a.labelAr.localeCompare(b.labelAr, "ar");
  });
};

export const buildCategoryRowsFromCells = (
  categories: HistoricalRowCategory[],
  buildCells: (cat: HistoricalRowCategory) => Record<string, number>
): Array<{ key: string; labelAr: string; labelEn: string; cells: Record<string, number> }> =>
  categories
    .filter((c) => c.key !== "activity_total")
    .map((cat) => ({
      key: cat.key,
      labelAr: cat.labelAr,
      labelEn: cat.labelEn,
      cells: buildCells(cat),
    }))
    .filter((r) => Object.values(r.cells).some((v) => v > 0));

export const rowMatcherForCategory = (
  cat: HistoricalRowCategory
): ((row: ParticipationActivityRow) => boolean) =>
  (row) => rowMatchesCategory(row, cat);

export const shouldShowActivityTotalRow = (
  categoryRowCount: number,
  scopeRowCount: number
): boolean => categoryRowCount === 0 || scopeRowCount === 0;
