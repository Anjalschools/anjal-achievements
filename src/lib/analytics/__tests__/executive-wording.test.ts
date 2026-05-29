import { describe, expect, it } from "vitest";
import { formatExecutiveCagr } from "@/lib/analytics/ai/executive-intelligence/executive-wording-engine";
import { dedupeExecutiveNarratives } from "@/lib/analytics/ai/executive-intelligence/executive-insight-dedupe";

describe("executive-wording-engine", () => {
  it("caps extreme CAGR for display", () => {
    const r = formatExecutiveCagr(136.3, 4, { locale: "ar" });
    expect(r.capped).toBe(true);
    expect(r.display).toContain("85");
  });
});

describe("executive-insight-dedupe", () => {
  it("removes duplicate growth narratives for same activity", () => {
    const out = dedupeExecutiveNarratives([
      {
        id: "sustained_growth_leader",
        priority: 95,
        activityKey: "kangaroo",
        bodyAr: "كانجارو نمو قوي",
        bodyEn: "Kangaroo strong growth",
      },
      {
        id: "growth_secondary",
        priority: 90,
        activityKey: "kangaroo",
        bodyAr: "كانجارو أسرع نمو",
        bodyEn: "Kangaroo fastest growth",
      },
      {
        id: "other",
        priority: 80,
        bodyAr: "بيبراس مستقر",
        bodyEn: "Bebras stable",
      },
    ]);
    const kangarooCount = out.filter((n) => n.activityKey === "kangaroo").length;
    expect(kangarooCount).toBe(1);
  });
});
