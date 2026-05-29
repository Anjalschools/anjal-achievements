import type { ExecutivePdfOrientation } from "@/lib/pdf/tokens/executive-print";
import { executivePrintableWidthMm } from "@/lib/pdf/tokens/executive-print";

export const EXECUTIVE_PDF_MAX_ROWS_SOFT = 2500;
export const EXECUTIVE_PDF_MAX_ROWS_HARD = 8000;
export const EXECUTIVE_PDF_MAX_COLUMNS = 32;

export type DatasetGuardAssessment = {
  rowCount: number;
  columnCount: number;
  orientation: ExecutivePdfOrientation;
  warnings: string[];
  blocked: boolean;
  escalatedOrientation?: ExecutivePdfOrientation;
  emergencySplit: boolean;
  estimatedPages: number;
};

export const assessDatasetForExport = (input: {
  rowCount: number;
  columnCount: number;
  orientation: ExecutivePdfOrientation;
  tableWidthMm?: number;
}): DatasetGuardAssessment => {
  const warnings: string[] = [];
  let blocked = false;
  let escalatedOrientation = input.orientation;
  let emergencySplit = false;

  if (input.columnCount > EXECUTIVE_PDF_MAX_COLUMNS) {
    warnings.push(`column_count_exceeds_${EXECUTIVE_PDF_MAX_COLUMNS}`);
    blocked = true;
  }

  if (input.rowCount > EXECUTIVE_PDF_MAX_ROWS_HARD) {
    warnings.push(`row_count_hard_limit_${EXECUTIVE_PDF_MAX_ROWS_HARD}`);
    blocked = true;
  } else if (input.rowCount > EXECUTIVE_PDF_MAX_ROWS_SOFT) {
    warnings.push(`row_count_soft_limit_${EXECUTIVE_PDF_MAX_ROWS_SOFT}`);
    emergencySplit = true;
  }

  if (input.orientation === "portrait" && input.columnCount > 8) {
    warnings.push("auto_landscape_escalation");
    escalatedOrientation = "landscape";
  }

  if (
    input.tableWidthMm != null &&
    input.tableWidthMm > executivePrintableWidthMm(escalatedOrientation) + 1
  ) {
    warnings.push("table_width_overflow");
    if (escalatedOrientation === "portrait") escalatedOrientation = "landscape";
    emergencySplit = true;
  }

  const rowsPerPage = escalatedOrientation === "landscape" ? 28 : 38;
  const estimatedPages = Math.max(1, Math.ceil(input.rowCount / rowsPerPage));

  return {
    rowCount: input.rowCount,
    columnCount: input.columnCount,
    orientation: input.orientation,
    warnings,
    blocked,
    escalatedOrientation,
    emergencySplit,
    estimatedPages,
  };
};
