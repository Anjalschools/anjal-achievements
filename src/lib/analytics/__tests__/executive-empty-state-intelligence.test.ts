import { describe, expect, it } from "vitest";
import { resolveExecutiveEmptyState } from "@/lib/analytics/analytics-empty-state-intelligence";

describe("executive-empty-state-intelligence", () => {
  it("detects partial signal", () => {
    const s = resolveExecutiveEmptyState({ hasPartialSignal: true });
    expect(s.kind).toBe("exploratory");
  });

  it("detects narrow filters", () => {
    const s = resolveExecutiveEmptyState({ filterCount: 6 });
    expect(s.kind).toBe("incompatible_filters");
  });
});
