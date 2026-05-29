/**
 * strategic-intelligence.test.ts
 * Unit tests for the Strategic Academic Intelligence Expansion.
 */
import { describe, it, expect } from "vitest";

// ── Activity intelligence ───────────────────────────────────────────────────
import { buildActivityTimeline } from "../ai/activity-intelligence/activity-timeline-builder";
import { buildStudentProgression } from "../ai/activity-intelligence/activity-progression-engine";
import { buildAchievementDensity } from "../ai/activity-intelligence/achievement-density-engine";
import { buildLongitudinalProfile } from "../ai/activity-intelligence/longitudinal-intelligence";
import type { RawActivityRecord } from "../ai/activity-intelligence/student-activity-loader";

// ── Competition graph ───────────────────────────────────────────────────────
import {
  resolveStudentPathwayPosition,
} from "../ai/competition-graph/competition-pathway-engine";
import {
  computeStudentGraphScores,
} from "../ai/competition-graph/graph-scoring-engine";

// ── Executive intelligence ──────────────────────────────────────────────────
import { buildExecutiveInsights } from "../ai/executive-intelligence/executive-insights-engine";
import type { InstitutionalSnapshot } from "../ai/executive-intelligence/executive-insight-types";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const makeRecord = (
  year: number,
  activityKey: string,
  outcomeKey: string,
  medalType: string | null = null
): RawActivityRecord => ({
  id: `${year}-${activityKey}`,
  userId: "student-1",
  achievementYear: year,
  canonicalActivityKey: activityKey,
  activityLabelAr: activityKey,
  activityLabelEn: activityKey,
  achievementType: "competition",
  achievementClassification: "academic",
  resultType: outcomeKey.split(":")[0]!,
  outcomeKey,
  medalType,
  rank: null,
  achievementLevel: "8",
  grade: "8",
  section: "arabic",
  stage: "middle",
  mawhiba: false,
  olympiadMeeting: "",
  olympiadField: "",
  standardizedScore: null,
  status: "approved",
});

/* ─── Activity Timeline ──────────────────────────────────────────────────── */

describe("buildActivityTimeline", () => {
  it("returns events sorted by year ascending", () => {
    const records = [
      makeRecord(2024, "bebras", "medal:gold", "gold"),
      makeRecord(2022, "bebras", "participation"),
    ];
    const timeline = buildActivityTimeline("u1", records);
    expect(timeline.events[0]!.year).toBe(2022);
    expect(timeline.events[1]!.year).toBe(2024);
    expect(timeline.firstYear).toBe(2022);
    expect(timeline.lastYear).toBe(2024);
  });
});

/* ─── Activity Progression ───────────────────────────────────────────────── */

describe("buildStudentProgression", () => {
  it('detects "accelerating" for 3-year quality improvement', () => {
    const records = [
      makeRecord(2022, "bebras", "participation"),
      makeRecord(2023, "bebras", "medal:bronze", "bronze"),
      makeRecord(2024, "bebras", "medal:silver", "silver"),
    ];
    const timeline = buildActivityTimeline("u1", records);
    const prog = buildStudentProgression(timeline);
    expect(prog.trend).toBe("accelerating");
    expect(prog.momentum).not.toBe("none");
    expect(prog.futurePotential).not.toBe("low");
  });

  it('detects "declining" trend', () => {
    const records = [
      makeRecord(2022, "bebras", "medal:gold", "gold"),
      makeRecord(2023, "bebras", "medal:bronze", "bronze"),
      makeRecord(2024, "bebras", "participation"),
    ];
    const timeline = buildActivityTimeline("u1", records);
    const prog = buildStudentProgression(timeline);
    expect(["declining", "volatile"]).toContain(prog.trend);
  });

  it('returns "emerging" for single-year data', () => {
    const records = [makeRecord(2024, "bebras", "medal:silver", "silver")];
    const timeline = buildActivityTimeline("u1", records);
    const prog = buildStudentProgression(timeline);
    expect(prog.trend).toBe("emerging");
  });
});

/* ─── Achievement Density ────────────────────────────────────────────────── */

describe("buildAchievementDensity", () => {
  it("counts medals correctly", () => {
    const records = [
      makeRecord(2022, "bebras", "medal:gold", "gold"),
      makeRecord(2023, "bebras", "medal:silver", "silver"),
      makeRecord(2024, "bebras", "participation"),
    ];
    const density = buildAchievementDensity(records);
    expect(density.goldCount).toBe(1);
    expect(density.silverCount).toBe(1);
    expect(density.medalCount).toBe(2);
    expect(density.medalDensityPct).toBeCloseTo(66.7, 0);
  });
});

/* ─── Longitudinal Profile ───────────────────────────────────────────────── */

describe("buildLongitudinalProfile", () => {
  it("produces expected top-level keys for accelerating student", () => {
    const records = [
      makeRecord(2022, "bebras", "participation"),
      makeRecord(2023, "bebras", "medal:bronze", "bronze"),
      makeRecord(2024, "bebras", "medal:silver", "silver"),
    ];
    const profile = buildLongitudinalProfile("u1", records);
    expect(profile.growthTrend).toBe("accelerating");
    expect(profile.achievementMomentum).not.toBe("none");
    expect(profile.summary).toContain("accelerating");
  });
});

