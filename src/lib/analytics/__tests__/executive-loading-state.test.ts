import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StrategicInsightSkeleton from "@/components/analytics/executive/loading/StrategicInsightSkeleton";
import ExcellenceWorkspaceSkeleton from "@/components/analytics/executive/loading/ExcellenceWorkspaceSkeleton";
import HistoricalLoadingTimeline from "@/components/analytics/executive/loading/HistoricalLoadingTimeline";

describe("executive-loading-state", () => {
  it("renders strategic insight skeleton", () => {
    const html = renderToStaticMarkup(React.createElement(StrategicInsightSkeleton));
    expect(html).toContain("aria-busy");
  });

  it("renders excellence workspace skeleton", () => {
    const html = renderToStaticMarkup(React.createElement(ExcellenceWorkspaceSkeleton));
    expect(html).toContain("animate-pulse");
  });

  it("renders historical timeline skeleton", () => {
    const html = renderToStaticMarkup(React.createElement(HistoricalLoadingTimeline));
    expect(html.length).toBeGreaterThan(20);
  });
});
