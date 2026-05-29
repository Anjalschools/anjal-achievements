import { describe, expect, it } from "vitest";
import { EXECUTIVE_DESIGN, resolveDensityTokens } from "@/lib/analytics/analytics-executive-design-tokens";

describe("executive-design-system", () => {
  it("exposes spacing and density tokens", () => {
    expect(EXECUTIVE_DESIGN.spacing.sectionGap).toBeTruthy();
    expect(resolveDensityTokens("executive").rowHeight).toBeGreaterThan(0);
  });
});

