import { describe, expect, it } from "vitest";
import {
  getSchoolIntelligenceBuildTrace,
  recordSchoolIntelligenceFirstFailure,
  runWithSchoolIntelligenceBuildTrace,
  traceSchoolIntelligenceSection,
  traceSchoolIntelligenceSnapshotSave,
} from "@/lib/school-intelligence/school-intelligence-section-tracer";
import { createSchoolIntelligenceMongoFailureError } from "@/lib/school-intelligence/school-intelligence-root-cause-capture";

describe("school-intelligence-section-tracer", () => {
  it("records only the first section failure per request", async () => {
    await runWithSchoolIntelligenceBuildTrace(async () => {
      recordSchoolIntelligenceFirstFailure({
        section: "buildStudentSuccessGraph",
        service: "student_success_graph",
        errorName: "Error",
        errorMessage: "first",
        timestamp: new Date().toISOString(),
        durationMs: 100,
        failureClassification: "Unknown Failure",
      });
      recordSchoolIntelligenceFirstFailure({
        section: "buildLongitudinalGrowth",
        service: "longitudinal_growth",
        errorName: "Error",
        errorMessage: "second",
        timestamp: new Date().toISOString(),
        durationMs: 200,
        failureClassification: "Unknown Failure",
      });

      expect(getSchoolIntelligenceBuildTrace().firstFailure?.errorMessage).toBe("first");
    });
  });

  it("captures failure from traced section and rethrows", async () => {
    await expect(
      runWithSchoolIntelligenceBuildTrace(async () => {
        await traceSchoolIntelligenceSection("buildStudentSuccessGraph", "student_success_graph", async () => {
          throw new Error("timeout exceeded 30000ms");
        });
      })
    ).rejects.toThrow("timeout exceeded 30000ms");

    await runWithSchoolIntelligenceBuildTrace(async () => {
      try {
        await traceSchoolIntelligenceSection("buildStudentSuccessGraph", "student_success_graph", async () => {
          throw new Error("timeout exceeded 30000ms");
        });
      } catch {
        const failure = getSchoolIntelligenceBuildTrace().firstFailure;
        expect(failure?.section).toBe("buildStudentSuccessGraph");
        expect(failure?.service).toBe("student_success_graph");
        expect(failure?.errorMessage).toContain("timeout");
        expect(failure?.failureClassification).toBe("Mongo Timeout");
      }
    });
  });

  it("captures mongo context from enriched profiler errors", async () => {
    await runWithSchoolIntelligenceBuildTrace(async () => {
      try {
        await traceSchoolIntelligenceSection("buildStudentSuccessGraph", "student_success_graph", async () => {
          throw createSchoolIntelligenceMongoFailureError(new Error("achievements.aggregate exceeded 30000ms"), {
            mongoCollection: "achievements",
            mongoOperation: "aggregate",
            queryName: "student_success_certificates_by_user",
            timeoutMs: 30000,
            durationMs: 30012,
            documentsReturned: 0,
          });
        });
      } catch {
        const failure = getSchoolIntelligenceBuildTrace().firstFailure;
        expect(failure?.mongoCollection).toBe("achievements");
        expect(failure?.queryName).toBe("student_success_certificates_by_user");
        expect(failure?.failureClassification).toBe("Mongo Timeout");
      }
    });
  });

  it("tracks snapshot save attempt success and failure", async () => {
    await runWithSchoolIntelligenceBuildTrace(async () => {
      await traceSchoolIntelligenceSnapshotSave("school_intelligence_payload", async () => undefined);
      expect(getSchoolIntelligenceBuildTrace().snapshotSave?.succeeded).toBe(true);
    });

    await runWithSchoolIntelligenceBuildTrace(async () => {
      try {
        await traceSchoolIntelligenceSnapshotSave("school_intelligence_payload", async () => {
          throw new Error("mongo write failed");
        });
      } catch {
        const save = getSchoolIntelligenceBuildTrace().snapshotSave;
        expect(save?.attempted).toBe(true);
        expect(save?.succeeded).toBe(false);
        expect(save?.errorMessage).toBe("mongo write failed");
      }
    });
  });
});
