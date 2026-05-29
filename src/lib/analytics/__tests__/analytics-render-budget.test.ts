import { describe, expect, it } from "vitest";
import { clampToBudget, resolveDowngradeMode } from "@/lib/analytics/analytics-render-budget";

describe("analytics-render-budget", () => {
  it("downgrades when over row budget", () => {
    expect(resolveDowngradeMode({ maxTableRows: 200 })).toBe("compact");
    expect(resolveDowngradeMode({ maxTableRows: 500 })).toBe("minimal");
  });

  it("clamps arrays to budget", () => {
    expect(clampToBudget([1, 2, 3, 4], 2)).toHaveLength(2);
  });
});
