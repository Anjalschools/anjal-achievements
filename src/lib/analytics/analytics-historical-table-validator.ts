/**
 * Historical comparison table contract validation — safe fallbacks instead of render crashes.
 */

import { columnKey } from "@/lib/analytics/historical-comparison-table-engine";
import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";
import {
  buildStableHistoricalColumnLayout,
  getHistoricalMetricMeta,
} from "@/lib/analytics/analytics-table-value-normalizer";
import { normalizeDecimal } from "@/lib/analytics/analytics-number-formatting";

export type HistoricalValidationIssueCode =
  | "row_mismatch"
  | "column_mismatch"
  | "grand_mismatch"
  | "duplicate_year"
  | "metric_count_mismatch"
  | "header_span_mismatch"
  | "orphan_cell"
  | "invalid_drill_value"
  | "missing_measure"
  | "no_data_rows";

export type HistoricalValidationIssue = {
  code: HistoricalValidationIssueCode;
  message: string;
  rowKey?: string;
  columnKey?: string;
  year?: number;
  expected?: number;
  actual?: number;
};

export type HistoricalTableValidationResult = {
  valid: boolean;
  canRender: boolean;
  issues: HistoricalValidationIssue[];
  validYearCount: number;
  layoutColumnCount: number;
};

const sumColumn = (
  rows: HistoricalComparisonTableModel["rows"],
  colKey: string,
  skipTotal: boolean
): number => {
  let sum = 0;
  for (const row of rows) {
    if (skipTotal && row.isTotal) continue;
    const meta = getHistoricalMetricMeta(colKey.split("__")[1] ?? "");
    if (!meta.aggregatable) continue;
    const v = row.cells[colKey];
    if (typeof v === "number" && Number.isFinite(v)) sum += v;
  }
  return normalizeDecimal(sum, 2);
};

export const validateHistoricalTableModel = (
  model: HistoricalComparisonTableModel | null | undefined
): HistoricalTableValidationResult => {
  const issues: HistoricalValidationIssue[] = [];

  if (!model) {
    return {
      valid: false,
      canRender: false,
      issues: [{ code: "no_data_rows", message: "Model is null" }],
      validYearCount: 0,
      layoutColumnCount: 0,
    };
  }

  if (!model.rows.length) {
    issues.push({ code: "no_data_rows", message: "No rows to render" });
  }

  const layout = buildStableHistoricalColumnLayout(model);
  const years = model.yearGroups.map((g) => g.year);
  const dupYears = years.filter((y, i) => years.indexOf(y) !== i);
  if (dupYears.length > 0) {
    issues.push({
      code: "duplicate_year",
      message: `Duplicate years: ${[...new Set(dupYears)].join(", ")}`,
    });
  }

  const metricCounts = model.yearGroups.map((g) => g.metrics.length);
  const expectedCount = metricCounts[0] ?? 0;
  if (metricCounts.some((c) => c !== expectedCount)) {
    issues.push({
      code: "metric_count_mismatch",
      message: "Year groups have inconsistent metric counts",
    });
  }

  const spanSum = model.yearGroups.reduce((s, g) => s + g.metrics.length, 0);
  if (spanSum !== layout.columns.length) {
    issues.push({
      code: "header_span_mismatch",
      message: "Grouped header colSpan does not match metric columns",
      expected: layout.columns.length,
      actual: spanSum,
    });
  }

  const knownKeys = new Set(layout.columns.map((c) => c.columnKey));
  for (const row of model.rows) {
    for (const key of Object.keys(row.cells)) {
      if (!knownKeys.has(key)) {
        issues.push({
          code: "orphan_cell",
          message: `Orphan cell key ${key}`,
          rowKey: row.key,
          columnKey: key,
        });
      }
      const metricKey = key.split("__")[1] ?? "";
      const v = row.cells[key];
      if (v != null && typeof v !== "number") {
        issues.push({
          code: "invalid_drill_value",
          message: `Non-numeric cell at ${key}`,
          rowKey: row.key,
          columnKey: key,
        });
      }
      if (typeof v === "number" && !Number.isFinite(v)) {
        issues.push({
          code: "invalid_drill_value",
          message: `Invalid numeric cell at ${key}`,
          rowKey: row.key,
          columnKey: key,
        });
      }
      if (!getHistoricalMetricMeta(metricKey).key && metricKey) {
        issues.push({
          code: "missing_measure",
          message: `Unknown metric ${metricKey}`,
          columnKey: key,
        });
      }
    }
  }

  const dataRows = model.rows.filter((r) => !r.isTotal);
  const totalRow = model.rows.find((r) => r.isTotal || r.key === "__total__");

  for (const col of layout.columns) {
    const meta = getHistoricalMetricMeta(col.metricKey);
    if (!meta.aggregatable) continue;

    const expected = sumColumn(dataRows, col.columnKey, true);
    const actual = totalRow?.cells[col.columnKey];
    if (totalRow && typeof actual === "number" && Math.abs(expected - actual) > 0.01) {
      issues.push({
        code: "column_mismatch",
        message: `Total mismatch for ${col.columnKey}`,
        columnKey: col.columnKey,
        expected,
        actual,
      });
    }
  }

  if (!model.totals.valid) {
    for (const issue of model.totals.issues) {
      issues.push({
        code: issue.code as HistoricalValidationIssueCode,
        message: issue.code,
        rowKey: issue.rowKey,
        columnKey: issue.columnKey,
        expected: issue.expected,
        actual: issue.actual,
      });
    }
  }

  let validYearCount = 0;
  const yearsWithData = new Set<number>();
  for (const row of dataRows) {
    for (const col of layout.columns) {
      const v = row.cells[col.columnKey];
      if (typeof v === "number" && v > 0) yearsWithData.add(col.year);
    }
  }
  validYearCount = yearsWithData.size;

  const canRender = model.rows.length > 0 && layout.columns.length > 0;

  return {
    valid: issues.length === 0,
    canRender,
    issues,
    validYearCount,
    layoutColumnCount: layout.columns.length,
  };
};

export const buildSafeHistoricalModel = (
  model: HistoricalComparisonTableModel
): HistoricalComparisonTableModel => {
  const layout = buildStableHistoricalColumnLayout(model);
  const alignedRows = model.rows.map((row) => {
    const cells: Record<string, number> = {};
    for (const col of layout.columns) {
      const raw = row.cells[col.columnKey];
      const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
      cells[col.columnKey] = n;
    }
    return { ...row, cells };
  });

  return {
    ...model,
    yearGroups: layout.yearGroups,
    rows: alignedRows,
  };
};

export const isDrillPayloadValid = (payload: {
  year: number;
  metricKey: string;
  rowKey: string;
  value: number;
}): boolean =>
  Number.isFinite(payload.year) &&
  payload.year >= 2018 &&
  payload.year <= 2035 &&
  Boolean(payload.metricKey) &&
  Boolean(payload.rowKey) &&
  payload.rowKey !== "__total__" &&
  Number.isFinite(payload.value) &&
  payload.value > 0;
