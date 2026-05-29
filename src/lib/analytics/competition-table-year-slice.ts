/**
 * Slice a CompetitionTableModel to a subset of years (for year-block paging).
 */
import type {
  CompetitionTableModel,
  CompetitionTableRow,
  CompetitionYearColumnGroup,
} from "@/lib/analytics/competition-table-engine";
import {
  buildCompetitionTableFromRecords,
  competitionTableColumnKey,
} from "@/lib/analytics/competition-table-engine";
import { competitionConfigByKey } from "@/lib/competitions/competition-configs";
import type { CompetitionAggregateRecord } from "@/lib/analytics/competition-table-engine";

export const sliceCompetitionTableToYears = (
  model: CompetitionTableModel,
  years: number[]
): CompetitionTableModel => {
  const yearSet = new Set(years);
  if (years.length === 0 || years.length === model.years.length) return model;

  const yearGroups = model.yearGroups.filter((yg) => yearSet.has(yg.year));
  const sliceCells = (cells: Record<string, number>): Record<string, number> => {
    const next: Record<string, number> = {};
    for (const yg of yearGroups) {
      for (const col of yg.columns) {
        const ck = competitionTableColumnKey(yg.year, col.key);
        next[ck] = cells[ck] ?? 0;
      }
    }
    return next;
  };

  const rows: CompetitionTableRow[] = model.rows.map((r) => ({
    ...r,
    cells: sliceCells(r.cells),
  }));

  const config = competitionConfigByKey(model.competition);
  if (!config) {
    return { ...model, years: [...years].sort(), yearGroups, rows };
  }

  // Rebuild metrics from sliced rows for consistency
  const records: CompetitionAggregateRecord[] = [];
  for (const row of rows.filter((r) => !r.isTotal)) {
    for (const yg of yearGroups) {
      for (const col of yg.columns) {
        if (col.key === "total") continue;
        const ck = competitionTableColumnKey(yg.year, col.key);
        const count = row.cells[ck] ?? 0;
        if (count > 0) {
          records.push({
            competitionKey: model.competition,
            year: yg.year,
            rowKey: row.key,
            columnKey: col.key,
            count,
          });
        }
      }
    }
  }

  return buildCompetitionTableFromRecords({
    config,
    years: [...years].sort(),
    records,
  });
};
