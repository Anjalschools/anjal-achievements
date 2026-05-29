import { buildExecutivePdfDocumentHtml } from "@/lib/pdf/executive-pdf-document";
import { landscapeShellDocumentStyles } from "@/lib/pdf/components/ExecutiveLandscapePageShell";
import {
  buildOfficialReportContinuationHeader,
  buildStandardReportHeader,
} from "@/lib/pdf/components/ExecutivePdfHeader";
import { buildExecutivePdfFooter } from "@/lib/pdf/components/ExecutivePdfFooter";
import {
  buildExecutiveSummaryPanelHtml,
  executiveKpiPanelStyles,
} from "@/lib/pdf/components/ExecutivePdfKpiGrid";
import {
  governExecutiveRowPagination,
  wrapExecutivePdfChunkPage,
} from "@/lib/pdf/governance/executive-pdf-pagination-governance";
import {
  EXECUTIVE_PDF_KPI_BAND_MM,
  EXECUTIVE_PDF_PAGE_CONTINUATION_HEADER_MM,
  EXECUTIVE_PDF_PAGE_HEADER_MM,
  EXECUTIVE_PDF_TABLE_HEADER_MM,
} from "@/lib/pdf/executive-pdf-pagination";
import {
  buildTableFromSchema,
  mapRowsToSchemaIds,
  schemaFromHeaders,
} from "@/lib/pdf/schema/executive-table-schema";
import { validateExecutivePdfTableContract } from "@/lib/pdf/contracts/executive-pdf-table-contract";
import { executivePdfTableStyles } from "@/lib/pdf/executive-pdf-theme";
import { exportExecutivePdfDocument } from "@/lib/pdf/executive-pdf-export-service";

export type GenericExportRow = Record<string, string | number | null | undefined>;

export type BuildExecutiveGenericTableExportInput = {
  isAr: boolean;
  title: string;
  headers: string[];
  rows: GenericExportRow[];
  orientation: "portrait" | "landscape";
  headerImagePath?: string;
  subtitle?: string;
  summaryLines?: string[];
  blocksHtml?: string;
  filterSummary?: string;
  competitionName?: string;
};

const mapRowsForHeaders = (headers: string[], rows: GenericExportRow[]): GenericExportRow[] =>
  rows.map((r) => {
    const out: GenericExportRow = {};
    for (const h of headers) out[h] = r[h];
    return out;
  });

