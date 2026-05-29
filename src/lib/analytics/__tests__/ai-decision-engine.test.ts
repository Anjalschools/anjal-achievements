import { describe, expect, it } from "vitest";
import { buildAiExecutiveDecisions } from "@/lib/analytics/ai/ai-decision-engine";
import { invalidateAiDecisionCache } from "@/lib/analytics/ai/ai-decision-cache";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const minimalPayload = (): ParticipationAnalyticsPayload =>
  ({
    ok: true,
    generatedAt: new Date().toISOString(),
    filters: {},
    kpis: {
      totalParticipations: 100,
      distinctStudents: 40,
      goldMedalCount: 5,
      femalePct: 45,
      internationalSectionPct: 10,
    },
    charts: {
      yearTrend: [],
      resultOutcomeCompare: [],
      genderParticipation: [],
      sectionParticipation: [],
      mawhibaSplit: [],
      resultDistribution: [],
      levelDistribution: [],
      genderResultStack: [],
      topPrograms: [],
      activityHorizontal: [],
    },
    table: [],
    tableTotal: 0,
    page: 1,
    pageSize: 25,
    activityOptions: [],
    focusedActivity: null,
  }) as unknown as ParticipationAnalyticsPayload;

describe("ai-decision-engine", () => {
  it("produces bounded deterministic decisions", () => {
    invalidateAiDecisionCache();
    const result = buildAiExecutiveDecisions({
      filterFingerprint: "test-fp",
      general: minimalPayload(),
      insights: {
        insights: [
          {
            id: "low_equity",
            severity: "warn",
            confidence: 0.7,
            titleAr: "فجوة",
            titleEn: "Gap",
            bodyAr: "فجوة عدالة",
            bodyEn: "Equity gap",
            metricKeys: ["equity"],
          },
        ],
        hasData: true,
      },
      narratives: [],
      strategicInsights: [],
      useCache: false,
    });
    expect(result.bundle.decisions.length).toBeGreaterThan(0);
    expect(result.bundle.decisions.length).toBeLessThanOrEqual(24);
    expect(result.boardSummary.headlineEn.length).toBeGreaterThan(0);
  });
});
