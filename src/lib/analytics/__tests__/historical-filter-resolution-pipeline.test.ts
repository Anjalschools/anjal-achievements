import { describe, expect, it } from "vitest";
import { resolveHistoricalFilterPipeline } from "@/lib/analytics/historical-filter-resolution-pipeline";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const f = (): ExecutiveFilterSnapshot => ({
  activityYears: ["2024"],
  academicYear: "",
  gender: "",
  mawhiba: "",
  stage: "",
  grade: "",
  section: "",
  categories: [],
  primaryType: "",
  levels: [],
  resultTokens: ["gold"],
  status: "",
  certificateStatus: "",
  fromDate: "",
  toDate: "",
  domain: "",
  classification: "",
  organization: "",
  achievementNames: [],
  genders: [],
  mawhibaValues: [],
  stages: [],
  grades: [],
  sections: [],
  statuses: [],
  certificateStatuses: [],
  standardizedTestTypes: [],
});

describe("historical-filter-resolution-pipeline", () => {
  it("produces stable fingerprint and expanded narrative tokens", () => {
    const slices = [
      {
        year: 2024,
        payload: {
          ok: true as const,
          generatedAt: "",
          filters: {},
          kpis: { totalParticipations: 1 } as ParticipationAnalyticsPayload["kpis"],
          charts: {} as ParticipationAnalyticsPayload["charts"],
          activityOptions: [],
          focusedActivity: null,
          table: [],
          tableTotal: 0,
          page: 1,
          pageSize: 100,
        } satisfies ParticipationAnalyticsPayload,
      },
    ];
    const a = resolveHistoricalFilterPipeline(f(), slices);
    const b = resolveHistoricalFilterPipeline(f(), slices);
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.fetch.resultTokens).toEqual(["gold"]);
    expect(a.compatible).toBeDefined();
    expect(a.relaxation).toBeDefined();
  });
});