export const buildExecutiveGenericTableExportHtml = (
  input: BuildExecutiveGenericTableExportInput
): { html: string; tableWidthMm: number; pageCount: number; lastChunkRows: number; maxChunkRows: number } => {
  const generatedAt = new Date().toLocaleString(input.isAr ? "ar-SA" : "en-GB");
  const competitionName = input.competitionName ?? input.title;
  const mappedRows = mapRowsForHeaders(input.headers, input.rows);

  const firstOverhead =
    EXECUTIVE_PDF_PAGE_HEADER_MM +
    (input.summaryLines?.length ? 28 : 0) +
    (input.blocksHtml ? 12 : 0) +
    EXECUTIVE_PDF_KPI_BAND_MM * 0.25;
  const continuationOverhead =
    EXECUTIVE_PDF_PAGE_CONTINUATION_HEADER_MM + EXECUTIVE_PDF_TABLE_HEADER_MM;

  const reportId =
    input.orientation === "landscape" ? "landscape-executive" : "portrait-table";
  const schema = schemaFromHeaders(`${reportId}-table`, input.headers, input.orientation);
  const schemaRows = mapRowsToSchemaIds(schema, input.headers, mappedRows);
  const tableContract = validateExecutivePdfTableContract({
    schema,
    rowCount: schemaRows.length,
    orientation: input.orientation,
  });
  if (!tableContract.ok) {
    throw new Error(`${tableContract.code}: ${tableContract.message}`);
  }

  const { chunks, pageCount, maxChunkRows, lastChunkRows } = governExecutiveRowPagination({
    reportId,
    rows: schemaRows,
    orientation: input.orientation,
    firstPageOverheadMm: firstOverhead,
    continuationOverheadMm: continuationOverhead,
  });

  const tablePages = chunks.map((chunk, idx) => {
    const { html: tableHtml, tableWidthMm } = buildTableFromSchema({
      schema,
      rows: chunk,
      isAr: input.isAr,
      orientation: input.orientation,
    });
    return { tableHtml, tableWidthMm, pageIndex: idx };
  });

  const tableWidthMm = tablePages[0]?.tableWidthMm ?? 0;
  const summaryHtml = input.summaryLines?.length
    ? buildExecutiveSummaryPanelHtml(input.isAr, input.summaryLines)
    : "";
  const blocks = input.blocksHtml ?? "";
  const preamble = `${summaryHtml}${blocks}`;

  const headerBannerPath = input.headerImagePath;
  const buildHeader = () =>
    buildStandardReportHeader({
      isAr: input.isAr,
      competitionName,
      reportTypeLabel: input.title,
      filterSummary: input.filterSummary ?? input.subtitle,
      generatedAt,
      headerBannerPath,
    });
  const buildContinuationHeader = () =>
    buildOfficialReportContinuationHeader(headerBannerPath);
  const footerHtml = buildExecutivePdfFooter({
    isAr: input.isAr,
    generatedAt,
    reportTypeLabel: input.title,
  });

  if (input.orientation === "landscape") {
    const header = buildHeader();
    const firstTable = tablePages[0]?.tableHtml ?? "";
    const firstInner = `<div class="page-shell page-content ep-landscape-first">
${header}
${preamble}
<div class="ep-table-wrap">${firstTable}</div>
${footerHtml}
</div>`;
    const rest = tablePages.slice(1).map((p) =>
      wrapExecutivePdfChunkPage({
        chunkHtml: p.tableHtml,
        pageIndex: p.pageIndex,
        pageTotal: pageCount,
        isAr: input.isAr,
        continuationHeaderHtml: buildContinuationHeader(),
        footerHtml,
      })
    ).join("\n");
    const body = `${firstInner}${rest}`;
    const html = buildExecutivePdfDocumentHtml({
      isAr: input.isAr,
      documentTitle: input.title,
      orientation: "landscape",
      bodyHtml: `<div class="ep-landscape-stage"><div class="ep-landscape-inner">${body}</div></div>`,
      includeHeader: false,
      includeFooter: false,
      wrapInPageShell: false,
      extraStyles: `${landscapeShellDocumentStyles()}\n${executivePdfTableStyles(input.isAr)}\n${executiveKpiPanelStyles()}`,
    });
    return { html, tableWidthMm, pageCount, lastChunkRows, maxChunkRows };
  }

  const header = buildHeader();
  const firstTable = tablePages[0]?.tableHtml ?? "";
  const firstPage = `<div class="page-shell page-content">
${header}
${preamble}
<div class="ep-table-wrap">${firstTable}</div>
${footerHtml}
</div>`;
  const restPortrait = tablePages.slice(1).map((p) =>
    wrapExecutivePdfChunkPage({
      chunkHtml: p.tableHtml,
      pageIndex: p.pageIndex,
      pageTotal: pageCount,
      isAr: input.isAr,
      continuationHeaderHtml: buildContinuationHeader(),
      footerHtml,
    })
  ).join("\n");
  const body = `${firstPage}${restPortrait}`;
  const html = buildExecutivePdfDocumentHtml({
    isAr: input.isAr,
    documentTitle: input.title,
    orientation: "portrait",
    bodyHtml: body,
    includeHeader: false,
    includeFooter: false,
    wrapInPageShell: false,
    extraStyles: `${executivePdfTableStyles(input.isAr)}\n${executiveKpiPanelStyles()}`,
  });

  return { html, tableWidthMm, pageCount, lastChunkRows, maxChunkRows };
};

/** Prefer exportGovernedExecutiveReport from executive-pdf-governance for new code. */
export const exportExecutiveGenericTablePdf = async (
  input: BuildExecutiveGenericTableExportInput
): Promise<void> => {
  const built = buildExecutiveGenericTableExportHtml(input);
  const reportId =
    input.orientation === "landscape" ? "landscape-executive" : "portrait-table";
  await exportExecutivePdfDocument(built.html, {
    headerImagePath: input.headerImagePath,
    surface: reportId,
    orientation: input.orientation,
    tableWidthMm: built.tableWidthMm,
    rowCount: input.rows.length,
    pageCount: built.pageCount,
    lastChunkRows: built.lastChunkRows,
    maxChunkRows: built.maxChunkRows,
  });
};
