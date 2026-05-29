import { describe, expect, it } from "vitest";
import {
  metricValueForPerspective,
  totalColumnLabel,
  ANALYTICS_COUNT_PERSPECTIVES,
} from "@/lib/analytics/analytics-perspective";
import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";

const row = (): ParticipationActivityRow =>
  ({
    activityKey: "kangaroo",
    activityLabelAr: "كانجارو",
    activityLabelEn: "Kangaroo",
    typeKey: "competition",
    typeLabelAr: "مسابقة",
    typeLabelEn: "Competition",
    totalParticipations: 120,
    distinctParticipants: 80,
    approvedAchievements: 15,
    goldMedalCount: 5,
    silverMedalCount: 3,
    bronzeMedalCount: 2,
    rankCount: 4,
    maleParticipants: 60,
    femaleParticipants: 60,
    arabicParticipants: 70,
    internationalParticipants: 50,
    mawhibaParticipants: 40,
    nonMawhibaParticipants: 80,
    excellenceRatePct: 10,
  }) as ParticipationActivityRow;

describe("analytics-perspective", () => {
  it("exposes five counting perspectives", () => {
    expect(ANALYTICS_COUNT_PERSPECTIVES).toHaveLength(5);
  });

  it("maps participation perspective to total participations", () => {
    const r = row();
    expect(metricValueForPerspective(r, "participation")).toBe(120);
    expect(totalColumnLabel("participation", "ar")).toContain("مشاركات");
  });

  it("maps student perspective to distinct participants", () => {
    expect(metricValueForPerspective(row(), "student")).toBe(80);
    expect(totalColumnLabel("student", "en").toLowerCase()).toContain("student");
  });

  it("maps result perspective to medals plus ranks", () => {
    expect(metricValueForPerspective(row(), "result")).toBe(14);
  });
});
