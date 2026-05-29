import {
  executivePdfStylesheet,
  type ExecutivePdfOrientation,
} from "@/lib/pdf/executive-pdf-theme";
import { buildStandardReportHeader, type ExecutivePdfHeaderInput } from "@/lib/pdf/components/ExecutivePdfHeader";
import { buildExecutivePdfFooter } from "@/lib/pdf/components/ExecutivePdfFooter";

export type BuildExecutivePdfDocumentInput = {
  isAr: boolean;
  documentTitle: string;
  orientation?: ExecutivePdfOrientation;
  bodyHtml: string;
  header?: ExecutivePdfHeaderInput;
  footer?: Parameters<typeof buildExecutivePdfFooter>[0];
  extraStyles?: string;
  /** When false, caller renders header inside bodyHtml */
  includeHeader?: boolean;
  includeFooter?: boolean;
  /** When false, bodyHtml must include its own `.page-shell` blocks (multi-page exports). */
  wrapInPageShell?: boolean;
};

export const buildExecutivePdfDocumentHtml = (input: BuildExecutivePdfDocumentInput): string => {
  const dir = input.isAr ? "rtl" : "ltr";
  const lang = input.isAr ? "ar" : "en";
  const orientation = input.orientation ?? "landscape";
  const includeHeader = input.includeHeader !== false && input.header;
  const includeFooter = input.includeFooter !== false;

  const headerHtml = includeHeader && input.header ? buildStandardReportHeader(input.header) : "";
  const footerHtml = includeFooter ? buildExecutivePdfFooter(input.footer ?? { isAr: input.isAr }) : "";
  const wrapInPageShell = input.wrapInPageShell !== false;

  const orientationOverride = `@page { size: A4 ${orientation}; }`;

  const bodyContent = wrapInPageShell
    ? `<div class="page-shell page-content">
${headerHtml}
${input.bodyHtml}
${footerHtml}
</div>`
    : `${input.bodyHtml}
${includeFooter ? `<div class="ep-doc-footer-slot">${footerHtml}</div>` : ""}`;

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<title>${input.documentTitle.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</title>
<style>
${orientationOverride}
${executivePdfStylesheet(input.isAr)}
${input.extraStyles ?? ""}
</style>
</head>
<body>
${bodyContent}
</body>
</html>`;
};
