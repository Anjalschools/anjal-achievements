import { describe, expect, it } from "vitest";
import { composeExecutiveReportDocument } from "@/lib/analytics/export/analytics-executive-report-layout";

describe("executive-pdf-layout", () => {
  it("composes multi-section document with cover and toc", () => {
    const html = composeExecutiveReportDocument({
      isAr: true,
      title: "تقرير",
      subtitle: "ملخص",
      generatedAt: "2025-01-01",
      sections: [
        { id: "historical", titleAr: "تاريخي", titleEn: "Historical", html: "<table></table>", landscape: true },
      ],
    });
    expect(html).toContain("cover-page");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("فهرس المحتويات");
  });
});
