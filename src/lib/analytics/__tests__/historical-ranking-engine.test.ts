import { describe, expect, it } from "vitest";
import { extractRankingIntelligence, rankingMetricValue } from "@/lib/analytics/historical-ranking-engine";
import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";

describe("historical-ranking-engine", () => {
  it("counts ranks and first place", () => {
    const rows = [
      {
        rankCount: 3,
        levelKey: "kingdom",
        participationResultKey: "first",
        participationResultAr: "مركز أول",
        participationResultEn: "First place",
      },
      {
        rankCount: 1,
        levelKey: "international",
        participationResultKey: "rank",
        participationResultAr: "مركز",
        participationResultEn: "Rank",
      },
    ] as ParticipationActivityRow[];
    const r = extractRankingIntelligence(rows);
    expect(r.rankCount).toBe(4);
    expect(r.firstPlace).toBeGreaterThan(0);
    expect(r.internationalRanking).toBe(1);
    expect(rankingMetricValue(rows, "rankings")).toBe(4);
  });
});
