/**
 * Competition executive PDF layout engine — column widths, orientation, year chunking, RTL grid.
 * Pure layout from CompetitionTableModel (no DOM / canvas).
 */

import type {
  CompetitionTableModel,
  CompetitionYearColumnGroup,
} from "@/lib/analytics/competition-table-engine";
import type { CompetitionColumnDef } from "@/lib/competitions/table-presets";

export type CompetitionPdfOrientation = "portrait" | "landscape";

import { competitionPdfPageFromLayout } from "@/lib/pdf/pdf-page-layout-engine";

export type CompetitionPdfPageMargins = {
  topMm: number;
  bottomMm: number;
  sideMm: number;
};

export type CompetitionPdfPageSpec = {
  widthMm: number;
  heightMm: number;
  margins: CompetitionPdfPageMargins;
  usableWidthMm: number;
  printableHeightMm: number;
};

/** Unified print margins — derived from getPdfPageLayout(). */
export const COMPETITION_PDF_PAGE: Record<CompetitionPdfOrientation, CompetitionPdfPageSpec> = {
  portrait: competitionPdfPageFromLayout("portrait"),
  landscape: competitionPdfPageFromLayout("landscape"),
};

export const COMPETITION_PDF_MARGINS: Record<CompetitionPdfOrientation, CompetitionPdfPageMargins> = {
  portrait: COMPETITION_PDF_PAGE.portrait.margins,
  landscape: COMPETITION_PDF_PAGE.landscape.margins,
};

/** Total metric columns (all years) above which landscape is preferred */
export const LANDSCAPE_METRIC_COLUMN_THRESHOLD = 10;

export const STAGE_COLUMN_WIDTH_MM = 34;
export const STAGE_COLUMN_MIN_MM = 30;
export const STAGE_COLUMN_MAX_MM = 40;

/** Minimum readable print widths — never shrink below these (chunk years instead) */
export const METRIC_NUMERIC_MIN_MM = 11;
export const METRIC_NUMERIC_MAX_MM = 14;
export const METRIC_PARTICIPANTS_MM = 13;
export const METRIC_TOTAL_MM = 15;

export type CompetitionPdfMetricColumn = {
  year: number;
  metricKey: string;
  labelAr: string;
  labelEn: string;
  widthMm: number;
  isTotalColumn: boolean;
};

export type CompetitionPdfYearGroupLayout = {
  year: number;
  labelAr: string;
  labelEn: string;
  columns: CompetitionPdfMetricColumn[];
  widthMm: number;
};

export type CompetitionPdfTableChunk = {
  chunkIndex: number;
  chunkTotal: number;
  orientation: CompetitionPdfOrientation;
  yearGroups: CompetitionYearColumnGroup[];
  stageWidthMm: number;
  yearGroupLayouts: CompetitionPdfYearGroupLayout[];
  tableWidthMm: number;
  fontSizePx: number;
  bodyFontSizePx: number;
};

export type CompetitionPdfLayoutPlan = {
  orientation: CompetitionPdfOrientation;
  chunks: CompetitionPdfTableChunk[];
  totalMetricColumns: number;
  totalYears: number;
};

const metricColumnWidthMm = (col: CompetitionColumnDef): number => {
  if (col.key === "total") return METRIC_TOTAL_MM;
  if (col.key === "participants") return METRIC_PARTICIPANTS_MM;
  return METRIC_NUMERIC_MIN_MM;
};

const yearGroupWidthMm = (yg: CompetitionYearColumnGroup): number =>
  yg.columns.reduce((sum, col) => sum + metricColumnWidthMm(col), 0);

const totalMetricColumns = (model: CompetitionTableModel): number =>
  model.yearGroups.reduce((s, yg) => s + yg.columns.length, 0);

const fullTableWidthMm = (model: CompetitionTableModel): number =>
  STAGE_COLUMN_WIDTH_MM + model.yearGroups.reduce((s, yg) => s + yearGroupWidthMm(yg), 0);

export const resolveCompetitionPdfOrientation = (
  model: CompetitionTableModel
): CompetitionPdfOrientation => {
  const metrics = totalMetricColumns(model);
  const width = fullTableWidthMm(model);
  if (metrics > LANDSCAPE_METRIC_COLUMN_THRESHOLD) return "landscape";
  if (width > COMPETITION_PDF_PAGE.portrait.usableWidthMm) return "landscape";
  return "portrait";
};

/** Greedy pack — how many year groups fit per page at natural column widths */
export const maxYearsPerChunk = (
  yearGroups: CompetitionYearColumnGroup[],
  orientation: CompetitionPdfOrientation
): number => {
  const usable = COMPETITION_PDF_PAGE[orientation].usableWidthMm - STAGE_COLUMN_WIDTH_MM;
  if (yearGroups.length === 0) return 1;

  let maxSeen = 1;
  let i = 0;
  while (i < yearGroups.length) {
    let used = 0;
    let count = 0;
    while (i < yearGroups.length) {
      const w = yearGroupWidthMm(yearGroups[i]!);
      if (count > 0 && used + w > usable) break;
      used += w;
      count += 1;
      i += 1;
    }
    maxSeen = Math.max(maxSeen, Math.max(1, count));
  }
  return maxSeen;
};

