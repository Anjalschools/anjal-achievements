import { describe, it, expect } from "vitest";
import {
  formatAcademicYearRangeLabel,
  normalizeAcademicYearLabel,
  parseAcademicYearStartFromText,
  resolveAcademicStartYear,
} from "@/lib/analytics/competition-year-normalizer";

describe("formatAcademicYearRangeLabel", () => {
  it("maps start years to correct ranges", () => {
    const years = [2020, 2021, 2022, 2023, 2024, 2025];
    const expected = [
      "2020-2021",
      "2021-2022",
      "2022-2023",
      "2023-2024",
      "2024-2025",
      "2025-2026",
    ];
    for (let i = 0; i < years.length; i++) {
      expect(formatAcademicYearRangeLabel(years[i]!)).toBe(expected[i]);
    }
  });
});

describe("parseAcademicYearStartFromText", () => {
  it("uses first year in academic string", () => {
    expect(parseAcademicYearStartFromText("2025-2026م")).toBe(2025);
    expect(parseAcademicYearStartFromText("2024-2025")).toBe(2024);
  });
});

describe("resolveAcademicStartYear", () => {
  it("uses achievementYear as start year when no date", () => {
    expect(resolveAcademicStartYear({ achievementYear: 2025 })).toBe(2025);
  });

  it("maps March 2026 date to academic start 2025", () => {
    expect(resolveAcademicStartYear({ achievementDate: "2026-03-15" })).toBe(2025);
  });

  it("maps October 2025 date to academic start 2025", () => {
    expect(resolveAcademicStartYear({ achievementDate: "2025-10-01" })).toBe(2025);
  });
});

describe("normalizeAcademicYearLabel", () => {
  it("does not double-increment end year", () => {
    const labels = normalizeAcademicYearLabel(2025, { titleAr: "بيبراس", titleEn: "Bebras" });
    expect(labels.labelAr).toBe("بيبراس 2025-2026");
    expect(labels.labelEn).toBe("Bebras 2025-2026");
    expect(labels.endYear).toBe(2026);
  });
});
