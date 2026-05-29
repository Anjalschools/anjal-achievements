import { describe, expect, it } from "vitest";
import {
  extractMedalIntelligence,
  hasMedalSignal,
  MEDAL_AWARD_WEIGHTS,
} from "@/lib/analytics/historical-medal-intelligence";
import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";

const rows = (): ParticipationActivityRow[] => [
  {
    goldMedalCount: 3,
    silverMedalCount: 2,
    bronzeMedalCount: 1,
    nominationCount: 4,
    approvedAchievements: 1,
    totalParticipations: 20,
    participationResultKey: "gold",
    participationResultAr: "ذهب",
    participationResultEn: "Gold",
  } as ParticipationActivityRow,
];

describe("historical-medal-intelligence", () => {
  it("computes weighted medal total", () => {
    const m = extractMedalIntelligence(rows());
    expect(m.total).toBe(6);
    expect(m.weightedTotal).toBe(
      3 * MEDAL_AWARD_WEIGHTS.gold + 2 * MEDAL_AWARD_WEIGHTS.silver + 1
    );
  });

  it("detects medal signal", () => {
    expect(hasMedalSignal(rows())).toBe(true);
    expect(hasMedalSignal([{ goldMedalCount: 0, silverMedalCount: 0, bronzeMedalCount: 0, nominationCount: 0, totalParticipations: 5 } as ParticipationActivityRow])).toBe(false);
  });
});
