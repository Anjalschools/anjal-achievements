import { describe, expect, it } from "vitest";
import { buildHistoricalTablePrintHtml } from "@/lib/analytics/analytics-table-export-engine";
import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";

const sampleModel = (): HistoricalComparisonTableModel => ({
  id: "test",
  tableType: "medals",
  themeId: "competition",
  mode: "historical",
  sectionTitleAr: "قسم",
  sectionTitleEn: "Section",
  activityFamilyKey: "kangaroo",
  activityLabelAr: "كانجارو",
  activityLabelEn: "Kangaroo",
  yearGroups: [
    {
      year: 2024,
      labelAr: "كانجارو 2024",
      labelEn: "Kangaroo 2024",
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
      cells: { "2024__participation": 12, "2024__gold": 3 },
    },
    {
      key: "__total__",
      labelAr: "المجموع",
      labelEn: "Total",
      cells: { "2024__participation": 12, "2024__gold": 3 },
      isTotal: true,
    },
  ],
  totals: {
    rowTotals: { middle_ar: 15 },
    columnTotals: { "2024__participation": 12, "2024__gold": 3 },
    grandTotal: 15,
    valid: true,
    issues: [],
  },
  trends: [],
  narratives: [],
});

describe("analytics-table-export-engine", () => {
  it("builds printable HTML with RTL and grouped headers", () => {
    const html = buildHistoricalTablePrintHtml(sampleModel(), true);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("كانجارو");
    expect(html).toContain("colspan");
    expect(html).toContain("المجموع");
  });
});
