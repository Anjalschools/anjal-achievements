import { describe, expect, it } from "vitest";
import { resolveSmartSemanticValue, EMPTY_DASH, EMPTY_NA } from "@/lib/analytics/analytics-smart-semantic-values";

describe("analytics-smart-semantic-values", () => {
  it("returns — when explicitMissing is true", () => {
    const r = resolveSmartSemanticValue({
      metricKey: "participation",
      raw: null,
      loc: "en",
      explicitMissing: true,
    });
    expect(r.display).toBe(EMPTY_DASH);
    expect(r.isMissing).toBe(true);
  });

  it("returns 0 (not —) when participation exists but outcomes are zero", () => {
    const r = resolveSmartSemanticValue({
      metricKey: "gold",
      raw: 0,
      loc: "en",
      hasParticipationScope: true,
      verifiedOutcomeSource: true,
    });
    expect(r.display).toBe("0");
    expect(r.kind).toBe("zero");
  });

  it("returns N/A for total row rate columns when aggregatable is false", () => {
    const r = resolveSmartSemanticValue({
      metricKey: "award_rate",
      raw: 0,
      loc: "en",
      isTotalRow: true,
      aggregatable: false,
    });
    expect(r.display).toBe(EMPTY_NA);
    expect(r.kind).toBe("na");
  });

  it("hides ranking metrics when no verified source exists", () => {
    const r = resolveSmartSemanticValue({
      metricKey: "rankings",
      raw: 0,
      loc: "en",
      verifiedOutcomeSource: false,
    });
    expect(r.kind).toBe("hidden");
    expect(r.display).toBe(EMPTY_DASH);
  });
});

