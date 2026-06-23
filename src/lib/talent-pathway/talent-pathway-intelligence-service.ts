import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentCareerProfile from "@/models/StudentCareerProfile";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import User from "@/models/User";
import VolunteerRecord from "@/models/VolunteerRecord";
import { loadStudentActivityBundle } from "@/lib/analytics/ai/activity-intelligence/student-activity-loader";
import {
  buildStudentAchievementSummary,
} from "@/lib/partnerships/build-student-achievement-summary";
import { analyzeTrainingReportConsistency } from "@/lib/partnerships/training-report-consistency";
import { computeTrainingOutcomeIntelligence } from "@/lib/partnerships/training-outcome-intelligence";
import { computeOrganizationTrainingQualityIndex } from "@/lib/partnerships/training-organization-quality-index";
import { buildAlumniTalentPreparation } from "@/lib/talent-pathway/alumni-talent-preparation";
import {
  analyzeAchievementTrainingCorrelation,
  type AchievementTrainingCorrelationInput,
} from "@/lib/talent-pathway/achievement-training-correlation";
import { identifyHighPotentialStudents } from "@/lib/talent-pathway/talent-discovery-alerts";
import { buildTalentFutureRecommendations } from "@/lib/talent-pathway/talent-future-recommendations";
import { computeTalentCareerReadinessIndex } from "@/lib/talent-pathway/talent-career-readiness-index";
import { buildLongitudinalGrowthSeries } from "@/lib/talent-pathway/talent-longitudinal-growth";
import {
  buildStudentTalentProfile,
  type StudentTalentProfileInput,
} from "@/lib/talent-pathway/student-talent-profile";
import type {
  AlumniTalentPreparationPayload,
  ExecutiveTalentIntelligence,
  StudentTalentPathwayPayload,
} from "@/lib/talent-pathway/talent-pathway-intelligence-types";
import { TALENT_AREAS, type TalentAreaKey } from "@/lib/talent-pathway/talent-pathway-constants";

export type {
  AlumniTalentPreparationPayload,
  ExecutiveTalentIntelligence,
  StudentTalentPathwayPayload,
} from "@/lib/talent-pathway/talent-pathway-intelligence-types";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const avg = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const inferPrimaryTalentArea = (text: string): TalentAreaKey => {
  const normalized = text.toLowerCase();
  for (const area of TALENT_AREAS) {
    if (area.signals.some((signal) => normalized.includes(signal.toLowerCase()))) {
      return area.key;
    }
  }
  return "research";
};

