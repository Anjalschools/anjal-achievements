import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import InstitutionReview from "@/models/InstitutionReview";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingInterview from "@/models/TrainingInterview";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import {
  PARTNER_ORGANIZATION_CATEGORY_LABELS,
  type PartnerOrganizationCategory,
} from "@/lib/partnerships/institution-analytics-constants";

const ACCEPTED_STATUSES = new Set(["accepted", "awaiting_school_approval", "completed"]);
const IN_TRAINING_STATUSES = new Set(["accepted", "awaiting_school_approval"]);
const REJECTED_STATUSES = new Set(["rejected"]);

const round1 = (value: number) => Math.round(value * 10) / 10;
const roundPct = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;

const avgDaysBetween = (pairs: Array<{ start: Date | undefined; end: Date | undefined }>) => {
  const days = pairs
    .map(({ start, end }) => {
      if (!start || !end) return null;
      const diff = new Date(end).getTime() - new Date(start).getTime();
      if (diff < 0) return null;
      return diff / (1000 * 60 * 60 * 24);
    })
    .filter((v): v is number => v !== null);
  return days.length ? round1(days.reduce((a, b) => a + b, 0) / days.length) : 0;
};

export type OrganizationYearChartRow = {
  academicYear: string;
  accepted: number;
  rejected: number;
};

export type OrganizationPerformanceStats = {
  nominatedStudents: number;
  acceptedStudents: number;
  rejectedStudents: number;
  interviewCount: number;
  inTrainingStudents: number;
  completedStudents: number;
  acceptanceRatePct: number;
  completionRatePct: number;
  rejectionRatePct: number;
  avgResponseTimeDays: number;
  avgStudentRating: number;
  chartByAcademicYear: OrganizationYearChartRow[];
};

export type OrganizationInsightRow = {
  organizationId: string;
  organizationName: string;
  category?: PartnerOrganizationCategory;
  categoryLabelAr?: string;
  categoryLabelEn?: string;
  value: number;
  metric: "satisfaction" | "acceptanceRate" | "completionRate" | "responseTime";
};

export type GlobalInstitutionInsights = {
  bestSatisfaction: OrganizationInsightRow | null;
  highestAcceptanceRate: OrganizationInsightRow | null;
  highestCompletionRate: OrganizationInsightRow | null;
  fastestResponse: OrganizationInsightRow | null;
  measuredAt: string;
};

const loadOrganizationApplications = async (organizationId: string) => {
  await connectDB();
  const opportunities = await TrainingOpportunity.find({ organizationId }).select("_id").lean();
  const opportunityIds = opportunities.map((o) => o._id);
  if (!opportunityIds.length) {
    return { applications: [], opportunityIds: [] as mongoose.Types.ObjectId[] };
  }
  const applications = await StudentTrainingApplication.find({
    opportunityId: { $in: opportunityIds },
    archived: { $ne: true },
  }).lean();
  return { applications, opportunityIds };
};

export const buildOrganizationPerformanceStats = async (
  organizationId: string
): Promise<OrganizationPerformanceStats> => {
  const { applications } = await loadOrganizationApplications(organizationId);

  const nominatedStudents = applications.filter((a) => String(a.status) !== "withdrawn").length;
  const acceptedStudents = applications.filter((a) => ACCEPTED_STATUSES.has(String(a.status))).length;
  const rejectedStudents = applications.filter((a) => REJECTED_STATUSES.has(String(a.status))).length;
  const inTrainingStudents = applications.filter((a) => IN_TRAINING_STATUSES.has(String(a.status))).length;
  const completedStudents = applications.filter((a) => String(a.status) === "completed").length;

  const interviewCount = await TrainingInterview.countDocuments({ organizationId });

  const decisionPool = acceptedStudents + rejectedStudents;
  const acceptanceRatePct = roundPct(acceptedStudents, decisionPool || nominatedStudents);
  const rejectionRatePct = roundPct(rejectedStudents, decisionPool || nominatedStudents);
  const completionRatePct = roundPct(completedStudents, acceptedStudents);

  const responsePairs = applications.map((app) => ({
    start: app.submittedAt ? new Date(app.submittedAt) : undefined,
    end: app.reviewedAt ? new Date(app.reviewedAt) : undefined,
  }));
  const avgResponseTimeDays = avgDaysBetween(responsePairs);

  const feedbackReviews = await InstitutionReview.find({
    organizationId,
    reviewKind: "student_feedback",
  })
    .select("overallRating")
    .lean();
  const ratings = feedbackReviews
    .map((r) => Number(r.overallRating || 0))
    .filter((v) => v >= 1 && v <= 5);
  const avgStudentRating = ratings.length
    ? round1(ratings.reduce((a, b) => a + b, 0) / ratings.length)
    : 0;

  const yearMap = new Map<string, { accepted: number; rejected: number }>();
  for (const app of applications) {
    const year = String(app.academicYear || app.academicYearLabel || "unknown").trim() || "unknown";
    const row = yearMap.get(year) || { accepted: 0, rejected: 0 };
    if (ACCEPTED_STATUSES.has(String(app.status))) row.accepted += 1;
    if (REJECTED_STATUSES.has(String(app.status))) row.rejected += 1;
    yearMap.set(year, row);
  }
  const chartByAcademicYear = [...yearMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([academicYear, counts]) => ({ academicYear, ...counts }));

  return {
    nominatedStudents,
    acceptedStudents,
    rejectedStudents,
    interviewCount,
    inTrainingStudents,
    completedStudents,
    acceptanceRatePct,
    completionRatePct,
    rejectionRatePct,
    avgResponseTimeDays,
    avgStudentRating,
    chartByAcademicYear,
  };
};

