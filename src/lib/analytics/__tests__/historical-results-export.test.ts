import { describe, expect, it } from "vitest";
import { buildHistoricalTablePrintHtml } from "@/lib/analytics/analytics-table-export-engine";
import {
  ACTIVITY_FAMILIES,
  buildHistoricalComparisonTable,
} from "@/lib/analytics/historical-comparison-table-engine";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const slice = (year: number): { year: number; payload: ParticipationAnalyticsPayload } => ({
  year,
  payload: {
    ok: true,
    generatedAt: "",
    filters: {},
    kpis: { totalParticipations: 50 } as ParticipationAnalyticsPayload["kpis"],
    charts: {} as ParticipationAnalyticsPayload["charts"],
    activityOptions: [],
    focusedActivity: null,
    table: [
      {
        activityLabelAr: "بيبراس",
        activityLabelEn: "Bebras",
        typeKey: "bebras",
        totalParticipations: 50,
        goldMedalCount: 5,
        silverMedalCount: 2,
        bronzeMedalCount: 1,
        nominationCount: 3,
        rankCount: 2,
        levelKey: "school",
        arabicParticipants: 40,
        internationalParticipants: 10,
      } as ParticipationAnalyticsPayload["table"][number],
    ],
    tableTotal: 1,
    page: 1,
    pageSize: 100,
  },
});

describe("historical-results-export", () => {
  it("export HTML includes medal columns when data exists", () => {
    const family = ACTIVITY_FAMILIES.find((f) => f.key === "bebras")!;
    const model = buildHistoricalComparisonTable({
      family,
      slices: [slice(2023), slice(2024)],
    });
    expect(model).not.toBeNull();
    const html = buildHistoricalTablePrintHtml(model!, true, undefined, {
      displayMode: "executive",
    });
    expect(html).toContain("ذهبية");
    expect(html).toContain("المشاركون");
  });
});
