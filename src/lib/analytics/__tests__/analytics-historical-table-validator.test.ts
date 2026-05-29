import { describe, expect, it } from "vitest";
import {
  buildSafeHistoricalModel,
  isDrillPayloadValid,
  validateHistoricalTableModel,
} from "@/lib/analytics/analytics-historical-table-validator";
import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";

const model = (): HistoricalComparisonTableModel => ({
  id: "v1",
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
      labelAr: "2024",
      labelEn: "2024",
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
      labelAr: "متوسط",
      labelEn: "Middle",
      cells: { "2024__participation": 8, "2024__gold": 2 },
    },
    {
      key: "__total__",
      labelAr: "المجموع",
      labelEn: "Total",
      isTotal: true,
      cells: { "2024__participation": 8, "2024__gold": 2 },
    },
  ],
  totals: {
    rowTotals: { middle_ar: 10 },
    columnTotals: { "2024__participation": 8, "2024__gold": 2 },
    grandTotal: 10,
    valid: true,
    issues: [],
  },
  trends: [],
  narratives: [],
});

describe("analytics-historical-table-validator", () => {
  it("validates consistent totals and layout", () => {
    const result = validateHistoricalTableModel(model());
    expect(result.canRender).toBe(true);
    expect(result.layoutColumnCount).toBeGreaterThanOrEqual(2);
  });

  it("flags orphan cells", () => {
    const m = model();
    m.rows[0]!.cells["2099__participation"] = 1;
    const result = validateHistoricalTableModel(m);
    expect(result.issues.some((i) => i.code === "orphan_cell")).toBe(true);
  });

  it("buildSafeHistoricalModel fills missing keys", () => {
    const safe = buildSafeHistoricalModel(model());
    expect(safe.rows[0]!.cells["2024__gold"]).toBe(2);
  });

  it("rejects invalid drill payloads", () => {
    expect(
      isDrillPayloadValid({ year: 2024, metricKey: "gold", rowKey: "__total__", value: 1 })
    ).toBe(false);
  });
});
