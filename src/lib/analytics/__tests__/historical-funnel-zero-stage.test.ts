import { describe, expect, it } from "vitest";
import {
  buildStableEducationalFunnel,
  stopZeroContinuity,
  type NormalizedFunnelStages,
} from "@/lib/analytics/historical-funnel-intelligence";

describe("historical-funnel-zero-stage", () => {
  it("stopZeroContinuity zeros downstream after first zero stage", () => {
    const stages: NormalizedFunnelStages = {
      participation: 50,
      training: 0,
      qualification: 10,
      award: 5,
      acceptance: 2,
      international: 1,
    };
    const { displayStages, terminatedAt } = stopZeroContinuity(stages);
    expect(terminatedAt).toBe("training");
    expect(displayStages.qualification).toBe(0);
    expect(displayStages.award).toBe(0);
    expect(displayStages.participation).toBe(50);
  });

  it("does not emit valid transitions after zero break", () => {
    const funnel = buildStableEducationalFunnel([
      { year: 2023, payload: { kpis: { totalParticipations: 0, nominationCount: 0 }, table: [] } as never },
      { year: 2024, payload: { kpis: { totalParticipations: 0, nominationCount: 0 }, table: [] } as never },
    ]);
    const latest = funnel.snapshots[funnel.snapshots.length - 1];
    if (latest) {
      const invalidAfterBreak = latest.transitions.filter(
        (t) => t.from === "training" || t.from === "qualification"
      );
      expect(invalidAfterBreak.every((t) => !t.valid || t.retention === 0)).toBe(true);
    }
    expect(funnel.funnelTerminationReason).toBeDefined();
  });
});
