import { describe, expect, it } from "vitest";
import { appendTotalsRow, buildTableTotals } from "@/lib/analytics/analytics-table-total-contract";

describe("analytics-table-total-contract", () => {
  it("validates consistent row and column totals", () => {
    const rows = [
      { key: "a", cells: { y2023_gold: 2, y2023_silver: 1 } },
      { key: "b", cells: { y2023_gold: 3, y2023_silver: 0 } },
    ];
    const totals = buildTableTotals(rows);
    expect(totals.valid).toBe(true);
    expect(totals.rowTotals.a).toBe(3);
    expect(totals.columnTotals.y2023_gold).toBe(5);
    expect(totals.grandTotal).toBe(6);
  });

  it("appends totals row", () => {
    const rows = [{ key: "a", labelAr: "أ", labelEn: "A", cells: { c1: 4 } }];
    const out = appendTotalsRow(rows, "المجموع", "Total");
    expect(out).toHaveLength(2);
    expect(out[1]!.isTotal).toBe(true);
    expect(out[1]!.cells.c1).toBe(4);
  });
});