const buildTalentInputFromStudent = async (studentId: string) => {
  await connectDB();
  const [activityBundle, achievementSummary, careerProfile, user, trainingRecords, volunteerRecords] =
    await Promise.all([
      loadStudentActivityBundle(studentId),
      buildStudentAchievementSummary(studentId, "ar"),
      StudentCareerProfile.findOne({ studentId: new mongoose.Types.ObjectId(studentId) }).lean(),
      User.findById(studentId).select("grade section fullName fullNameAr fullNameEn").lean(),
      TrainingCompletionRecord.find({ studentId: new mongoose.Types.ObjectId(studentId) }).lean(),
      VolunteerRecord.find({ studentId: new mongoose.Types.ObjectId(studentId), status: "approved" })
        .select("hours academicYear")
        .lean(),
    ]);

  const orgIds = [...new Set(trainingRecords.map((row) => String(row.organizationId)).filter(Boolean))];
  const orgs =
    orgIds.length > 0
      ? await PartnerOrganization.find({ _id: { $in: orgIds } }).select("category name").lean()
      : [];
  const orgCategoryMap = new Map(orgs.map((org) => [String(org._id), String(org.category || "")]));

  const achievementCategories = activityBundle.records.flatMap((row) =>
    [
      row.achievementType,
      row.achievementClassification,
      row.activityLabelAr,
      row.activityLabelEn,
      row.olympiadField,
    ].filter(Boolean)
  );

  const olympiadCount = activityBundle.records.filter(
    (row) => row.achievementType === "olympiad" || Boolean(row.olympiadField)
  ).length;
  const competitionCount = activityBundle.records.filter((row) =>
    /competition|مسابق/i.test(`${row.achievementType} ${row.activityLabelAr}`)
  ).length;

  const trainingRatings = trainingRecords.flatMap((row) =>
    [row.studentBenefitRating, row.practicalBenefitRating, row.supervisorCooperationRating, row.workEnvironmentRating]
      .filter((value): value is number => typeof value === "number")
  );
  const avgTrainingRating = trainingRatings.length ? avg(trainingRatings) : null;
  const trainingHours = trainingRecords.reduce((sum, row) => sum + Number(row.volunteerHours || 0), 0);
  const recommendationCount = trainingRecords.filter((row) => row.recommendInstitutionToPeers === true).length;
  const recommendationRatePct = trainingRecords.length
    ? clamp((recommendationCount / trainingRecords.length) * 100)
    : 0;

  const consistencyScores = trainingRecords.map((row) => analyzeTrainingReportConsistency(row).consistencyScore);
  const avgConsistency = consistencyScores.length ? avg(consistencyScores) : 0;

  const outcome = computeTrainingOutcomeIntelligence({
    studentSatisfaction: avgTrainingRating ?? 0,
    institutionEvaluation: avg(
      trainingRecords
        .map((row) => row.overallRecommendation)
        .filter((value): value is number => typeof value === "number")
    ),
    consistencyScore: avgConsistency,
    recommendationRatePct,
  });

  const leadershipActivities = activityBundle.records.filter((row) =>
    /lead|قياد|president|captain|initiative|مبادرة/i.test(
      `${row.activityLabelAr} ${row.activityLabelEn} ${row.achievementClassification}`
    )
  ).length;

  const participationQualityScore = clamp(
    achievementSummary.excellenceScore * 0.5 +
      achievementSummary.medalCount * 8 +
      achievementSummary.participationCount * 3
  );

  const talentInput: StudentTalentProfileInput = {
    achievementCategories: [...new Set(achievementCategories)],
    competitionCount,
    olympiadCount,
    medalCount: achievementSummary.medalCount,
    trainingOutcomeScore: outcome.outcomeScore,
    recommendationRatePct,
    grade: user?.grade ? String(user.grade) : undefined,
    section: user?.section ? String(user.section) : undefined,
    targetMajors: careerProfile?.targetMajors || [],
    careerInterests: careerProfile?.careerInterests || [],
    trainingCategories: trainingRecords
      .map((row) => orgCategoryMap.get(String(row.organizationId)) || "")
      .filter(Boolean),
  };

  const achievementByYear: Record<string, number> = {};
  for (const row of activityBundle.records) {
    const year = String(row.achievementYear || "unknown");
    achievementByYear[year] = (achievementByYear[year] || 0) + 1;
  }

  const trainingHoursByYear: Record<string, number> = {};
  for (const row of trainingRecords) {
    const year = String(row.academicYear || "unknown");
    trainingHoursByYear[year] = (trainingHoursByYear[year] || 0) + Number(row.volunteerHours || 0);
  }

  const volunteerByYear: Record<string, number> = {};
  for (const row of volunteerRecords) {
    const year = String(row.academicYear || "unknown");
    volunteerByYear[year] = (volunteerByYear[year] || 0) + Number(row.hours || 0);
  }

  return {
    user,
    achievementSummary,
    talentInput,
    trainingRecords,
    orgCategoryMap,
    outcome,
    avgTrainingRating,
    trainingHours,
    trainingCount: trainingRecords.length,
    leadershipActivities,
    participationQualityScore,
    recommendationRatePct,
    avgConsistency,
    achievementByYear,
    trainingHoursByYear,
    volunteerByYear,
    targetMajors: careerProfile?.targetMajors || [],
  };
};

