import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExecutiveDecisionPriorityQueue from "@/components/analytics/decision/ExecutiveDecisionPriorityQueue";

describe("executive-decision-priority-queue", () => {
  it("renders queue items", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExecutiveDecisionPriorityQueue, {
        isAr: false,
        title: "Priorities",
        decisions: [
          {
            id: "1",
            title: "t",
            titleAr: "ع",
            titleEn: "T",
            executiveSummary: "",
            executiveSummaryAr: "ملخص",
            executiveSummaryEn: "Sum",
            severity: "WARNING",
            confidence: "HIGH",
            urgency: "medium",
            impact: "medium",
            evidence: [],
            rationale: "",
            rationaleAr: "",
            rationaleEn: "",
            affectedDimensions: [],
            suggestedActions: [],
            expectedOutcome: "",
            expectedOutcomeAr: "",
            expectedOutcomeEn: "",
            strategicCategory: "Execution",
            timeHorizon: "short_term",
            decisionType: "intervention",
            historicalSupport: false,
            generatedAt: "",
            sourceMetrics: [],
            sourceInsights: [],
            fingerprint: "f",
            priorityScore: 1,
          },
        ],
      })
    );
    expect(html).toContain("Priorities");
    expect(html).toContain("Sum");
  });
});
