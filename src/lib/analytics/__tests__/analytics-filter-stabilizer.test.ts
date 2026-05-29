import { describe, expect, it } from "vitest";
import {
  buildDeterministicFilterHash,
  stableArrayIdentity,
  stabilizeAnalyticsFilters,
} from "@/lib/analytics/analytics-filter-stabilizer";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";

const base = (): ExecutiveFilterSnapshot => ({
  activityYears: ["2024", "2025"],
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

describe("analytics-filter-stabilizer", () => {
  it("reuses stable array identity for same values", () => {
    const a = stableArrayIdentity(["2024", "2025"]);
    const b = stableArrayIdentity(["2024", "2025"]);
    expect(a).toBe(b);
  });

  it("produces deterministic filter hash", () => {
    const h1 = buildDeterministicFilterHash(stabilizeAnalyticsFilters(base()));
    const h2 = buildDeterministicFilterHash(stabilizeAnalyticsFilters(base()));
    expect(h1).toBe(h2);
  });
});
