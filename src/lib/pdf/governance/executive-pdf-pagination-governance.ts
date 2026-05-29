/**
 * Centralized pagination governance — the only approved entry for row chunking.
 */
import {
  balanceRowChunks,
  chunkRowsByPrintableHeight,
  wrapExecutivePdfChunkPage,
  type ExecutivePdfChunkPageInput,
} from "@/lib/pdf/executive-pdf-pagination";
import { telemetryChunkBalance } from "@/lib/pdf/governance/executive-pdf-telemetry";
import type { ExecutivePdfOrientation } from "@/lib/pdf/tokens/executive-print";
import { executivePrintableWidthMm } from "@/lib/pdf/tokens/executive-print";

export type GovernedPaginationInput<T> = {
  reportId: string;
  rows: T[];
  orientation: ExecutivePdfOrientation;
  firstPageOverheadMm: number;
  continuationOverheadMm: number;
  minRowsPerChunk?: number;
};

export type GovernedPaginationResult<T> = {
  chunks: T[][];
  pageCount: number;
  maxChunkRows: number;
  lastChunkRows: number;
};

export const governExecutiveRowPagination = <T>(
  input: GovernedPaginationInput<T>
): GovernedPaginationResult<T> => {
  const chunks = chunkRowsByPrintableHeight({
    rows: input.rows,
    orientation: input.orientation,
    firstPageOverheadMm: input.firstPageOverheadMm,
    continuationOverheadMm: input.continuationOverheadMm,
    minRowsPerChunk: input.minRowsPerChunk,
  });
  const pageCount = chunks.length;
  const maxChunkRows = Math.max(...chunks.map((c) => c.length), 0);
  const lastChunkRows = chunks[chunks.length - 1]?.length ?? 0;

  telemetryChunkBalance({
    reportId: input.reportId,
    orientation: input.orientation,
    rowCount: input.rows.length,
    chunkCount: pageCount,
    lastChunkRows,
    datasetSize: input.rows.length,
  });

  return { chunks, pageCount, maxChunkRows, lastChunkRows };
};

export const normalizeLandscapeTableWidth = (
  tableWidthMm: number,
  orientation: ExecutivePdfOrientation
): { tableWidthMm: number; overflowMm: number } => {
  const printable = executivePrintableWidthMm(orientation);
  if (tableWidthMm <= printable) return { tableWidthMm, overflowMm: 0 };
  return { tableWidthMm: printable, overflowMm: tableWidthMm - printable };
};

export {
  balanceRowChunks,
  chunkRowsByPrintableHeight,
  wrapExecutivePdfChunkPage,
  type ExecutivePdfChunkPageInput,
};
