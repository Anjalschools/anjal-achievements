import { describe, expect, it } from "vitest";
import { buildRealHistoricalTotals, appendRealTotalsRow } from "@/lib/analytics/analytics-real-total-engine";

describe("analytics-real-total-engine", () => {
  it("recomputes rate columns instead of summing them", () => {
    const rows = [
      { key: "a", labelAr: "A", labelEn: "A", cells: { "2023__participation": 100, "2023__award_winners": 10, "2023__award_rate": 10 } },
      { key: "b", labelAr: "B", labelEn: "B", cells: { "2023__participation": 50, "2023__award_winners": 5, "2023__award_rate": 10 } },
    ];
    const totals = buildRealHistoricalTotals(rows);
    expect(totals.columnTotals["2023__participation"]).toBe(150);
    expect(totals.columnTotals["2023__award_winners"]).toBe(15);
    // 15 / 150 = 10%
    expect(totals.columnTotals["2023__award_rate"]).toBe(10);
  });

  it("appends totals row with computed totals", () => {
    const rows = [{ key: "a", labelAr: "A", labelEn: "A", cells: { "2023__participation": 2 } }];
    const out = appendRealTotalsRow(rows, "المجموع", "Total");
    expect(out).toHaveLength(2);
    expect(out[1]!.key).toBe("__total__");
    expect(out[1]!.cells["2023__participation"]).toBe(2);
  });
});

