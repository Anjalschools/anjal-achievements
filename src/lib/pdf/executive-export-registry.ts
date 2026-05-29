import type { AiDecisionEngineResult } from "@/lib/analytics/ai/ai-decision-schema";
import { buildExecutiveDecisionPdfDocument } from "@/lib/analytics/ai/executive-decision-pdf-layout";
import {
  buildFocusedParticipantsPdfHtml,
  type FocusedParticipantsPdfOptions,
} from "@/lib/analytics/export/focused-participants-pdf-document";
import type { ExecutivePdfExportValidationRules } from "@/lib/pdf/contracts/executive-pdf-export-contract";
import type { ExecutivePdfLayoutMode } from "@/lib/pdf/contracts/executive-pdf-export-contract";
import {
  buildExecutiveGenericTableExportHtml,
  type BuildExecutiveGenericTableExportInput,
} from "@/lib/pdf/executive-pdf-generic-export";
import type { ExecutivePdfOrientation } from "@/lib/pdf/tokens/executive-print";
import { EXECUTIVE_PAGE_SIZE } from "@/lib/pdf/tokens/executive-print";

export const EXECUTIVE_REPORT_IDS = [
  "portrait-table",
  "landscape-executive",
  "focused-participants",
  "focused-competition-analytics",
  "focused-executive-report",
  "executive-decisions",
  "historical-comparison",
] as const;

export type ExecutiveReportId = (typeof EXECUTIVE_REPORT_IDS)[number];

export type ExecutiveExportMetrics = {
  tableWidthMm?: number;
  pageCount?: number;
  lastChunkRows?: number;
  maxChunkRows?: number;
  rowCount: number;
  columnCount: number;
};

export type ExecutiveExportBuildResult = {
  html: string;
  orientation: ExecutivePdfOrientation;
  metrics: ExecutiveExportMetrics;
  headerImagePath?: string;
};

export type ExecutiveReportDefinition = {
  id: ExecutiveReportId;
  titleAr: string;
  titleEn: string;
  orientation: ExecutivePdfOrientation;
  pageSize: typeof EXECUTIVE_PAGE_SIZE;
  layoutMode: ExecutivePdfLayoutMode;
  supportsPagination: boolean;
  supportsLandscape: boolean;
  supportsKpis: boolean;
  supportsFilters: boolean;
  validationRules: ExecutivePdfExportValidationRules;
  exportBuilder: (payload: unknown) => ExecutiveExportBuildResult | Promise<ExecutiveExportBuildResult>;
};

export type PortraitTablePayload = BuildExecutiveGenericTableExportInput;
export type LandscapeExecutivePayload = BuildExecutiveGenericTableExportInput;
export type FocusedParticipantsPayload = FocusedParticipantsPdfOptions;
export type ExecutiveDecisionsPayload = {
  result: AiDecisionEngineResult;
  title: string;
  isAr: boolean;
  headerImagePath?: string;
};

export type FocusedCompetitionAnalyticsPayload = {
  html: string;
  rowCount: number;
  columnCount: number;
  headerImagePath?: string;
};

export type FocusedExecutiveReportPayload = {
  html: string;
  rowCount: number;
  pageCount: number;
  headerImagePath?: string;
};

export type HistoricalComparisonPayload = {
  html: string;
  rowCount: number;
  columnCount: number;
};

const portraitTableDef: ExecutiveReportDefinition = {
  id: "portrait-table",
  titleAr: "جدول عمودي",
  titleEn: "Portrait table",
  orientation: "portrait",
  pageSize: EXECUTIVE_PAGE_SIZE,
  layoutMode: "standard",
  supportsPagination: true,
  supportsLandscape: false,
  supportsKpis: false,
  supportsFilters: true,
  validationRules: { maxRows: 8000, maxColumns: 32, requireHeaderMarker: true },
  exportBuilder: (payload) => {
    const p = payload as PortraitTablePayload;
    const built = buildExecutiveGenericTableExportHtml({ ...p, orientation: "portrait" });
    return {
      html: built.html,
      orientation: "portrait",
      headerImagePath: p.headerImagePath,
      metrics: {
        rowCount: p.rows.length,
        columnCount: p.headers.length,
        tableWidthMm: built.tableWidthMm,
        pageCount: built.pageCount,
        lastChunkRows: built.lastChunkRows,
        maxChunkRows: built.maxChunkRows,
      },
    };
  },
};

const landscapeExecutiveDef: ExecutiveReportDefinition = {
  id: "landscape-executive",
  titleAr: "تقرير تنفيذي أفقي",
  titleEn: "Landscape executive",
  orientation: "landscape",
  pageSize: EXECUTIVE_PAGE_SIZE,
  layoutMode: "landscape-shell",
  supportsPagination: true,
  supportsLandscape: true,
  supportsKpis: true,
  supportsFilters: true,
  validationRules: { maxRows: 8000, maxColumns: 32, requireHeaderMarker: true },
  exportBuilder: (payload) => {
    const p = payload as LandscapeExecutivePayload;
    const built = buildExecutiveGenericTableExportHtml({ ...p, orientation: "landscape" });
    return {
      html: built.html,
      orientation: "landscape",
      headerImagePath: p.headerImagePath,
      metrics: {
        rowCount: p.rows.length,
        columnCount: p.headers.length,
        tableWidthMm: built.tableWidthMm,
        pageCount: built.pageCount,
        lastChunkRows: built.lastChunkRows,
        maxChunkRows: built.maxChunkRows,
      },
    };
  },
};

