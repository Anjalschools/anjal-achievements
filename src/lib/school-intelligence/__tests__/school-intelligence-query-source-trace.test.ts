import { describe, expect, it } from "vitest";
import {
  analyzeInArrays,
  buildQuerySourceTrace,
  formatFieldBytesSummary,
  pickPrimaryQuerySourceEntry,
} from "@/lib/school-intelligence/school-intelligence-query-source-trace";
import { buildFirstFailureRecord, mergeQuerySourceIntoMongoContext } from "@/lib/school-intelligence/school-intelligence-root-cause-capture";

describe("school-intelligence-query-source-trace", () => {
  it("captures filter origin metadata for find_students", () => {
    const trace = buildQuerySourceTrace({
      queryName: "find_students",
      collection: "users",
      filter: { role: "student" },
      projection: "_id fullNameAr grade",
      sourceVariableName: "STUDENT_FIND_FILTER",
      sourceFunction: "buildStudentSuccessGraph",
    });

    expect(trace.filterKeys).toEqual(["role"]);
    expect(trace.projectionKeys).toEqual(["_id", "fullNameAr", "grade"]);
    expect(trace.sourceVariableName).toBe("STUDENT_FIND_FILTER");
    expect(trace.sourceFunction).toBe("buildStudentSuccessGraph");
  });

  it("analyzes $in arrays with duplicate detection", () => {
    const analysis = analyzeInArrays({
      _id: { $in: ["a", "b", "a", "c", "c"] },
    });

    expect(analysis[0]?.path).toBe("_id.$in");
    expect(analysis[0]?.arrayLength).toBe(5);
    expect(analysis[0]?.uniqueValues).toBe(3);
    expect(analysis[0]?.duplicateValues).toBe(2);
    expect(analysis[0]?.firstFiveValues).toEqual(["a", "b", "a", "c", "c"]);
    expect(analysis[0]?.lastFiveValues).toEqual(["a", "b", "a", "c", "c"]);
  });

  it("builds per-field payload breakdown", () => {
    const trace = buildQuerySourceTrace({
      queryName: "find_by_ids",
      collection: "users",
      filter: {
        status: "approved",
        _id: { $in: ["x".repeat(100), "y".repeat(100)] },
      },
      sourceVariableName: "studentIds",
      sourceFunction: "buildStudentParticipationPool",
    });

    expect(trace.offendingFilterPath).toBe("_id.$in");
    expect(trace.fieldBytes.status).toBeGreaterThan(0);
    expect(trace.fieldBytes["_id.$in"]).toBeGreaterThan(trace.fieldBytes.status ?? 0);
    expect(formatFieldBytesSummary(trace.fieldBytes)).toContain("_id.$in");
  });

  it("merges query source into first failure diagnostics", () => {
    const trace = buildQuerySourceTrace({
      queryName: "find_students",
      collection: "users",
      filter: { _id: { $in: ["1", "2", "3"] } },
      sourceVariableName: "studentIds",
      sourceFunction: "buildStudentParticipationPool",
    });

    const failure = buildFirstFailureRecord({
      section: "buildStudentSuccessGraph",
      service: "student_success_graph",
      durationMs: 10,
      error: {
        name: "Error",
        message: "query_payload_too_large",
      },
    });

    const merged = mergeQuerySourceIntoMongoContext(
      {
        ...failure,
        mongoCollection: "users",
        mongoOperation: "find_students",
        timeoutMs: 8000,
        documentsReturned: 0,
      },
      trace
    );

    expect(merged.sourceVariableName).toBe("studentIds");
    expect(merged.sourceFunction).toBe("buildStudentParticipationPool");
    expect(merged.offendingFilterPath).toBe("_id.$in");
    expect(merged.uniqueValues).toBe(3);
  });

  it("picks the matching query source entry by query name", () => {
    const entries = [
      buildQuerySourceTrace({
        queryName: "find_profiles",
        collection: "studentcareerprofiles",
        filter: { studentId: { $exists: true } },
        sourceVariableName: "PROFILE_FIND_FILTER",
        sourceFunction: "buildStudentSuccessGraph",
      }),
      buildQuerySourceTrace({
        queryName: "find_students",
        collection: "users",
        filter: { role: "student" },
        sourceVariableName: "STUDENT_FIND_FILTER",
        sourceFunction: "buildStudentSuccessGraph",
      }),
    ];

    expect(pickPrimaryQuerySourceEntry(entries, "find_students")?.sourceVariableName).toBe(
      "STUDENT_FIND_FILTER"
    );
  });
});
