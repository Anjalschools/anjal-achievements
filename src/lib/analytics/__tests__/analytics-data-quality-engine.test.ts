import { describe, expect, it } from "vitest";
import { auditHistoricalTableQuality } from "@/lib/analytics/analytics-data-quality-engine";

describe("analytics-data-quality-engine", () => {
  it("flags duplicate rows", () => {
    const model = {
      rows: [
        { key: "a", labelAr: "A", labelEn: "A", cells: {}, isTotal: false },
        { key: "a", labelAr: "A2", labelEn: "A2", cells: {}, isTotal: false },
      ],
      yearGroups: [],
      unifiedGraph: { totals: { participants: 0, award_winners: 0 }, byYear: {}, signals: {} },
      totals: { valid: true },
    } as any;
    const issues = auditHistoricalTableQuality(model);
    expect(issues.some((i) => i.code === "duplicate_row")).toBe(true);
  });
});