const focusedParticipantsDef: ExecutiveReportDefinition = {
  id: "focused-participants",
  titleAr: "جدول المشاركين",
  titleEn: "Participants register",
  orientation: "landscape",
  pageSize: EXECUTIVE_PAGE_SIZE,
  layoutMode: "landscape-shell",
  supportsPagination: false,
  supportsLandscape: true,
  supportsKpis: false,
  supportsFilters: true,
  validationRules: { maxRows: 5000, maxColumns: 24, requireHeaderMarker: true, requireFooterMarker: true },
  exportBuilder: (payload) => {
    const p = payload as FocusedParticipantsPayload;
    return {
    html: buildFocusedParticipantsPdfHtml(p),
    orientation: "landscape",
    headerImagePath: p.headerImagePath,
    metrics: {
      rowCount: p.rows.length,
      columnCount: p.headers.length,
      pageCount: 1,
    },
  };
  },
};

const executiveDecisionsDef: ExecutiveReportDefinition = {
  id: "executive-decisions",
  titleAr: "قرارات تنفيذية",
  titleEn: "Executive decisions",
  orientation: "landscape",
  pageSize: EXECUTIVE_PAGE_SIZE,
  layoutMode: "landscape-shell",
  supportsPagination: false,
  supportsLandscape: true,
  supportsKpis: true,
  supportsFilters: false,
  validationRules: { requireHeaderMarker: true, requireFooterMarker: true },
  exportBuilder: (payload) => {
    const p = payload as ExecutiveDecisionsPayload;
    return {
      html: buildExecutiveDecisionPdfDocument(p.result, p.title, p.isAr, p.headerImagePath),
      orientation: "landscape",
      headerImagePath: p.headerImagePath,
      metrics: {
        rowCount: p.result.bundle.decisions.length,
        columnCount: 5,
        pageCount: 1,
      },
    };
  },
};

const focusedCompetitionDef: ExecutiveReportDefinition = {
  id: "focused-competition-analytics",
  titleAr: "تحليلات المسابقة المركّزة",
  titleEn: "Focused competition analytics",
  orientation: "landscape",
  pageSize: EXECUTIVE_PAGE_SIZE,
  layoutMode: "multi-section",
  supportsPagination: true,
  supportsLandscape: true,
  supportsKpis: true,
  supportsFilters: true,
  validationRules: { maxRows: 8000, requireHeaderMarker: true },
  exportBuilder: (payload) => {
    const p = payload as FocusedCompetitionAnalyticsPayload;
    return {
      html: p.html,
      orientation: "landscape",
      headerImagePath: p.headerImagePath,
      metrics: {
        rowCount: p.rowCount,
        columnCount: p.columnCount,
        pageCount: 1,
      },
    };
  },
};

const focusedExecutiveDef: ExecutiveReportDefinition = {
  id: "focused-executive-report",
  titleAr: "التقرير التنفيذي المركّز",
  titleEn: "Focused executive report",
  orientation: "landscape",
  pageSize: EXECUTIVE_PAGE_SIZE,
  layoutMode: "multi-section",
  supportsPagination: true,
  supportsLandscape: true,
  supportsKpis: true,
  supportsFilters: true,
  validationRules: { maxRows: 8000, requireHeaderMarker: true },
  exportBuilder: (payload) => {
    const p = payload as FocusedExecutiveReportPayload;
    return {
    html: p.html,
    orientation: "landscape",
    headerImagePath: p.headerImagePath,
    metrics: {
      rowCount: p.rowCount,
      columnCount: 0,
      pageCount: p.pageCount,
    },
  };
  },
};

const historicalComparisonDef: ExecutiveReportDefinition = {
  id: "historical-comparison",
  titleAr: "مقارنة تاريخية",
  titleEn: "Historical comparison",
  orientation: "landscape",
  pageSize: EXECUTIVE_PAGE_SIZE,
  layoutMode: "multi-section",
  supportsPagination: true,
  supportsLandscape: true,
  supportsKpis: true,
  supportsFilters: true,
  validationRules: { maxRows: 12000, maxColumns: 40, requireHeaderMarker: false },
  exportBuilder: (payload) => {
    const p = payload as HistoricalComparisonPayload;
    return {
    html: p.html,
    orientation: "landscape",
    metrics: {
      rowCount: p.rowCount,
      columnCount: p.columnCount,
      pageCount: 1,
    },
  };
  },
};

export const EXECUTIVE_EXPORT_REGISTRY: Record<ExecutiveReportId, ExecutiveReportDefinition> = {
  "portrait-table": portraitTableDef,
  "landscape-executive": landscapeExecutiveDef,
  "focused-participants": focusedParticipantsDef,
  "focused-competition-analytics": focusedCompetitionDef,
  "focused-executive-report": focusedExecutiveDef,
  "executive-decisions": executiveDecisionsDef,
  "historical-comparison": historicalComparisonDef,
};

export const getExecutiveReportDefinition = (id: ExecutiveReportId): ExecutiveReportDefinition => {
  const def = EXECUTIVE_EXPORT_REGISTRY[id];
  if (!def) throw new Error(`Unknown executive report id: ${id}`);
  return def;
};

export const listExecutiveReportDefinitions = (): ExecutiveReportDefinition[] =>
  EXECUTIVE_REPORT_IDS.map((id) => EXECUTIVE_EXPORT_REGISTRY[id]!);
