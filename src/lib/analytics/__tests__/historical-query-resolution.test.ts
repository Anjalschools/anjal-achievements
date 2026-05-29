import { describe, expect, it } from "vitest";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import {
  buildHistoricalDimensionRelaxation,
  buildHistoricalQueryFingerprint,
  resolveHistoricalCompatibleFilters,
} from "@/lib/analytics/historical-query-resolution";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";

const filter = (): ExecutiveFilterSnapshot => ({
  activityYears: ["2024", "2025"],
  academicYear: "",
  gender: "",
  mawhiba: "",
  stage: "",
  grade: "",
  section: "",
  categories: [],
  primaryType: "",
  levels: ["g10"],
  resultTokens: ["gold"],
  status: "",
  certificateStatus: "",
  fromDate: "",
  toDate: "",
  domain: "",
  classification: "science",
  organization: "",
  achievementNames: ["Kangaroo"],
  genders: [],
  mawhibaValues: [],
  stages: [],
  grades: [],
  sections: [],
  statuses: [],
  certificateStatuses: [],
  standardizedTestTypes: [],
});

const slice = (year: number): HistoricalYearSlice => ({
  year,
  payload: {
    ok: true,
    generatedAt: "",
    filters: {},
    kpis: { totalParticipations: 10, nominationCount: 2 } as HistoricalYearSlice["payload"]["kpis"],
    charts: {} as HistoricalYearSlice["payload"]["charts"],
    activityOptions: [],
    focusedActivity: null,
    table: [
      {
        activityLabelAr: "كانجارو",
        activityLabelEn: "Kangaroo",
        totalParticipations: 5,
      } as HistoricalYearSlice["payload"]["table"][number],
    ],
    tableTotal: 1,
    page: 1,
    pageSize: 500,
  },
});

describe("historical-query-resolution", () => {
  it("relaxes strict cross-year filters", () => {
    const relaxation = buildHistoricalDimensionRelaxation(filter(), [slice(2024), slice(2025)]);
    expect(relaxation.droppedResultTokens).toBe(true);
    expect(relaxation.droppedLevels).toBe(true);
  });

  it("builds stable fingerprint", () => {
    const fp = buildHistoricalQueryFingerprint(filter(), [2025, 2024]);
    expect(fp.years).toEqual([2024, 2025]);
    expect(fp.hash.length).toBeGreaterThan(8);
  });

  it("resolveHistoricalCompatibleFilters clears dropped dimensions", () => {
    const { filter: compatible, fingerprint } = resolveHistoricalCompatibleFilters(filter(), [
      slice(2024),
    ]);
    expect(compatible.resultTokens).toEqual([]);
    expect(fingerprint.relaxed).toBe(true);
  });
});