export const buildStudentTalentPathway = async (
  studentId: string
): Promise<StudentTalentPathwayPayload> => {
  const ctx = await buildTalentInputFromStudent(studentId);
  const studentTalentProfile = buildStudentTalentProfile(ctx.talentInput);

  const careerReadinessIndex = computeTalentCareerReadinessIndex({
    achievementsScore: ctx.achievementSummary.excellenceScore,
    trainingHours: ctx.trainingHours,
    trainingCount: ctx.trainingCount,
    avgTrainingRating: ctx.avgTrainingRating,
    leadershipActivities: ctx.leadershipActivities,
    certificationCount: ctx.trainingRecords.filter((row) => String(row.status) === "approved").length,
    participationQualityScore: ctx.participationQualityScore,
    recommendationRatePct: ctx.recommendationRatePct,
  });

  const correlationRows: AchievementTrainingCorrelationInput[] = ctx.trainingRecords.map((record) => ({
    achievementArea: inferPrimaryTalentArea(
      ctx.talentInput.achievementCategories.join(" ") || studentTalentProfile.primaryTalentAreas[0]?.key || "research"
    ),
    trainingCategory: ctx.orgCategoryMap.get(String(record.organizationId)),
    trainingOutcomeScore: ctx.outcome.outcomeScore,
    consistencyScore: analyzeTrainingReportConsistency(record).consistencyScore,
    studentCount: 1,
  }));

  const achievementTrainingCorrelation = analyzeAchievementTrainingCorrelation(correlationRows);

  const futureRecommendations = buildTalentFutureRecommendations({
    studentTalentProfile,
    trainingCount: ctx.trainingCount,
    competitionCount: ctx.talentInput.competitionCount,
    targetMajors: ctx.targetMajors,
    trainingOutcomeScore: ctx.outcome.outcomeScore,
  });

  const talentScoreByYear: Record<string, number> = {};
  const careerReadinessByYear: Record<string, number> = {};
  const years = [
    ...new Set([
      ...Object.keys(ctx.achievementByYear),
      ...Object.keys(ctx.trainingHoursByYear),
      ...Object.keys(ctx.volunteerByYear),
    ]),
  ].sort();

  for (const year of years) {
    talentScoreByYear[year] = clamp(
      (ctx.achievementByYear[year] || 0) * 12 +
        (ctx.trainingHoursByYear[year] || 0) * 0.4 +
        (ctx.volunteerByYear[year] || 0) * 0.3
    );
    careerReadinessByYear[year] = clamp(
      (ctx.achievementByYear[year] || 0) * 10 + (ctx.trainingHoursByYear[year] || 0) * 0.35
    );
  }

  const longitudinalGrowth = buildLongitudinalGrowthSeries({
    achievementByYear: ctx.achievementByYear,
    trainingHoursByYear: ctx.trainingHoursByYear,
    talentScoreByYear,
    careerReadinessByYear,
  });

  return {
    generatedAt: new Date().toISOString(),
    studentTalentProfile,
    careerReadinessIndex,
    achievementTrainingCorrelation,
    futureRecommendations,
    longitudinalGrowth,
  };
};

export const buildStudentAlumniTalentPreparation = async (
  studentId: string
): Promise<AlumniTalentPreparationPayload> => {
  const pathway = await buildStudentTalentPathway(studentId);
  const ctx = await buildTalentInputFromStudent(studentId);
  return buildAlumniTalentPreparation(
    pathway.studentTalentProfile,
    pathway.careerReadinessIndex,
    ctx.targetMajors
  );
};

