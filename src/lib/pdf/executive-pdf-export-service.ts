import { runExecutivePdfPrintSandbox } from "@/lib/pdf/governance/executive-pdf-export-sandbox";
import { hasOfficialReportHeaderMarker } from "@/lib/pdf/report-header-standard";
import {
  executivePdfPrintableHeightMm,
  executivePdfPrintableWidthMm,
  type ExecutivePdfOrientation,
} from "@/lib/pdf/executive-pdf-theme";
import { validateExecutivePdfLayout } from "@/lib/pdf/executive-pdf-layout-validation";

export type ExportExecutivePdfOptions = {
  headerImagePath?: string;
  surface?: string;
  orientation?: ExecutivePdfOrientation;
  tableWidthMm?: number;
  rowCount?: number;
  pageCount?: number;
  lastChunkRows?: number;
  maxChunkRows?: number;
};

export const exportExecutivePdfDocument = async (
  html: string,
  opts?: ExportExecutivePdfOptions
): Promise<void> => {
  const orientation = opts?.orientation ?? "landscape";
  validateExecutivePdfLayout({
    surface: opts?.surface ?? "executive-pdf",
    orientation,
    printableWidthMm: executivePdfPrintableWidthMm(orientation),
    printableHeightMm: executivePdfPrintableHeightMm(orientation),
    tableWidthMm: opts?.tableWidthMm,
    rowCount: opts?.rowCount,
    pageCount: opts?.pageCount,
    lastChunkRows: opts?.lastChunkRows,
    maxChunkRows: opts?.maxChunkRows,
    hasHeader: hasOfficialReportHeaderMarker(html) || html.includes("ep-h1"),
    hasFooter: html.includes("ep-footer") || html.includes("ep-page-foot"),
  });
  await runExecutivePdfPrintSandbox(html, {
    headerImagePath: opts?.headerImagePath,
    reportId: opts?.surface ?? "executive-pdf",
    orientation: opts?.orientation,
    rowCount: opts?.rowCount,
  });
};
