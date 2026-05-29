import { describe, expect, it } from "vitest";
import { computeRenderingBudget, resolveEffectiveDisplayMode } from "@/lib/analytics/adaptive-rendering-budget";

describe("adaptive-rendering-budget", () => {
  it("recommends condensed mode when budget exceeded", () => {
    const model = {
      yearGroups: Array.from({ length: 6 }).map((_, i) => ({
        year: 2020 + i,
        metrics: Array.from({ length: 6 }).map((__, j) => ({ key: `m${j}`, labelAr: "m", labelEn: "m" })),
      })),
      rows: Array.from({ length: 10 }).map((_, i) => ({
        key: `r${i}`,
        labelAr: "r",
        labelEn: "r",
        cells: {},
      })),
    } as any;
    const budget = computeRenderingBudget(model, "analyst");
    expect(budget.exceedsBudget).toBe(true);
    expect(resolveEffectiveDisplayMode("analyst", model)).toBe("executive");
  });
});

