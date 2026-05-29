import { describe, expect, it } from "vitest";
import {
  DENSITY_SECTION_DEFAULTS,
  isSectionVisibleInDensity,
  layerDefaultCollapsed,
  NAV_SECTIONS,
} from "@/lib/analytics/intelligence-workspace-hierarchy";

describe("intelligence-workspace-hierarchy", () => {
  it("defines six navigation sections in layer order", () => {
    expect(NAV_SECTIONS.length).toBe(7);
    expect(NAV_SECTIONS[0]!.layer).toBe(1);
    expect(NAV_SECTIONS.find((s) => s.id === "recommendations")?.layer).toBe(4);
  });

  it("hides deep layers in executive density", () => {
    expect(isSectionVisibleInDensity(5, "executive")).toBe(false);
    expect(isSectionVisibleInDensity(6, "executive")).toBe(false);
    expect(isSectionVisibleInDensity(4, "executive")).toBe(true);
  });

  it("shows all layers in deep mode", () => {
    expect(isSectionVisibleInDensity(6, "deep")).toBe(true);
  });

  it("collapses heavy sections in executive mode by default", () => {
    expect(layerDefaultCollapsed(5, "executive")).toBe(true);
    expect(DENSITY_SECTION_DEFAULTS.executive.maxRecommendationCards).toBe(3);
  });
});
