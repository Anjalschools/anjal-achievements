import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import type { StudentTrainingApplicationStatus } from "@/lib/partnerships/partnerships-constants";
import { trainingApplicationBlocksReapply } from "@/lib/partnerships/partnerships-application-status-ui";
import {
  resolveApplicationLastUpdatedAt,
  type TrainingApplicationTimelineEvent,
} from "@/lib/partnerships/partnerships-application-workflow";
import {
  loadStudentTrainingDashboardStats,
  type StudentTrainingDashboardStats,
} from "@/lib/partnerships/partnerships-student-dashboard-stats";
import {
  resolveStudentTrainingWidgetLabels,
  resolveStudentTrainingWidgetStatus,
  STUDENT_TRAINING_WIDGET_LABEL_DEFAULT,
  type StudentTrainingWidgetStatus,
} from "@/lib/partnerships/partnerships-student-dashboard-ui";

export type { StudentTrainingWidgetStatus };

export type StudentTrainingApplicationSummary = {
  applicationId: string;
  opportunityId: string;
  status: StudentTrainingApplicationStatus;
  submittedAt: string | null;
  lastUpdatedAt: string | null;
  opportunityTitle: string;
  organizationName: string;
  blocksReapply: boolean;
};

export type StudentTrainingCertificateSummary = {
  recordId: string;
  achievementId: string;
  opportunityId: string | null;
  opportunityTitle: string;
  organizationName: string;
  certificateViewPath: string;
  certificateVerifyPath: string | null;
  volunteerHours: number | null;
};

export type StudentTrainingDashboardContext = {
  stats: StudentTrainingDashboardStats;
  widget: {
    status: StudentTrainingWidgetStatus;
    applicationStatus: StudentTrainingApplicationStatus | null;
    statusLabelAr: string;
    statusLabelEn: string;
    opportunityId: string | null;
    opportunityTitle: string | null;
    organizationName: string | null;
    applicationId: string | null;
    submittedAt: string | null;
    lastUpdatedAt: string | null;
  };
  applicationsByOpportunityId: Record<string, StudentTrainingApplicationSummary>;
  quickActions: {
    showApplicationStatus: boolean;
    showMessages: boolean;
    showFinalReport: boolean;
    showCertificate: boolean;
    opportunityId: string | null;
    applicationId: string | null;
    certificateAchievementId: string | null;
  };
  certificates: StudentTrainingCertificateSummary[];
};

const ACTIVE_PRIMARY_STATUSES: StudentTrainingApplicationStatus[] = [
  "submitted",
  "under_review",
  "interview_requested",
  "institution_review",
  "accepted",
  "awaiting_school_approval",
  "completed",
];

const EMPTY_STATS: StudentTrainingDashboardStats = {
  applicationsSubmitted: 0,
  acceptedOpportunities: 0,
  approvedTrainingHours: 0,
  trainingInstitutions: 0,
};

export const createFallbackStudentTrainingDashboardContext = (): StudentTrainingDashboardContext => ({
  stats: { ...EMPTY_STATS },
  applicationsByOpportunityId: {},
  widget: {
    status: "not_applied",
    applicationStatus: null,
    statusLabelAr: STUDENT_TRAINING_WIDGET_LABEL_DEFAULT.ar,
    statusLabelEn: STUDENT_TRAINING_WIDGET_LABEL_DEFAULT.en,
    opportunityId: null,
    opportunityTitle: null,
    organizationName: null,
    applicationId: null,
    submittedAt: null,
    lastUpdatedAt: null,
  },
  quickActions: {
    showApplicationStatus: false,
    showMessages: false,
    showFinalReport: false,
    showCertificate: false,
    opportunityId: null,
    applicationId: null,
    certificateAchievementId: null,
  },
  certificates: [],
});

const resolveWidgetStatus = (status: string | null): StudentTrainingWidgetStatus =>
  resolveStudentTrainingWidgetStatus(status);

const pickPrimaryApplication = (
  applications: Array<{
    _id: mongoose.Types.ObjectId;
    opportunityId: mongoose.Types.ObjectId;
    status: string;
    submittedAt?: Date;
    updatedAt?: Date;
    reviewedAt?: Date;
    timeline?: TrainingApplicationTimelineEvent[];
  }>
) => {
  const active = applications.find((row) =>
    ACTIVE_PRIMARY_STATUSES.includes(String(row.status) as StudentTrainingApplicationStatus)
  );
  if (active) return active;
  return applications[0] || null;
};

export const loadStudentTrainingDashboardContext = async (
  studentId: mongoose.Types.ObjectId
): Promise<StudentTrainingDashboardContext> => {
  try {
    return await buildStudentTrainingDashboardContext(studentId);
  } catch (error) {
    console.error("[loadStudentTrainingDashboardContext]", error);
    return createFallbackStudentTrainingDashboardContext();
  }
};

