/**
 * Normalized comparison matrix — taxonomy-based activity columns, resilient row bucketing.
 */
import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import { MATRIX_ROW_KEYS, ROW_CATEGORIES } from "@/lib/analytics/shared/historical-row-categories";
import { rowMatchesCategory } from "@/lib/analytics/shared/historical-row-matcher";
import type { MatrixTableModel } from "@/lib/analytics/shared/historical-matrix-types";
import {
  HISTORICAL_ACTIVITY_TAXONOMY,
  normalizeActivitySlug,
  taxonomyById,
} from "@/lib/analytics/historical-activity-taxonomy";
import { resolveActivityForRow } from "@/lib/analytics/historical-activity-resolution";
import { isMatrixDebugEnabled, logMatrixDebug } from "./matrix-debugger";

const participationValue = (row: ParticipationActivityRow): number =>
  Math.max(0, row.totalParticipations ?? row.approvedAchievements ?? 0);

/** Single resolver for matrix columns — taxonomy first, then stable raw slug. */
const resolveMatrixActivityColumn = (
  row: ParticipationActivityRow
): { actKey: string; labelAr: string; labelEn: string } | null => {
  const resolved = resolveActivityForRow(row);
  if (resolved) {
    const taxon = taxonomyById(resolved.id);
    return {
      actKey: resolved.id,
      labelAr: taxon?.labelAr ?? row.activityLabelAr,
      labelEn: taxon?.labelEn ?? row.activityLabelEn,
    };
  }
  const slug = normalizeActivitySlug(
    `${row.activityKey ?? ""} ${row.activityLabelEn ?? ""} ${row.activityLabelAr ?? ""}`
  );
  if (!slug) return null;
  return {
    actKey: `raw_${slug}`,
    labelAr: row.activityLabelAr || row.activityLabelEn || slug,
    labelEn: row.activityLabelEn || row.activityLabelAr || slug,
  };
};

export const buildNormalizedComparisonMatrix = (
  slices: HistoricalYearSlice[],
  relaxed = false
): MatrixTableModel | null => {
  if (slices.length === 0) return null;

  if (ROW_CATEGORIES.length === 0) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info("[MATRIX_INIT_ERROR]", {
        source: "comparison-matrix-normalizer",
        note: "ROW_CATEGORIES is empty — check import chain",
      });
    }
    return null;
  }

  const columnMeta = new Map<string, { labelAr: string; labelEn: string }>();
  const aggregated = new Map<string, Map<string, number>>();

  for (const cat of MATRIX_ROW_KEYS) {
    aggregated.set(cat.key, new Map());
  }
  aggregated.set("activity_total", new Map());

  let sourceRecords = 0;

  for (const slice of slices) {
    for (const row of slice.payload.table) {
      sourceRecords += 1;
      const column = resolveMatrixActivityColumn(row);
      if (!column) continue;

      const { actKey, labelAr, labelEn } = column;
      columnMeta.set(actKey, { labelAr, labelEn });

      const val = participationValue(row);
      if (val <= 0 && !relaxed) continue;

      let categoryHit = false;
      for (const cat of MATRIX_ROW_KEYS) {
        if (!rowMatchesCategory(row, cat)) continue;
        categoryHit = true;
        const rowMap = aggregated.get(cat.key)!;
        rowMap.set(actKey, (rowMap.get(actKey) ?? 0) + val);
      }

      if (!categoryHit || relaxed) {
        const totalMap = aggregated.get("activity_total")!;
        totalMap.set(actKey, (totalMap.get(actKey) ?? 0) + val);
      }
    }
  }

  const columnKeys = [...columnMeta.keys()];
  if (columnKeys.length === 0) {
    if (isMatrixDebugEnabled()) {
      logMatrixDebug("empty-columns", {
        selectedYears: slices.map((s) => s.year),
        sliceCount: slices.length,
        sourceRecordCount: sourceRecords,
        normalizedActivities: [],
        activityKeys: [],
        rowKeys: [],
        matrixRowsLength: 0,
        matrixColumnsLength: 0,
        filtersSummary: "",
      });
    }
    return null;
  }

  const cells: Record<string, Record<string, number>> = {};
  const rowLabels: MatrixTableModel["rowLabels"] = [];

  const dataRowCats = MATRIX_ROW_KEYS.filter((cat) => {
    const sum = columnKeys.reduce(
      (s, col) => s + (aggregated.get(cat.key)?.get(col) ?? 0),
      0
    );
    return sum > 0;
  });

  const rowsToRender =
    dataRowCats.length > 0
      ? dataRowCats
      : [
          {
            key: "activity_total",
            labelAr: "إجمالي النشاط",
            labelEn: "Activity total",
            stage: "all" as const,
            section: "all" as const,
          },
        ];

  for (const cat of rowsToRender) {
    cells[cat.key] = {};
    for (const col of columnKeys) {
      cells[cat.key]![col] =
        aggregated.get(cat.key)?.get(col) ??
        aggregated.get("activity_total")?.get(col) ??
        0;
    }
    rowLabels.push({
      key: cat.key,
      labelAr: cat.labelAr,
      labelEn: cat.labelEn,
    });
  }

  const totalKey = "__matrix_total__";
  cells[totalKey] = {};
  for (const col of columnKeys) {
    cells[totalKey][col] = rowLabels.reduce(
      (s, r) => s + (cells[r.key]?.[col] ?? 0),
      0
    );
  }
  rowLabels.push({ key: totalKey, labelAr: "المجموع", labelEn: "Total" });

  const model: MatrixTableModel = {
    id: `matrix-norm-${slices.map((s) => s.year).join("-")}`,
    rowLabels,
    columnLabels: columnKeys.map((k) => ({
      key: k,
      labelAr: columnMeta.get(k)!.labelAr,
      labelEn: columnMeta.get(k)!.labelEn,
    })),
    cells,
  };

  if (isMatrixDebugEnabled()) {
    logMatrixDebug("built", {
      selectedYears: slices.map((s) => s.year),
      sliceCount: slices.length,
      sourceRecordCount: sourceRecords,
      normalizedActivities: HISTORICAL_ACTIVITY_TAXONOMY.map((t) => t.id),
      activityKeys: columnKeys,
      rowKeys: rowLabels.map((r) => r.key),
      matrixRowsLength: rowLabels.length,
      matrixColumnsLength: columnKeys.length,
      filtersSummary: "",
      relaxed,
    });
  }

  return model;
};
