import { describe, expect, it } from "vitest";
import {
  computeRenderingBudget,
  resolveEffectiveDisplayMode,
} from "@/lib/analytics/adaptive-rendering-budget";

describe("adaptive-render-budget-v2", () => {
  it("downgrades analyst mode on large tables", () => {
    const model = {
      yearGroups: Array.from({ length: 5 }).map((_, i) => ({
        year: 2020 + i,
        metrics: Array.from({ length: 8 }).map((__, j) => ({ key: `m${j}` })),
      })),
      rows: Array.from({ length: 12 }).map((_, i) => ({ key: `r${i}`, cells: {} })),
    } as any;
    expect(resolveEffectiveDisplayMode("analyst", model)).not.toBe("analyst");
    expect(computeRenderingBudget(model, "analyst").exceedsBudget).toBe(true);
  });
});
