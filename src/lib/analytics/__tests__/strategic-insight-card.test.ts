import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StrategicInsightCard from "@/components/analytics/executive/insights/StrategicInsightCard";
import { createSemanticInsight } from "@/lib/analytics/intelligence/analytics-narrative-schema";

describe("strategic-insight-card", () => {
  it("renders executive title and impact", () => {
    const insight = createSemanticInsight({
      id: "t1",
      titleAr: "فرصة توسع",
      titleEn: "Expansion opportunity",
      descriptionAr: "ملخص تنفيذي",
      descriptionEn: "Executive summary",
      severity: "OPPORTUNITY",
      confidence: "HIGH",
      impact: "high",
      evidence: ["metric_a"],
      strategicMeaning: "معنى استراتيجي",
    });
    const html = renderToStaticMarkup(
      React.createElement(StrategicInsightCard, { isAr: true, insight })
    );
    expect(html).toContain("فرصة توسع");
    expect(html).toContain("92%");
  });
});
