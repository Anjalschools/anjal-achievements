import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExecutiveDecisionWorkspace } from "@/components/analytics/ExecutiveDecisionWorkspace";

describe("executive-decision-workspace", () => {
  it("renders empty state without data", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExecutiveDecisionWorkspace, {
        isAr: false,
        filterFingerprint: "fp",
        data: null,
        insights: { insights: [], hasData: false },
        narratives: [],
        strategicInsights: [],
      })
    );
    expect(html).toContain("No executive decisions");
  });
});
