import { describe, expect, it } from "vitest";
import {
  buildHealthScoreBreakdown,
  buildRootCauseSummary,
  buildSnapshotVisibility,
  formatSnapshotAge,
  reclassifySystemStatus,
  resolveSectionEmptyKind,
  resolveSnapshotAvailable,
  resolveTransparentPageState,
} from "@/lib/school-intelligence/school-intelligence-transparency-utils";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";

const samplePayload = () =>
  ({
    generatedAt: "2026-06-17T08:00:00.000Z",
    schoolExcellence: { excellenceIndex: 72, participationRatePct: 55 },
    studentSuccessGraph: {
      totalNodes: 10,
      avgSuccessIndex: 68,
      topStudents: [{ studentId: "1", fullNameAr: "ط", fullNameEn: "S", grade: "10", successIndex: 80 }],
    },
    strategicInsights: [],
    departmentExcellence: [],
    talentDiscovery: [],
    interventions: [],
    opportunityMapping: [],
    longitudinalGrowth: [],
  }) as unknown as SchoolIntelligencePayload;

describe("school-intelligence-transparency-utils", () => {
  it("reclassifies unavailable to degraded when sections have data", () => {
    const state = resolveTransparentPageState(
      "unavailable",
      samplePayload(),
      { status: "unavailable", warnings: ["aggregation_slow_or_timeout"] },
      true
    );
    expect(state.status).toBe("degraded");
    expect(state.availableSections).toBeGreaterThan(0);
  });

  it("keeps unavailable only when no sections have data", () => {
    const empty = samplePayload();
    empty.schoolExcellence.excellenceIndex = 0;
    empty.studentSuccessGraph.totalNodes = 0;
    empty.studentSuccessGraph.topStudents = [];

    const state = resolveTransparentPageState(
      "unavailable",
      empty,
      { status: "unavailable", warnings: ["aggregation_slow_or_timeout"] },
      false
    );
    expect(state.status).toBe("unavailable");
  });

  it("builds root cause from diagnostics warnings", () => {
    const root = buildRootCauseSummary({
      status: "degraded",
      snapshotFallback: true,
      warnings: ["aggregation_slow_or_timeout"],
      timeoutSource: "achievement_intelligence",
      generatedAt: "2026-06-18T10:00:00.000Z",
      steps: [{ step: "snapshot_fallback", durationMs: 1200, detail: "snapshot_loaded" }],
    });
    expect(root.errorCategory).toBe("Aggregation Timeout");
    expect(root.snapshotAvailable).toBe(true);
  });

  it("does not treat empty fallback generatedAt as snapshot available", () => {
    const emptyPayload = {
      generatedAt: "2026-06-18T10:00:00.000Z",
      schoolExcellence: { excellenceIndex: 0, participationRatePct: 0 },
      studentSuccessGraph: { totalNodes: 0, avgSuccessIndex: 0, topStudents: [] },
      strategicInsights: [],
      departmentExcellence: [],
      talentDiscovery: [],
      interventions: [],
      opportunityMapping: [],
      longitudinalGrowth: [],
    } as unknown as SchoolIntelligencePayload;

    expect(
      resolveSnapshotAvailable({
        status: "unavailable",
        snapshotFallback: false,
        generatedAt: "2026-06-18T10:00:00.000Z",
      })
    ).toBe(false);

    const visibility = buildSnapshotVisibility(
      { status: "unavailable", snapshotFallback: false, generatedAt: "2026-06-18T10:00:00.000Z" },
      emptyPayload
    );
    expect(visibility.available).toBe(false);
    expect(visibility.timestamp).toBeNull();

    const root = buildRootCauseSummary({
      status: "unavailable",
      snapshotFallback: false,
      generatedAt: "2026-06-18T10:00:00.000Z",
    });
    expect(root.snapshotAvailable).toBe(false);
    expect(root.errorCategory).toBe("Snapshot Missing");
  });

  it("uses distinct empty kinds for failure vs no data", () => {
    expect(resolveSectionEmptyKind("unavailable", "unavailable", { warnings: ["timeout"] })).toBe("failure");
    expect(resolveSectionEmptyKind("unavailable", "success", undefined)).toBe("no_data");
    expect(resolveSectionEmptyKind("no_data", "success", undefined)).toBe("no_data");
    expect(resolveSectionEmptyKind("snapshot", "degraded", undefined)).toBe("snapshot");
  });

  it("builds health score breakdown with deductions", () => {
    const breakdown = buildHealthScoreBreakdown(
      { status: "unavailable", warnings: ["aggregation_slow_or_timeout", "service_down"] },
      { available: 1, snapshot: 1, noData: 0, unavailable: 6 }
    );
    expect(breakdown.total).toBeLessThan(100);
    expect(breakdown.items.length).toBeGreaterThan(0);
  });

  it("formats snapshot age in Arabic", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const age = formatSnapshotAge(threeHoursAgo, true);
    expect(age.ar).toContain("ساع");
  });

  it("reclassifySystemStatus direct cases", () => {
    expect(reclassifySystemStatus("success", 3, true)).toBe("success");
    expect(reclassifySystemStatus("unavailable", 0, true)).toBe("unavailable");
    expect(reclassifySystemStatus("unavailable", 2, true)).toBe("degraded");
  });
});
