import { describe, expect, it } from "vitest";
import {
  buildBsonSerializationTrace,
  buildSerializationBreakdown,
  normalizeProjectionForTrace,
  resolveOffendingComponent,
  truncatePreview,
} from "@/lib/school-intelligence/school-intelligence-bson-serialization-trace";
import { BSON_QUERY_SAFE_LIMIT_BYTES } from "@/lib/school-intelligence/school-intelligence-bson-safety";
import { buildFirstFailureRecord, mergeSerializationTraceIntoMongoContext } from "@/lib/school-intelligence/school-intelligence-root-cause-capture";

describe("school-intelligence-bson-serialization-trace", () => {
  it("measures BSON components separately", () => {
    const breakdown = buildSerializationBreakdown({
      filter: { role: "student" },
      projection: "_id fullNameAr grade",
      options: { skip: 0, limit: 500, lean: true },
      populate: [{ path: "profile" }],
      pipeline: [{ $match: { status: "approved" } }],
    });

    expect(breakdown.filter).toBeGreaterThan(0);
    expect(breakdown.projection).toBeGreaterThan(0);
    expect(breakdown.options).toBeGreaterThan(0);
    expect(breakdown.populate).toBeGreaterThan(0);
    expect(breakdown.pipeline).toBeGreaterThan(0);
    expect(breakdown.total).toBe(
      breakdown.filter + breakdown.projection + breakdown.options + breakdown.populate + breakdown.pipeline
    );
  });

  it("identifies the largest offending component", () => {
    const hugeFilter = { _id: { $in: Array.from({ length: 5000 }, (_, i) => `id-${i}-${"x".repeat(100)}`) } };
    const trace = buildBsonSerializationTrace({
      queryName: "find_students",
      collection: "users",
      filter: hugeFilter,
      projection: "_id",
      options: { lean: true },
    });

    expect(trace.offendingComponent).toBe("filter");
    expect(trace.filterBytes).toBeGreaterThan(trace.projectionBytes);
  });

  it("truncates pre-serialize previews to 2KB", () => {
    const preview = truncatePreview({ payload: "x".repeat(5000) });
    expect(preview).toContain("[truncated]");
    expect(Buffer.byteLength(preview ?? "", "utf8")).toBeLessThanOrEqual(2048);
  });

  it("normalizes string projections for byte measurement", () => {
    const normalized = normalizeProjectionForTrace("_id fullName grade");
    expect(normalized).toEqual({ _id: 1, fullName: 1, grade: 1 });
  });

  it("merges serialization trace into first failure diagnostics", () => {
    const trace = buildBsonSerializationTrace({
      queryName: "find_students",
      collection: "users",
      filter: { role: "student" },
      projection: "_id fullNameAr fullName fullNameEn grade section isMawhibaStudent profilePhoto",
      options: { skip: 1000, limit: 500, lean: true },
    });

    const merged = mergeSerializationTraceIntoMongoContext(
      {
        mongoCollection: "users",
        mongoOperation: "find_students",
        timeoutMs: 8000,
        durationMs: 12,
        documentsReturned: 0,
      },
      trace
    );

    const rangeError = new Error("The value of offset is out of range");
    rangeError.name = "RangeError";
    const failure = buildFirstFailureRecord({
      section: "buildStudentSuccessGraph",
      service: "student_success_graph",
      durationMs: 12,
      error: rangeError,
    });

    expect(merged.offendingComponent).toBeDefined();
    expect(merged.serializationBreakdown?.total).toBeGreaterThan(0);
    expect(resolveOffendingComponent(trace.serializationBreakdown, BSON_QUERY_SAFE_LIMIT_BYTES)).toBeDefined();
    expect(failure.failureClassification).toBe("Query Payload Too Large");
  });
});
