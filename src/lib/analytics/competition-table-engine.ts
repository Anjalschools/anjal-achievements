/**
 * Dynamic competition analytics table engine — metadata-driven, deterministic aggregation.
 */

import type { CompetitionConfig } from "@/lib/competitions/competition-configs";
import { competitionConfigByKey } from "@/lib/competitions/competition-configs";
import type { CompetitionStageRowKey } from "@/lib/competitions/table-presets";
import { EXCEL_STAGE_ROWS, type CompetitionColumnDef } from "@/lib/competitions/table-presets";
import { normalizeAcademicYearLabel } from "@/lib/analytics/competition-year-normalizer";

export type CompetitionAggregateRecord = {
  competitionKey: string;
  year: number;
  rowKey: CompetitionStageRowKey;
  columnKey: string;
  count: number;
};

export type CompetitionYearColumnGroup = {
  year: number;
  labelAr: string;
  labelEn: string;
  columns: CompetitionColumnDef[];
};

export type CompetitionTableRow = {
  key: CompetitionStageRowKey;
  labelAr: string;
  labelEn: string;
  cells: Record<string, number>;
  isTotal?: boolean;
};

export type CompetitionTableMetrics = {
  growthRatePct: number | null;
  medalDensityPct: number | null;
  qualityScore: number;
  bestYear: number | null;
  worstYear: number | null;
};

export type CompetitionTableModel = {
  competition: string;
  competitionTitleAr: string;
  competitionTitleEn: string;
  tableType: CompetitionConfig["type"];
  years: number[];
  yearGroups: CompetitionYearColumnGroup[];
  rows: CompetitionTableRow[];
  metrics: CompetitionTableMetrics;
  generatedAt: string;
  hasData: boolean;
};

const columnKey = (year: number, metricKey: string): string => `${year}__${metricKey}`;

const emptyCells = (yearGroups: CompetitionYearColumnGroup[]): Record<string, number> => {
  const cells: Record<string, number> = {};
  for (const yg of yearGroups) {
    for (const col of yg.columns) {
      cells[columnKey(yg.year, col.key)] = 0;
    }
  }
  return cells;
};

const sumRowHorizontal = (
  cells: Record<string, number>,
  year: number,
  columns: CompetitionColumnDef[]
): void => {
  const totalCol = columns.find((c) => c.key === "total");
  if (!totalCol) return;
  const sum = columns
    .filter((c) => c.includeInRowTotal && c.key !== "total")
    .reduce((s, c) => s + (cells[columnKey(year, c.key)] ?? 0), 0);
  cells[columnKey(year, "total")] = sum;
};

const buildYearGroups = (
  config: CompetitionConfig,
  years: number[]
): CompetitionYearColumnGroup[] =>
  years.map((startYear) => {
    const labels = normalizeAcademicYearLabel(startYear, {
      titleAr: config.titleAr,
      titleEn: config.titleEn,
    });
    return {
      year: startYear,
      labelAr: labels.labelAr,
      labelEn: labels.labelEn,
      columns: config.resolveColumns(startYear),
    };
  });

