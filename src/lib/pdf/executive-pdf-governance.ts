/**
 * Enterprise Executive Reporting Governance — single export gate.
 * All PDF exports MUST pass through this module.
 */

import {
  validateExecutivePdfExportContract,
  type ExecutivePdfExportContract,
} from "@/lib/pdf/contracts/executive-pdf-export-contract";
import { validateExecutivePdfKpiContract } from "@/lib/pdf/contracts/executive-pdf-kpi-contract";
import { validateExecutivePdfMetadataContract } from "@/lib/pdf/contracts/executive-pdf-metadata-contract";
import type { ExecutiveKpiItem } from "@/lib/pdf/components/ExecutivePdfKpiGrid";
import type { ExecutivePdfMetadata } from "@/lib/pdf/executive-pdf-metadata";
import { validateExecutivePdfLayout } from "@/lib/pdf/executive-pdf-layout-validation";
import {
  assessDatasetForExport,
  type DatasetGuardAssessment,
} from "@/lib/pdf/governance/executive-pdf-dataset-guard";
import { runExecutivePdfPrintSandbox } from "@/lib/pdf/governance/executive-pdf-export-sandbox";
import {
  telemetryExportFailure,
  telemetryPageCount,
  telemetryTableOverflow,
} from "@/lib/pdf/governance/executive-pdf-telemetry";
import { normalizeLandscapeTableWidth } from "@/lib/pdf/governance/executive-pdf-pagination-governance";
import {
  executivePrintableHeightMm,
  executivePrintableWidthMm,
} from "@/lib/pdf/tokens/executive-print";
import {
  getExecutiveReportDefinition,
  type ExecutiveExportBuildResult,
  type ExecutiveReportId,
} from "@/lib/pdf/executive-export-registry";
import { hasOfficialReportHeaderMarker } from "@/lib/pdf/report-header-standard";

export class ExecutivePdfGovernanceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ExecutivePdfGovernanceError";
    this.code = code;
  }
}

export type GovernedExportOptions = {
  kpis?: ExecutiveKpiItem[];
  metadata?: ExecutivePdfMetadata;
  skipPrint?: boolean;
};

export const buildGovernedExecutiveReport = async <T>(
  reportId: ExecutiveReportId,
  payload: T
): Promise<ExecutiveExportBuildResult & { assessment: DatasetGuardAssessment }> => {
  const def = getExecutiveReportDefinition(reportId);
  const built = await Promise.resolve(def.exportBuilder(payload));
  const orientation = built.orientation;

  const assessment = assessDatasetForExport({
    rowCount: built.metrics.rowCount,
    columnCount: built.metrics.columnCount,
    orientation,
    tableWidthMm: built.metrics.tableWidthMm,
  });

  if (assessment.blocked) {
    throw new ExecutivePdfGovernanceError(
      "DATASET_BLOCKED",
      `Export blocked: ${assessment.warnings.join(", ")}`
    );
  }

  const contract: ExecutivePdfExportContract = {
    reportId,
    title: def.titleEn,
    isAr: /dir="rtl"/i.test(built.html),
    orientation,
    pageSize: "A4",
    layoutMode: def.layoutMode,
    rowCount: built.metrics.rowCount,
    columnCount: built.metrics.columnCount,
    pageCount: built.metrics.pageCount,
  };

  const exportValidation = validateExecutivePdfExportContract(
    contract,
    def.validationRules,
    built.html
  );
  if (!exportValidation.ok) {
    throw new ExecutivePdfGovernanceError(exportValidation.code, exportValidation.message);
  }

  return { ...built, assessment };
};

export const exportGovernedExecutiveReport = async <T>(
  reportId: ExecutiveReportId,
  payload: T,
  opts?: GovernedExportOptions
): Promise<void> => {
  try {
    if (opts?.kpis?.length) {
      const kpiVal = validateExecutivePdfKpiContract({ items: opts.kpis });
      if (!kpiVal.ok) throw new ExecutivePdfGovernanceError(kpiVal.code, kpiVal.message);
    }
    if (opts?.metadata) {
      const metaVal = validateExecutivePdfMetadataContract({ metadata: opts.metadata });
      if (!metaVal.ok) throw new ExecutivePdfGovernanceError(metaVal.code, metaVal.message);
    }

    const built = await buildGovernedExecutiveReport(reportId, payload);
    const orientation = built.orientation;

    if (built.metrics.tableWidthMm != null) {
      const norm = normalizeLandscapeTableWidth(built.metrics.tableWidthMm, orientation);
      if (norm.overflowMm > 0) {
        telemetryTableOverflow({
          reportId,
          orientation,
          rowCount: built.metrics.rowCount,
          columnCount: built.metrics.columnCount,
          tableWidthMm: built.metrics.tableWidthMm,
          overflowMm: norm.overflowMm,
        });
      }
    }

    validateExecutivePdfLayout({
      surface: reportId,
      orientation,
      printableWidthMm: executivePrintableWidthMm(orientation),
      printableHeightMm: executivePrintableHeightMm(orientation),
      tableWidthMm: built.metrics.tableWidthMm,
      rowCount: built.metrics.rowCount,
      pageCount: built.metrics.pageCount,
      lastChunkRows: built.metrics.lastChunkRows,
      maxChunkRows: built.metrics.maxChunkRows,
      hasHeader: hasOfficialReportHeaderMarker(built.html) || built.html.includes("ep-h1"),
      hasFooter: built.html.includes("ep-footer") || built.html.includes("ep-page-foot"),
    });

    if (built.metrics.pageCount != null) {
      telemetryPageCount({
        reportId,
        orientation,
        pageCount: built.metrics.pageCount,
        rowCount: built.metrics.rowCount,
        columnCount: built.metrics.columnCount,
      });
    }

    if (opts?.skipPrint) return;

    await runExecutivePdfPrintSandbox(built.html, {
      headerImagePath: built.headerImagePath,
      reportId,
      orientation,
      rowCount: built.metrics.rowCount,
      columnCount: built.metrics.columnCount,
    });
  } catch (e) {
    telemetryExportFailure({
      reportId,
      orientation: "landscape",
      err: e instanceof Error ? e.message : "export_failed",
    });
    throw e;
  }
};

export {
  EXECUTIVE_EXPORT_REGISTRY,
  EXECUTIVE_REPORT_IDS,
  getExecutiveReportDefinition,
  listExecutiveReportDefinitions,
  type ExecutiveReportId,
} from "@/lib/pdf/executive-export-registry";
