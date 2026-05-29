import { describe, expect, it } from "vitest";
import {
  formatPercentage,
  normalizeDecimal,
  ratioToPercentage,
  sanitizeDisplayNumber,
} from "@/lib/analytics/analytics-number-formatting";

describe("analytics-number-formatting", () => {
  it("normalizes floating precision leakage", () => {
    expect(normalizeDecimal(62.900000000000006, 1)).toBe(62.9);
    expect(normalizeDecimal(33.300000000000004, 1)).toBe(33.3);
  });

  it("formats percentages without float artifacts", () => {
    const s = formatPercentage(62.900000000000006, "en", { decimals: 1 });
    expect(s).toBe("62.9%");
    expect(s).not.toContain("000000");
  });

  it("computes ratio percentages safely", () => {
    expect(ratioToPercentage(3, 10)).toBe(30);
  });

  it("sanitizes raw display numbers without float leakage", () => {
    const s = sanitizeDisplayNumber(62.900000000000006);
    expect(s).not.toContain("000000");
    expect(s.endsWith("%") || s.includes("٪")).toBe(true);
  });
});
