import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StrategicInsightEmptyState from "@/components/analytics/executive/insights/StrategicInsightEmptyState";

describe("executive-empty-state", () => {
  it("renders reason and exploratory confidence", () => {
    const html = renderToStaticMarkup(
      React.createElement(StrategicInsightEmptyState, { isAr: false, filterCount: 0 })
    );
    expect(html).toContain("No compatible data");
    expect(html).toContain("exploratory");
  });
});