export const buildCompetitionTableFromRecords = (input: {
  config: CompetitionConfig;
  years: number[];
  records: CompetitionAggregateRecord[];
}): CompetitionTableModel => {
  const { config, years } = input;
  const sortedYears = [...new Set(years)].sort((a, b) => a - b);
  const yearGroups = buildYearGroups(config, sortedYears);
  const dataRows = EXCEL_STAGE_ROWS.filter((r) => !r.isTotal).map((def) => ({
    key: def.key,
    labelAr: def.labelAr,
    labelEn: def.labelEn,
    cells: emptyCells(yearGroups),
    isTotal: false,
  }));

  for (const rec of input.records) {
    if (rec.competitionKey !== config.key) continue;
    const row = dataRows.find((r) => r.key === rec.rowKey);
    if (!row) continue;
    const ck = columnKey(rec.year, rec.columnKey);
    row.cells[ck] = (row.cells[ck] ?? 0) + rec.count;
  }

  for (const row of dataRows) {
    for (const yg of yearGroups) {
      sumRowHorizontal(row.cells, yg.year, yg.columns);
    }
  }

  const totalRow: CompetitionTableRow = {
    key: "total",
    labelAr: "المجموع",
    labelEn: "Total",
    isTotal: true,
    cells: emptyCells(yearGroups),
  };

  for (const yg of yearGroups) {
    for (const col of yg.columns) {
      const ck = columnKey(yg.year, col.key);
      totalRow.cells[ck] = dataRows.reduce((s, r) => s + (r.cells[ck] ?? 0), 0);
    }
  }

  const rows = [...dataRows, totalRow];
  const metrics = computeCompetitionTableMetrics(rows, yearGroups, config);
  const hasData = input.records.some((r) => r.count > 0);

  return {
    competition: config.key,
    competitionTitleAr: config.titleAr,
    competitionTitleEn: config.titleEn,
    tableType: config.type,
    years: sortedYears,
    yearGroups,
    rows,
    metrics,
    generatedAt: new Date().toISOString(),
    hasData,
  };
};

export const computeCompetitionTableMetrics = (
  rows: CompetitionTableRow[],
  yearGroups: CompetitionYearColumnGroup[],
  config: CompetitionConfig
): CompetitionTableMetrics => {
  const totalRow = rows.find((r) => r.isTotal);
  if (!totalRow || yearGroups.length === 0) {
    return {
      growthRatePct: null,
      medalDensityPct: null,
      qualityScore: 0,
      bestYear: null,
      worstYear: null,
    };
  }

  const yearTotals = yearGroups.map((yg) => {
    const participants = totalRow.cells[columnKey(yg.year, "participants")] ?? 0;
    const medals =
      config.type === "medals"
        ? (totalRow.cells[columnKey(yg.year, "gold")] ?? 0) +
          (totalRow.cells[columnKey(yg.year, "silver")] ?? 0) +
          (totalRow.cells[columnKey(yg.year, "bronze")] ?? 0)
        : (totalRow.cells[columnKey(yg.year, "total")] ?? 0);
    return { year: yg.year, participants, medals };
  });

  const first = yearTotals[0];
  const last = yearTotals[yearTotals.length - 1];
  const growthRatePct =
    first && last && first.participants > 0
      ? Math.round(((last.participants - first.participants) / first.participants) * 100)
      : null;

  const lastParticipants = last?.participants ?? 0;
  const lastMedals = last?.medals ?? 0;
  const medalDensityPct =
    lastParticipants > 0 ? Math.round((lastMedals / lastParticipants) * 100) : null;

  const best = [...yearTotals].sort((a, b) => b.participants - a.participants)[0];
  const worst = [...yearTotals].sort((a, b) => a.participants - b.participants)[0];

  const qualityScore = Math.min(
    100,
    Math.round((medalDensityPct ?? 0) * 0.6 + Math.max(0, growthRatePct ?? 0) * 0.4)
  );

  return {
    growthRatePct,
    medalDensityPct,
    qualityScore,
    bestYear: best?.year ?? null,
    worstYear: worst?.year ?? null,
  };
};

export const buildCompetitionTable = (input: {
  competitionKey: string;
  years: number[];
  records: CompetitionAggregateRecord[];
}): CompetitionTableModel | null => {
  const config = competitionConfigByKey(input.competitionKey);
  if (!config) return null;
  return buildCompetitionTableFromRecords({
    config,
    years: input.years,
    records: input.records,
  });
};

export const aggregateCompetitionResults = (input: {
  competition: string;
  years: number[];
  records: CompetitionAggregateRecord[];
}): CompetitionTableModel | null =>
  buildCompetitionTable({
    competitionKey: input.competition,
    years: input.years,
    records: input.records,
  });

export { columnKey as competitionTableColumnKey };
