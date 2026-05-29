import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import GlobalAnalyticsNavigation from "@/components/analytics/GlobalAnalyticsNavigation";
import { defaultExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";

describe("executive-navigation", () => {
  it("renders back control and breadcrumb region", () => {
    const html = renderToStaticMarkup(
      <GlobalAnalyticsNavigation isAr={false} f={defaultExecutiveFilterSnapshot()} backHref="/admin" />
    );
    expect(html).toContain("Back");
  });
});
