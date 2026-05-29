import { describe, expect, it } from "vitest";
import { getPdfPageLayout } from "@/lib/pdf/pdf-page-layout-engine";

describe("getPdfPageLayout", () => {
  it("returns consistent landscape geometry for all exports", () => {
    const layout = getPdfPageLayout("landscape");
    expect(layout.pageWidth).toBe(297);
    expect(layout.pageHeight).toBe(210);
    expect(layout.contentStartY).toBeGreaterThan(layout.marginTop);
    expect(layout.headerHeight).toBe(46);
    expect(layout.contentEndY).toBeLessThan(layout.pageHeight);
    expect(layout.printableWidth).toBe(layout.pageWidth - layout.marginLeft - layout.marginRight);
  });
});