export const recomputeOrganizationRating = async (organizationId: string): Promise<void> => {
  await connectDB();
  const reviews = await InstitutionReview.find({
    organizationId,
    reviewKind: "student_feedback",
  })
    .select("overallRating")
    .lean();

  const ratings = reviews
    .map((r) => Number(r.overallRating || 0))
    .filter((v) => v >= 1 && v <= 5);

  const ratingCount = ratings.length;
  const averageRating =
    ratingCount > 0 ? round1(ratings.reduce((a, b) => a + b, 0) / ratingCount) : 0;

  await PartnerOrganization.findByIdAndUpdate(organizationId, {
    $set: { averageRating, ratingCount },
  });
};

export const buildGlobalInstitutionInsights = async (): Promise<GlobalInstitutionInsights> => {
  await connectDB();
  const orgs = await PartnerOrganization.find({ active: { $ne: false } }).select("name category averageRating ratingCount").lean();

  const rows: Array<{
    organizationId: string;
    organizationName: string;
    category?: PartnerOrganizationCategory;
    satisfaction: number;
    acceptanceRatePct: number;
    completionRatePct: number;
    avgResponseTimeDays: number;
  }> = [];

  for (const org of orgs) {
    const stats = await buildOrganizationPerformanceStats(String(org._id));
    rows.push({
      organizationId: String(org._id),
      organizationName: org.name,
      category: org.category as PartnerOrganizationCategory | undefined,
      satisfaction: stats.avgStudentRating || Number(org.averageRating || 0),
      acceptanceRatePct: stats.acceptanceRatePct,
      completionRatePct: stats.completionRatePct,
      avgResponseTimeDays: stats.avgResponseTimeDays,
    });
  }

  const toInsight = (
    row: (typeof rows)[number] | undefined,
    metric: OrganizationInsightRow["metric"],
    value: number
  ): OrganizationInsightRow | null => {
    if (!row || value <= 0) return null;
    const labels = row.category ? PARTNER_ORGANIZATION_CATEGORY_LABELS[row.category] : undefined;
    return {
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      category: row.category,
      categoryLabelAr: labels?.ar,
      categoryLabelEn: labels?.en,
      value,
      metric,
    };
  };

  const bestSatisfactionRow = [...rows].sort((a, b) => b.satisfaction - a.satisfaction)[0];
  const highestAcceptanceRow = [...rows].sort((a, b) => b.acceptanceRatePct - a.acceptanceRatePct)[0];
  const highestCompletionRow = [...rows].sort((a, b) => b.completionRatePct - a.completionRatePct)[0];
  const fastestResponseRow = [...rows]
    .filter((r) => r.avgResponseTimeDays > 0)
    .sort((a, b) => a.avgResponseTimeDays - b.avgResponseTimeDays)[0];

  return {
    bestSatisfaction: toInsight(bestSatisfactionRow, "satisfaction", bestSatisfactionRow?.satisfaction || 0),
    highestAcceptanceRate: toInsight(
      highestAcceptanceRow,
      "acceptanceRate",
      highestAcceptanceRow?.acceptanceRatePct || 0
    ),
    highestCompletionRate: toInsight(
      highestCompletionRow,
      "completionRate",
      highestCompletionRow?.completionRatePct || 0
    ),
    fastestResponse: toInsight(
      fastestResponseRow,
      "responseTime",
      fastestResponseRow?.avgResponseTimeDays || 0
    ),
    measuredAt: new Date().toISOString(),
  };
};

export const buildPartnershipAnalyticsSummary = async () => {
  await connectDB();
  const orgs = await PartnerOrganization.find().select("name category averageRating ratingCount active").lean();
  const insights = await buildGlobalInstitutionInsights();

  const categoryCounts = new Map<string, number>();
  for (const org of orgs) {
    const key = org.category || "uncategorized";
    categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
  }

  const ratedOrgs = orgs.filter((o) => Number(o.ratingCount || 0) > 0);
  const avgOrgRating =
    ratedOrgs.length > 0
      ? round1(
          ratedOrgs.reduce((sum, o) => sum + Number(o.averageRating || 0), 0) / ratedOrgs.length
        )
      : 0;

  return {
    totalOrganizations: orgs.length,
    activeOrganizations: orgs.filter((o) => o.active !== false).length,
    ratedOrganizations: ratedOrgs.length,
    averageOrganizationRating: avgOrgRating,
    categoryBreakdown: [...categoryCounts.entries()].map(([category, count]) => ({
      category,
      count,
      labelAr:
        category !== "uncategorized"
          ? PARTNER_ORGANIZATION_CATEGORY_LABELS[category as PartnerOrganizationCategory]?.ar || category
          : "غير مصنّف",
      labelEn:
        category !== "uncategorized"
          ? PARTNER_ORGANIZATION_CATEGORY_LABELS[category as PartnerOrganizationCategory]?.en || category
          : "Uncategorized",
    })),
    insights,
    measuredAt: new Date().toISOString(),
  };
};
