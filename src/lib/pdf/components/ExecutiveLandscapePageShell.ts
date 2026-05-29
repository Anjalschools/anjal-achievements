import { buildExecutivePdfDocumentHtml } from "@/lib/pdf/executive-pdf-document";
import { buildStandardReportHeader, type ExecutivePdfHeaderInput } from "@/lib/pdf/components/ExecutivePdfHeader";
import { buildExecutivePdfFooter } from "@/lib/pdf/components/ExecutivePdfFooter";
import {
  executivePdfPrintableHeightMm,
  executivePdfPrintableWidthMm,
} from "@/lib/pdf/executive-pdf-theme";

export type ExecutiveLandscapePageShellInput = {
  isAr: boolean;
  documentTitle: string;
  header: ExecutivePdfHeaderInput;
  bodyHtml: string;
  footer?: Parameters<typeof buildExecutivePdfFooter>[0];
  extraStyles?: string;
  centerContent?: boolean;
};

export const landscapeShellDocumentStyles = (): string => `
.ep-landscape-first .page-shell { page-break-after: always; }
`;

const landscapeShellStyles = (): string => `
.ep-landscape-stage {
  width: 100%;
  max-width: ${executivePdfPrintableWidthMm("landscape")}mm;
  margin-inline: auto;
  min-height: ${executivePdfPrintableHeightMm("landscape") - 24}mm;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ep-landscape-stage--center {
  justify-content: center;
}
.ep-landscape-inner {
  width: 100%;
  max-width: 100%;
}
`;

/**
 * Unified A4 landscape page shell — mandatory for matrix / participant / comparative exports.
 */
export const buildExecutiveLandscapePageShell = (input: ExecutiveLandscapePageShellInput): string => {
  const centerClass = input.centerContent !== false ? "ep-landscape-stage--center" : "";
  const body = `
<div class="ep-landscape-stage ${centerClass}">
  <div class="ep-landscape-inner page-section page-section--flow">
    ${input.bodyHtml}
  </div>
</div>`;

  return buildExecutivePdfDocumentHtml({
    isAr: input.isAr,
    documentTitle: input.documentTitle,
    orientation: "landscape",
    header: input.header,
    footer: input.footer,
    bodyHtml: body,
    includeHeader: true,
    includeFooter: true,
    extraStyles: `${landscapeShellDocumentStyles()}\n${landscapeShellStyles()}\n${input.extraStyles ?? ""}`,
  });
};

export const buildExecutiveLandscapePageShellFromParts = (input: {
  isAr: boolean;
  documentTitle: string;
  competitionName: string;
  reportTypeLabel?: string;
  academicYears?: string;
  outcomeLine?: string;
  filterSummary?: string;
  generatedAt?: string;
  headerBannerPath?: string;
  sectionsHtml: string;
  footer?: Parameters<typeof buildExecutivePdfFooter>[0];
  extraStyles?: string;
}): string =>
  buildExecutiveLandscapePageShell({
    isAr: input.isAr,
    documentTitle: input.documentTitle,
    header: {
      isAr: input.isAr,
      competitionName: input.competitionName,
      reportTypeLabel: input.reportTypeLabel ?? input.documentTitle,
      academicYears: input.academicYears,
      outcomeLine: input.outcomeLine,
      filterSummary: input.filterSummary,
      generatedAt: input.generatedAt,
      headerBannerPath: input.headerBannerPath,
    },
    bodyHtml: input.sectionsHtml,
    footer: input.footer,
    extraStyles: input.extraStyles,
  });
