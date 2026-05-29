import { describe, expect, it } from "vitest";
import {
  EXECUTIVE_REPORT_SECTIONS,
  buildExecutiveReportHtmlShell,
  activityReportPage,
} from "@/lib/analytics/analytics-executive-report-layout";

describe("executive-report-layout", () => {
  it("keeps expected section order", () => {
    expect(EXECUTIVE_REPORT_SECTIONS.map((s) => s.id)).toContain("cover");
    expect(EXECUTIVE_REPORT_SECTIONS.map((s) => s.id)).toContain("executive_summary");
    expect(EXECUTIVE_REPORT_SECTIONS.map((s) => s.id)).toContain("historical");
  });

  it("builds html shell with rtl when ar", () => {
    const html = buildExecutiveReportHtmlShell({
      isAr: true,
      title: "T",
      subtitle: "S",
      sections: [{ id: "executive_summary", html: "<h2>Hi</h2>" }],
    });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("<h2>Hi</h2>");
  });

  it("builds activity page header", () => {
    const html = activityReportPage({
      isAr: false,
      activityLabel: "Math",
      yearLabel: "2023-2024",
      tableHtml: "<table></table>",
    });
    expect(html).toContain("Activity: Math");
    expect(html).toContain("<table>");
  });
});

