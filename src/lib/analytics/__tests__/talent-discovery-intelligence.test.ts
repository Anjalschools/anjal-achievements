import { describe, expect, it } from "vitest";
import {
  buildTalentDiscoveryRecommendations,
  buildTalentDiscoverySignals,
} from "@/lib/analytics/talent-discovery-intelligence";
import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";

const row = (overrides: Partial<ParticipationActivityRow> = {}): ParticipationActivityRow =>
  ({
    activityKey: "olympiad",
    activityLabelAr: "أولمبياد رياضيات",
    activityLabelEn: "Math Olympiad",
    totalParticipations: 30,
    distinctParticipants: 25,
    maleParticipants: 15,
    femaleParticipants: 15,
    arabicParticipants: 22,
    internationalParticipants: 8,
    mawhibaParticipants: 20,
    nonMawhibaParticipants: 10,
    goldMedalCount: 6,
    silverMedalCount: 4,
    bronzeMedalCount: 3,
    rankCount: 0,
    approvedAchievements: 5,
    excellenceRatePct: 18,
    levelLabelAr: "أول ثانوي",
    levelLabelEn: "Grade 10",
    typeKey: "olympiad",
    typeLabelAr: "أولمبياد",
    typeLabelEn: "Olympiad",
    ...overrides,
  }) as ParticipationActivityRow;

describe("talent-discovery-intelligence", () => {
  it("detects conversion lift signals", () => {
    const signals = buildTalentDiscoverySignals([row()]);
    expect(signals.some((s) => s.kind === "conversion_lift")).toBe(true);
  });

  it("generates talent recommendations with confidence", () => {
    const signals = buildTalentDiscoverySignals([row(), row({ activityKey: "bebras", activityLabelEn: "Bebras" })]);
    const recs = buildTalentDiscoveryRecommendations([row()], signals);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]?.confidence).toBeGreaterThan(0.5);
  });
});