/** Width-aware greedy packing — never squeeze years; split across pages instead */
export const chunkCompetitionYearGroups = (
  yearGroups: CompetitionYearColumnGroup[],
  orientation: CompetitionPdfOrientation
): CompetitionYearColumnGroup[][] => {
  if (yearGroups.length === 0) return [];

  const usable = COMPETITION_PDF_PAGE[orientation].usableWidthMm - STAGE_COLUMN_WIDTH_MM;
  const chunks: CompetitionYearColumnGroup[][] = [];
  let i = 0;

  while (i < yearGroups.length) {
    const chunk: CompetitionYearColumnGroup[] = [];
    let used = 0;

    while (i < yearGroups.length) {
      const yg = yearGroups[i]!;
      const w = yearGroupWidthMm(yg);
      if (chunk.length > 0 && used + w > usable) break;
      chunk.push(yg);
      used += w;
      i += 1;
    }

    if (chunk.length === 0) {
      chunk.push(yearGroups[i]!);
      i += 1;
    }

    chunks.push(chunk);
  }

  return chunks;
};

const naturalMetricColumns = (
  yg: CompetitionYearColumnGroup
): CompetitionPdfMetricColumn[] =>
  yg.columns.map((col) => ({
    year: yg.year,
    metricKey: col.key,
    labelAr: col.labelAr,
    labelEn: col.labelEn,
    widthMm: metricColumnWidthMm(col),
    isTotalColumn: col.key === "total",
  }));

const expandYearGroupsToFill = (
  layouts: CompetitionPdfYearGroupLayout[],
  targetMetricsWidthMm: number
): CompetitionPdfYearGroupLayout[] => {
  const current = layouts.reduce((s, yg) => s + yg.widthMm, 0);
  if (current <= 0 || current >= targetMetricsWidthMm) return layouts;

  const factor = targetMetricsWidthMm / current;
  return layouts.map((yg) => {
    const columns = yg.columns.map((c) => {
      const cap = c.isTotalColumn ? METRIC_TOTAL_MM + 3 : METRIC_NUMERIC_MAX_MM + 2;
      return {
        ...c,
        widthMm: Math.min(cap, Math.round(c.widthMm * factor * 10) / 10),
      };
    });
    return {
      ...yg,
      columns,
      widthMm: columns.reduce((s, col) => s + col.widthMm, 0),
    };
  });
};

const buildYearGroupLayouts = (
  yearGroups: CompetitionYearColumnGroup[],
  orientation: CompetitionPdfOrientation
): CompetitionPdfYearGroupLayout[] => {
  const usableMetrics = COMPETITION_PDF_PAGE[orientation].usableWidthMm - STAGE_COLUMN_WIDTH_MM;

  let layouts: CompetitionPdfYearGroupLayout[] = yearGroups.map((yg) => {
    const columns = naturalMetricColumns(yg);
    return {
      year: yg.year,
      labelAr: yg.labelAr,
      labelEn: yg.labelEn,
      columns,
      widthMm: columns.reduce((s, c) => s + c.widthMm, 0),
    };
  });

  const metricsTotal = layouts.reduce((s, yg) => s + yg.widthMm, 0);
  if (metricsTotal < usableMetrics * 0.88) {
    layouts = expandYearGroupsToFill(layouts, usableMetrics * 0.92);
  }

  return layouts;
};

const resolveFontSizes = (metricCols: number): { table: number; body: number } => {
  if (metricCols > 24) return { table: 10, body: 10 };
  return { table: 10, body: 11 };
};

export const buildCompetitionPdfLayoutPlan = (
  model: CompetitionTableModel
): CompetitionPdfLayoutPlan => {
  if (!isCompetitionPdfLayoutReady(model)) {
    return {
      orientation: "landscape",
      chunks: [],
      totalMetricColumns: 0,
      totalYears: 0,
    };
  }

  const orientation = resolveCompetitionPdfOrientation(model);
  const yearChunks = chunkCompetitionYearGroups(model.yearGroups, orientation);
  const metricCols = totalMetricColumns(model);

  const chunks: CompetitionPdfTableChunk[] = yearChunks.map((yearGroups, idx) => {
    const yearGroupLayouts = buildYearGroupLayouts(yearGroups, orientation);
    const tableWidthMm =
      STAGE_COLUMN_WIDTH_MM + yearGroupLayouts.reduce((s, yg) => s + yg.widthMm, 0);
    const chunkMetricCols = yearGroups.reduce((s, yg) => s + yg.columns.length, 0);
    const fonts = resolveFontSizes(chunkMetricCols);

    return {
      chunkIndex: idx,
      chunkTotal: yearChunks.length,
      orientation,
      yearGroups,
      stageWidthMm: STAGE_COLUMN_WIDTH_MM,
      yearGroupLayouts,
      tableWidthMm,
      fontSizePx: fonts.table,
      bodyFontSizePx: fonts.body,
    };
  });

  return {
    orientation,
    chunks,
    totalMetricColumns: metricCols,
    totalYears: model.yearGroups.length,
  };
};

/** Guard for empty model — mirrors matrix funnel init pattern */
const isCompetitionPdfLayoutReady = (model: CompetitionTableModel): boolean => {
  if (model.yearGroups.length === 0) {
    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info("[COMPETITION_PDF_INIT_ERROR]", {
        source: "competition-pdf-layout-engine",
        note: "yearGroups empty",
        competition: model.competition,
      });
    }
    return false;
  }
  return true;
};

export const assertCompetitionPdfLayoutReady = (model: CompetitionTableModel): void => {
  if (model.rows.length === 0 || model.yearGroups.length === 0) {
    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info("[COMPETITION_PDF_INIT_ERROR]", {
        source: "competition-pdf-layout-engine",
        rows: model.rows.length,
        years: model.yearGroups.length,
      });
    }
  }
};
