import { describe, expect, it } from "vitest";
import {
  fingerprintFromParticipationFilters,
  normalizeFiltersForFingerprint,
} from "@/lib/analytics/server/analytics-snapshot-fingerprint";

describe("analytics-snapshot-fingerprint", () => {
  it("produces stable fingerprint for same filters", () => {
    const base = normalizeFiltersForFingerprint({
      academicYear: "2025-2026م",
      gender: "all",
      stage: "all",
      grade: "all",
      section: "all",
      mawhiba: "all",
      categories: ["a", "b"],
      levels: [],
      resultTokens: [],
    });
    const a = fingerprintFromParticipationFilters({
      academicYear: "2025-2026م",
      gender: "all",
      stage: "all",
      grade: "all",
      section: "all",
      mawhiba: "all",
      categories: ["b", "a"],
      levels: [],
      resultTokens: [],
    });
    const b = fingerprintFromParticipationFilters({
      academicYear: "2025-2026م",
      gender: "all",
      stage: "all",
      grade: "all",
      section: "all",
      mawhiba: "all",
      categories: ["a", "b"],
      levels: [],
      resultTokens: [],
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
    expect(JSON.stringify(normalizeFiltersForFingerprint({ categories: ["b", "a"] }))).toContain('"a"');
  });
});