/* ─── Competition Graph ──────────────────────────────────────────────────── */

describe("resolveStudentPathwayPosition", () => {
  it("identifies bebras → kangaroo progression", () => {
    const keys = new Set(["bebras", "kangaroo"]);
    const pos = resolveStudentPathwayPosition("math_ladder", keys);
    expect(pos.completedNodes).toContain("bebras");
    expect(pos.completedNodes).toContain("kangaroo");
    expect(pos.nextNodeKey).toBe("kaust_math");
  });

  it("returns not-started position for empty keys", () => {
    const pos = resolveStudentPathwayPosition("math_ladder", new Set());
    expect(pos.completedNodes.length).toBe(0);
    expect(pos.currentNodeIndex).toBe(-1);
  });
});

describe("computeStudentGraphScores", () => {
  it("awards olympiad potential for olympiad activity history", () => {
    const records = [
      makeRecord(2022, "nasmo", "qualification"),
      makeRecord(2023, "olympiad_training", "participation"),
    ];
    const profile = buildLongitudinalProfile("u1", records);
    const scores = computeStudentGraphScores(profile);
    expect(scores.olympiadPotential).toBeGreaterThan(40);
  });
});

/* ─── Executive Intelligence ─────────────────────────────────────────────── */

describe("buildExecutiveInsights", () => {
  const snapshot: InstitutionalSnapshot = {
    schoolBreakdown: [
      {
        schoolId: "s1",
        schoolName: "مدرسة النموذج",
        totalStudents: 500,
        totalParticipations: 150,
        medalCount: 20,
        awardCount: 40,
        currentYear: 150,
        previousYear: 80,
        growthRatePct: 87,
        activityCount: 6,
      },
      {
        schoolId: "s2",
        schoolName: "مدرسة المثال",
        totalStudents: 300,
        totalParticipations: 20,
        medalCount: 2,
        awardCount: 4,
        currentYear: 20,
        previousYear: 60,
        growthRatePct: -66,
        activityCount: 2,
      },
    ],
    stageBreakdown: [
      {
        stage: "middle",
        section: "arabic",
        totalStudents: 400,
        totalParticipations: 30,
        participationRatePct: 7,
        medalCount: 3,
        awardCount: 5,
      },
    ],
    activityBreakdown: [
      {
        activityKey: "ibdaa",
        activityLabelAr: "إبداع",
        domain: "research",
        participations: 60,
        currentYear: 60,
        previousYear: 30,
        growthRatePct: 100,
        awardCount: 15,
      },
    ],
    yearOverYear: [
      { year: 2021, totalParticipations: 200, totalAwards: 40, medalCount: 20, activeSchools: 5 },
      { year: 2022, totalParticipations: 220, totalAwards: 45, medalCount: 22, activeSchools: 6 },
      { year: 2023, totalParticipations: 210, totalAwards: 42, medalCount: 21, activeSchools: 6 },
      { year: 2024, totalParticipations: 400, totalAwards: 80, medalCount: 40, activeSchools: 8 },
    ],
    studentSamples: [
      {
        userId: "u1",
        displayName: "أحمد محمد",
        recentTrend: "accelerating",
        momentum: "high",
        peakQuality: 80,
        recentQuality: 80,
        olympiadTrajectory: "strong",
      },
    ],
  };

  it("generates growth insight for fast-growing school", () => {
    const bundle = buildExecutiveInsights(snapshot);
    const growthInsights = bundle.insights.filter((i) => i.insightType === "growth");
    expect(growthInsights.length).toBeGreaterThan(0);
    expect(growthInsights[0]!.affectedEntity).toBe("مدرسة النموذج");
  });

  it("generates decline insight for declining school", () => {
    const bundle = buildExecutiveInsights(snapshot);
    const declineInsights = bundle.insights.filter((i) => i.insightType === "decline");
    expect(declineInsights.length).toBeGreaterThan(0);
  });

  it("generates risk insight for weak stage", () => {
    const bundle = buildExecutiveInsights(snapshot);
    const risk = bundle.insights.filter((i) => i.insightType === "risk" && i.affectedEntityType === "stage");
    expect(risk.length).toBeGreaterThan(0);
  });

  it("generates talent_detection insight", () => {
    const bundle = buildExecutiveInsights(snapshot);
    const talent = bundle.insights.filter((i) => i.insightType === "talent_detection");
    expect(talent.length).toBeGreaterThan(0);
  });

  it("generates track_rise insight for ibdaa growth", () => {
    const bundle = buildExecutiveInsights(snapshot);
    const rise = bundle.insights.filter((i) => i.insightType === "track_rise");
    expect(rise.length).toBeGreaterThan(0);
  });

  it("returns topInsights as top 5 by severity", () => {
    const bundle = buildExecutiveInsights(snapshot);
    expect(bundle.topInsights.length).toBeLessThanOrEqual(5);
  });
});
