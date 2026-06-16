import "server-only";
import connectDB from "@/lib/mongodb";
import TrainingOutcomeRecord from "@/models/TrainingOutcomeRecord";
import InstitutionTalentRecommendation from "@/models/InstitutionTalentRecommendation";
import PartnerOrganization from "@/models/PartnerOrganization";
import User from "@/models/User";
import type { TrainingOutcomeLevel } from "@/lib/partnerships/training-outcome-constants";
import { OUTCOME_LEVEL_LABELS } from "@/lib/partnerships/training-outcome-constants";

const avg = (values: number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;

const roundPct = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;

export type TrainingOutcomeAnalytics = {
  totalTrainingHours: number;
  employabilityAverage: number;
  employmentRecommendations: number;
  outstandingTraineeCount: number;
  avgEmployabilityScore: number;
  recommendedForEmploymentRate: number;
  institutionRecommendationRate: number;
  outcomeDistribution: Record<TrainingOutcomeLevel, number>;
  topPerformingInstitutions: Array<{
    institutionId: string;
    institutionName: string;
    avgEmployabilityScore: number;
    outcomeCount: number;
  }>;
  topPerformingStudents: Array<{
    studentId: string;
    studentName: string;
    avgEmployabilityScore: number;
    totalHours: number;
    outcomeCount: number;
  }>;
  trendsByAcademicYear: Array<{
    academicYearLabel: string;
    outcomeCount: number;
    avgEmployability: number;
    totalHours: number;
    employmentRecommendations: number;
  }>;
  trendsByInstitution: Array<{
    institutionId: string;
    institutionName: string;
    outcomeCount: number;
    avgEmployability: number;
  }>;
  trendsByGrade: Array<{
    grade: string;
    outcomeCount: number;
    avgEmployability: number;
  }>;
  recordCount: number;
};

export const buildTrainingOutcomeAnalytics = async (
  academicYearLabel?: string
): Promise<TrainingOutcomeAnalytics> => {
  await connectDB();

  const filter = academicYearLabel ? { academicYearLabel } : {};
  const rows = await TrainingOutcomeRecord.find(filter).lean();

  const totalTrainingHours = rows.reduce((s, r) => s + (r.trainingHours || 0), 0);
  const employabilityScores = rows.map((r) => r.employabilityScore);
  const employabilityAverage = avg(employabilityScores);
  const employmentRecommendations = rows.filter((r) => r.recommendedForEmployment).length;
  const outstandingTraineeCount = rows.filter((r) =>
    r.recognitions?.includes("outstanding_trainee")
  ).length;

  const outcomeDistribution = {
    excellent: 0,
    very_good: 0,
    good: 0,
    satisfactory: 0,
    needs_improvement: 0,
  } satisfies Record<TrainingOutcomeLevel, number>;

  for (const row of rows) {
    if (row.outcomeLevel in outcomeDistribution) {
      outcomeDistribution[row.outcomeLevel as TrainingOutcomeLevel] += 1;
    }
  }

  const institutionBuckets = new Map<string, { scores: number[]; count: number }>();
  for (const row of rows) {
    const key = String(row.institutionId);
    const bucket = institutionBuckets.get(key) || { scores: [], count: 0 };
    bucket.scores.push(row.employabilityScore);
    bucket.count += 1;
    institutionBuckets.set(key, bucket);
  }

  const institutionIds = [...institutionBuckets.keys()];
  const institutions = institutionIds.length
    ? await PartnerOrganization.find({ _id: { $in: institutionIds } }).select("name").lean()
    : [];
  const institutionNameMap = new Map(institutions.map((o) => [String(o._id), String(o.name || "")]));

  const topPerformingInstitutions = institutionIds
    .map((id) => {
      const bucket = institutionBuckets.get(id)!;
      return {
        institutionId: id,
        institutionName: institutionNameMap.get(id) || id,
        avgEmployabilityScore: avg(bucket.scores),
        outcomeCount: bucket.count,
      };
    })
    .sort((a, b) => b.avgEmployabilityScore - a.avgEmployabilityScore)
    .slice(0, 10);

  const studentBuckets = new Map<string, { scores: number[]; hours: number; count: number }>();
  for (const row of rows) {
    const key = String(row.studentId);
    const bucket = studentBuckets.get(key) || { scores: [], hours: 0, count: 0 };
    bucket.scores.push(row.employabilityScore);
    bucket.hours += row.trainingHours || 0;
    bucket.count += 1;
    studentBuckets.set(key, bucket);
  }

  const studentIds = [...studentBuckets.keys()];
  const students = studentIds.length
    ? await User.find({ _id: { $in: studentIds } }).select("fullName fullNameAr").lean()
    : [];
  const studentNameMap = new Map(
    students.map((u) => [String(u._id), String(u.fullNameAr || u.fullName || "")])
  );

  const topPerformingStudents = studentIds
    .map((id) => {
      const bucket = studentBuckets.get(id)!;
      return {
        studentId: id,
        studentName: studentNameMap.get(id) || id,
        avgEmployabilityScore: avg(bucket.scores),
        totalHours: bucket.hours,
        outcomeCount: bucket.count,
      };
    })
    .sort((a, b) => b.avgEmployabilityScore - a.avgEmployabilityScore)
    .slice(0, 10);

  const yearBuckets = new Map<string, typeof rows>();
  for (const row of rows) {
    const label = row.academicYearLabel || "unknown";
    const list = yearBuckets.get(label) || [];
    list.push(row);
    yearBuckets.set(label, list);
  }

  const trendsByAcademicYear = [...yearBuckets.entries()]
    .map(([academicYearLabel, yearRows]) => ({
      academicYearLabel,
      outcomeCount: yearRows.length,
      avgEmployability: avg(yearRows.map((r) => r.employabilityScore)),
      totalHours: yearRows.reduce((s, r) => s + (r.trainingHours || 0), 0),
      employmentRecommendations: yearRows.filter((r) => r.recommendedForEmployment).length,
    }))
    .sort((a, b) => b.academicYearLabel.localeCompare(a.academicYearLabel));

  const trendsByInstitution = topPerformingInstitutions.map((r) => ({
    institutionId: r.institutionId,
    institutionName: r.institutionName,
    outcomeCount: r.outcomeCount,
    avgEmployability: r.avgEmployabilityScore,
  }));

  const gradeRows = await User.find({ _id: { $in: studentIds } }).select("grade").lean();
  const gradeMap = new Map(gradeRows.map((u) => [String(u._id), String((u as { grade?: string }).grade || "unknown")]));

  const gradeBuckets = new Map<string, number[]>();
  for (const row of rows) {
    const grade = gradeMap.get(String(row.studentId)) || "unknown";
    const list = gradeBuckets.get(grade) || [];
    list.push(row.employabilityScore);
    gradeBuckets.set(grade, list);
  }

  const trendsByGrade = [...gradeBuckets.entries()]
    .map(([grade, scores]) => ({
      grade,
      outcomeCount: scores.length,
      avgEmployability: avg(scores),
    }))
    .sort((a, b) => b.avgEmployability - a.avgEmployability);

  const futureRecCount = rows.filter((r) => r.recommendedForFutureTraining).length;

  return {
    totalTrainingHours,
    employabilityAverage,
    employmentRecommendations,
    outstandingTraineeCount,
    avgEmployabilityScore: employabilityAverage,
    recommendedForEmploymentRate: roundPct(employmentRecommendations, rows.length),
    institutionRecommendationRate: roundPct(futureRecCount, rows.length),
    outcomeDistribution,
    topPerformingInstitutions,
    topPerformingStudents,
    trendsByAcademicYear,
    trendsByInstitution,
    trendsByGrade,
    recordCount: rows.length,
  };
};

export type PartnershipTrainingOutcomeExtension = {
  avgEmployabilityScore: number;
  recommendedForEmploymentRate: number;
  outstandingTraineeCount: number;
  institutionRecommendationRate: number;
  outcomeDistribution: Record<TrainingOutcomeLevel, number>;
  topPerformingInstitutions: TrainingOutcomeAnalytics["topPerformingInstitutions"];
  topPerformingStudents: TrainingOutcomeAnalytics["topPerformingStudents"];
};

export const buildPartnershipTrainingOutcomeExtension = async (
  academicYearLabel?: string
): Promise<PartnershipTrainingOutcomeExtension> => {
  const analytics = await buildTrainingOutcomeAnalytics(academicYearLabel);
  return {
    avgEmployabilityScore: analytics.avgEmployabilityScore,
    recommendedForEmploymentRate: analytics.recommendedForEmploymentRate,
    outstandingTraineeCount: analytics.outstandingTraineeCount,
    institutionRecommendationRate: analytics.institutionRecommendationRate,
    outcomeDistribution: analytics.outcomeDistribution,
    topPerformingInstitutions: analytics.topPerformingInstitutions,
    topPerformingStudents: analytics.topPerformingStudents,
  };
};

export const outcomeLevelLabel = (level: TrainingOutcomeLevel, isAr: boolean): string => {
  const row = OUTCOME_LEVEL_LABELS[level];
  return isAr ? row.ar : row.en;
};

export const countTalentRecommendations = async (academicYearLabel?: string): Promise<number> => {
  await connectDB();
  if (!academicYearLabel) {
    return InstitutionTalentRecommendation.countDocuments();
  }
  const outcomes = await TrainingOutcomeRecord.find({ academicYearLabel }).select("_id").lean();
  const outcomeIds = outcomes.map((o) => o._id);
  if (!outcomeIds.length) return 0;
  return InstitutionTalentRecommendation.countDocuments({ outcomeRecordId: { $in: outcomeIds } });
};
