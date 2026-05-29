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

describe("historical-performance-dedup", () => {
  it("coalesces parallel historical queries", async () => {
    clearHistoricalQueryDedup();
    let n = 0;
    await Promise.all([
      deduplicateHistoricalQuery(f(), [2024, 2025], async () => {
        n += 1;
        return [{ year: 2024 }];
      }),
      deduplicateHistoricalQuery(f(), [2024, 2025], async () => {
        n += 1;
        return [{ year: 2024 }];
      }),
    ]);
    expect(n).toBe(1);
  });
});
