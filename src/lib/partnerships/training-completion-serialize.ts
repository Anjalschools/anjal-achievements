import type { ITrainingAttachment } from "@/models/TrainingAttachment";
import type { ITrainingCompletionRecord } from "@/models/TrainingCompletionRecord";

type LeanRecord = Pick<
  ITrainingCompletionRecord,
  | "applicationId"
  | "studentId"
  | "organizationId"
  | "academicYear"
  | "status"
  | "organizationName"
  | "supervisorName"
  | "supervisorPhone"
  | "trainingStartDate"
  | "trainingEndDate"
  | "volunteerHours"
  | "hasAllowance"
  | "studentBenefitRating"
  | "numberOfTrainees"
  | "positionTitle"
  | "assignedTasks"
  | "studentReflection"
  | "supervisorCooperationRating"
  | "practicalBenefitRating"
  | "workEnvironmentRating"
  | "recommendInstitutionToPeers"
  | "biggestChallenge"
  | "challengeResponse"
  | "wishedToLearn"
  | "futureImpact"
  | "attendanceCommitment"
  | "professionalEthics"
  | "safetyCompliance"
  | "overallRecommendation"
  | "institutionNotes"
  | "institutionReportSource"
  | "institutionReportFileKey"
  | "institutionReportFileName"
  | "institutionReportExtraction"
  | "institutionUploadedEvaluation"
  | "videoUrl"
  | "reviewNotes"
  | "revisionRequestedAt"
  | "revisionRequestedBy"
  | "revisionReason"
  | "resubmittedAt"
  | "revisionAudit"
  | "reviewedAt"
  | "reviewedBy"
  | "submittedAt"
  | "createdAt"
  | "updatedAt"
> & { _id?: { toString(): string } };

type LeanAttachment = Pick<ITrainingAttachment, "type" | "fileName" | "storageKey" | "uploadedBy" | "createdAt"> & {
  _id?: { toString(): string };
};

type RecordContext = {
  studentName?: string;
  opportunityTitle?: string;
  organizationLabel?: string;
  attachments?: LeanAttachment[];
};

const toIso = (value?: Date | null) => (value ? new Date(value).toISOString() : null);

export const serializeTrainingAttachment = (row: LeanAttachment) => ({
  id: String(row._id),
  type: row.type,
  fileName: row.fileName,
  storageKey: row.storageKey,
  uploadedBy: String(row.uploadedBy),
  createdAt: toIso(row.createdAt),
});

export const serializeTrainingCompletionRecord = (row: LeanRecord, context?: RecordContext) => ({
  id: String(row._id),
  applicationId: String(row.applicationId),
  studentId: String(row.studentId),
  organizationId: String(row.organizationId),
  academicYear: row.academicYear,
  status: row.status,
  organizationName: row.organizationName || "",
  supervisorName: row.supervisorName || "",
  supervisorPhone: row.supervisorPhone || "",
  trainingStartDate: toIso(row.trainingStartDate),
  trainingEndDate: toIso(row.trainingEndDate),
  volunteerHours: row.volunteerHours ?? null,
  hasAllowance: row.hasAllowance ?? null,
  studentBenefitRating: row.studentBenefitRating ?? null,
  numberOfTrainees: row.numberOfTrainees ?? null,
  positionTitle: row.positionTitle || "",
  assignedTasks: row.assignedTasks || "",
  studentReflection: row.studentReflection || "",
  supervisorCooperationRating: row.supervisorCooperationRating ?? null,
  practicalBenefitRating: row.practicalBenefitRating ?? null,
  workEnvironmentRating: row.workEnvironmentRating ?? null,
  recommendInstitutionToPeers: row.recommendInstitutionToPeers ?? null,
  biggestChallenge: row.biggestChallenge || "",
  challengeResponse: row.challengeResponse || "",
  wishedToLearn: row.wishedToLearn || "",
  futureImpact: row.futureImpact || "",
  attendanceCommitment: row.attendanceCommitment ?? null,
  professionalEthics: row.professionalEthics ?? null,
  safetyCompliance: row.safetyCompliance ?? null,
  overallRecommendation: row.overallRecommendation ?? null,
  institutionNotes: row.institutionNotes || "",
  institutionReportSource: row.institutionReportSource ?? null,
  institutionReportFileKey: row.institutionReportFileKey || "",
  institutionReportFileName: row.institutionReportFileName || "",
  institutionReportExtraction: row.institutionReportExtraction ?? null,
  institutionUploadedEvaluation: row.institutionUploadedEvaluation ?? null,
  videoUrl: row.videoUrl || "",
  reviewNotes: row.reviewNotes || "",
  revisionRequestedAt: toIso(row.revisionRequestedAt),
  revisionRequestedBy: row.revisionRequestedBy ? String(row.revisionRequestedBy) : null,
  revisionReason: row.revisionReason || "",
  resubmittedAt: toIso(row.resubmittedAt),
  revisionAudit: Array.isArray(row.revisionAudit)
    ? row.revisionAudit.map((entry) => ({
        at: toIso(entry.at),
        action: entry.action,
        actorId: entry.actorId || null,
        actorName: entry.actorName || null,
        reason: entry.reason || null,
        fromStatus: entry.fromStatus || null,
        toStatus: entry.toStatus || null,
      }))
    : [],
  reviewedAt: toIso(row.reviewedAt),
  reviewedBy: row.reviewedBy ? String(row.reviewedBy) : null,
  submittedAt: toIso(row.submittedAt),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
  studentName: context?.studentName || "",
  opportunityTitle: context?.opportunityTitle || "",
  organizationLabel: context?.organizationLabel || row.organizationName || "",
  attachments: (context?.attachments || []).map(serializeTrainingAttachment),
});
