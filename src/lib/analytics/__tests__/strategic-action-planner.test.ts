import { describe, expect, it } from "vitest";
import { buildStrategicActionPlan } from "@/lib/analytics/ai/strategic-action-planner";
import type { ExecutiveAiDecision } from "@/lib/analytics/ai/ai-decision-schema";

describe("strategic-action-planner", () => {
  it("builds roadmap phases", () => {
    const plan = buildStrategicActionPlan([]);
    expect(plan.roadmap).toHaveLength(4);
  });
});
