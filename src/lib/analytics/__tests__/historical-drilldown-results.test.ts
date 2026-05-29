import { describe, expect, it } from "vitest";
import { buildDrillDownFilters } from "@/lib/analytics/analytics-drilldown-router";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";

const base = (): ExecutiveFilterSnapshot => ({
  activityYears: [],
  academicYear: "",
  gender: "",
  mawhiba: "",
  stage: "",
  grade: "",
  section: "",
  categories: [],
  primaryType: "",
  levels: [],
  resultTokens: [],
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

describe("historical-drilldown-results", () => {
  it("maps award_winners to medal tokens", () => {
    const patch = buildDrillDownFilters(
      "historical_cell",
      { metricKey: "award_winners", year: 2024, competitionKey: "kangaroo" },
      base()
    );
    expect(patch.resultTokens?.length).toBeGreaterThan(0);
    expect(patch.activityYears).toEqual(["2024"]);
  });

  it("maps rankings to rank tokens", () => {
    const patch = buildDrillDownFilters(
      "historical_cell",
      { metricKey: "rankings", year: 2023 },
      base()
    );
    expect(patch.resultTokens?.length).toBeGreaterThan(0);
  });
});