const buildStudentTrainingDashboardContext = async (
  studentId: mongoose.Types.ObjectId
): Promise<StudentTrainingDashboardContext> => {
  await connectDB();

  const [stats, applications, approvedRecords] = await Promise.all([
    loadStudentTrainingDashboardStats(studentId),
    StudentTrainingApplication.find({ studentId, archived: { $ne: true } })
      .sort({ submittedAt: -1, updatedAt: -1 })
      .lean(),
    TrainingCompletionRecord.find({ studentId, status: "approved" })
      .sort({ reviewedAt: -1, automationCompletedAt: -1 })
      .lean(),
  ]);

  const opportunityIds = [
    ...new Set(applications.map((row) => String(row.opportunityId))),
  ];

  const opportunities = await TrainingOpportunity.find({ _id: { $in: opportunityIds } }).lean();
  const oppMap = new Map(opportunities.map((row) => [String(row._id), row]));
  const orgIds = [...new Set(opportunities.map((row) => String(row.organizationId)))];
  const organizations = await PartnerOrganization.find({ _id: { $in: orgIds } }).lean();
  const orgMap = new Map(organizations.map((row) => [String(row._id), row]));

  const applicationsByOpportunityId: Record<string, StudentTrainingApplicationSummary> = {};
  for (const app of applications) {
    const oppId = String(app.opportunityId);
    if (applicationsByOpportunityId[oppId]) continue;
    const opp = oppMap.get(oppId);
    const org = opp ? orgMap.get(String(opp.organizationId)) : null;
    const status = String(app.status) as StudentTrainingApplicationStatus;
    applicationsByOpportunityId[oppId] = {
      applicationId: String(app._id),
      opportunityId: oppId,
      status,
      submittedAt: app.submittedAt ? new Date(app.submittedAt).toISOString() : null,
      lastUpdatedAt: resolveApplicationLastUpdatedAt(app),
      opportunityTitle: opp?.title || "",
      organizationName: org?.name || "",
      blocksReapply: trainingApplicationBlocksReapply(status),
    };
  }

  const primary = pickPrimaryApplication(applications);
  const primaryOpp = primary ? oppMap.get(String(primary.opportunityId)) : null;
  const primaryOrg = primaryOpp ? orgMap.get(String(primaryOpp.organizationId)) : null;
  const primaryStatus = primary ? (String(primary.status) as StudentTrainingApplicationStatus) : null;
  const widgetStatus = resolveWidgetStatus(primaryStatus);
  const labels = resolveStudentTrainingWidgetLabels(widgetStatus);

  const achievementIds = approvedRecords
    .map((row) => row.achievementId)
    .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
  const achievements = await Achievement.find({ _id: { $in: achievementIds } })
    .select("certificateIssued certificateVerificationToken certificateId userId")
    .lean();
  const achievementMap = new Map(achievements.map((row) => [String(row._id), row]));

  const certificates: StudentTrainingCertificateSummary[] = [];
  for (const record of approvedRecords) {
    if (!record.achievementId) continue;
    const achievement = achievementMap.get(String(record.achievementId));
    if (!achievement?.certificateIssued) continue;
    const app = applications.find((row) => String(row._id) === String(record.applicationId));
    const opp = app ? oppMap.get(String(app.opportunityId)) : null;
    const achievementId = String(record.achievementId);
    certificates.push({
      recordId: String(record._id),
      achievementId,
      opportunityId: app ? String(app.opportunityId) : null,
      opportunityTitle: opp?.title || "",
      organizationName: record.organizationName || "",
      certificateViewPath: `/achievements/${achievementId}/certificate`,
      certificateVerifyPath: achievement.certificateVerificationToken
        ? `/verify/certificate/${String(achievement.certificateVerificationToken)}`
        : achievement.certificateId
          ? `/certificates/verify/${String(achievement.certificateId)}`
          : null,
      volunteerHours: record.volunteerHours ?? null,
    });
  }

  const hasApplication = Boolean(primary);
  const hasAcceptedApplication = applications.some((row) =>
    ["accepted", "completed", "awaiting_school_approval"].includes(String(row.status))
  );
  const primaryCertificate = certificates[0] || null;
  const canViewApplicationDetails = hasApplication;

  return {
    stats,
    applicationsByOpportunityId,
    widget: {
      status: widgetStatus,
      applicationStatus: primaryStatus,
      statusLabelAr: labels?.ar ?? STUDENT_TRAINING_WIDGET_LABEL_DEFAULT.ar,
      statusLabelEn: labels?.en ?? STUDENT_TRAINING_WIDGET_LABEL_DEFAULT.en,
      opportunityId: primary ? String(primary.opportunityId) : null,
      opportunityTitle: primaryOpp?.title || null,
      organizationName: primaryOrg?.name || null,
      applicationId: primary ? String(primary._id) : null,
      submittedAt: primary?.submittedAt ? new Date(primary.submittedAt).toISOString() : null,
      lastUpdatedAt: primary ? resolveApplicationLastUpdatedAt(primary) : null,
    },
    quickActions: {
      showApplicationStatus: canViewApplicationDetails,
      showMessages: canViewApplicationDetails,
      showFinalReport: hasAcceptedApplication,
      showCertificate: certificates.length > 0,
      opportunityId: primary ? String(primary.opportunityId) : null,
      applicationId: primary ? String(primary._id) : null,
      certificateAchievementId: primaryCertificate?.achievementId || null,
    },
    certificates,
  };
};

export const getStudentApplicationForOpportunity = (
  context: StudentTrainingDashboardContext,
  opportunityId: string
): StudentTrainingApplicationSummary | null =>
  context.applicationsByOpportunityId[opportunityId] || null;
