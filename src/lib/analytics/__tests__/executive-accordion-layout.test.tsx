import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExecutiveAccordionSection from "@/components/analytics/executive/ExecutiveAccordionSection";

describe("executive-accordion-layout", () => {
  it("renders collapsed header without mounting children", () => {
    const html = renderToStaticMarkup(
      <ExecutiveAccordionSection
        id="test-section"
        title="Test"
        isAr={false}
        defaultOpen={false}
      >
        <div id="heavy-child">Heavy</div>
      </ExecutiveAccordionSection>
    );
    expect(html).toContain("Test");
    expect(html).not.toContain("heavy-child");
  });
});
