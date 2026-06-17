import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { getCurrentAcademicYear } from "@/lib/academic-years/current-academic-year";
import InstitutionAnnualReview from "@/models/InstitutionAnnualReview";
import InstitutionPerformanceSnapshot, {
  type InstitutionPerformanceMetricsPayload,
} from "@/models/InstitutionPerformanceSnapshot";
import InstitutionReview from "@/models/InstitutionReview";
import InstitutionSupervisorFeedback from "@/models/InstitutionSupervisorFeedback";
import PartnerOrganization from "@/models/PartnerOrganization";
import PartnershipMessage from "@/models/PartnershipMessage";
import PartnershipThread from "@/models/PartnershipThread";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingInterview from "@/models/TrainingInterview";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import {
  DEFAULT_NO_RESPONSE_ALERT_DAYS,
  PARTNERSHIP_ALERT_LABELS,
  type PartnershipAlertType,
  qualityLabelForScore,
} from "@/lib/partnerships/institution-performance-intelligence-constants";
import {
  PARTNER_ORGANIZATION_CATEGORY_LABELS,
  type PartnerOrganizationCategory,
} from "@/lib/partnerships/institution-analytics-constants";
import { buildParentConsentAnalytics } from "@/lib/partnerships/parent-consent-service";
import { buildFinalEvaluationAnalytics } from "@/lib/partnerships/training-final-evaluation-analytics";
import { buildPartnershipTrainingOutcomeExtension } from "@/lib/partnerships/training-outcome-analytics";

const ACCEPTED_STATUSES = new Set(["accepted", "awaiting_school_approval", "completed"]);
const REJECTED_STATUSES = new Set(["rejected"]);

const round1 = (value: number) => Math.round(value * 10) / 10;
const roundPct = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : round1((sorted[mid - 1] + sorted[mid]) / 2);
};

const daysBetween = (start?: Date | string | null, end?: Date | string | null): number | null => {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff < 0) return null;
  return diff / (1000 * 60 * 60 * 24);
};

const avgDays = (pairs: Array<{ start?: Date | string | null; end?: Date | string | null }>) => {
  const days = pairs.map((p) => daysBetween(p.start, p.end)).filter((v): v is number => v !== null);
  return days.length ? round1(days.reduce((a, b) => a + b, 0) / days.length) : 0;
};

export type ResponseTimeAnalytics = InstitutionPerformanceMetricsPayload["responseTime"];

export type InstitutionRankingRow = {
  organizationId: string;
  organizationName: string;
  category?: PartnerOrganizationCategory;
  categoryLabelAr?: string;
  categoryLabelEn?: string;
  qualityScore: number;
  qualityLabelAr: string;
  qualityLabelEn: string;
  applicantCount: number;
  acceptedCount: number;
  completedTraineeCount: number;
  interviewCount: number;
  acceptanceRatePct: number;
  avgStudentRating: number;
  averageResponseTimeDays: number;
  activityScore: number;
};

export type PartnershipAlert = {
  id: string;
  type: PartnershipAlertType;
  organizationId: string;
  organizationName: string;
  severity: "high" | "medium" | "low" | "info";
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  measuredAt: string;
};

