/**
 * Safe comparison matrix model — validated dimensions & measures.
 */

import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import { ALL_HISTORICAL_ACTIVITY_FAMILIES } from "@/lib/analytics/historical-activity-resolution";
import { ROW_CATEGORIES } from "@/lib/analytics/shared/historical-row-categories";
import { rowMatchesCategory } from "@/lib/analytics/shared/historical-row-matcher";
import type { MatrixTableModel } from "@/lib/analytics/shared/historical-matrix-types";
import { extractMetric } from "@/lib/analytics/shared/historical-metric-extract";
import { matchActivityEvolution } from "@/lib/analytics/historical-compatibility-registry";
import { readHistoricalCache, writeHistoricalCache, stableAnalyticsHash } from "@/lib/analytics/analytics-historical-cache-v2";
import { buildNormalizedComparisonMatrix } from "@/lib/analytics/ai/executive-intelligence/comparison-matrix-normalizer";

export type MatrixDebugMeta = {
  yearsCount: number;
  dimensionsCount: number;
  measuresCount: number;
  normalizedRows: number;
  sourceYear: number;
  valid: boolean;
  recoveryMode: boolean;
  recoveryReasonAr: string;
  recoveryReasonEn: string;
};

export type SafeMatrixResult = {
  model: MatrixTableModel | null;
  meta: MatrixDebugMeta;
};

const ACTIVITY_FAMILIES = ALL_HISTORICAL_ACTIVITY_FAMILIES;

