import { describe, expect, it } from "vitest";
import {
  applyDrillDownFromChart,
  buildDrillDownFilters,
  mergeAnalyticsFilters,
  resolveDrillDownTarget,
} from "@/lib/analytics/analytics-drilldown-router";
import { defaultExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";

describe("analytics drilldown router", () => {
  const base = defaultExecutiveFilterSnapshot();

  it("maps gold outcome to medal token", () => {
    const patch = buildDrillDownFilters("outcome_donut", { key: "gold" }, base);
    expect(patch.resultTokens).toContain("medal:gold");
    expect(patch.tableMode).toBe("detailed");
  });

  it("maps year trend to activity year filter", () => {
    const patch = buildDrillDownFilters("year_trend", { year: 2024 }, base);
    expect(patch.activityYears).toEqual(["2024"]);
  });

  it("maps competition bebras to primary type", () => {
    const patch = buildDrillDownFilters("competition_row", { competitionKey: "bebras", key: "bebras" }, base);
    expect(patch.primaryType).toBe("bebras");
    expect(patch.tableMode).toBe("activity");
  });

  it("merges filters without dropping academic year", () => {
    const withYear = { ...base, academicYear: "2025-2026م" };
    const merged = mergeAnalyticsFilters(withYear, { resultTokens: ["medal:gold"] });
    expect(merged.academicYear).toBe("2025-2026م");
    expect(merged.resultTokens).toEqual(["medal:gold"]);
  });

  it("builds trace on applyDrillDownFromChart", () => {
    const result = applyDrillDownFromChart("section_card", { key: "international" }, base);
    expect(result.trace.sourceChart).toBe("section_card");
    expect(result.trace.traceId).toMatch(/^dd-/);
    expect(result.mergedFilter.sections).toEqual(["international"]);
  });

  it("resolves student tab for distinct students kpi", () => {
    const target = resolveDrillDownTarget("kpi", { metricKey: "distinctStudents" });
    expect(target.preferStudentTab).toBe(true);
    expect(target.tableMode).toBe("student");
  });
});
