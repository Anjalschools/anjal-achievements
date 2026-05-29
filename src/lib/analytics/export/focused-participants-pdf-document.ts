/**
 * Focused participants executive PDF — uses unified Executive PDF design system.
 */

import { buildExecutivePdfDocumentHtml } from "@/lib/pdf/executive-pdf-document";
import { buildStandardReportHeader } from "@/lib/pdf/components/ExecutivePdfHeader";
import { buildExecutivePdfFooter } from "@/lib/pdf/components/ExecutivePdfFooter";
import {
  buildExecutiveParticipantsTableHtml,
  executiveParticipantsTableEmbedStyles,
} from "@/lib/pdf/components/ExecutivePdfTable";
import { executivePdfStylesheet } from "@/lib/pdf/executive-pdf-theme";
import { exportGovernedExecutiveReport } from "@/lib/pdf/executive-pdf-governance";
import { printExecutivePdfHtml } from "@/lib/pdf/executive-pdf-print";
import type { FocusedParticipantsTableLayoutPlan } from "@/lib/analytics/export/focused-participants-pdf-layout-engine";

export type FocusedParticipantsPdfRow = Record<string, string | number | null | undefined>;

export type FocusedParticipantsPdfOptions = {
  isAr: boolean;
  docTitle: string;
  subtitle?: string;
  note?: string;
  headers: string[];
  rows: FocusedParticipantsPdfRow[];
  headerImagePath?: string;
  leftLogoPath?: string;
  rightLogoPath?: string;
  filterSummary?: string;
  reportName?: string;
  competitionName?: string;
  academicYears?: string;
  tableOnly?: boolean;
};

export const buildFocusedParticipantsTableHtml = (
  opts: Pick<FocusedParticipantsPdfOptions, "headers" | "rows" | "isAr">
): { html: string; plan: FocusedParticipantsTableLayoutPlan } =>
  buildExecutiveParticipantsTableHtml(opts);

/** @deprecated Use executiveParticipantsTableEmbedStyles — kept for embed compatibility */
export const focusedParticipantsTableEmbedStyles = executiveParticipantsTableEmbedStyles;

export const focusedParticipantsPdfStyles = (): string => executivePdfStylesheet(true);

export const buildFocusedParticipantsPdfHtml = (opts: FocusedParticipantsPdfOptions): string => {
  const generatedAt = new Date().toLocaleString(opts.isAr ? "ar-SA" : "en-GB");
  const competitionName = opts.competitionName ?? opts.docTitle;
  const { html: tableHtml } = buildExecutiveParticipantsTableHtml(opts);
  const note = opts.note ? `<p class="ep-note">${opts.note.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : "";

  if (opts.tableOnly) {
    return `${note}<div class="ep-table-wrap">${tableHtml}</div>`;
  }

  const header = buildStandardReportHeader({
    isAr: opts.isAr,
    competitionName,
    reportTypeLabel: opts.reportName ?? opts.docTitle,
    academicYears: opts.subtitle,
    filterSummary: opts.filterSummary,
    generatedAt,
    headerBannerPath: opts.headerImagePath,
  });

  const body = `
${header}
${note}
<section class="page-section">
  <h2 class="ep-h2">${opts.isAr ? "جدول المشاركين" : "Participant register"}</h2>
  <div class="ep-table-wrap">${tableHtml}</div>
</section>`;

  return buildExecutivePdfDocumentHtml({
    isAr: opts.isAr,
    documentTitle: opts.docTitle,
    orientation: "landscape",
    bodyHtml: body,
    includeHeader: false,
    includeFooter: true,
    footer: {
      isAr: opts.isAr,
      generatedAt,
      reportTypeLabel: opts.isAr ? "جدول المشاركين" : "Participant register",
    },
  });
};

export const printHtmlDocument = printExecutivePdfHtml;

export const exportFocusedParticipantsPdf = async (
  opts: FocusedParticipantsPdfOptions
): Promise<void> => {
  await exportGovernedExecutiveReport("focused-participants", opts);
};
