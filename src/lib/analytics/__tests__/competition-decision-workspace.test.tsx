import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CompetitionDecisionWorkspace } from "@/components/admin/CompetitionDecisionWorkspace";

describe("competition-decision-workspace", () => {
  it("renders decision header and narrative", () => {
    const html = renderToStaticMarkup(
      <CompetitionDecisionWorkspace
        isAr={false}
        report={
          {
            ok: true,
            generatedAt: new Date().toISOString(),
            filters: {},
            focusType: "activity",
            focusRaw: "x",
            activityLabelAr: "رياضيات",
            activityLabelEn: "Math",
            focusedOutcome: "all",
            kpis: { totalRecords: 1, distinctStudents: 1, approvedRecords: 1, excellenceRatePct: 0 },
            charts: { resultBars: [], genderPie: [], sectionPie: [], mawhibaPie: [], yearTrend: [] },
            executive: {
              kpiCards: [],
              yearComparison: [],
              demographicStacks: { sectionGender: [], stageBreakdown: [], mawhibaGender: [] },
              topPerformers: { byWeighted: [], byParticipation: [], byMedals: [], byLevel: [] },
            },
            decisionPlatform: {
              narrativeAr: "نص",
              narrativeEn: "Narrative",
              alerts: [],
              recommendations: [],
              medalIntelligence: {
                medalsPer100Records: 0,
                goldPer100Records: 0,
                nominationsPer100Records: 0,
                participationOnlyRatio: 0,
                heatLabelAr: "",
                heatLabelEn: "",
                heatScore: 0,
                bars: [],
              },
              benchmarkIntelligence: {
                peerCount: 0,
                peerMedianMedalsPer100: 0,
                peerMedianNominationsPer100: 0,
                peerMedianAcceptanceRate: 0,
                labelAr: "",
                labelEn: "",
                comparisonAr: "",
                comparisonEn: "",
                rows: [],
              },
              activityRanking: {
                rows: [],
                narrativeAr: "",
                narrativeEn: "",
                current: {
                  rankExcellence: null,
                  rankMedalDensity: null,
                  peerCount: 0,
                },
                topByExcellence: [],
                topByMedalDensity: [],
                highParticipationLowMedal: [],
                topInternationalShare: [],
              },
            },
            participants: [],
          } as any
        }
      />
    );

    expect(html).toContain("Competition decisions");
    expect(html).toContain("Narrative");
  });
});

