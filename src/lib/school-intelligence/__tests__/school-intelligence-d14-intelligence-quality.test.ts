import { describe, expect, it } from "vitest";
import { buildGrowthTrendsIntelligence } from "@/lib/school-intelligence/growth-trends-intelligence";
import { computeStudentPercentileRank } from "@/lib/school-intelligence/ssi-percentile";
import {
  resolveTalentDiscoveryThresholds,
  TALENT_DISCOVERY_DEFAULTS,
} from "@/lib/school-intelligence/talent-discovery-config";
import { buildTalentDiscoveryWithDiagnostics } from "@/lib/school-intelligence/talent-discovery";
import { buildRootCauseSummary } from "@/lib/school-intelligence/school-intelligence-transparency-utils";
import type { StudentSuccessGraphNode } from "@/lib/school-intelligence/school-intelligence-types";

const baseNode = (overrides: Partial<StudentSuccessGraphNode> = {}): StudentSuccessGraphNode =>
  ({
    studentId: "s1",
    fullNameAr: "طالب",
    fullNameEn: "Student",
    avatarUrl: "",
    grade: "g10",
    stage: "secondary",
    track: "arabic",
    department: "general",
    isMawhiba: false,
    recordCount: 3,
    medalCount: 1,
    medalRatioPct: 33,
    distinctActivityCount: 2,
    certificateCount: 1,
    participationCount: 3,
    trainingHours: 12,
    volunteerHours: 0,
    topSkills: [],
    activityKeys: [],
    growthIndex: 1.1,
    recentTrend: "improving",
    momentum: "medium",
    subScores: {
      achievementScore: 50,
      trainingScore: 40,
      volunteerScore: 20,
      skillScore: 30,
      careerReadiness: 45,
      universityReadiness: 55,
      consistencyScore: 50,
    },
    successIndex: 37,
    evidence: "",
    ...overrides,
  }) as StudentSuccessGraphNode;

describe("D.14 intelligence quality", () => {
  it("uses adaptive talent thresholds for realistic SSI ranges", () => {
    const thresholds = resolveTalentDiscoveryThresholds(
      {
        successIndexes: [37, 16, 15, 22, 30],
        growthIndexes: [1.1, 0.4, 0.3, 0.9, 1.0],
        participationCounts: [3, 2, 1, 4, 2],
        readinessScores: [55, 40, 35, 50, 45],
      },
      TALENT_DISCOVERY_DEFAULTS
    );

    expect(thresholds.mode).toBe("percentile");
    expect(thresholds.underutilizedSuccessIndex).toBeLessThanOrEqual(37);
    expect(thresholds.underutilizedSuccessIndex).toBeGreaterThanOrEqual(20);
  });

  it("finds talent candidates when data exists at SSI ~37", () => {
    const result = buildTalentDiscoveryWithDiagnostics([
      baseNode(),
      baseNode({ studentId: "s2", successIndex: 16, growthIndex: 0.4, trainingHours: 0 }),
    ]);

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.diagnostics.status).toBe("success");
    expect(result.diagnostics.thresholdMode).toBe("percentile");
    expect(result.diagnostics.excludedBySSI).toBeTypeOf("number");
  });

  it("computes SSI percentile bands", () => {
    const rank = computeStudentPercentileRank(37, [37, 16, 15, 30, 22]);
    expect(rank.percentile).toBeGreaterThanOrEqual(80);
    expect(rank.bandLabelAr).toMatch(/أفضل 5%|أفضل 10%/);
  });

  it("defines strategic insight categories and confidence in source", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/lib/school-intelligence/strategic-school-insights.ts"),
      "utf8"
    );
    expect(src).toContain("category:");
    expect(src).toContain("confidence:");
    expect(src).toContain(".slice(0, 10)");
  });

  it("builds growth trend highlights from longitudinal data", () => {
    const { trends, diagnostics } = buildGrowthTrendsIntelligence({
      longitudinalGrowth: [
        { year: 2024, participations: 213, students: 180, avgSuccessIndex: 24, growthRatePct: 0 },
        { year: 2025, participations: 369, students: 210, avgSuccessIndex: 28, growthRatePct: 73 },
      ],
      departmentExcellence: [],
      opportunityMapping: [],
      nodes: [baseNode()],
    });

    expect(trends.highlights.length).toBeGreaterThan(0);
    expect(trends.highlights[0]?.bodyAr).toContain("213");
    expect(diagnostics.participationChangePct).toBeGreaterThan(0);
  });

  it("shows healthy root cause when no unavailable sections and no failures", () => {
    const root = buildRootCauseSummary(
      { status: "success", warnings: [], generatedAt: "2026-06-18T10:00:00.000Z" },
      { unavailableSections: 0 }
    );
    expect(root.isHealthy).toBe(true);
    expect(root.rootCauseTitleAr).toBe("لا توجد مشكلة نشطة");
    expect(root.errorCategory).toBe("No active issue");
  });
});

describe("opportunity mapping labels", () => {
  it("maps unknown stage labels to Arabic unclassified text", async () => {
    const { reportStageLabel } = await import("@/lib/report-stage-mapping");
    expect(reportStageLabel("unknown", true)).toBe("غير محدد");
    expect(reportStageLabel("unknown", false)).not.toBe("unknown stage");
  });
});
