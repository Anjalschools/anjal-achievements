import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StrategicInsightGrid from "@/components/analytics/executive/insights/StrategicInsightGrid";
import { createSemanticInsight } from "@/lib/analytics/intelligence/analytics-narrative-schema";

describe("strategic-insight-grid", () => {
  it("renders empty state when no insights", () => {
    const html = renderToStaticMarkup(
      React.createElement(StrategicInsightGrid, { isAr: false, insights: [] })
    );
    expect(html).toContain("No compatible data");
  });

  it("renders cards for insights", () => {
    const insight = createSemanticInsight({
      id: "g1",
      titleAr: "رؤية",
      titleEn: "Insight",
      severity: "INFO",
      confidence: "MEDIUM",
    });
    const html = renderToStaticMarkup(
      React.createElement(StrategicInsightGrid, { isAr: false, insights: [insight] })
    );
    expect(html).toContain('role="list"');
    expect(html).toContain("Insight");
  });
});
