import { describe, expect, it } from "vitest";
import { simulateDecisionImpact } from "@/lib/analytics/ai/decision-impact-simulator";

describe("decision-impact-simulator", () => {
  it("returns bounded simulation", () => {
    const sim = simulateDecisionImpact({
      decision: { decisionType: "award_improvement", impact: "high", urgency: "high" },
      impact: "high",
      confidence: "HIGH",
    });
    expect(sim.institutionalBenefitScore).toBeLessThanOrEqual(100);
    expect(sim.expectedParticipationChangePct).toBeGreaterThan(0);
  });
});
