import { describe, expect, it } from "vitest";
import { computeExecutiveChartBudget } from "@/lib/analytics/executive-performance-budget";

describe("executive-performance-budget", () => {
  it("defers advanced charts when complexity exceeds budget", () => {
    const budget = computeExecutiveChartBudget({
      chartCount: 8,
      yearCount: 10,
      rowCount: 20,
    });
    expect(budget.exceedsBudget).toBe(true);
    expect(budget.deferAdvancedCharts).toBe(true);
    expect(budget.maxVisibleCharts).toBeLessThanOrEqual(4);
  });

  it("keeps full charts within budget", () => {
    const budget = computeExecutiveChartBudget({
      chartCount: 3,
      yearCount: 2,
      rowCount: 5,
    });
    expect(budget.exceedsBudget).toBe(false);
    expect(budget.deferAdvancedCharts).toBe(false);
  });
});
