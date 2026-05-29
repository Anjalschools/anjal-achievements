import { describe, expect, it } from "vitest";
import { composeExecutiveReportDocument } from "@/lib/analytics/export/analytics-executive-report-layout";

describe("executive-report-rtl", () => {
  it("uses rtl for arabic reports", () => {
    const html = composeExecutiveReportDocument({
      isAr: true,
      title: "ع",
      subtitle: "ب",
      generatedAt: "x",
      sections: [],
    });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
  });
});
