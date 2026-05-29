/**
 * Unified totals contract for educational comparison tables.
 */

import { normalizeDecimal } from "@/lib/analytics/analytics-number-formatting";

export type TableCellValue = number | null | undefined;

export type TotalValidationIssue = {
  code: "row_mismatch" | "column_mismatch" | "grand_mismatch";
  rowKey?: string;
  columnKey?: string;
  expected: number;
  actual: number;
};

export type TableTotalsBundle = {
  rowTotals: Record<string, number>;
  columnTotals: Record<string, number>;
  grandTotal: number;
  valid: boolean;
  issues: TotalValidationIssue[];
};

const sumValues = (values: TableCellValue[]): number =>
  values.reduce<number>((s, v) => s + (typeof v === "number" && Number.isFinite(v) ? v : 0), 0);

/** Build row/column/grand totals from a flat cell matrix */
export const buildTableTotals = (
  rows: Array<{ key: string; cells: Record<string, TableCellValue> }>
): TableTotalsBundle => {
  const rowTotals: Record<string, number> = {};
  const columnTotals: Record<string, number> = {};
  const columnKeys = new Set<string>();

  for (const row of rows) {
    let rowSum = 0;
    for (const [col, val] of Object.entries(row.cells)) {
      columnKeys.add(col);
      const n = typeof val === "number" && Number.isFinite(val) ? val : 0;
      rowSum += n;
      columnTotals[col] = normalizeDecimal((columnTotals[col] ?? 0) + n, 2);
    }
    rowTotals[row.key] = normalizeDecimal(rowSum, 2);
  }

  const grandFromRows = normalizeDecimal(sumValues(Object.values(rowTotals)), 2);
  const grandFromCols = normalizeDecimal(sumValues(Object.values(columnTotals)), 2);
  const issues: TotalValidationIssue[] = [];

  if (Math.abs(grandFromRows - grandFromCols) > 0.01) {
    issues.push({
      code: "grand_mismatch",
      expected: grandFromCols,
      actual: grandFromRows,
    });
  }

  for (const row of rows) {
    const expected = rowTotals[row.key] ?? 0;
    const actual = sumValues(Object.values(row.cells));
    if (Math.abs(expected - actual) > 0.01) {
      issues.push({
        code: "row_mismatch",
        rowKey: row.key,
        expected,
        actual,
      });
    }
  }

  for (const col of columnKeys) {
    const expected = columnTotals[col] ?? 0;
    const actual = sumValues(rows.map((r) => r.cells[col]));
    if (Math.abs(expected - actual) > 0.01) {
      issues.push({
        code: "column_mismatch",
        columnKey: col,
        expected,
        actual,
      });
    }
  }

  return {
    rowTotals,
    columnTotals,
    grandTotal: grandFromRows,
    valid: issues.length === 0,
    issues,
  };
};

/** Apply computed totals row to matrix (mutates copy) */
export const appendTotalsRow = (
  rows: Array<{ key: string; labelAr: string; labelEn: string; cells: Record<string, number> }>,
  totalLabelAr: string,
  totalLabelEn: string
): Array<{ key: string; labelAr: string; labelEn: string; cells: Record<string, number>; isTotal?: boolean }> => {
  const totals = buildTableTotals(rows);
  const totalCells: Record<string, number> = {};
  for (const [col, v] of Object.entries(totals.columnTotals)) {
    totalCells[col] = v;
  }
  return [
    ...rows,
    {
      key: "__total__",
      labelAr: totalLabelAr,
      labelEn: totalLabelEn,
      cells: totalCells,
      isTotal: true,
    },
  ];
};
