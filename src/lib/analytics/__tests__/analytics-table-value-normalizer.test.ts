import { describe, expect, it } from "vitest";
import {
  EMPTY_DASH,
  EMPTY_NA,
  buildStableHistoricalColumnLayout,
  normalizeHistoricalValue,
} from "@/lib/analytics/analytics-table-value-normalizer";
import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";

const baseModel = (): HistoricalComparisonTableModel => ({
  id: "t1",
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
      year: 2023,
      labelAr: "2023",
      labelEn: "2023",
      metrics: [
        { key: "participation", labelAr: "مشاركة", labelEn: "Participation" },
        { key: "conversion", labelAr: "تحويل", labelEn: "Conversion %" },
      ],
    },
    {
      year: 2024,
      labelAr: "2024",
      labelEn: "2024",
      metrics: [{ key: "participation", labelAr: "مشاركة", labelEn: "Participation" }],
    },
  ],
  rowCategories: [],
  rows: [
    {
      key: "middle_ar",
      labelAr: "متوسط",
      labelEn: "Middle",
      cells: { "2024__participation": 10 },
    },
  ],
  totals: {
    rowTotals: {},
    columnTotals: {},
    grandTotal: 10,
    valid: true,
    issues: [],
  },
  trends: [],
  narratives: [],
});

describe("analytics-table-value-normalizer", () => {
  it("replaces dot and invalid values with dash or zero", () => {
    expect(normalizeHistoricalValue(".", "participation", { explicitMissing: true }).display).toBe(
      EMPTY_DASH
    );
    expect(normalizeHistoricalValue(null, "participation").display).toBe("0");
    expect(normalizeHistoricalValue(NaN, "conversion").display).not.toBe(".");
    expect(normalizeHistoricalValue(undefined, "avg_performance", { isTotalRow: true }).display).toBe(
      EMPTY_NA
    );
  });

  it("aligns year groups to consistent metric columns", () => {
    const layout = buildStableHistoricalColumnLayout(baseModel());
    const years = [...new Set(layout.columns.map((c) => c.year))];
    expect(years).toHaveLength(2);
    const countsPerYear = years.map(
      (y) => layout.columns.filter((c) => c.year === y).length
    );
    expect(countsPerYear[0]).toBe(countsPerYear[1]);
    expect(layout.yearHeaderSpans.reduce((s, h) => s + h.colSpan, 0)).toBe(layout.columns.length);
  });
});
