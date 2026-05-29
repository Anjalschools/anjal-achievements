import { describe, expect, it } from "vitest";
import {
  HISTORICAL_ACTIVITY_TAXONOMY,
  normalizeActivitySlug,
  taxonomyById,
} from "@/lib/analytics/historical-activity-taxonomy";
import { resolveActivityForRow } from "@/lib/analytics/historical-activity-resolution";
import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";

const row = (overrides: Partial<ParticipationActivityRow>): ParticipationActivityRow =>
  ({
    activityKey: "k1",
    activityLabelAr: "كانجارو",
    activityLabelEn: "Kangaroo Math 2024",
    typeKey: "kangaroo",
    typeLabelAr: "مسابقة",
    typeLabelEn: "Competition",
    classificationKey: "c",
    classificationLabelAr: "c",
    classificationLabelEn: "c",
    levelKey: "school",
    levelLabelAr: "مدرسة",
    levelLabelEn: "School",
    participationResultKey: "gold",
    participationResultAr: "ذهب",
    participationResultEn: "Gold",
    totalParticipations: 10,
    distinctParticipants: 8,
    maleParticipants: 5,
    femaleParticipants: 3,
    arabicParticipants: 8,
    internationalParticipants: 2,
    mawhibaParticipants: 1,
    nonMawhibaParticipants: 7,
    goldMedalCount: 2,
    silverMedalCount: 1,
    bronzeMedalCount: 0,
    rankCount: 1,
    nominationCount: 0,
    participationOnlyCount: 5,
    approvedAchievements: 2,
    excellenceRatePct: 40,
    ...overrides,
  }) as ParticipationActivityRow;

describe("historical-activity-taxonomy", () => {
  it("maps kangaroo aliases to same canonical id", () => {
    const r1 = row({ typeKey: "kangaroo" });
    const r2 = row({
      typeKey: "competition",
      activityLabelEn: "kangaroo-2024 competition",
      activityLabelAr: "مسابقة كانجارو",
    });
    expect(resolveActivityForRow(r1)?.id).toBe("kangaroo");
    expect(resolveActivityForRow(r2)?.id).toBe("kangaroo");
  });

  it("normalizes legacy slugs", () => {
    expect(normalizeActivitySlug("Kangaroo Math 2024")).toBe("kangaroo_math_2024");
    expect(taxonomyById("bebras")?.legacySlugs.length).toBeGreaterThan(0);
  });

  it("covers all competition families in taxonomy", () => {
    const ids = HISTORICAL_ACTIVITY_TAXONOMY.map((t) => t.id);
    expect(ids).toContain("kangaroo");
    expect(ids).toContain("bebras");
    expect(ids).toContain("sat");
  });
});
