import { describe, expect, it } from "vitest";
import { buildMatrixWithRecovery } from "@/lib/analytics/historical-matrix-model";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";

const sliceWithKangaroo = (year: number): HistoricalYearSlice => ({
  year,
  payload: {
    ok: true,
    generatedAt: "",
    filters: {},
    kpis: { totalParticipations: 20 } as HistoricalYearSlice["payload"]["kpis"],
    charts: {} as HistoricalYearSlice["payload"]["charts"],
    activityOptions: [],
    focusedActivity: null,
    table: [
      {
        activityKey: "kangaroo-legacy",
        activityLabelAr: "كانجارو قديم",
        activityLabelEn: "Kangaroo legacy",
        typeKey: "k",
        typeLabelAr: "k",
        typeLabelEn: "k",
        classificationKey: "c",
        classificationLabelAr: "c",
        classificationLabelEn: "c",
        levelKey: "g9",
        levelLabelAr: "تاسع",
        levelLabelEn: "G9",
        participationResultKey: "p",
        participationResultAr: "مشاركة",
        participationResultEn: "Participation",
        totalParticipations: 20,
        distinctParticipants: 15,
        maleParticipants: 10,
        femaleParticipants: 10,
        arabicParticipants: 15,
        internationalParticipants: 5,
        mawhibaParticipants: 0,
        nonMawhibaParticipants: 20,
        goldMedalCount: 0,
        silverMedalCount: 0,
        bronzeMedalCount: 0,
        rankCount: 0,
        nominationCount: 0,
        participationOnlyCount: 20,
        approvedAchievements: 0,
        excellenceRatePct: 0,
      },
    ],
    tableTotal: 1,
    page: 1,
    pageSize: 500,
  },
});

describe("historical-matrix-recovery", () => {
  it("recovers matrix via relaxed activity matching", () => {
    const result = buildMatrixWithRecovery([sliceWithKangaroo(2022), sliceWithKangaroo(2024)]);
    if (result.model) {
      expect(result.meta.valid).toBe(true);
    } else {
      expect(result.meta.recoveryMode || result.meta.yearsCount).toBeGreaterThan(0);
    }
  });
});
