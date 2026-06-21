import { describe, expect, it } from "vitest";
import { buildTalentDiscoveryWithDiagnostics } from "@/lib/school-intelligence/talent-discovery";
import type { StudentSuccessGraphNode } from "@/lib/school-intelligence/school-intelligence-types";

const baseNode = (overrides: Partial<StudentSuccessGraphNode> = {}): StudentSuccessGraphNode =>
  ({
    studentId: "s1",
    fullNameAr: "طالب",
    fullNameEn: "Student",
    avatarUrl: "",
    grade: "10",
    stage: "secondary",
    track: "arabic",
    department: "general",
    isMawhiba: false,
    recordCount: 3,
    medalCount: 1,
    medalRatioPct: 33,
    distinctActivityCount: 4,
    certificateCount: 1,
    participationCount: 3,
    trainingHours: 0,
    volunteerHours: 0,
    topSkills: [],
    activityKeys: [],
    growthIndex: 0.8,
    recentTrend: "stable",
    momentum: "medium",
    subScores: {
      achievementScore: 50,
      trainingScore: 40,
      volunteerScore: 20,
      skillScore: 30,
      careerReadiness: 45,
      universityReadiness: 40,
      consistencyScore: 50,
    },
    successIndex: 48,
    evidence: "",
    ...overrides,
  }) as StudentSuccessGraphNode;

describe("talent-discovery", () => {
  it("returns no_data diagnostics when thresholds eliminate all candidates", () => {
    const result = buildTalentDiscoveryWithDiagnostics([baseNode(), baseNode({ studentId: "s2" })]);

    expect(result.rows).toHaveLength(0);
    expect(result.diagnostics.status).toBe("no_data");
    expect(result.diagnostics.candidateCount).toBe(2);
    expect(result.diagnostics.filteredCount).toBe(0);
    expect(result.diagnostics.reasons.length).toBeGreaterThan(0);
  });

  it("returns success diagnostics for rapid growth candidates", () => {
    const result = buildTalentDiscoveryWithDiagnostics([
      baseNode({ studentId: "rapid", growthIndex: 1.4, recentTrend: "accelerating", successIndex: 72 }),
    ]);

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.diagnostics.status).toBe("success");
    expect(result.diagnostics.filteredCount).toBeGreaterThan(0);
  });
});
