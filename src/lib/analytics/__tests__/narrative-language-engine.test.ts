import { describe, expect, it } from "vitest";
import { executivePhrase, softenOverclaim } from "@/lib/analytics/intelligence/analytics-executive-language-engine";

describe("narrative-language-engine", () => {
  it("uses executive phrasing in arabic", () => {
    const t = executivePhrase("WARNING", "فجوة أداء", true, "MEDIUM");
    expect(t).toContain("فجوة أداء");
  });

  it("softens low confidence claims", () => {
    const t = softenOverclaim("نص", "LOW", true);
    expect(t).toContain("مزيد من البيانات");
  });
});
