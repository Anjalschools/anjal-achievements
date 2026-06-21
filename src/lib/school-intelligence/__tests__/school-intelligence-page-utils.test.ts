import { describe, expect, it } from "vitest";
import {
  buildSectionStatusMap,
  countSectionsByStatus,
  countSlowSignals,
  deriveDisplayScoresFromDiagnostics,
  parseSchoolIntelligenceResponse,
  resolveDataSource,
  resolveLastSuccessfulUpdate,
  resolveSectionStatus,
  SNAPSHOT_USED_KEY,
} from "@/lib/school-intelligence/school-intelligence-page-utils";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";

const emptyPayload = (): SchoolIntelligencePayload =>
  ({
    generatedAt: "2026-01-01T00:00:00.000Z",
    schoolExcellence: { excellenceIndex: 0, participationRatePct: 0 },
    studentSuccessGraph: { totalNodes: 0, avgSuccessIndex: 0, topStudents: [] },
    strategicInsights: [],
    departmentExcellence: [],
    talentDiscovery: [],
    interventions: [],
    opportunityMapping: [],
    longitudinalGrowth: [],
  }) as SchoolIntelligencePayload;

const samplePayload = (): SchoolIntelligencePayload => ({
  ...emptyPayload(),
  schoolExcellence: { excellenceIndex: 72, participationRatePct: 55 },
  studentSuccessGraph: {
    totalNodes: 10,
    avgSuccessIndex: 68,
    topStudents: [{ studentId: "1", fullNameAr: "ط", fullNameEn: "S", grade: "10", successIndex: 80 }],
  },
  strategicInsights: [{ id: "i1", titleAr: "t", titleEn: "t", bodyAr: "b", bodyEn: "b", priority: 1 }],
});

describe("school-intelligence-page-utils", () => {
  it("maps snapshotFallback to snapshotUsed", () => {
    expect(SNAPSHOT_USED_KEY({ snapshotFallback: true })).toBe(true);
    expect(SNAPSHOT_USED_KEY({ snapshotFallback: false })).toBe(false);
  });

  it("parses API status and snapshot flag", () => {
    const parsed = parseSchoolIntelligenceResponse({
      status: "degraded",
      diagnostics: { snapshotFallback: true },
      intelligence: samplePayload(),
    });
    expect(parsed.status).toBe("degraded");
    expect(parsed.snapshotUsed).toBe(true);
  });

  it("labels live data source on success", () => {
    expect(resolveDataSource("success", false, true)).toContain("Live");
  });

  it("labels snapshot data source when snapshot fallback is used", () => {
    expect(resolveDataSource("degraded", true, true)).toContain("Snapshot");
  });

  it("prefers snapshot payload timestamp only when snapshot is in use", () => {
    const ts = resolveLastSuccessfulUpdate(
      { buildTimestamp: "2026-06-18T10:00:00.000Z" },
      { generatedAt: "2026-06-17T08:00:00.000Z" } as SchoolIntelligencePayload,
      true
    );
    expect(ts).toBe("2026-06-17T08:00:00.000Z");
  });

  it("ignores intelligence generatedAt when snapshot is not in use", () => {
    const ts = resolveLastSuccessfulUpdate(
      { buildTimestamp: "2026-06-18T10:00:00.000Z" },
      { generatedAt: "2026-06-17T08:00:00.000Z" } as SchoolIntelligencePayload,
      false
    );
    expect(ts).toBe("2026-06-18T10:00:00.000Z");
  });

  it("derives display scores from diagnostics payload", () => {
    const scores = deriveDisplayScoresFromDiagnostics({ status: "success", snapshotFallback: false });
    expect(scores.healthScore).toBeGreaterThan(0);
    expect(scores.resilienceScore).toBeGreaterThan(0);
  });

  it("marks empty talent discovery as no_data when the graph is healthy", () => {
    expect(resolveSectionStatus("talent_discovery", emptyPayload(), "success", false)).toBe("unavailable");
    expect(
      resolveSectionStatus(
        "talent_discovery",
        { ...emptyPayload(), studentSuccessGraph: { totalNodes: 12, avgSuccessIndex: 50, topStudents: [] } } as SchoolIntelligencePayload,
        "success",
        false
      )
    ).toBe("no_data");
  });

  it("marks populated sections snapshot when degraded with fallback", () => {
    expect(resolveSectionStatus("summary", samplePayload(), "degraded", true)).toBe("snapshot");
  });

  it("counts section availability", () => {
    const map = buildSectionStatusMap(samplePayload(), "degraded", true);
    const counts = countSectionsByStatus(map);
    expect(counts.unavailable).toBeGreaterThan(0);
    expect(counts.snapshot + counts.available).toBeGreaterThan(0);
  });

  it("counts slow query signals from diagnostics warnings", () => {
    expect(
      countSlowSignals({
        warnings: ["aggregation_slow_or_timeout", "other"],
        steps: [{ step: "x", durationMs: 6000, detail: "slow_or_timeout" }],
      })
    ).toBeGreaterThanOrEqual(1);
  });
});
