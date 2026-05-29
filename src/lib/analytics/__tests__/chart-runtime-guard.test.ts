import { describe, expect, it, vi } from "vitest";
import {
  validateCountBarSeries,
  validateStackedGenderSeries,
} from "@/lib/analytics/runtime/chart-runtime-guard";

describe("chart-runtime-guard", () => {
  it("rejects empty stacked gender series", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = validateStackedGenderSeries("test-chart", [
      { name: "عربي", male: 0, female: 0 },
    ]);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("empty");
    warn.mockRestore();
  });

  it("accepts valid stacked gender series", () => {
    const res = validateStackedGenderSeries("test-chart", [
      { name: "عربي", male: 12, female: 8 },
      { name: "دولي", male: 4, female: 6 },
    ]);
    expect(res.ok).toBe(true);
    expect(res.total).toBe(30);
  });

  it("accepts valid stage count bars", () => {
    const res = validateCountBarSeries(
      "stage",
      [
        { name: "ابتدائي", n: 5 },
        { name: "متوسط", n: 3 },
      ],
      "n"
    );
    expect(res.ok).toBe(true);
    expect(res.data).toHaveLength(2);
  });
});
