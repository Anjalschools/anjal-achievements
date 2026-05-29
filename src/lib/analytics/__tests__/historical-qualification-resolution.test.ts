import { describe, expect, it } from "vitest";
import { resolveQualificationFromRows } from "@/lib/analytics/historical-qualification-resolution";

describe("historical-qualification-resolution", () => {
  it("resolves nomination and acceptance", () => {
    const q = resolveQualificationFromRows(
      [
        { nominationCount: 4, approvedAchievements: 2, totalParticipations: 10 },
      ] as never,
      10
    );
    expect(q.qualified).toBe(4);
    expect(q.accepted).toBe(2);
    expect(q.qualificationRate).toBe(40);
  });
});
