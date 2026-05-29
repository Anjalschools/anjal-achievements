import { describe, expect, it } from "vitest";
import { buildStudentRadarProfile } from "@/lib/analytics/student-excellence-derivations";
import type { StudentIntelRow } from "@/lib/student-intelligence-analytics";

const sampleRow: StudentIntelRow = {
  participantId: "p1",
  nameAr: "أحمد",
  nameEn: "Ahmad",
  avatarUrl: "",
  school: "S",
  stageKey: "middle",
  stageLabelAr: "متوسط",
  stageLabelEn: "Middle",
  sectionKey: "arabic",
  mawhiba: true,
  recordCount: 10,
  medalCount: 4,
  medalRatioPct: 40,
  distinctActivityCount: 3,
  growthIndex: 2,
  yearSpan: 3,
};

describe("student-excellence-radar", () => {
  it("builds six radar axes", () => {
    const axes = buildStudentRadarProfile(sampleRow);
    expect(axes).toHaveLength(6);
    expect(axes.map((a) => a.key)).toEqual([
      "participation",
      "awards",
      "medals",
      "consistency",
      "growth",
      "leadership",
    ]);
    for (const axis of axes) {
      expect(axis.value).toBeGreaterThanOrEqual(0);
      expect(axis.value).toBeLessThanOrEqual(100);
    }
  });
});
