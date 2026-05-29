import { describe, expect, it } from "vitest";
import { getSmartResultsMetrics } from "@/lib/analytics/historical-smart-results-table";

describe("historical-smart-table-layout", () => {
  it("uses award_rate for competition tables", () => {
    const cols = getSmartResultsMetrics("medals");
    expect(cols.some((c) => c.key === "award_rate")).toBe(true);
    expect(cols.some((c) => c.key === "conversion")).toBe(false);
  });

  it("uses completion_rate for training tables", () => {
    const cols = getSmartResultsMetrics("training_program");
    expect(cols.some((c) => c.key === "completion_rate")).toBe(true);
  });
});
