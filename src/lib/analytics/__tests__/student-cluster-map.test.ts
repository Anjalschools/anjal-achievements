import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StudentEliteClusterMap from "@/components/analytics/excellence/StudentEliteClusterMap";
import { detectEliteClusters } from "@/lib/analytics/student-excellence-derivations";
import type { StudentIntelligencePayload } from "@/lib/student-intelligence-analytics";

const emptyPayload: StudentIntelligencePayload = {
  ok: true,
  generatedAt: new Date().toISOString(),
  filters: {},
  byWeightedScore: [],
  byParticipation: [],
  byMedals: [],
  bySuccessRate: [],
  byActivityDiversity: [],
  byFastestGrowth: [],
};

describe("student-cluster-map", () => {
  it("detects clusters from payload", () => {
    const clusters = detectEliteClusters(emptyPayload);
    expect(Array.isArray(clusters)).toBe(true);
  });

  it("renders cluster labels", () => {
    const html = renderToStaticMarkup(
      React.createElement(StudentEliteClusterMap, {
        isAr: false,
        clusters: [
          {
            id: "medals",
            labelAr: "نخبة",
            labelEn: "Elite",
            memberIds: ["a", "b"],
            score: 2,
          },
        ],
      })
    );
    expect(html).toContain("Elite");
    expect(html).toContain("2 students");
  });
});