const pickBestSlice = (slices: HistoricalYearSlice[]): HistoricalYearSlice | null => {
  if (slices.length === 0) return null;
  const sorted = [...slices].sort((a, b) => a.year - b.year);
  let best = sorted[sorted.length - 1]!;
  let bestScore = best.payload.table.length;
  for (const s of sorted) {
    const score = s.payload.table.reduce((sum, r) => sum + r.totalParticipations, 0);
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
};

export const normalizeMatrixDimensions = (
  rowLabels: MatrixTableModel["rowLabels"],
  columnLabels: MatrixTableModel["columnLabels"]
): { rowLabels: MatrixTableModel["rowLabels"]; columnLabels: MatrixTableModel["columnLabels"] } => {
  const rows = rowLabels.filter((r) => r?.key && r.labelAr && r.labelEn);
  const cols = columnLabels.filter((c) => c?.key && c.labelAr && c.labelEn);
  return { rowLabels: rows, columnLabels: cols };
};

export const validateMatrixMeasures = (
  model: MatrixTableModel
): { valid: boolean; normalizedRows: number } => {
  let normalizedRows = 0;
  for (const row of model.rowLabels) {
    let rowSum = 0;
    for (const col of model.columnLabels) {
      const raw = model.cells[row.key]?.[col.key];
      const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
      if (model.cells[row.key]) model.cells[row.key]![col.key] = n;
      rowSum += n;
    }
    if (rowSum > 0) normalizedRows += 1;
  }
  return {
    valid:
      model.rowLabels.length > 0 &&
      model.columnLabels.length > 0 &&
      normalizedRows > 0,
    normalizedRows,
  };
};

const familyMatchesRow = (
  fam: (typeof ACTIVITY_FAMILIES)[number],
  row: HistoricalYearSlice["payload"]["table"][number],
  relaxed: boolean
): boolean =>
  fam.match(row) ||
  (relaxed && matchActivityEvolution(row.activityLabelAr, row.activityLabelEn, fam.key));

const buildRawMatrix = (
  slices: HistoricalYearSlice[],
  relaxed = false
): MatrixTableModel | null => {
  const primary = pickBestSlice(slices);
  if (!primary) return null;

  const aggregated = new Map<string, Map<string, number>>();

  for (const slice of slices) {
    const colFamilies = ACTIVITY_FAMILIES.filter((f) => f.tableType !== "matrix");
    for (const cat of ROW_CATEGORIES) {
      if (!aggregated.has(cat.key)) aggregated.set(cat.key, new Map());
      const rowMap = aggregated.get(cat.key)!;
      for (const fam of colFamilies) {
        const rows = slice.payload.table
          .filter((r) => familyMatchesRow(fam, r, relaxed))
          .filter((r) => rowMatchesCategory(r, cat));
        const val = extractMetric(rows, "participation");
        rowMap.set(fam.key, (rowMap.get(fam.key) ?? 0) + val);
      }
    }
  }

  const colFamilies = ACTIVITY_FAMILIES.filter((f) => f.tableType !== "matrix").filter((fam) =>
    slices.some((s) =>
      s.payload.table.some((r) => familyMatchesRow(fam, r, relaxed))
    )
  );

  const cells: Record<string, Record<string, number>> = {};
  for (const cat of ROW_CATEGORIES) {
    cells[cat.key] = {};
    for (const fam of colFamilies) {
      const v = aggregated.get(cat.key)?.get(fam.key) ?? 0;
      cells[cat.key]![fam.key] = typeof v === "number" && Number.isFinite(v) ? v : 0;
    }
  }

  return {
    id: `matrix-${slices.map((s) => s.year).join("-")}`,
    rowLabels: ROW_CATEGORIES.map((c) => ({
      key: c.key,
      labelAr: c.labelAr,
      labelEn: c.labelEn,
    })),
    columnLabels: colFamilies.map((f) => ({
      key: f.key,
      labelAr: f.labelAr,
      labelEn: f.labelEn,
    })),
    cells,
  };
};

const finalizeMatrix = (
  slices: HistoricalYearSlice[],
  raw: MatrixTableModel | null,
  recoveryMode: boolean,
  recoveryReasonAr: string,
  recoveryReasonEn: string
): SafeMatrixResult => {
  const emptyMeta: MatrixDebugMeta = {
    yearsCount: slices.length,
    dimensionsCount: 0,
    measuresCount: 0,
    normalizedRows: 0,
    sourceYear: 0,
    valid: false,
    recoveryMode,
    recoveryReasonAr,
    recoveryReasonEn,
  };

  if (!raw) return { model: null, meta: emptyMeta };

  const { rowLabels, columnLabels } = normalizeMatrixDimensions(raw.rowLabels, raw.columnLabels);
  const model: MatrixTableModel = { ...raw, rowLabels, columnLabels };
  const { valid, normalizedRows } = validateMatrixMeasures(model);

  const filteredRows = rowLabels.filter((row) => {
    const sum = columnLabels.reduce((s, col) => s + (model.cells[row.key]?.[col.key] ?? 0), 0);
    return sum > 0;
  });

  const finalModel: MatrixTableModel | null = valid
    ? {
        ...model,
        rowLabels: filteredRows.length > 0 ? filteredRows : rowLabels,
      }
    : null;

  const best = pickBestSlice(slices);
  const meta: MatrixDebugMeta = {
    yearsCount: slices.length,
    dimensionsCount: rowLabels.length,
    measuresCount: columnLabels.length,
    normalizedRows,
    sourceYear: best?.year ?? 0,
    valid: valid && filteredRows.length > 0,
    recoveryMode,
    recoveryReasonAr,
    recoveryReasonEn,
  };

  return { model: finalModel, meta };
};

/** Strict matrix first; relaxed historical matching on empty strict result. */
export const buildMatrixWithRecovery = (slices: HistoricalYearSlice[]): SafeMatrixResult => {
  if (ROW_CATEGORIES.length === 0) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info("[MATRIX_INIT_ERROR]", {
        source: "historical-matrix-model",
        note: "ROW_CATEGORIES is empty — check import chain",
      });
    }
    return {
      model: null,
      meta: {
        yearsCount: slices.length,
        dimensionsCount: 0,
        measuresCount: 0,
        normalizedRows: 0,
        sourceYear: 0,
        valid: false,
        recoveryMode: false,
        recoveryReasonAr: "",
        recoveryReasonEn: "",
      },
    };
  }

  const cacheKey = stableAnalyticsHash({
    y: slices.map((s) => s.year).join(","),
    t: slices.reduce((s, x) => s + x.payload.table.length, 0),
    recovery: "2",
  });
  const cached = readHistoricalCache<SafeMatrixResult>("matrix", `recovery|${cacheKey}`);
  if (cached) return cached;

  const normalizedStrict = finalizeMatrix(
    slices,
    buildNormalizedComparisonMatrix(slices, false),
    false,
    "",
    ""
  );
  if (normalizedStrict.model && normalizedStrict.meta.valid) {
    writeHistoricalCache("matrix", `recovery|${cacheKey}`, normalizedStrict);
    return normalizedStrict;
  }

  const normalizedRelaxed = finalizeMatrix(
    slices,
    buildNormalizedComparisonMatrix(slices, true),
    true,
    "تم توسيع نطاق التحليل تاريخيًا لعرض بيانات متوافقة.",
    "Historical scope was expanded to show compatible data."
  );
  if (normalizedRelaxed.model && normalizedRelaxed.meta.valid) {
    writeHistoricalCache("matrix", `recovery|${cacheKey}`, normalizedRelaxed);
    return normalizedRelaxed;
  }

  const strict = finalizeMatrix(slices, buildRawMatrix(slices, false), false, "", "");
  if (strict.model && strict.meta.valid) {
    writeHistoricalCache("matrix", `recovery|${cacheKey}`, strict);
    return strict;
  }

  const relaxed = finalizeMatrix(
    slices,
    buildRawMatrix(slices, true),
    true,
    "تم توسيع نطاق التحليل تاريخيًا لعرض بيانات متوافقة.",
    "Historical scope was expanded to show compatible data."
  );

  if (process.env.NODE_ENV !== "production" && relaxed.meta.valid) {
    // eslint-disable-next-line no-console
    console.info("[historical-fallback] matrix recovery", relaxed.meta);
  }

  writeHistoricalCache("matrix", `recovery|${cacheKey}`, relaxed);
  return relaxed;
};

export const buildSafeMatrixModel = (slices: HistoricalYearSlice[]): SafeMatrixResult => {
  const emptyMeta: MatrixDebugMeta = {
    yearsCount: slices.length,
    dimensionsCount: 0,
    measuresCount: 0,
    normalizedRows: 0,
    sourceYear: 0,
    valid: false,
    recoveryMode: false,
    recoveryReasonAr: "",
    recoveryReasonEn: "",
  };

  if (slices.length === 0) {
    return { model: null, meta: emptyMeta };
  }

  const cacheKey = stableAnalyticsHash({
    y: slices.map((s) => s.year).join(","),
    t: slices.reduce((s, x) => s + x.payload.table.length, 0),
  });
  const cached = readHistoricalCache<SafeMatrixResult>("matrix", cacheKey);
  if (cached) return cached;

  const result = buildMatrixWithRecovery(slices);
  writeHistoricalCache("matrix", cacheKey, result);
  return result;
};
