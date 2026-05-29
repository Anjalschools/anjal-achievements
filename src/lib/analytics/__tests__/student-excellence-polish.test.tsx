import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentExcellenceWorkspace } from "@/components/analytics/StudentExcellenceWorkspace";

describe("student-excellence-polish", () => {
  it("renders excellence workspace header", () => {
    const html = renderToStaticMarkup(
      <StudentExcellenceWorkspace
        isAr={false}
        data={
          {
            ok: true,
            generatedAt: new Date().toISOString(),
            filters: {},
            byWeightedScore: [],
            byParticipation: [],
            byMedals: [],
            bySuccessRate: [],
            byActivityDiversity: [],
            byFastestGrowth: [],
          } as any
        }
      />
    );
    expect(html).toContain("Student excellence intelligence");
  });
});
