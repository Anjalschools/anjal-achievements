import { describe, expect, it } from "vitest";
import { buildActivityConcentrationIntelligence } from "@/lib/analytics/activity-concentration-intelligence";
import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";

const row = (overrides: Partial<ParticipationActivityRow> = {}): ParticipationActivityRow =>
  ({
    activityKey: "olympiad",
    activityLabelAr: "أولمبياد علوم",
    activityLabelEn: "Science Olympiad",
    typeKey: "olympiad",
    typeLabelAr: "أولمبياد",
    typeLabelEn: "Olympiad",
    totalParticipations: 40,
    distinctParticipants: 35,
    arabicParticipants: 10,
    internationalParticipants: 5,
    maleParticipants: 20,
    femaleParticipants: 20,
    mawhibaParticipants: 32,
    nonMawhibaParticipants: 8,
    goldMedalCount: 2,
    silverMedalCount: 1,
    bronzeMedalCount: 0,
    rankCount: 0,
    approvedAchievements: 3,
    excellenceRatePct: 5,
    levelLabelAr: "G10",
    levelLabelEn: "G10",
    ...overrides,
  }) as ParticipationActivityRow;

describe("activity-concentration-intelligence", () => {
  it("detects mawhiba dominance in olympiad activities", () => {
    const rows = buildActivityConcentrationIntelligence([row()], 5);
    expect(rows[0]?.dominantKind).toBe("mawhiba");
    expect(rows[0]?.dominantPct).toBeGreaterThanOrEqual(75);
    expect(rows[0]?.narrativeEn).toMatch(/Olympiad|Mawhiba/i);
  });

  it("provides diversity recommendations", () => {
    const rows = buildActivityConcentrationIntelligence([row()], 5);
    expect(rows[0]?.recommendationAr.length).toBeGreaterThan(10);
    expect(rows[0]?.recommendationEn.length).toBeGreaterThan(10);
  });

  it("detects international dominance for SAT-like activities", () => {
    const sat = row({
      activityKey: "sat",
      activityLabelAr: "SAT",
      activityLabelEn: "SAT",
      totalParticipations: 30,
      internationalParticipants: 25,
      arabicParticipants: 5,
      mawhibaParticipants: 10,
      nonMawhibaParticipants: 20,
    });
    const rows = buildActivityConcentrationIntelligence([sat], 3);
    expect(rows[0]?.dominantLabelEn).toBe("International");
    expect(rows[0]?.narrativeEn).toMatch(/SAT|International/i);
  });
});
