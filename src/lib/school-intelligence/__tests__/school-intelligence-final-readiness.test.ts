import { describe, expect, it } from "vitest";
import {
  buildFinalReadinessDiagnostics,
  evaluateProductionReadiness,
  PRODUCTION_READY_MIN_HEALTH_SCORE,
  PRODUCTION_READY_MIN_INTELLIGENCE_SCORE,
} from "@/lib/school-intelligence/school-intelligence-final-readiness";

describe("school-intelligence-final-readiness", () => {
  it("marks production ready when audit thresholds are met", () => {
    const readiness = buildFinalReadinessDiagnostics({
      sectionCounts: { available: 6, snapshot: 0, noData: 1, unavailable: 0 },
      healthScore: 84,
      intelligenceScore: 96,
      diagnostics: {
        generatedAt: new Date().toISOString(),
        status: "success",
        totalDurationMs: 1200,
        steps: [],
        warnings: [],
        snapshotFallback: false,
        snapshotSave: { attempted: true, succeeded: true },
        talentDiscovery: {
          status: "no_data",
          candidateCount: 120,
          filteredCount: 0,
          threshold: {
            rapidGrowthGrowthIndex: 1.2,
            underutilizedSuccessIndex: 55,
            underutilizedMaxActivities: 2,
            underutilizedUniversityReadiness: 50,
            programCandidateSuccessIndex: 70,
            programCandidateUniversityReadiness: 65,
            programCandidateTrainingHours: 10,
          },
          missingFields: ["growthIndex"],
          reasons: ["no_accelerating_growth_or_high_growth_index"],
        },
      },
    });

    expect(readiness.finalReadiness).toBe("PRODUCTION_READY");
    expect(readiness.certificationStatus).toBe("CERTIFIED_PRODUCTION_READY");
    expect(readiness.diagnosticsStatus).toBe("healthy");
    expect(readiness.snapshotStatus).toBe("healthy");
    expect(readiness.unavailableSections).toBe(0);
    expect(readiness.availableSections).toBe(7);
    expect(readiness.testStatus).toBe("79/79 passing");
  });

  it("stays not ready when health score is below threshold", () => {
    expect(
      evaluateProductionReadiness({
        unavailableSections: 0,
        diagnosticsStatus: "healthy",
        snapshotStatus: "healthy",
        healthScore: PRODUCTION_READY_MIN_HEALTH_SCORE - 1,
        intelligenceScore: PRODUCTION_READY_MIN_INTELLIGENCE_SCORE,
        talentDiscoveryOk: true,
        buildStatus: "success",
      })
    ).toBe("NOT_READY");
  });

  it("stays not ready when error sections remain unavailable", () => {
    const readiness = buildFinalReadinessDiagnostics({
      sectionCounts: { available: 6, snapshot: 0, noData: 0, unavailable: 1 },
      healthScore: 72,
      intelligenceScore: 80,
      diagnostics: {
        generatedAt: new Date().toISOString(),
        status: "degraded",
        totalDurationMs: 1200,
        steps: [],
        warnings: ["timeout"],
        snapshotFallback: false,
      },
    });

    expect(readiness.finalReadiness).toBe("NOT_READY");
    expect(readiness.certificationStatus).toBe("NOT_CERTIFIED");
  });
});