export const buildExecutiveTalentIntelligence = async (): Promise<ExecutiveTalentIntelligence> => {
  await connectDB();
  const [records, organizations, students] = await Promise.all([
    TrainingCompletionRecord.find({}).lean(),
    PartnerOrganization.find({ active: { $ne: false } }).select("name category").lean(),
    User.find({ role: "student", accountType: { $ne: "alumni" } })
      .select("_id fullName fullNameAr fullNameEn grade")
      .limit(500)
      .lean(),
  ]);

  const orgNameMap = new Map(organizations.map((org) => [String(org._id), org.name || ""]));
  const orgCategoryMap = new Map(organizations.map((org) => [String(org._id), String(org.category || "")]));

  const correlationInputs: AchievementTrainingCorrelationInput[] = records.map((record) => ({
    achievementArea: inferPrimaryTalentArea(String(record.positionTitle || record.assignedTasks || "")),
    trainingCategory: orgCategoryMap.get(String(record.organizationId)),
    trainingOutcomeScore: computeTrainingOutcomeIntelligence({
      studentSatisfaction: avg(
        [record.studentBenefitRating, record.practicalBenefitRating].filter(
          (value): value is number => typeof value === "number"
        )
      ),
      institutionEvaluation: record.overallRecommendation,
      consistencyScore: analyzeTrainingReportConsistency(record).consistencyScore,
      recommendationRatePct: record.recommendInstitutionToPeers ? 100 : 0,
    }).outcomeScore,
    consistencyScore: analyzeTrainingReportConsistency(record).consistencyScore,
    studentCount: 1,
  }));

  const correlation = analyzeAchievementTrainingCorrelation(correlationInputs);

  const partnerScores = new Map<string, { total: number; count: number; name: string }>();
  for (const record of records) {
    const orgId = String(record.organizationId || "");
    const bucket = partnerScores.get(orgId) || {
      total: 0,
      count: 0,
      name: orgNameMap.get(orgId) || orgId,
    };
    bucket.total += computeOrganizationTrainingQualityIndex([record]).organizationTrainingQualityIndex;
    bucket.count += 1;
    partnerScores.set(orgId, bucket);
  }

  const topTalentDevelopingPartners = [...partnerScores.entries()]
    .map(([, value]) => ({
      organizationName: value.name,
      developmentScore: clamp(value.total / Math.max(value.count, 1)),
    }))
    .sort((a, b) => b.developmentScore - a.developmentScore)
    .slice(0, 8);

  const fieldGrowth = new Map<string, { total: number; count: number; ar: string; en: string }>();
  for (const area of TALENT_AREAS) {
    fieldGrowth.set(area.key, { total: 0, count: 0, ar: area.ar, en: area.en });
  }
  for (const row of correlation.talentClusters) {
    const bucket = fieldGrowth.get(row.clusterKey);
    if (bucket) {
      bucket.total += row.averageOutcomeScore;
      bucket.count += row.memberCount;
    }
  }

  const emergingFields = [...fieldGrowth.entries()]
    .map(([key, value]) => ({
      fieldAr: value.ar,
      fieldEn: value.en,
      growthScore: clamp(value.total / Math.max(value.count, 1)),
      key,
    }))
    .sort((a, b) => b.growthScore - a.growthScore)
    .slice(0, 5);

  const candidateInputs = await Promise.all(
    students.slice(0, 120).map(async (student) => {
      const studentId = String(student._id);
      try {
        const summary = await buildStudentAchievementSummary(studentId, "ar");
        const recordsForStudent = records.filter((row) => String(row.studentId) === studentId);
        const ratings = recordsForStudent.flatMap((row) =>
          [row.studentBenefitRating, row.practicalBenefitRating].filter(
            (value): value is number => typeof value === "number"
          )
        );
        const consistency = recordsForStudent.length
          ? avg(recordsForStudent.map((row) => analyzeTrainingReportConsistency(row).consistencyScore))
          : 0;
        const recommendPct = recordsForStudent.length
          ? clamp(
              (recordsForStudent.filter((row) => row.recommendInstitutionToPeers).length /
                recordsForStudent.length) *
                100
            )
          : 0;
        return {
          studentId,
          studentName: String(student.fullNameAr || student.fullName || student.fullNameEn || studentId),
          grade: student.grade ? String(student.grade) : undefined,
          achievementScore: summary.excellenceScore,
          trainingOutcomeScore: ratings.length ? clamp(avg(ratings) * 20) : 0,
          consistencyScore: consistency,
          recommendationRatePct: recommendPct,
        };
      } catch {
        return null;
      }
    })
  );

  const highPotentialStudents = identifyHighPotentialStudents(
    candidateInputs.filter((row): row is NonNullable<typeof row> => row != null)
  ).slice(0, 12);

  return {
    generatedAt: new Date().toISOString(),
    bestPathways: correlation.strongestPathways.slice(0, 8).map((row) => ({
      pathway: `${row.achievementArea}→${row.trainingCategory}`,
      correlationScore: row.correlationScore,
    })),
    mostImpactfulPrograms: correlation.talentClusters.slice(0, 6).map((row) => ({
      programLabelAr: row.labelAr,
      programLabelEn: row.labelEn,
      impactScore: row.averageOutcomeScore,
    })),
    topTalentDevelopingPartners,
    emergingFields: emergingFields.map(({ fieldAr, fieldEn, growthScore }) => ({
      fieldAr,
      fieldEn,
      growthScore,
    })),
    highPotentialStudents,
  };
};
