import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";
import { groupYearsIntoPageBlocks } from "@/lib/analytics/historical-pagination-layout";
import { computeRenderingBudget } from "@/lib/analytics/adaptive-rendering-budget";
import {
  activityReportPage,
  composeExecutiveReportDocument,
  type ComposeExecutiveReportInput,
} from "@/lib/analytics/export/analytics-executive-report-layout";
import { continuationBanner } from "@/lib/analytics/export/analytics-report-pagination";

export const composeHistoricalTablesReport = (input: {
  isAr: boolean;
  title: string;
  subtitle: string;
  generatedAt: string;
  tables: HistoricalComparisonTableModel[];
  renderTableHtml: (model: HistoricalComparisonTableModel, yearBlockId?: string) => string;
  summary?: ComposeExecutiveReportInput["summary"];
}): string => {
  const sections = input.tables.flatMap((table) => {
    const budget = computeRenderingBudget(table, "executive");
    const blocks = groupYearsIntoPageBlocks(
      table.yearGroups,
      budget.recommendedYearsPerBlock
    );
    return blocks.map((block, bi) => ({
      id: `hist-${table.id}-${block.id}`,
      titleAr: `${table.activityLabelAr} (${block.labelAr})`,
      titleEn: `${table.activityLabelEn} (${block.labelEn})`,
      html: activityReportPage({
        isAr: input.isAr,
        activityLabel: input.isAr ? table.activityLabelAr : table.activityLabelEn,
        yearLabel: input.isAr ? block.labelAr : block.labelEn,
        tableHtml: input.renderTableHtml(table, block.id),
        continuation:
          blocks.length > 1
            ? continuationBanner(input.isAr, bi + 1, blocks.length)
            : undefined,
      }),
      landscape: true,
    }));
  });

  return composeExecutiveReportDocument({
    isAr: input.isAr,
    title: input.title,
    subtitle: input.subtitle,
    generatedAt: input.generatedAt,
    summary: input.summary,
    sections,
  });
};

export const openExecutiveReportPrintWindow = (html: string): void => {
  void import("@/lib/pdf/executive-pdf-print").then(({ printExecutivePdfHtml }) => {
    void printExecutivePdfHtml(html);
  });
};
