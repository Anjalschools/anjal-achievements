import { describe, expect, it } from "vitest";
import { buildHistoricalRequestFingerprint } from "@/lib/analytics/historical-request-fingerprint";
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

describe("historical-request-dedup", () => {
  it("stable fingerprint for same inputs", () => {
    const a = buildHistoricalRequestFingerprint({
      filter: f(),
      years: [2024, 2023],
      dimension: "combined",
      familyKey: "kangaroo",
    });
    const b = buildHistoricalRequestFingerprint({
      filter: f(),
      years: [2023, 2024],
      dimension: "combined",
      familyKey: "kangaroo",
    });
    expect(a).toBe(b);
  });
});