export type PartnershipIntelligencePayload = {
  generatedAt: string;
  academicYearLabel: string;
  summary: {
    totalPartnerships: number;
    activeInstitutions: number;
    totalTrainees: number;
    avgQualityScore: number;
    bestInstitution: InstitutionRankingRow | null;
    weakestInstitution: InstitutionRankingRow | null;
  };
  rankings: {
    topRated: InstitutionRankingRow[];
    mostActive: InstitutionRankingRow[];
    highestAcceptance: InstitutionRankingRow[];
    highestRated: InstitutionRankingRow[];
    fastestResponse: InstitutionRankingRow[];
  };
  alerts: PartnershipAlert[];
  schoolImprovementIndicators: {
    careerReadiness: number;
    externalPartnerships: number;
    professionalExposure: number;
    studentPlacementSuccess: number;
  };
  parentConsentAnalytics: {
    required: number;
    uploaded: number;
    approved: number;
    suspiciousCount: number;
    avgConfidenceScore: number;
    outdatedDetectedCount: number;
    regeneratedCount: number;
    templateCompatibilityRate: number;
  };
  finalEvaluationAnalytics: {
    trainingSatisfactionAverage: number;
    institutionEvaluationAverage: number;
    trainingHoursTotal: number;
    trainingCompletionQualityIndex: number;
    studentRecommendationRate: number;
    employmentRecommendationRate: number;
    institutionRecommendationRate: number;
    safetyComplianceAverage: number;
    technicalSkillsAverage: number;
    studentEvaluationCount: number;
    institutionEvaluationCount: number;
    approvedCount: number;
    topTrainingInstitutions: Array<{
      institutionId: string;
      institutionName: string;
      averageScore: number;
      evaluationCount: number;
    }>;
    mostRecommendedStudents: Array<{
      studentId: string;
      averageScore: number;
      recommendEmployment: boolean;
    }>;
  };
  trainingOutcomeAnalytics: {
    avgEmployabilityScore: number;
    recommendedForEmploymentRate: number;
    outstandingTraineeCount: number;
    institutionRecommendationRate: number;
    outcomeDistribution: Record<string, number>;
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
  };
  executiveWidget: {
    partnershipCount: number;
    activeInstitutions: number;
    bestInstitutionName: string;
    weakestInstitutionName: string;
    traineeCount: number;
    avgQualityScore: number;
  };
};

type YearFilter = {
  academicYearId?: string;
  academicYearLabel?: string;
};

const matchesYear = (app: { academicYearId?: unknown; academicYear?: string; academicYearLabel?: string }, filter: YearFilter) => {
  if (filter.academicYearId) {
    return String(app.academicYearId || "") === filter.academicYearId;
  }
  if (filter.academicYearLabel) {
    const label = String(app.academicYear || app.academicYearLabel || "").trim();
    return label === filter.academicYearLabel;
  }
  return true;
};

const loadOrgContext = async (organizationId: string, yearFilter: YearFilter = {}) => {
  await connectDB();
  const opportunities = await TrainingOpportunity.find({ organizationId }).select("_id academicYear").lean();
  const opportunityIds = opportunities.map((o) => o._id);

  const applications = opportunityIds.length
    ? await StudentTrainingApplication.find({
        opportunityId: { $in: opportunityIds },
        archived: { $ne: true },
      }).lean()
    : [];

  const filteredApps = applications.filter((a) => matchesYear(a, yearFilter));
  const appIds = filteredApps.map((a) => a._id);

  return { opportunities, opportunityIds, applications: filteredApps, appIds };
};

const computeMessageEngagementPct = async (appIds: mongoose.Types.ObjectId[]): Promise<number> => {
  if (!appIds.length) return 0;
  const threads = await PartnershipThread.find({
    applicationId: { $in: appIds },
    archived: { $ne: true },
  })
    .select("_id applicationId")
    .lean();
  if (!threads.length) return 0;

  let engaged = 0;
  for (const thread of threads) {
    const messages = await PartnershipMessage.find({ threadId: thread._id })
      .sort({ createdAt: 1 })
      .select("senderRole createdAt")
      .lean();
    const studentIdx = messages.findIndex((m) => m.senderRole === "student");
    if (studentIdx < 0) continue;
    const studentAt = messages[studentIdx].createdAt;
    const institutionReply = messages.slice(studentIdx + 1).find((m) => m.senderRole === "institution");
    if (!institutionReply) continue;
    const hrs = (new Date(institutionReply.createdAt).getTime() - new Date(studentAt).getTime()) / (1000 * 60 * 60);
    if (hrs <= 48) engaged += 1;
  }
  return roundPct(engaged, threads.length);
};

const computeInterviewAttendancePct = async (organizationId: string, appIds: mongoose.Types.ObjectId[]): Promise<number> => {
  if (!appIds.length) return 0;
  const interviews = await TrainingInterview.find({
    organizationId,
    applicationId: { $in: appIds },
  })
    .select("attendance")
    .lean();
  if (!interviews.length) return 0;
  const attended = interviews.filter((i) => i.attendance === "attended").length;
  return roundPct(attended, interviews.length);
};

