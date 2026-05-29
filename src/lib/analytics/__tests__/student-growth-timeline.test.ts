import { describe, expect, it } from "vitest";
import {
  buildGrowthTimeline,
  computeCagrPercent,
} from "@/lib/analytics/student-excellence-derivations";
import type { StudentIntelRow } from "@/lib/student-intelligence-analytics";

describe("student-growth-timeline", () => {
  it("builds timeline points and CAGR", () => {
    const row: StudentIntelRow = {
      participantId: "p1",
      nameAr: "x",
      nameEn: "x",
      avatarUrl: "",
      school: "",
      stageKey: "primary",
      stageLabelAr: "",
      stageLabelEn: "",
      sectionKey: "",
      mawhiba: false,
      recordCount: 12,
      medalCount: 3,
      medalRatioPct: 25,
      distinctActivityCount: 2,
      yearSpan: 4,
      growthIndex: 1.2,
    };
    const points = buildGrowthTimeline(row);
    expect(points.length).toBe(4);
    const cagr = computeCagrPercent(points);
    expect(typeof cagr).toBe("number");
  });
});
