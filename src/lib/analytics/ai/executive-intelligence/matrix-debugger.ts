/**
 * Matrix aggregation debug — enable with NEXT_PUBLIC_MATRIX_DEBUG=1
 */
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";

export const isMatrixDebugEnabled = (): boolean =>
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_MATRIX_DEBUG === "1";

export type MatrixDebugSnapshot = {
  selectedYears: number[];
  sliceCount: number;
  sourceRecordCount: number;
  normalizedActivities: string[];
  activityKeys: string[];
  rowKeys: string[];
  matrixRowsLength: number;
  matrixColumnsLength: number;
  filtersSummary: string;
};

export const logMatrixDebug = (
  label: string,
  payload: MatrixDebugSnapshot & Record<string, unknown>
): void => {
  if (!isMatrixDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.info(`[matrix-debug] ${label}`, payload);
};

export const summarizeFilters = (f: ExecutiveFilterSnapshot): string =>
  [
    `years:${(f.activityYears ?? []).join(",")}`,
    `gender:${f.gender}`,
    `stage:${f.stage}`,
    `names:${(f.achievementNames ?? []).length}`,
  ].join("|");

export const countSourceRecords = (slices: HistoricalYearSlice[]): number =>
  slices.reduce((s, sl) => s + sl.payload.table.length, 0);
