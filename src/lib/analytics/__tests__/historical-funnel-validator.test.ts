import { describe, expect, it } from "vitest";
import {
  validateHistoricalFunnel,
  validateTransitionLegality,
} from "@/lib/analytics/historical-funnel-validator";

describe("historical-funnel-validator", () => {
  it("rejects illegal skip transitions", () => {
    expect(
      validateTransitionLegality({
        key: "participation_training",
        from: "participation",
        to: "qualification",
        sourceCount: 50,
        targetCount: 10,
        conversionRate: 20,
        retention: 20,
        leakageRate: 80,
        valid: true,
      })
    ).toBe(false);
  });

  it("validates empty funnel as invalid", () => {
    const r = validateHistoricalFunnel(null);
    expect(r.valid).toBe(false);
  });
});
