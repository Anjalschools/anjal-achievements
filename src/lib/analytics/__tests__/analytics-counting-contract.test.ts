import { describe, expect, it } from "vitest";
import {
  buildParticipationCountingSnapshot,
  buildAnalyticsCountingDebugMeta,
} from "@/lib/analytics/analytics-counting-contract";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const sample = (): ParticipationAnalyticsPayload =>
  ({
    ok: true,
    kpis: {
      totalParticipations: 44,
      distinctStudents: 39,
      goldMedalCount: 3,
      internationalAchievementPct: 0,
      internationalSectionPct: 0,
    },
    charts: {
      resultOutcomeCompare: [
        { key: "gold", count: 3 },
        { key: "silver", count: 3 },
        { key: "bronze", count: 9 },
        { key: "participation", count: 29 },
      ],
      yearTrend: [],
      sectionParticipation: [],
      activityHorizontal: [],
      genderParticipation: [],
      mawhibaSplit: [],
      resultDistribution: [],
      levelDistribution: [],
      genderResultStack: [],
    },
    table: [{ totalParticipations: 44, distinctParticipants: 39 } as never],
    tableTotal: 1,
    tablePage: 1,
    tablePageSize: 25,
    activityOptions: [],
  }) as unknown as ParticipationAnalyticsPayload;

describe("analytics counting contract", () => {
  it("aligns medal totals with outcome chart", () => {
    const snap = buildParticipationCountingSnapshot(sample());
    expect(snap.medalWinningParticipations).toBe(15);
    expect(snap.participationCount).toBe(44);
    expect(snap.uniqueStudentsCount).toBe(39);
    expect(snap.nonMedalParticipations).toBe(29);
  });

  it("exposes debug meta for drift detection", () => {
    const meta = buildAnalyticsCountingDebugMeta(sample());
    expect(meta.kpiTotalParticipations).toBe(44);
    expect(typeof meta.inSync).toBe("boolean");
  });
});
