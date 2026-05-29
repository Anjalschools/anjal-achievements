import { describe, expect, it } from "vitest";
import { EXECUTIVE_NAV_REGISTRY } from "@/lib/analytics/executive-nav-registry";
import { EXECUTIVE_SECTION_IDS } from "@/components/analytics/executive/ExecutiveSectionVisibilityStore";

describe("executive-navigator", () => {
  it("registry has 15 executive sections", () => {
    expect(EXECUTIVE_NAV_REGISTRY).toHaveLength(15);
    expect(EXECUTIVE_SECTION_IDS).toHaveLength(15);
  });

  it("each nav entry has unique anchor and order", () => {
    const anchors = new Set(EXECUTIVE_NAV_REGISTRY.map((e) => e.anchorId));
    expect(anchors.size).toBe(15);
    const orders = EXECUTIVE_NAV_REGISTRY.map((e) => e.order).sort((a, b) => a - b);
    expect(orders[0]).toBe(1);
    expect(orders[14]).toBe(15);
  });
});
