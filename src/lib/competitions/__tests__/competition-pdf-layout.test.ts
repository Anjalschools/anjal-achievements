import { describe, expect, it } from "vitest";
import { buildCompetitionTableFromRecords } from "@/lib/analytics/competition-table-engine";
import { competitionConfigByKey } from "@/lib/competitions/competition-configs";
import {
  buildCompetitionPdfLayoutPlan,
  chunkCompetitionYearGroups,
  COMPETITION_PDF_PAGE,
  maxYearsPerChunk,
  METRIC_NUMERIC_MIN_MM,
  resolveCompetitionPdfOrientation,
  STAGE_COLUMN_WIDTH_MM,
} from "@/lib/competitions/export/competition-pdf-layout-engine";
import {
  buildCompetitionTablePrintHtml,
  composePageComposition,
  estimateTableHeightMm,
  PDF_PAGE_COMPOSITION,
} from "@/lib/competitions/export/competition-pdf-document";

const medalModel = (years: number[]) => {
  const config = competitionConfigByKey("kangaroo")!;
  const records = years.flatMap((year) =>
    ["primary_ar", "middle_ar"].flatMap((rowKey) =>
      ["participants", "gold", "silver", "bronze"].map((columnKey) => ({
        competitionKey: "kangaroo",
        year,
        rowKey: rowKey as "primary_ar",
        columnKey,
        count: 5 + year % 3,
      }))
    )
  );
  return buildCompetitionTableFromRecords({ config, years, records });
};

describe("competition-pdf-layout-engine", () => {
  it("returns empty chunks for model without years", () => {
    const config = competitionConfigByKey("kangaroo")!;
    const model = buildCompetitionTableFromRecords({ config, years: [], records: [] });
    const plan = buildCompetitionPdfLayoutPlan(model);
    expect(plan.chunks).toHaveLength(0);
  });

  it("uses portrait for 2 years with few columns", () => {
    const model = medalModel([2023, 2024])!;
    expect(resolveCompetitionPdfOrientation(model)).toBe("portrait");
    const plan = buildCompetitionPdfLayoutPlan(model);
    expect(plan.chunks.length).toBe(1);
    expect(plan.chunks[0]!.stageWidthMm).toBeGreaterThanOrEqual(30);
  });

  it("handles 4 years in landscape with stable headers", () => {
    const model = medalModel([2022, 2023, 2024, 2025])!;
    const plan = buildCompetitionPdfLayoutPlan(model);
    expect(plan.orientation).toBe("landscape");
    expect(plan.chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("uses landscape and chunks for 7 years", () => {
    const model = medalModel([2019, 2020, 2021, 2022, 2023, 2024, 2025])!;
    const plan = buildCompetitionPdfLayoutPlan(model);
    expect(plan.orientation).toBe("landscape");
    expect(plan.chunks.length).toBeGreaterThan(1);
    expect(plan.totalYears).toBe(7);
  });

  it("chunks year groups without losing years (greedy width)", () => {
    const model = medalModel([2020, 2021, 2022, 2023, 2024])!;
    const chunks = chunkCompetitionYearGroups(model.yearGroups, "landscape");
    const years = chunks.flatMap((c) => c.map((y) => y.year));
    expect(years).toEqual(model.years);
    expect(maxYearsPerChunk(model.yearGroups, "landscape")).toBeGreaterThanOrEqual(1);
  });

  it("keeps each chunk within printable width at natural column sizes", () => {
    const model = medalModel([2019, 2020, 2021, 2022, 2023, 2024, 2025])!;
    const plan = buildCompetitionPdfLayoutPlan(model);
    const usable = COMPETITION_PDF_PAGE[plan.orientation].usableWidthMm;

    for (const chunk of plan.chunks) {
      expect(chunk.tableWidthMm).toBeLessThanOrEqual(usable + 1);
      expect(chunk.tableWidthMm).toBeGreaterThan(STAGE_COLUMN_WIDTH_MM);
      expect(chunk.fontSizePx).toBeGreaterThanOrEqual(10);
      for (const yg of chunk.yearGroupLayouts) {
        for (const col of yg.columns) {
          expect(col.widthMm).toBeGreaterThanOrEqual(METRIC_NUMERIC_MIN_MM - 0.5);
        }
      }
    }
  });

  it("expands narrow tables toward usable width", () => {
    const model = medalModel([2024, 2025])!;
    const plan = buildCompetitionPdfLayoutPlan(model);
    const usable = COMPETITION_PDF_PAGE[plan.orientation].usableWidthMm;
    const chunk = plan.chunks[0]!;
    expect(chunk.tableWidthMm).toBeGreaterThan(usable * 0.75);
  });
});

describe("competition-pdf-document", () => {
  it("renders RTL executive HTML with colgroup and thead repeat", () => {
    const model = medalModel([2023, 2024, 2025, 2026])!;
    const html = buildCompetitionTablePrintHtml(model, true, {
      sectionTitleAr: "قسم البنين والبنات",
    });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("<colgroup>");
    expect(html).toContain('display: table-header-group');
    expect(html).toContain("ct-kpi-grid");
    expect(html).toContain("ct-row-total");
    expect(html).toContain("table-layout: fixed");
    expect(html).toContain("ct-year-sep");
    expect(html).toContain('font-size:10px');
  });

  it("includes metadata and KPI labels in Arabic", () => {
    const model = medalModel([2024, 2025])!;
    const html = buildCompetitionTablePrintHtml(model, true);
    expect(html).toContain("جودة النتائج");
    expect(html).toContain("تاريخ التصدير");
    expect(html).toContain("كانجارو");
  });

  it("uses print composition pages with balanced continuation layout", () => {
    const model = medalModel([2019, 2020, 2021, 2022, 2023, 2024, 2025])!;
    const html = buildCompetitionTablePrintHtml(model, true);
    expect(html).toContain("ct-print-page");
    expect(html).toContain("ct-page-inner");
    expect(html).toContain("ct-table-stage");
    expect(html).toContain("ct-page-footer");
    expect(html).toContain("margin: 14mm 10mm");
    expect(html).toContain("ct-print-page--continuation");
  });
});

describe("PDF_PAGE_COMPOSITION", () => {
  it("centers sparse continuation pages vertically", () => {
    const plan = composePageComposition({
      orientation: "landscape",
      role: "continuation",
      rowCount: 7,
      tableHeightMm: estimateTableHeightMm(7),
      includeHeader: false,
      includeKpi: false,
      chunkIndex: 1,
      chunkTotal: 2,
    });
    expect(plan.pageClass).toContain("ct-print-page--balanced");
    expect(plan.tableStageStyle).toContain("justify-content:center");
  });

  it("defines print margins within unified executive spec", () => {
    expect(PDF_PAGE_COMPOSITION.margins.landscape.topMm).toBe(14);
    expect(PDF_PAGE_COMPOSITION.margins.landscape.bottomMm).toBe(14);
    expect(PDF_PAGE_COMPOSITION.margins.landscape.sideMm).toBe(10);
  });
});
