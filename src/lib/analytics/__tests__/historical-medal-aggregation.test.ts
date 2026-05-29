import { describe, expect, it } from "vitest";
import { aggregateMedalsFromRows } from "@/lib/analytics/historical-medal-aggregation";
import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";

describe("historical-medal-aggregation", () => {
  it("sums row medal counts", () => {
    const rows = [
      { goldMedalCount: 2, silverMedalCount: 1, bronzeMedalCount: 0, totalParticipations: 5 },
      { goldMedalCount: 1, silverMedalCount: 0, bronzeMedalCount: 1, totalParticipations: 3 },
    ] as ParticipationActivityRow[];
    const m = aggregateMedalsFromRows(rows);
    expect(m.gold).toBe(3);
    expect(m.total).toBe(5);
  });

  it("infers gold from result label when counts zero", () => {
    const rows = [
      {
        goldMedalCount: 0,
        silverMedalCount: 0,
        bronzeMedalCount: 0,
        totalParticipations: 4,
        participationResultKey: "medal:gold",
        participationResultAr: "ذهبية",
        participationResultEn: "Gold medal",
      },
    ] as ParticipationActivityRow[];
    const m = aggregateMedalsFromRows(rows);
    expect(m.fromSemanticInference).toBeGreaterThan(0);
    expect(m.gold).toBeGreaterThan(0);
  });
});
