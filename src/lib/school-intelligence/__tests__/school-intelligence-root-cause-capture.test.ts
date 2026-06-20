import { describe, expect, it } from "vitest";
import {
  buildFirstFailureRecord,
  classifySchoolIntelligenceFailure,
  createSchoolIntelligenceMongoFailureError,
} from "@/lib/school-intelligence/school-intelligence-root-cause-capture";

describe("school-intelligence-root-cause-capture", () => {
  it("classifies mongo timeout failures", () => {
    expect(
      classifySchoolIntelligenceFailure({
        errorName: "IntelligenceQueryTimeoutError",
        errorMessage: "users.find_students exceeded 30000ms",
        mongoOperation: "find_students",
      })
    ).toBe("Mongo Timeout");
  });

  it("classifies mongo aggregation failures", () => {
    expect(
      classifySchoolIntelligenceFailure({
        errorMessage: "pipeline stage 2 failed",
        mongoOperation: "aggregate",
        queryName: "student_success_certificates_by_user",
      })
    ).toBe("Mongo Aggregation Failure");
  });

  it("captures mongo context on enriched errors", () => {
    const failure = buildFirstFailureRecord({
      section: "buildStudentSuccessGraph",
      service: "student_success_graph",
      durationMs: 30102,
      error: createSchoolIntelligenceMongoFailureError(new Error("users.find_students exceeded 30000ms"), {
        mongoCollection: "users",
        mongoOperation: "find_students",
        queryName: undefined,
        timeoutMs: 30000,
        durationMs: 30102,
        documentsReturned: 0,
      }),
    });

    expect(failure.mongoCollection).toBe("users");
    expect(failure.mongoOperation).toBe("find_students");
    expect(failure.durationMs).toBe(30102);
    expect(failure.timeoutMs).toBe(30000);
    expect(failure.failureClassification).toBe("Mongo Timeout");
    expect(failure.stack).toBeTruthy();
  });

  it("classifies undefined reference failures", () => {
    expect(
      classifySchoolIntelligenceFailure({
        errorName: "TypeError",
        errorMessage: "Cannot read properties of undefined (reading 'map')",
      })
    ).toBe("Undefined Reference");
  });
});
