import type { IStudentTrainingApplication } from "@/models/StudentTrainingApplication";
import type { TrainingApplicationTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";
import type { TrainingStudentSnapshot } from "@/lib/partnerships/partnerships-student-snapshot";
import type { StudentAchievementSummary } from "@/lib/partnerships/build-student-achievement-summary";
import type { PartnershipStudentPortfolioAccess } from "@/lib/partnerships/partnerships-portfolio-access";
import { applyAcademicYearCreateFields } from "@/lib/academic-years/academic-year-integration";
import { resolveAcademicYearForLegacyRecord } from "@/lib/academic-years/academic-year-display";

type LeanApplication = Pick<
  IStudentTrainingApplication,
  | "studentId"
  | "opportunityId"
  | "status"
  | "institutionStatus"
  | "academicYear"
  | "academicYearId"
  | "academicYearLabel"
  | "studentSnapshot"
  | "submittedAt"
  | "reviewedAt"
  | "reviewedBy"
  | "reviewNotes"
  | "rejectionReason"
  | "timeline"
  | "createdAt"
  | "updatedAt"
> & { _id?: { toString(): string } };

type ApplicationContext = {
  opportunityTitle?: string;
  organizationName?: string;
  organizationId?: string;
  achievementSummary?: StudentAchievementSummary;
  publicPortfolio?: PartnershipStudentPortfolioAccess;
};

const serializeTimeline = (timeline: TrainingApplicationTimelineEvent[] | undefined) =>
  (timeline || []).map((event) => ({
    at: event.at ? new Date(event.at).toISOString() : null,
    action: event.action,
    fromStatus: event.fromStatus || null,
    toStatus: event.toStatus || null,
    actorId: event.actorId || null,
    actorName: event.actorName || null,
    note: event.note || null,
  }));

export const serializeTrainingApplication = async (row: LeanApplication, context?: ApplicationContext) => {
  const academicYearLabel = await resolveAcademicYearForLegacyRecord({
    academicYear: row.academicYear,
    academicYearLabel: row.academicYearLabel,
  });

  return {
  id: String(row._id),
  studentId: String(row.studentId),
  opportunityId: String(row.opportunityId),
  status: row.status,
  institutionStatus: row.institutionStatus || null,
  academicYear: academicYearLabel,
  academicYearId: row.academicYearId ? String(row.academicYearId) : null,
  academicYearLabel,
  studentSnapshot: row.studentSnapshot as TrainingStudentSnapshot,
  submittedAt: row.submittedAt ? new Date(row.submittedAt).toISOString() : null,
  reviewedAt: row.reviewedAt ? new Date(row.reviewedAt).toISOString() : null,
  reviewedBy: row.reviewedBy ? String(row.reviewedBy) : null,
  reviewNotes: row.reviewNotes || "",
  rejectionReason: row.rejectionReason || "",
  timeline: serializeTimeline(row.timeline),
  createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  opportunityTitle: context?.opportunityTitle || "",
  organizationName: context?.organizationName || "",
  organizationId: context?.organizationId || "",
  achievementSummary: context?.achievementSummary,
  publicPortfolio: context?.publicPortfolio,
  excellenceScore: context?.achievementSummary?.excellenceScore ?? null,
  };
};