const computeResponseTimeAnalytics = (applications: Array<{
  submittedAt?: Date;
  reviewedAt?: Date;
  status: string;
  timeline?: Array<{ at?: Date; action?: string }>;
}>): ResponseTimeAnalytics => {
  const firstResponsePairs = applications.map((app) => {
    const submitted = app.submittedAt;
    const institutionEvent = (app.timeline || []).find((e) =>
      String(e.action || "").startsWith("institution_")
    );
    return { start: submitted, end: institutionEvent?.at || app.reviewedAt };
  });

  const reviewPairs = applications
    .filter((a) => String(a.status) !== "institution_review" || a.reviewedAt)
    .map((app) => ({ start: app.submittedAt, end: app.reviewedAt }));

  const interviewPairs = applications
    .filter((a) => ["interview_requested", "accepted", "rejected", "completed", "awaiting_school_approval"].includes(String(a.status)))
    .map((app) => {
      const req = (app.timeline || []).find((e) => e.action === "institution_interview_requested");
      const scheduled = (app.timeline || []).find((e) => e.action === "institution_interview_scheduled");
      return { start: req?.at || app.submittedAt, end: scheduled?.at };
    });

  const reportPairs = applications
    .filter((a) => ACCEPTED_STATUSES.has(String(a.status)))
    .map((app) => {
      const evaluated = (app.timeline || []).find((e) => e.action === "institution_training_evaluated");
      return { start: app.reviewedAt, end: evaluated?.at };
    });

  const allDays = firstResponsePairs
    .map((p) => daysBetween(p.start, p.end))
    .filter((v): v is number => v !== null);

  const averageResponseTimeDays = allDays.length ? round1(allDays.reduce((a, b) => a + b, 0) / allDays.length) : 0;

  return {
    firstResponseAvgDays: avgDays(firstResponsePairs),
    firstResponseMedianDays: median(allDays),
    reviewAvgDays: avgDays(reviewPairs),
    interviewScheduleAvgDays: avgDays(interviewPairs),
    finalReportAvgDays: avgDays(reportPairs),
    averageResponseTimeDays,
    medianResponseTimeDays: median(allDays),
    fastestResponseDays: allDays.length ? round1(Math.min(...allDays)) : 0,
    slowestResponseDays: allDays.length ? round1(Math.max(...allDays)) : 0,
  };
};

export const computeInstitutionQualityScore = (input: {
  responseTime: ResponseTimeAnalytics;
  acceptanceRatePct: number;
  completionRatePct: number;
  reportCompletionRatePct: number;
  messageEngagementPct: number;
  interviewAttendancePct: number;
  studentFeedbackAvg: number;
}): number => {
  const responseComponent = clamp(100 - input.responseTime.averageResponseTimeDays * 8);
  const acceptanceComponent = clamp(
    input.acceptanceRatePct >= 15 && input.acceptanceRatePct <= 85
      ? 80 + Math.min(input.acceptanceRatePct, 100 - input.acceptanceRatePct) * 0.2
      : input.acceptanceRatePct * 0.7
  );
  const completionComponent = clamp(input.completionRatePct);
  const reportComponent = clamp(input.reportCompletionRatePct);
  const messageComponent = clamp(input.messageEngagementPct);
  const interviewComponent = clamp(input.interviewAttendancePct);
  const feedbackComponent = clamp((input.studentFeedbackAvg / 5) * 100);

  return clamp(
    responseComponent * 0.2 +
      acceptanceComponent * 0.1 +
      completionComponent * 0.2 +
      reportComponent * 0.15 +
      messageComponent * 0.1 +
      interviewComponent * 0.1 +
      feedbackComponent * 0.15
  );
};

