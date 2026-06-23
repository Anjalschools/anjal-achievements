import { describe, expect, it } from "vitest";
import { analyzeAchievementTrainingCorrelation } from "@/lib/talent-pathway/achievement-training-correlation";
import { buildAlumniTalentPreparation } from "@/lib/talent-pathway/alumni-talent-preparation";
import { identifyHighPotentialStudents } from "@/lib/talent-pathway/talent-discovery-alerts";
import { buildTalentFutureRecommendations } from "@/lib/talent-pathway/talent-future-recommendations";
import { computeTalentCareerReadinessIndex } from "@/lib/talent-pathway/talent-career-readiness-index";
import { buildLongitudinalGrowthSeries } from "@/lib/talent-pathway/talent-longitudinal-growth";
import {
  careerReadinessIndexLabel,
  talentAreaLabel,
} from "@/lib/talent-pathway/talent-pathway-constants";
import { buildStudentTalentProfile } from "@/lib/talent-pathway/student-talent-profile";

describe("phase T.2.5 — talent pathway intelligence", () => {
  it("builds studentTalentProfile with primary talent areas", () => {
    const profile = buildStudentTalentProfile({
      achievementCategories: ["technology", "programming", "robotics"],
      competitionCount: 4,
      olympiadCount: 2,
      medalCount: 3,
      trainingOutcomeScore: 82,
      recommendationRatePct: 88,
      grade: "12",
      section: "A",
      targetMajors: ["علوم الحاسب"],
      careerInterests: ["برمجة"],
      trainingCategories: ["technology"],
    });

    expect(profile.primaryTalentAreas.length).toBeGreaterThan(0);
    expect(profile.primaryTalentAreas[0]?.key).toBe("technical");
    expect(talentAreaLabel("technical", true)).toBe("تقني");
  });

  it("analyzes achievement-training correlation pathways", () => {
    const correlation = analyzeAchievementTrainingCorrelation([
      {
        achievementArea: "technical",
        trainingCategory: "technology",
        trainingOutcomeScore: 88,
        consistencyScore: 90,
        studentCount: 1,
      },
      {
        achievementArea: "research",
        trainingCategory: "university",
        trainingOutcomeScore: 76,
        consistencyScore: 72,
        studentCount: 1,
      },
    ]);

    expect(correlation.strongestPathways.length).toBeGreaterThan(0);
    expect(correlation.recurringSuccessPatterns.length).toBeGreaterThan(0);
    expect(correlation.talentClusters.length).toBeGreaterThan(0);
  });

  it("computes careerReadinessIndex with Arabic bands", () => {
    const index = computeTalentCareerReadinessIndex({
      achievementsScore: 85,
      trainingHours: 120,
      trainingCount: 2,
      avgTrainingRating: 4.5,
      leadershipActivities: 3,
      certificationCount: 2,
      participationQualityScore: 80,
      recommendationRatePct: 90,
    });

    expect(index.careerReadinessIndex).toBeGreaterThanOrEqual(40);
    expect(index.careerReadinessIndex).toBeLessThanOrEqual(100);
    expect(careerReadinessIndexLabel(index.careerReadinessBand, true)).toBeTruthy();
  });

  it("generates future recommendations from talent profile", () => {
    const profile = buildStudentTalentProfile({
      achievementCategories: ["health", "science"],
      competitionCount: 2,
      olympiadCount: 1,
      medalCount: 1,
      targetMajors: ["طب"],
      careerInterests: ["صحة"],
      trainingCategories: ["health"],
    });

    const recs = buildTalentFutureRecommendations({
      studentTalentProfile: profile,
      trainingCount: 0,
      competitionCount: 1,
      targetMajors: ["طب"],
      trainingOutcomeScore: 60,
    });

    expect(recs.some((row) => row.type === "training")).toBe(true);
    expect(recs.some((row) => row.type === "competition")).toBe(true);
  });

  it("identifies high-potential students", () => {
    const alerts = identifyHighPotentialStudents([
      {
        studentId: "s1",
        studentName: "Student One",
        achievementScore: 88,
        trainingOutcomeScore: 85,
        consistencyScore: 90,
        recommendationRatePct: 92,
      },
      {
        studentId: "s2",
        studentName: "Student Two",
        achievementScore: 40,
        trainingOutcomeScore: 35,
        consistencyScore: 30,
        recommendationRatePct: 20,
      },
    ]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.studentId).toBe("s1");
  });

  it("tracks longitudinal growth across years", () => {
    const growth = buildLongitudinalGrowthSeries({
      achievementByYear: { "2023": 2, "2024": 5, "2025": 8 },
      trainingHoursByYear: { "2023": 40, "2024": 80, "2025": 120 },
      talentScoreByYear: { "2023": 30, "2024": 55, "2025": 78 },
      careerReadinessByYear: { "2023": 25, "2024": 50, "2025": 72 },
    });

    expect(growth.achievementGrowth).toHaveLength(3);
    expect(growth.overallTrend).toBe("rising");
  });

  it("builds alumni preparation outputs", () => {
    const profile = buildStudentTalentProfile({
      achievementCategories: ["leadership"],
      competitionCount: 2,
      olympiadCount: 0,
      medalCount: 2,
      targetMajors: ["إدارة أعمال"],
      careerInterests: ["قيادة"],
      trainingCategories: ["administrative"],
    });
    const readiness = computeTalentCareerReadinessIndex({
      achievementsScore: 70,
      trainingHours: 80,
      trainingCount: 1,
      leadershipActivities: 4,
      participationQualityScore: 65,
    });

    const prep = buildAlumniTalentPreparation(profile, readiness, ["إدارة أعمال"]);
    expect(prep.recommendedMentors.length).toBeGreaterThan(0);
    expect(prep.careerPathways.length).toBeGreaterThan(0);
    expect(prep.universityPreparation.length).toBeGreaterThan(0);
  });
});
