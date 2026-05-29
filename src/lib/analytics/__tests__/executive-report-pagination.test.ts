import { describe, expect, it } from "vitest";
import { splitTableRowsIntoPages, continuationBanner } from "@/lib/analytics/export/analytics-report-pagination";

describe("executive-report-pagination", () => {
  it("splits long row lists", () => {
    const rows = Array.from({ length: 50 }, (_, i) => `<tr>${i}</tr>`);
    const chunks = splitTableRowsIntoPages(rows, 20);
    expect(chunks.length).toBe(3);
    expect(chunks[0]!.length).toBe(20);
  });

  it("renders continuation banner", () => {
    expect(continuationBanner(true, 2, 3)).toContain("تابع");
  });
});
