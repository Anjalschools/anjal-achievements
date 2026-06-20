import { describe, expect, it } from "vitest";
import {
  assertBsonSafeMongoQuery,
  BSON_IN_BATCH_COUNT,
  buildMongoQueryInstrumentation,
  countIdsInFilter,
  findForbiddenFilterObjects,
  measureSerializedBytes,
  resolveFilterChunks,
  sanitizeMongoFilter,
  splitFilterByInArraySize,
  splitFilterByInCount,
} from "@/lib/school-intelligence/school-intelligence-bson-safety";
import {
  buildFirstFailureRecord,
  classifySchoolIntelligenceFailure,
  createSchoolIntelligenceMongoFailureError,
} from "@/lib/school-intelligence/school-intelligence-root-cause-capture";

describe("school-intelligence-bson-safety", () => {
  it("measures serialized query bytes", () => {
    const filter = { role: "student" };
    expect(measureSerializedBytes(filter)).toBeGreaterThan(0);
    expect(buildMongoQueryInstrumentation({ filter, projection: "_id fullName" }).projectionFields).toEqual([
      "_id",
      "fullName",
    ]);
  });

  it("counts ids in $in filters", () => {
    expect(
      countIdsInFilter({
        _id: { $in: ["a", "b", "c"] },
      })
    ).toBe(3);
  });

  it("detects forbidden embedded objects in filters", () => {
    const violations = findForbiddenFilterObjects({
      diagnostics: { generatedAt: "2024-01-01" },
    });
    expect(violations).toContain("filter.diagnostics");
  });

  it("throws query_payload_too_large before BSON RangeError", () => {
    expect(() =>
      assertBsonSafeMongoQuery({
        collection: "users",
        operation: "find_students",
        filter: { diagnostics: { payload: "x".repeat(20_000_000) } },
        timeoutMs: 8000,
      })
    ).toThrow("query_payload_too_large");
  });

  it("chunks oversized $in arrays", () => {
    const ids = Array.from({ length: 2000 }, (_, index) => `id-${index}-${"x".repeat(3000)}`);
    const filter = { _id: { $in: ids } };
    const chunks = splitFilterByInArraySize(filter, 500_000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(
      chunks.reduce(
        (total, chunk) => total + ((chunk._id as { $in: unknown[] }).$in.length ?? 0),
        0
      )
    ).toBe(ids.length);
  });

  it("splits _id.$in into 5000-id batches", () => {
    const ids = Array.from({ length: 12_000 }, (_, index) => `student-${index}`);
    const filter = { _id: { $in: ids } };
    const chunks = splitFilterByInCount(filter, BSON_IN_BATCH_COUNT);
    expect(chunks).toHaveLength(3);
    expect((chunks[0]._id as { $in: string[] }).$in).toHaveLength(5000);
    expect((chunks[2]._id as { $in: string[] }).$in).toHaveLength(2000);
  });

  it("sanitizes document-shaped $in values to primitive ids", () => {
    const sanitized = sanitizeMongoFilter({
      userId: { $in: [{ _id: "abc123" }, { _id: "def456" }] },
    });
    expect((sanitized.userId as { $in: unknown[] }).$in).toEqual(["abc123", "def456"]);
  });

  it("auto-resolves chunk mode for oversized source filters", () => {
    const ids = Array.from({ length: BSON_IN_BATCH_COUNT + 1 }, (_, index) => `id-${index}`);
    const resolved = resolveFilterChunks({ studentId: { $in: ids } });
    expect(resolved.chunkedRecoveryUsed).toBe(true);
    expect(resolved.chunks.length).toBe(2);
    expect(resolved.chunkSize).toBe(BSON_IN_BATCH_COUNT);
  });

  it("rejects forbidden payload objects inside $in arrays", () => {
    expect(() =>
      sanitizeMongoFilter({
        _id: { $in: [{ diagnostics: { payload: "x" }, _id: "1" }] },
      })
    ).toThrow("query_payload_too_large");
  });

  it("surfaces BSON diagnostics on first failure record", () => {
    const failure = buildFirstFailureRecord({
      section: "buildStudentSuccessGraph",
      service: "student_success_graph",
      durationMs: 12,
      error: createSchoolIntelligenceMongoFailureError(new Error("query_payload_too_large"), {
        mongoCollection: "users",
        mongoOperation: "find_students",
        timeoutMs: 8000,
        durationMs: 12,
        documentsReturned: 0,
        querySizeBytes: 17_825_795,
        pipelineSizeBytes: 0,
        arrayLength: 5000,
        serializedBytes: 17_825_795,
        limitBytes: 16_000_000,
        offendingFilterPath: "filter._id.$in",
      }),
    });

    expect(failure.querySizeBytes).toBe(17_825_795);
    expect(failure.arrayLength).toBe(5000);
    expect(failure.offendingFilterPath).toBe("filter._id.$in");
    expect(classifySchoolIntelligenceFailure({ errorMessage: "query_payload_too_large" })).toBe(
      "Query Payload Too Large"
    );
  });
});
