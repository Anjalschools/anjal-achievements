import { describe, expect, it } from "vitest";
import { computeWithFingerprint, clearComputationGraph } from "@/lib/analytics/analytics-computation-graph";

describe("historical-performance-regression", () => {
  it("skips recompute when fingerprint unchanged", () => {
    clearComputationGraph();
    let runs = 0;
    const factory = () => {
      runs += 1;
      return { ok: true };
    };
    computeWithFingerprint("hist-trend", "fp-1", factory);
    computeWithFingerprint("hist-trend", "fp-1", factory);
    expect(runs).toBe(1);
    computeWithFingerprint("hist-trend", "fp-2", factory);
    expect(runs).toBe(2);
  });
});
