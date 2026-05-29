import { describe, expect, it } from "vitest";
import { normalizeDecimal } from "@/lib/analytics/analytics-number-formatting";
import { resolveSmartSemanticValue } from "@/lib/analytics/analytics-smart-semantic-values";

describe("smart-number-formatting", () => {
  it("normalizes floating noise", () => {
    expect(normalizeDecimal(74.299999999, 1)).toBe(74.3);
  });

  it("does not show raw zero as NA for counts", () => {
    const v = resolveSmartSemanticValue({
      metricKey: "participation",
      raw: 0,
      loc: "en",
      hasParticipationScope: true,
    });
    expect(v.display).toBe("0");
  });
});
