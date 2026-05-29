import { describe, expect, it } from "vitest";
import { dedupeActivityTotalRow, orderHistoricalRows } from "@/lib/analytics/historical-table-row-semantics";

describe("historical-table-row-semantics", () => {
  it("removes activity_total when it duplicates scope rows", () => {
    const rows = [
      { key: "scope_arabic", labelAr: "عربي", labelEn: "Arabic", cells: { "2023__participation": 5 } },
      { key: "scope_international", labelAr: "دولي", labelEn: "International", cells: { "2023__participation": 5 } },
      { key: "activity_total", labelAr: "إجمالي النشاط", labelEn: "Activity total", cells: { "2023__participation": 10 } },
    ];
    const out = dedupeActivityTotalRow(rows);
    expect(out.some((r) => r.key === "activity_total")).toBe(false);
    expect(out).toHaveLength(2);
  });

  it("orders activity then scope then stage then total", () => {
    const rows = [
      { key: "__total__", labelAr: "المجموع", labelEn: "Total", cells: {} },
      { key: "stage_primary", labelAr: "ابتدائي", labelEn: "Primary", cells: {} },
      { key: "scope_arabic", labelAr: "عربي", labelEn: "Arabic", cells: {} },
      { key: "activity_total", labelAr: "إجمالي النشاط", labelEn: "Activity total", cells: {} },
    ];
    const out = orderHistoricalRows(rows);
    expect(out.map((r) => r.key)).toEqual(["activity_total", "scope_arabic", "stage_primary", "__total__"]);
  });
});

