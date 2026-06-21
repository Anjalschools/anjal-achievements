import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  analyzeSnapshotPayload,
  buildSnapshotFieldSizes,
  SchoolIntelligenceSnapshotPayloadTooLargeError,
  SNAPSHOT_PAYLOAD_LIMIT_BYTES,
  SNAPSHOT_PAYLOAD_WARN_BYTES,
} from "@/lib/school-intelligence/school-intelligence-snapshot-payload-trace";
import { guardSnapshotPayloadBeforeSave } from "@/lib/school-intelligence/school-intelligence-snapshot-payload-guard";
import { classifySchoolIntelligenceFailure } from "@/lib/school-intelligence/school-intelligence-root-cause-capture";

describe("school-intelligence-snapshot-payload-trace", () => {
  it("measures snapshot payload components", () => {
    const trace = analyzeSnapshotPayload(
      {
        studentSuccessGraph: {
          topStudents: [{ studentId: "1", fullNameAr: "Test" }],
          totalNodes: 1,
        },
        strategicInsights: [{ title: "Insight" }],
        diagnostics: { status: "degraded" },
      },
      "full_payload:school_intelligence_payload"
    );

    expect(trace.payloadBytes).toBeGreaterThan(0);
    expect(trace.jsonBytes).toBe(trace.payloadBytes);
    expect(trace.topLevelKeys).toContain("studentSuccessGraph");
    expect(trace.largestTopLevelField).toBeDefined();
    expect(trace.saveTarget).toBe("full_payload:school_intelligence_payload");
  });

  it("tracks nested field sizes by name", () => {
    const fieldSizes = buildSnapshotFieldSizes({
      studentSuccessGraph: {
        nodes: [{ id: "1" }, { id: "2" }],
        graph: { edges: [{ from: "1", to: "2" }] },
      },
      opportunityMapping: [{ id: "opp-1" }],
      opportunities: [{ id: "opp-1", label: "Summer program" }],
      longitudinalGrowth: [{ year: 2024 }],
      growth: [{ year: 2024, index: 1.2 }],
    });

    expect(fieldSizes.nodes).toBeGreaterThan(0);
    expect(fieldSizes.graph).toBeGreaterThan(0);
    expect(fieldSizes.opportunities).toBeGreaterThan(0);
    expect(fieldSizes.growth).toBeGreaterThan(0);
  });

  it("throws snapshot_payload_too_large before BSON RangeError", () => {
    expect(() =>
      guardSnapshotPayloadBeforeSave(
        {
          studentSuccessGraph: {
            topStudents: Array.from({ length: 1000 }, (_, index) => ({
              studentId: String(index),
              blob: "x".repeat(20_000),
            })),
          },
        },
        "full_payload:school_intelligence_payload"
      )
    ).toThrow("snapshot_payload_too_large");
  });

  it("classifies snapshot payload failures", () => {
    const trace = analyzeSnapshotPayload({ ok: true }, "query:users:find_students");
    const error = new SchoolIntelligenceSnapshotPayloadTooLargeError({
      ...trace,
      payloadBytes: SNAPSHOT_PAYLOAD_LIMIT_BYTES + 1,
    });

    expect(error.message).toBe("snapshot_payload_too_large");
    expect(classifySchoolIntelligenceFailure({ errorMessage: error.message })).toBe(
      "Snapshot Payload Too Large"
    );
    expect(SNAPSHOT_PAYLOAD_WARN_BYTES).toBeLessThan(SNAPSHOT_PAYLOAD_LIMIT_BYTES);
  });
});
