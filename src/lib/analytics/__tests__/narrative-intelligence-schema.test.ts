import { describe, expect, it } from "vitest";
import { createSemanticInsight } from "@/lib/analytics/intelligence/analytics-narrative-schema";

describe("narrative-intelligence-schema", () => {
  it("creates insight with required fields", () => {
    const ins = createSemanticInsight({
      id: "x1",
      titleAr: "عنوان",
      titleEn: "Title",
      severity: "WARNING",
      confidence: "MEDIUM",
    });
    expect(ins.id).toBe("x1");
    expect(ins.severity).toBe("WARNING");
    expect(ins.evidence).toEqual([]);
  });
});
