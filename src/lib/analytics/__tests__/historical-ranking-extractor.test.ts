import { describe, expect, it } from "vitest";
import { extractRankingsFromRows } from "@/lib/analytics/historical-ranking-extractor";

describe("historical-ranking-extractor", () => {
  it("uses KPI first place fallback", () => {
    const r = extractRankingsFromRows(
      [
        {
          rankCount: 0,
          participationResultKey: "participation",
          participationResultAr: "مشاركة",
          participationResultEn: "Participation",
          levelKey: "school",
        },
      ] as never,
      { firstPlaceCount: 3 } as never
    );
    expect(r.fromKpiFallback).toBe(true);
    expect(r.firstPlace).toBe(3);
  });
});
