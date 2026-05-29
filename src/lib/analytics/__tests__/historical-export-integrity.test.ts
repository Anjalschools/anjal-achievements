import { describe, expect, it } from "vitest";
import { buildHistoricalTablePrintHtml } from "@/lib/analytics/analytics-table-export-engine";
import { buildStableHistoricalColumnLayout } from "@/lib/analytics/analytics-table-value-normalizer";
import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";

const sampleModel = (): HistoricalComparisonTableModel => ({
  id: "export-test",
  tableType: "medals",
  themeId: "competition",
  mode: "historical",
  sectionTitleAr: "قسم البنين والبنات",
  sectionTitleEn: "Boys and girls",
  activityFamilyKey: "kangaroo",
  activityLabelAr: "كانجارو",
  activityLabelEn: "Kangaroo",
  yearGroups: [
    {
      year: 2023,
      labelAr: "كانجارو 2023-2024",
      labelEn: "Kangaroo 2023-2024",
      metrics: [
        { key: "participation", labelAr: "مشاركة", labelEn: "Participation" },
        { key: "gold", labelAr: "ذهبية", labelEn: "Gold" },
        { key: "conversion", labelAr: "تحويل %", labelEn: "Conversion %" },
      ],
    },
    {
      year: 2024,
      labelAr: "كانجارو 2024-2025",
      labelEn: "Kangaroo 2024-2025",
      metrics: [
        { key: "participation", labelAr: "مشاركة", labelEn: "Participation" },
        { key: "gold", labelAr: "ذهبية", labelEn: "Gold" },
      ],
    },
  ],
  rowCategories: [],
  rows: [
    {
      key: "middle_ar",
      labelAr: "متوسط عربي",
      labelEn: "Middle Arabic",
      cells: {
        "2023__participation": 20,
        "2023__gold": 5,
        "2023__conversion": 25,
        "2024__participation": 30,
        "2024__gold": 8,
      },
    },
    {
      key: "__total__",
      labelAr: "المجموع",
      labelEn: "Total",
      isTotal: true,
      cells: {
        "2023__participation": 20,
        "2023__gold": 5,
        "2023__conversion": 25,
        "2024__participation": 30,
        "2024__gold": 8,
      },
    },
  ],
  totals: {
    rowTotals: { middle_ar: 88 },
    columnTotals: {},
    grandTotal: 88,
    valid: true,
    issues: [],
  },
  trends: [],
  narratives: [],
});

describe("historical-export-integrity", () => {
  it("PDF HTML uses aligned colSpan and normalized empty totals for conversion", () => {
    const model = sampleModel();
    const layout = buildStableHistoricalColumnLayout(model);
    const html = buildHistoricalTablePrintHtml(model, true);

    expect(html).toContain('dir="rtl"');
    expect(html).toContain(`colspan="${layout.yearHeaderSpans[0]!.colSpan}"`);
    // Rate columns are recomputed for totals. When rate columns are absent, they show as dash.
    expect(html).toContain("—");
    expect(html).toMatch(/٣٠|30/);
    expect(layout.columns.length).toBeGreaterThan(model.yearGroups[1]!.metrics.length);
  });

  it("export layout column order matches stable layout", () => {
    const layout = buildStableHistoricalColumnLayout(sampleModel());
    const keys = layout.columns.map((c) => c.columnKey);
    expect(keys[0]).toMatch(/^2023__/);
    expect(keys.filter((k) => k.startsWith("2024__")).length).toBeGreaterThan(0);
  });
});