export const buildInstitutionPerformanceMetrics = async (
  organizationId: string,
  yearFilter: YearFilter = {}
): Promise<InstitutionPerformanceMetricsPayload> => {
  const { opportunities, applications, appIds } = await loadOrgContext(organizationId, yearFilter);

  const opportunityCount = opportunities.filter((o) =>
    yearFilter.academicYearLabel ? String(o.academicYear || "") === yearFilter.academicYearLabel : true
  ).length;

  const applicantCount = applications.filter((a) => String(a.status) !== "withdrawn").length;
  const acceptedCount = applications.filter((a) => ACCEPTED_STATUSES.has(String(a.status))).length;
  const rejectedCount = applications.filter((a) => REJECTED_STATUSES.has(String(a.status))).length;
  const completedTraineeCount = applications.filter((a) => String(a.status) === "completed").length;

  const interviewCount = appIds.length
    ? await TrainingInterview.countDocuments({ organizationId, applicationId: { $in: appIds } })
    : 0;

  const finalReportCount = appIds.length
    ? await InstitutionReview.countDocuments({
        organizationId,
        applicationId: { $in: appIds },
        reviewKind: "completion_evaluation",
      })
    : 0;

  const decisionPool = acceptedCount + rejectedCount;
  const acceptanceRatePct = roundPct(acceptedCount, decisionPool || applicantCount);
  const completionRatePct = roundPct(completedTraineeCount, acceptedCount);
  const interviewRatePct = roundPct(interviewCount, applicantCount);
  const reportCompletionRatePct = roundPct(finalReportCount, acceptedCount);

  const responseTime = computeResponseTimeAnalytics(applications);

  const feedbackReviews = await InstitutionReview.find({
    organizationId,
    reviewKind: "student_feedback",
    ...(appIds.length ? { applicationId: { $in: appIds } } : {}),
  })
    .select("overallRating")
    .lean();
  const ratings = feedbackReviews.map((r) => Number(r.overallRating || 0)).filter((v) => v >= 1 && v <= 5);
  const studentFeedbackAvg = ratings.length ? round1(ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
  const studentFeedbackCount = ratings.length;

  const supervisorRows = await InstitutionSupervisorFeedback.find({
    organizationId,
    ...(yearFilter.academicYearLabel ? { academicYearLabel: yearFilter.academicYearLabel } : {}),
  }).lean();
  const supervisorAvgs = supervisorRows.map((row) => {
    const dims = [row.cooperation, row.commitment, row.responseSpeed, row.reportQuality, row.communication];
    return dims.reduce((a, b) => a + Number(b || 0), 0) / dims.length;
  });
  const supervisorFeedbackAvg = supervisorAvgs.length
    ? round1(supervisorAvgs.reduce((a, b) => a + b, 0) / supervisorAvgs.length)
    : 0;

  const messageEngagementPct = await computeMessageEngagementPct(appIds);
  const interviewAttendancePct = await computeInterviewAttendancePct(organizationId, appIds);

  const qualityScore = computeInstitutionQualityScore({
    responseTime,
    acceptanceRatePct,
    completionRatePct,
    reportCompletionRatePct,
    messageEngagementPct,
    interviewAttendancePct,
    studentFeedbackAvg,
  });

  return {
    opportunityCount,
    applicantCount,
    acceptedCount,
    rejectedCount,
    interviewCount,
    completedTraineeCount,
    finalReportCount,
    acceptanceRatePct,
    completionRatePct,
    interviewRatePct,
    reportCompletionRatePct,
    responseTime,
    qualityScore,
    qualityLabelAr: qualityLabelForScore(qualityScore, true),
    qualityLabelEn: qualityLabelForScore(qualityScore, false),
    studentFeedbackAvg,
    studentFeedbackCount,
    supervisorFeedbackAvg,
    supervisorFeedbackCount: supervisorRows.length,
    messageEngagementPct,
    interviewAttendancePct,
  };
};

export const upsertInstitutionPerformanceSnapshot = async (
  organizationId: string,
  options?: { academicYearId?: string; academicYearLabel?: string }
) => {
  const currentYear = await getCurrentAcademicYear();
  const academicYearId = options?.academicYearId || currentYear?.id;
  const academicYearLabel = options?.academicYearLabel || currentYear?.label || currentYear?.name || "unknown";

  const metrics = await buildInstitutionPerformanceMetrics(organizationId, {
    academicYearId,
    academicYearLabel,
  });

  const generatedAt = new Date();
  const filter: Record<string, unknown> = { organizationId };
  if (academicYearId) filter.academicYearId = academicYearId;
  else filter.academicYearLabel = academicYearLabel;

  const snapshot = await InstitutionPerformanceSnapshot.findOneAndUpdate(
    filter,
    {
      $set: {
        organizationId,
        academicYearId: academicYearId ? new mongoose.Types.ObjectId(academicYearId) : undefined,
        academicYearLabel,
        generatedAt,
        metrics,
      },
    },
    { upsert: true, new: true }
  );

  return {
    id: String(snapshot._id),
    organizationId,
    academicYearId,
    academicYearLabel,
    generatedAt: generatedAt.toISOString(),
    metrics,
  };
};

const toRankingRow = (
  org: { _id: unknown; name: string; category?: string; averageRating?: number },
  metrics: InstitutionPerformanceMetricsPayload
): InstitutionRankingRow => {
  const category = org.category as PartnerOrganizationCategory | undefined;
  const labels = category ? PARTNER_ORGANIZATION_CATEGORY_LABELS[category] : undefined;
  const activityScore = metrics.applicantCount + metrics.interviewCount * 2 + metrics.completedTraineeCount * 3;

  return {
    organizationId: String(org._id),
    organizationName: org.name,
    category,
    categoryLabelAr: labels?.ar,
    categoryLabelEn: labels?.en,
    qualityScore: metrics.qualityScore,
    qualityLabelAr: metrics.qualityLabelAr,
    qualityLabelEn: metrics.qualityLabelEn,
    applicantCount: metrics.applicantCount,
    acceptedCount: metrics.acceptedCount,
    completedTraineeCount: metrics.completedTraineeCount,
    interviewCount: metrics.interviewCount,
    acceptanceRatePct: metrics.acceptanceRatePct,
    avgStudentRating: metrics.studentFeedbackAvg || Number(org.averageRating || 0),
    averageResponseTimeDays: metrics.responseTime.averageResponseTimeDays,
    activityScore,
  };
};

export const buildPartnershipAlerts = async (
  rows: InstitutionRankingRow[],
  noResponseDays = DEFAULT_NO_RESPONSE_ALERT_DAYS
): Promise<PartnershipAlert[]> => {
  await connectDB();
  const alerts: PartnershipAlert[] = [];
  const now = new Date();
  const cutoff = new Date(now.getTime() - noResponseDays * 24 * 60 * 60 * 1000);

  for (const row of rows) {
    if (row.qualityScore >= 92 && row.completedTraineeCount >= 3) {
      alerts.push({
        id: `exemplary-${row.organizationId}`,
        type: "exemplary",
        organizationId: row.organizationId,
        organizationName: row.organizationName,
        severity: "info",
        titleAr: PARTNERSHIP_ALERT_LABELS.exemplary.ar,
        titleEn: PARTNERSHIP_ALERT_LABELS.exemplary.en,
        detailAr: `${row.organizationName}: درجة الجودة ${row.qualityScore} مع ${row.completedTraineeCount} متدرب مكتمل.`,
        detailEn: `${row.organizationName}: quality score ${row.qualityScore} with ${row.completedTraineeCount} completed trainees.`,
        measuredAt: now.toISOString(),
      });
    }

    if (row.qualityScore > 0 && row.qualityScore < 70) {
      alerts.push({
        id: `rating-drop-${row.organizationId}`,
        type: "rating_drop",
        organizationId: row.organizationId,
        organizationName: row.organizationName,
        severity: "high",
        titleAr: PARTNERSHIP_ALERT_LABELS.rating_drop.ar,
        titleEn: PARTNERSHIP_ALERT_LABELS.rating_drop.en,
        detailAr: `${row.organizationName}: درجة الجودة ${row.qualityScore} — ${row.qualityLabelAr}.`,
        detailEn: `${row.organizationName}: quality score ${row.qualityScore} — ${row.qualityLabelEn}.`,
        measuredAt: now.toISOString(),
      });
    }

    const pendingApps = await StudentTrainingApplication.countDocuments({
      status: "institution_review",
      submittedAt: { $lt: cutoff },
      archived: { $ne: true },
    });
    if (pendingApps > 0 && row.applicantCount > 0 && row.averageResponseTimeDays > noResponseDays) {
      alerts.push({
        id: `no-response-${row.organizationId}`,
        type: "no_response",
        organizationId: row.organizationId,
        organizationName: row.organizationName,
        severity: "medium",
        titleAr: PARTNERSHIP_ALERT_LABELS.no_response.ar,
        titleEn: PARTNERSHIP_ALERT_LABELS.no_response.en,
        detailAr: `${row.organizationName}: متوسط الاستجابة ${row.averageResponseTimeDays} يوماً (الحد ${noResponseDays} أيام).`,
        detailEn: `${row.organizationName}: avg response ${row.averageResponseTimeDays} days (threshold ${noResponseDays} days).`,
        measuredAt: now.toISOString(),
      });
    }

    if (row.acceptedCount > 0 && row.completedTraineeCount > 0) {
      const reportRate = roundPct(
        await InstitutionReview.countDocuments({
          organizationId: row.organizationId,
          reviewKind: "completion_evaluation",
        }),
        row.acceptedCount
      );
      if (reportRate < 50) {
        alerts.push({
          id: `missing-reports-${row.organizationId}`,
          type: "missing_reports",
          organizationId: row.organizationId,
          organizationName: row.organizationName,
          severity: "high",
          titleAr: PARTNERSHIP_ALERT_LABELS.missing_reports.ar,
          titleEn: PARTNERSHIP_ALERT_LABELS.missing_reports.en,
          detailAr: `${row.organizationName}: اكتمال التقارير ${reportRate}% فقط.`,
          detailEn: `${row.organizationName}: only ${reportRate}% report completion.`,
          measuredAt: now.toISOString(),
        });
      }
    }
  }

  return alerts.slice(0, 30);
};

export const buildSchoolPartnershipIndicators = async (rows: InstitutionRankingRow[]) => {
  const active = rows.filter((r) => r.applicantCount > 0);
  const placementSuccess =
    active.length > 0
      ? roundPct(
          active.reduce((s, r) => s + r.completedTraineeCount, 0),
          active.reduce((s, r) => s + r.acceptedCount, 0) || 1
        )
      : 0;

  const avgQuality =
    active.length > 0
      ? round1(active.reduce((s, r) => s + r.qualityScore, 0) / active.length)
      : 0;

  return {
    careerReadiness: clamp(avgQuality * 0.85 + placementSuccess * 0.15),
    externalPartnerships: clamp(active.length * 12 + rows.length * 3),
    professionalExposure: clamp(
      active.reduce((s, r) => s + r.completedTraineeCount, 0) * 4 +
        active.reduce((s, r) => s + r.interviewCount, 0) * 2
    ),
    studentPlacementSuccess: placementSuccess,
  };
};

export const generateInstitutionAnnualReview = async (
  organizationId: string,
  options?: { academicYearId?: string; academicYearLabel?: string; generatedBy?: string }
) => {
  const snapshot = await upsertInstitutionPerformanceSnapshot(organizationId, options);
  const org = await PartnerOrganization.findById(organizationId).select("name").lean();
  if (!org) throw new Error("Organization not found");

  const m = snapshot.metrics;
  const renewalDecision =
    m.qualityScore >= 85
      ? ("renew" as const)
      : m.qualityScore >= 70
        ? ("renew_with_conditions" as const)
        : m.qualityScore >= 55
          ? ("review_next_year" as const)
          : ("do_not_renew" as const);

  const performanceSummaryAr = `ملخص أداء ${org.name} للعام ${snapshot.academicYearLabel}: درجة الجودة ${m.qualityScore} (${m.qualityLabelAr}). معدل القبول ${m.acceptanceRatePct}% ومعدل الإكمال ${m.completionRatePct}%.`;
  const performanceSummaryEn = `${org.name} performance summary for ${snapshot.academicYearLabel}: quality score ${m.qualityScore} (${m.qualityLabelEn}). Acceptance ${m.acceptanceRatePct}%, completion ${m.completionRatePct}%.`;

  const achievementsAr = `أكملت المؤسسة تدريب ${m.completedTraineeCount} طالباً، وأجرت ${m.interviewCount} مقابلة، ورفعت ${m.finalReportCount} تقريراً نهائياً.`;
  const achievementsEn = `The institution trained ${m.completedTraineeCount} students, conducted ${m.interviewCount} interviews, and submitted ${m.finalReportCount} final reports.`;

  const statisticsAr = `المتقدمون: ${m.applicantCount} | المقبولون: ${m.acceptedCount} | المرفوضون: ${m.rejectedCount} | متوسط الاستجابة: ${m.responseTime.averageResponseTimeDays} يوم.`;
  const statisticsEn = `Applicants: ${m.applicantCount} | Accepted: ${m.acceptedCount} | Rejected: ${m.rejectedCount} | Avg response: ${m.responseTime.averageResponseTimeDays} days.`;

  const recommendationsAr =
    m.qualityScore < 70
      ? "يُوصى بتحسين سرعة الاستجابة ورفع اكتمال التقارير قبل تجديد الشراكة."
      : "يُوصى بالاستمرار في الشراكة مع متابعة دورية للأداء.";
  const recommendationsEn =
    m.qualityScore < 70
      ? "Improve response speed and report completion before renewing the partnership."
      : "Continue the partnership with periodic performance monitoring.";

  const generatedAt = new Date();
  const filter: Record<string, unknown> = { organizationId };
  if (snapshot.academicYearId) filter.academicYearId = snapshot.academicYearId;
  else filter.academicYearLabel = snapshot.academicYearLabel;

  const review = await InstitutionAnnualReview.findOneAndUpdate(
    filter,
    {
      $set: {
        organizationId,
        academicYearId: snapshot.academicYearId
          ? new mongoose.Types.ObjectId(snapshot.academicYearId)
          : undefined,
        academicYearLabel: snapshot.academicYearLabel,
        snapshotId: new mongoose.Types.ObjectId(snapshot.id),
        performanceSummaryAr,
        performanceSummaryEn,
        achievementsAr,
        achievementsEn,
        statisticsAr,
        statisticsEn,
        recommendationsAr,
        recommendationsEn,
        renewalDecision,
        generatedAt,
        generatedBy: options?.generatedBy
          ? new mongoose.Types.ObjectId(options.generatedBy)
          : undefined,
      },
    },
    { upsert: true, new: true }
  );

  return {
    id: String(review._id),
    organizationId,
    organizationName: org.name,
    academicYearLabel: snapshot.academicYearLabel,
    renewalDecision,
    generatedAt: generatedAt.toISOString(),
    performanceSummaryAr,
    performanceSummaryEn,
    achievementsAr,
    achievementsEn,
    statisticsAr,
    statisticsEn,
    recommendationsAr,
    recommendationsEn,
    metrics: m,
  };
};

export const buildPartnershipIntelligenceDashboard = async (): Promise<PartnershipIntelligencePayload> => {
  await connectDB();
  const currentYear = await getCurrentAcademicYear();
  const yearFilter: YearFilter = {
    academicYearId: currentYear?.id,
    academicYearLabel: currentYear?.label || currentYear?.name,
  };

  const orgs = await PartnerOrganization.find({ active: { $ne: false } }).select("name category averageRating").lean();

  const rankingRows: InstitutionRankingRow[] = [];
  for (const org of orgs) {
    const metrics = await buildInstitutionPerformanceMetrics(String(org._id), yearFilter);
    if (metrics.applicantCount > 0 || metrics.opportunityCount > 0) {
      rankingRows.push(toRankingRow(org, metrics));
    }
  }

  const sortedByQuality = [...rankingRows].sort((a, b) => b.qualityScore - a.qualityScore);
  const best = sortedByQuality[0] || null;
  const weakest = sortedByQuality.filter((r) => r.qualityScore > 0).sort((a, b) => a.qualityScore - b.qualityScore)[0] || null;

  const totalTrainees = rankingRows.reduce((s, r) => s + r.completedTraineeCount, 0);
  const avgQualityScore =
    rankingRows.length > 0
      ? round1(rankingRows.reduce((s, r) => s + r.qualityScore, 0) / rankingRows.length)
      : 0;

  const alerts = await buildPartnershipAlerts(rankingRows);
  const schoolImprovementIndicators = await buildSchoolPartnershipIndicators(rankingRows);
  const parentConsentAnalytics = await buildParentConsentAnalytics();
  const finalEvaluationAnalytics = await buildFinalEvaluationAnalytics(yearFilter.academicYearLabel);
  const trainingOutcomeAnalytics = await buildPartnershipTrainingOutcomeExtension(yearFilter.academicYearLabel);

  return {
    generatedAt: new Date().toISOString(),
    academicYearLabel: yearFilter.academicYearLabel || "all",
    summary: {
      totalPartnerships: orgs.length,
      activeInstitutions: rankingRows.filter((r) => r.applicantCount > 0).length,
      totalTrainees,
      avgQualityScore,
      bestInstitution: best,
      weakestInstitution: weakest,
    },
    rankings: {
      topRated: sortedByQuality.slice(0, 10),
      mostActive: [...rankingRows].sort((a, b) => b.activityScore - a.activityScore).slice(0, 10),
      highestAcceptance: [...rankingRows].sort((a, b) => b.acceptanceRatePct - a.acceptanceRatePct).slice(0, 10),
      highestRated: [...rankingRows].sort((a, b) => b.avgStudentRating - a.avgStudentRating).slice(0, 10),
      fastestResponse: [...rankingRows]
        .filter((r) => r.averageResponseTimeDays > 0)
        .sort((a, b) => a.averageResponseTimeDays - b.averageResponseTimeDays)
        .slice(0, 10),
    },
    alerts,
    schoolImprovementIndicators,
    parentConsentAnalytics,
    finalEvaluationAnalytics,
    trainingOutcomeAnalytics,
    executiveWidget: {
      partnershipCount: orgs.length,
      activeInstitutions: rankingRows.filter((r) => r.applicantCount > 0).length,
      bestInstitutionName: best?.organizationName || "—",
      weakestInstitutionName: weakest?.organizationName || "—",
      traineeCount: totalTrainees,
      avgQualityScore,
    },
  };
};

export const submitSupervisorInstitutionFeedback = async (input: {
  organizationId: string;
  supervisorId: string;
  cooperation: number;
  commitment: number;
  responseSpeed: number;
  reportQuality: number;
  communication: number;
  notes?: string;
  academicYearId?: string;
  academicYearLabel?: string;
}) => {
  const currentYear = await getCurrentAcademicYear();
  const academicYearId = input.academicYearId || currentYear?.id;
  const academicYearLabel = input.academicYearLabel || currentYear?.label || currentYear?.name || "unknown";

  const clampRating = (v: number) => Math.min(5, Math.max(1, Math.round(v)));

  const row = await InstitutionSupervisorFeedback.findOneAndUpdate(
    {
      organizationId: input.organizationId,
      academicYearId: academicYearId ? new mongoose.Types.ObjectId(academicYearId) : undefined,
      supervisorId: input.supervisorId,
    },
    {
      $set: {
        organizationId: input.organizationId,
        academicYearId: academicYearId ? new mongoose.Types.ObjectId(academicYearId) : undefined,
        academicYearLabel,
        supervisorId: input.supervisorId,
        cooperation: clampRating(input.cooperation),
        commitment: clampRating(input.commitment),
        responseSpeed: clampRating(input.responseSpeed),
        reportQuality: clampRating(input.reportQuality),
        communication: clampRating(input.communication),
        notes: input.notes?.trim().slice(0, 4000),
        reviewedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  return {
    id: String(row._id),
    organizationId: input.organizationId,
    academicYearLabel,
    cooperation: row.cooperation,
    commitment: row.commitment,
    responseSpeed: row.responseSpeed,
    reportQuality: row.reportQuality,
    communication: row.communication,
    notes: row.notes || "",
    reviewedAt: row.reviewedAt.toISOString(),
  };
};

export const getSupervisorInstitutionFeedback = async (organizationId: string, supervisorId: string) => {
  await connectDB();
  const row = await InstitutionSupervisorFeedback.findOne({ organizationId, supervisorId })
    .sort({ reviewedAt: -1 })
    .lean();
  if (!row) return null;
  return {
    id: String(row._id),
    organizationId,
    academicYearLabel: row.academicYearLabel,
    cooperation: row.cooperation,
    commitment: row.commitment,
    responseSpeed: row.responseSpeed,
    reportQuality: row.reportQuality,
    communication: row.communication,
    notes: row.notes || "",
    reviewedAt: row.reviewedAt ? new Date(row.reviewedAt).toISOString() : null,
  };
};

export const getInstitutionAnnualReview = async (organizationId: string, academicYearLabel?: string) => {
  await connectDB();
  const filter: Record<string, unknown> = { organizationId };
  if (academicYearLabel) filter.academicYearLabel = academicYearLabel;
  const row = await InstitutionAnnualReview.findOne(filter).sort({ generatedAt: -1 }).lean();
  if (!row) return null;
  return {
    id: String(row._id),
    organizationId,
    academicYearLabel: row.academicYearLabel,
    renewalDecision: row.renewalDecision,
    performanceSummaryAr: row.performanceSummaryAr,
    performanceSummaryEn: row.performanceSummaryEn,
    achievementsAr: row.achievementsAr,
    achievementsEn: row.achievementsEn,
    statisticsAr: row.statisticsAr,
    statisticsEn: row.statisticsEn,
    recommendationsAr: row.recommendationsAr,
    recommendationsEn: row.recommendationsEn,
    generatedAt: row.generatedAt ? new Date(row.generatedAt).toISOString() : null,
  };
};
