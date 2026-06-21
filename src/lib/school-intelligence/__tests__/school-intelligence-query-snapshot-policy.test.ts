import { describe, expect, it } from "vitest";
import {
  applyQuerySnapshotPolicy,
  buildQuerySnapshotMetadataPayload,
  extractQueryResultSampleIds,
  QUERY_SNAPSHOT_DISABLED_KEYS,
  resolveQuerySnapshotMode,
} from "@/lib/school-intelligence/school-intelligence-query-snapshot-policy";
import { SNAPSHOT_PAYLOAD_LIMIT_BYTES, SNAPSHOT_PAYLOAD_WARN_BYTES } from "@/lib/school-intelligence/school-intelligence-snapshot-payload-trace";

describe("school-intelligence-query-snapshot-policy", () => {
  it("disables persistence for find_students and find_profiles", () => {
    for (const key of QUERY_SNAPSHOT_DISABLED_KEYS) {
      const result = applyQuerySnapshotPolicy({
        snapshotKey: key,
        saveTarget: `query:${key}`,
        payload: [{ _id: "1", fullName: "Student" }],
        collection: "users",
        queryName: key.split(":")[1] ?? key,
        executionMs: 120,
      });

      expect(result.shouldPersist).toBe(false);
      expect(result.diagnostics.mode).toBe("disabled");
      expect(result.diagnostics.storedBytes).toBe(0);
      expect(result.diagnostics.downgraded).toBe(false);
    }
  });

  it("downgrades oversized payloads to metadata_only", () => {
    const largePayload = Array.from({ length: 2000 }, (_, index) => ({
      _id: String(index),
      blob: "x".repeat(5000),
    }));

    const result = applyQuerySnapshotPolicy({
      snapshotKey: "achievements:student_intelligence_facet",
      saveTarget: "query:achievements:student_intelligence_facet",
      payload: largePayload,
      collection: "achievements",
      queryName: "student_intelligence_facet",
      executionMs: 450,
    });

    expect(result.shouldPersist).toBe(true);
    expect(result.diagnostics.mode).toBe("metadata_only");
    expect(result.diagnostics.downgraded).toBe(true);
    expect(result.diagnostics.originalBytes).toBeGreaterThan(SNAPSHOT_PAYLOAD_WARN_BYTES);
    expect(result.diagnostics.storedBytes).toBeLessThan(SNAPSHOT_PAYLOAD_WARN_BYTES);
    expect(result.payload).toMatchObject({
      snapshotMode: "metadata_only",
      count: 2000,
      executionMs: 450,
      queryName: "student_intelligence_facet",
      collection: "achievements",
    });
  });

  it("skips persistence when payload exceeds hard limit", () => {
    const mode = resolveQuerySnapshotMode(
      "achievements:aggregate_rankings",
      SNAPSHOT_PAYLOAD_LIMIT_BYTES + 1
    );

    expect(mode.mode).toBe("disabled");
    expect(mode.downgraded).toBe(true);
  });

  it("stores metadata only with capped sample ids and checksum", () => {
    const metadata = buildQuerySnapshotMetadataPayload({
      result: Array.from({ length: 30 }, (_, index) => ({ _id: String(index) })),
      collection: "users",
      queryName: "find_students",
      executionMs: 88,
      generatedAt: "2026-06-18T00:00:00.000Z",
    });

    expect(metadata.count).toBe(30);
    expect(metadata.sampleIds).toHaveLength(20);
    expect(metadata.checksum).toMatch(/^[0-9a-f]{8}$/);
    expect(extractQueryResultSampleIds(metadata)).toEqual([]);
  });

  it("allows full persistence for small payloads", () => {
    const result = applyQuerySnapshotPolicy({
      snapshotKey: "achievements:count_active",
      saveTarget: "query:achievements:count_active",
      payload: { total: 42 },
      collection: "achievements",
      queryName: "count_active",
      executionMs: 12,
    });

    expect(result.shouldPersist).toBe(true);
    expect(result.diagnostics.mode).toBe("full");
    expect(result.diagnostics.downgraded).toBe(false);
    expect(result.payload).toEqual({ total: 42 });
  });
});
