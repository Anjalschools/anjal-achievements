import { describe, expect, it } from "vitest";
import { confidenceFromNumeric } from "@/lib/analytics/ai/ai-decision-confidence";

describe("ai-decision-confidence", () => {
  it("maps numeric scores to bands", () => {
    expect(confidenceFromNumeric(0.9)).toBe("HIGH");
    expect(confidenceFromNumeric(0.6)).toBe("MEDIUM");
    expect(confidenceFromNumeric(0.2)).toBe("LOW");
    expect(confidenceFromNumeric(0.9, true)).toBe("EXPLORATORY");
  });
});
