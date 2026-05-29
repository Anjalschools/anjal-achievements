import { describe, expect, it } from "vitest";
import {
  buildValidatedFunnelNarrative,
  isValidFunnelTransition,
} from "@/lib/analytics/historical-funnel-semantics";
import type { HistoricalFunnelIntelligence } from "@/lib/analytics/historical-funnel-intelligence";

describe("historical-funnel-semantics", () => {
  it("rejects invalid transition from terminal without valid denominator", () => {
    expect(
      isValidFunnelTransition({
        key: "acceptance_international",
        from: "acceptance",
        to: "international",
        sourceCount: 1,
        targetCount: 1,
        conversionRate: 100,
        retention: 100,
        leakageRate: 0,
        valid: true,
      })
    ).toBe(false);
  });

  it("returns null narrative when funnel insufficient", () => {
    expect(buildValidatedFunnelNarrative({ sufficient: false } as HistoricalFunnelIntelligence)).toBeNull();
  });
});
