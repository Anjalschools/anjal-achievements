/**
 * Runtime PDF layout validation — debug-only structured warnings.
 */

export type ExecutivePdfValidationInput = {
  surface: string;
  orientation: "portrait" | "landscape";
  printableWidthMm: number;
  printableHeightMm: number;
  tableWidthMm?: number;
  rowCount?: number;
  pageCount?: number;
  lastChunkRows?: number;
  maxChunkRows?: number;
  hasHeader?: boolean;
  hasFooter?: boolean;
};

const isDebug = (): boolean =>
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

const log = (tag: string, payload: Record<string, unknown>): void => {
  if (!isDebug()) return;
  // eslint-disable-next-line no-console
  console.info(tag, payload);
};

export const validateExecutivePdfLayout = (input: ExecutivePdfValidationInput): void => {
  if (!isDebug()) return;

  if (input.tableWidthMm != null && input.tableWidthMm > input.printableWidthMm + 0.5) {
    log("[EXEC_PDF_OVERFLOW_WARNING]", {
      surface: input.surface,
      tableWidthMm: input.tableWidthMm,
      printableWidthMm: input.printableWidthMm,
      overflowMm: Math.round((input.tableWidthMm - input.printableWidthMm) * 10) / 10,
    });
  }

  if (
    input.lastChunkRows != null &&
    input.maxChunkRows != null &&
    input.maxChunkRows > 0 &&
    input.lastChunkRows > 0 &&
    input.lastChunkRows < Math.max(2, Math.floor(input.maxChunkRows * 0.25))
  ) {
    log("[EXEC_PDF_EMPTY_PAGE_WARNING]", {
      surface: input.surface,
      lastChunkRows: input.lastChunkRows,
      maxChunkRows: input.maxChunkRows,
      reason: "sparse_last_chunk",
    });
  }

  if (input.rowCount === 0) {
    log("[EXEC_PDF_LAYOUT_WARNING]", {
      surface: input.surface,
      reason: "empty_dataset",
    });
  }

  if (input.pageCount != null && input.pageCount > 1 && input.lastChunkRows === 1) {
    log("[EXEC_PDF_ORPHAN_WARNING]", {
      surface: input.surface,
      reason: "orphan_row_on_last_page",
      pageCount: input.pageCount,
    });
  }

  if (input.hasHeader === false) {
    log("[EXEC_PDF_LAYOUT_WARNING]", {
      surface: input.surface,
      reason: "missing_header",
    });
  }
};
