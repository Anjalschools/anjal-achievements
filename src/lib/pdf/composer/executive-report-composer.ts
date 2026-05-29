import { buildExecutivePdfDocumentHtml } from "@/lib/pdf/executive-pdf-document";
import {
  buildStandardReportHeader,
  type ExecutivePdfHeaderInput,
} from "@/lib/pdf/components/ExecutivePdfHeader";
import { buildExecutivePdfFooter } from "@/lib/pdf/components/ExecutivePdfFooter";
import {
  buildExecutiveKpiGridHtml,
  buildExecutiveSummaryPanelHtml,
  type ExecutiveKpiItem,
} from "@/lib/pdf/components/ExecutivePdfKpiGrid";
import { formatExecutivePdfMetadataHtml } from "@/lib/pdf/executive-pdf-metadata";
import type { ExecutivePdfMetadata } from "@/lib/pdf/executive-pdf-metadata";
import { buildTableFromSchema, type ExecutiveTableRow, type ExecutiveTableSchema } from "@/lib/pdf/schema/executive-table-schema";
import { landscapeShellDocumentStyles } from "@/lib/pdf/components/ExecutiveLandscapePageShell";
import { executivePdfAccessibilityStyles } from "@/lib/pdf/governance/executive-pdf-accessibility";
import { executivePdfStylesheet } from "@/lib/pdf/executive-pdf-theme";
import type { ExecutivePdfOrientation } from "@/lib/pdf/tokens/executive-print";

export type ExecutiveReportComposerInput = {
  isAr: boolean;
  documentTitle: string;
  orientation: ExecutivePdfOrientation;
  header: ExecutivePdfHeaderInput;
  footer?: Parameters<typeof buildExecutivePdfFooter>[0];
  useLandscapeShell?: boolean;
  wrapInPageShell?: boolean;
};

/**
 * Composable executive report builder — replaces ad-hoc HTML concatenation.
 */
export class ExecutiveReportComposer {
  private readonly input: ExecutiveReportComposerInput;
  private sections: string[] = [];
  private extraStyles = "";

  constructor(input: ExecutiveReportComposerInput) {
    this.input = input;
  }

  withStyles(css: string): this {
    this.extraStyles += `\n${css}`;
    return this;
  }

  header(override?: Partial<ExecutivePdfHeaderInput>): this {
    const h = buildStandardReportHeader({ ...this.input.header, ...override });
    this.sections.push(h);
    return this;
  }

  metadata(meta?: ExecutivePdfMetadata): this {
    const html = formatExecutivePdfMetadataHtml(this.input.isAr, meta);
    if (html) this.sections.push(html);
    return this;
  }

  kpis(items: ExecutiveKpiItem[], columns = 4): this {
    const html = buildExecutiveKpiGridHtml(items, columns);
    if (html) this.sections.push(`<section class="page-section" aria-label="KPI">${html}</section>`);
    return this;
  }

  narrative(lines: string[], title?: string): this {
    const html = buildExecutiveSummaryPanelHtml(this.input.isAr, lines, title);
    if (html) this.sections.push(html);
    return this;
  }

  table(schema: ExecutiveTableSchema, rows: ExecutiveTableRow[]): this {
    const { html } = buildTableFromSchema({
      schema,
      rows,
      isAr: this.input.isAr,
      orientation: this.input.orientation,
    });
    this.sections.push(
      `<section class="page-section page-section--flow"><div class="ep-table-wrap">${html}</div></section>`
    );
    return this;
  }

  charts(blockHtml: string): this {
    if (blockHtml.trim()) {
      this.sections.push(`<section class="page-section ep-charts" aria-label="charts">${blockHtml}</section>`);
    }
    return this;
  }

  raw(html: string): this {
    if (html.trim()) this.sections.push(html);
    return this;
  }

  pageBlocks(blocks: string[]): this {
    this.sections.push(...blocks.filter(Boolean));
    return this;
  }

  build(): { html: string; sectionCount: number } {
    const body = this.sections.join("\n");
    const shell = this.input.useLandscapeShell
      ? `<div class="ep-landscape-stage ep-landscape-stage--center"><div class="ep-landscape-inner">${body}</div></div>`
      : body;

    const html = buildExecutivePdfDocumentHtml({
      isAr: this.input.isAr,
      documentTitle: this.input.documentTitle,
      orientation: this.input.orientation,
      bodyHtml: shell,
      includeHeader: false,
      includeFooter: this.input.footer != null,
      footer: this.input.footer,
      wrapInPageShell: this.input.wrapInPageShell ?? !this.input.useLandscapeShell,
      extraStyles: [
        executivePdfStylesheet(this.input.isAr),
        executivePdfAccessibilityStyles(),
        this.input.useLandscapeShell ? landscapeShellDocumentStyles() : "",
        this.extraStyles,
      ].join("\n"),
    });

    return { html, sectionCount: this.sections.length };
  }
}

export const createExecutiveReportComposer = (
  input: ExecutiveReportComposerInput
): ExecutiveReportComposer => new ExecutiveReportComposer(input);
