import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExecutiveAccordionSummary from "@/components/analytics/executive/ExecutiveAccordionSummary";

describe("executive-accordion-summary", () => {
  it("renders collapsed KPI insight warning and confidence", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExecutiveAccordionSummary, {
        isAr: false,
        kpi: "42%",
        insight: "Strong participation",
        warning: "Equity gap",
        confidence: "HIGH",
      })
    );
    expect(html).toContain("KPI: 42%");
    expect(html).toContain("Strong participation");
    expect(html).toContain("Equity gap");
    expect(html).toContain("High");
  });
});
