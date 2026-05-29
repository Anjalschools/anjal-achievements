import type { ExecutivePdfOrientation } from "@/lib/pdf/tokens/executive-print";
import { hasOfficialReportHeaderMarker } from "@/lib/pdf/report-header-standard";

export type ExecutivePdfLayoutMode = "standard" | "landscape-shell" | "multi-section";

export type ExecutivePdfExportContract = {
  reportId: string;
  title: string;
  isAr: boolean;
  orientation: ExecutivePdfOrientation;
  pageSize: "A4";
  layoutMode: ExecutivePdfLayoutMode;
  rowCount: number;
  columnCount: number;
  pageCount?: number;
};

export type ExecutivePdfExportValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export type ExecutivePdfExportValidationRules = {
  minTitleLength?: number;
  maxRows?: number;
  maxColumns?: number;
  requireHeaderMarker?: boolean;
  requireFooterMarker?: boolean;
};

export const validateExecutivePdfExportContract = (
  contract: ExecutivePdfExportContract,
  rules: ExecutivePdfExportValidationRules,
  html?: string
): ExecutivePdfExportValidationResult => {
  if (!contract.reportId?.trim()) {
    return { ok: false, code: "MISSING_REPORT_ID", message: "Report id is required" };
  }
  if (!contract.title?.trim()) {
    return { ok: false, code: "MISSING_TITLE", message: "Report title is required" };
  }
  if (rules.minTitleLength != null && contract.title.trim().length < rules.minTitleLength) {
    return { ok: false, code: "TITLE_TOO_SHORT", message: "Report title is too short" };
  }
  if (rules.maxRows != null && contract.rowCount > rules.maxRows) {
    return {
      ok: false,
      code: "ROW_LIMIT_EXCEEDED",
      message: `Row count ${contract.rowCount} exceeds limit ${rules.maxRows}`,
    };
  }
  if (rules.maxColumns != null && contract.columnCount > rules.maxColumns) {
    return {
      ok: false,
      code: "COLUMN_LIMIT_EXCEEDED",
      message: `Column count ${contract.columnCount} exceeds limit ${rules.maxColumns}`,
    };
  }
  if (html && rules.requireHeaderMarker && !hasOfficialReportHeaderMarker(html) && !html.includes("ep-h1")) {
    return { ok: false, code: "MISSING_HEADER", message: "Document missing unified header" };
  }
  if (html && rules.requireFooterMarker && !html.includes("ep-footer") && !html.includes("ep-page-foot")) {
    return { ok: false, code: "MISSING_FOOTER", message: "Document missing unified footer" };
  }
  return { ok: true };
};
