import { describe, expect, it } from "vitest";
import {
  clearHistoricalQueryDedup,
  deduplicateHistoricalQuery,
} from "@/lib/analytics/historical-query-dedup";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";

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

describe("historical-query-dedup", () => {
  it("deduplicates concurrent identical queries", async () => {
    clearHistoricalQueryDedup();
    let calls = 0;
    const factory = async () => {
      calls += 1;
      return [{ year: 2024 }];
    };
    const [a, b] = await Promise.all([
      deduplicateHistoricalQuery(f(), [2024], factory),
      deduplicateHistoricalQuery(f(), [2024], factory),
    ]);
    expect(a).toEqual(b);
    expect(calls).toBe(1);
  });
});
