import { describe, expect, it } from "vitest";
import { buildHallOfFameShowcase } from "@/lib/analytics/student-intelligence-insights";
import type { StudentIntelligencePayload } from "@/lib/student-intelligence-analytics";

const samplePayload = (): StudentIntelligencePayload => ({
  ok: true,
  generatedAt: new Date().toISOString(),
  filters: {},
  byWeightedScore: [],
  byParticipation: [
    {
      participantId: "p1",
      nameAr: "أحمد",
      nameEn: "Ahmad",
      avatarUrl: "",
      school: "الأنجال",
      stageKey: "middle",
      stageLabelAr: "متوسط",
      stageLabelEn: "Middle",
      sectionKey: "arabic",
      mawhiba: true,
      recordCount: 5,
      medalCount: 3,
      medalRatioPct: 60,
      distinctActivityCount: 2,
    },
  ],
  byMedals: [
    {
      participantId: "p1",
      nameAr: "أحمد",
      nameEn: "Ahmad",
      avatarUrl: "",
      school: "الأنجال",
      stageKey: "middle",
      stageLabelAr: "متوسط",
      stageLabelEn: "Middle",
      sectionKey: "arabic",
      mawhiba: true,
      recordCount: 5,
      medalCount: 3,
      medalRatioPct: 60,
      distinctActivityCount: 2,
    },
  ],
  bySuccessRate: [],
  byActivityDiversity: [],
  byFastestGrowth: [],
});

describe("student intelligence insights", () => {
  it("builds hero with narrative and badges", () => {
    const showcase = buildHallOfFameShowcase(samplePayload(), {
      topActivityLabelAr: "كانجارو",
      topActivityLabelEn: "Kangaroo",
      locale: "ar",
    });
    expect(showcase.hero).not.toBeNull();
    expect(showcase.hero!.badges.length).toBeGreaterThan(0);
    expect(showcase.hero!.narrativeAr.length).toBeGreaterThan(10);
  });
});
