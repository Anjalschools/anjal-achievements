import { describe, expect, it } from "vitest";
import { confidenceFromSignal } from "@/lib/analytics/intelligence/analytics-insight-confidence";

describe("narrative-confidence-engine", () => {
  it("returns exploratory when sparse", () => {
    expect(confidenceFromSignal({ hasParticipation: true, hasOutcome: false, yearSpan: 1, sparse: true })).toBe(
      "EXPLORATORY"
    );
  });

  it("returns high with outcomes and years", () => {
    expect(
      confidenceFromSignal({ hasParticipation: true, hasOutcome: true, yearSpan: 3 })
    ).toBe("HIGH");
  });
});
