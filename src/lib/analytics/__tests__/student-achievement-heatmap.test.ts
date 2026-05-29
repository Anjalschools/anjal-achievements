import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StudentAchievementHeatmap from "@/components/analytics/excellence/StudentAchievementHeatmap";
import type { StudentIntelRow } from "@/lib/student-intelligence-analytics";
import { buildAchievementHeatmap } from "@/lib/analytics/student-excellence-derivations";

const row: StudentIntelRow = {
  participantId: "p1",
  nameAr: "أ",
  nameEn: "A",
  avatarUrl: "",
  school: "",
  stageKey: "primary",
  stageLabelAr: "",
  stageLabelEn: "",
  sectionKey: "",
  mawhiba: false,
  recordCount: 5,
  medalCount: 2,
  medalRatioPct: 40,
  distinctActivityCount: 2,
};

describe("student-achievement-heatmap", () => {
  it("builds heatmap cells from rows", () => {
    const cells = buildAchievementHeatmap([row]);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells[0]!.intensity).toBeGreaterThanOrEqual(0);
  });

  it("renders heatmap grid", () => {
    const html = renderToStaticMarkup(
      React.createElement(StudentAchievementHeatmap, { isAr: false, rows: [row] })
    );
    expect(html).toContain("grid");
  });
});
