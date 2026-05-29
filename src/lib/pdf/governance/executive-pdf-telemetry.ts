import type { ExecutivePdfOrientation } from "@/lib/pdf/tokens/executive-print";

export type ExecutivePdfTelemetryPayload = {
  reportId: string;
  orientation: ExecutivePdfOrientation;
  rowCount?: number;
  columnCount?: number;
  pageCount?: number;
  datasetSize?: number;
  renderTimeMs?: number;
  tableWidthMm?: number;
  chunkCount?: number;
  lastChunkRows?: number;
  overflowMm?: number;
  err?: string;
};

const log = (tag: string, payload: ExecutivePdfTelemetryPayload): void => {
  if (typeof console === "undefined") return;
  // eslint-disable-next-line no-console
  console.info(tag, payload);
};

export const telemetryRenderTime = (payload: ExecutivePdfTelemetryPayload & { renderTimeMs: number }): void =>
  log("[EXEC_PDF_RENDER_TIME]", payload);

export const telemetryPageCount = (payload: ExecutivePdfTelemetryPayload & { pageCount: number }): void =>
  log("[EXEC_PDF_PAGE_COUNT]", payload);

export const telemetryTableOverflow = (
  payload: ExecutivePdfTelemetryPayload & { overflowMm: number; tableWidthMm: number }
): void => log("[EXEC_PDF_TABLE_OVERFLOW]", payload);

export const telemetryChunkBalance = (
  payload: ExecutivePdfTelemetryPayload & { chunkCount: number; lastChunkRows: number }
): void => log("[EXEC_PDF_CHUNK_BALANCE]", payload);

export const telemetryExportSuccess = (payload: ExecutivePdfTelemetryPayload): void =>
  log("[EXEC_PDF_EXPORT_SUCCESS]", payload);

export const telemetryExportFailure = (payload: ExecutivePdfTelemetryPayload): void =>
  log("[EXEC_PDF_EXPORT_FAILURE]", payload);
