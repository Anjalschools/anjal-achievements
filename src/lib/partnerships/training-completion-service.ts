import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingAttachment from "@/models/TrainingAttachment";
import TrainingCompletionRecord, {
  type InstitutionReportExtractionMeta,
} from "@/models/TrainingCompletionRecord";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";
import {
  inferTrainingAttachmentType,
  isAllowedTrainingVideoUrl,
  isValidRating,
  type TrainingAttachmentType,
  type TrainingReportSupervisorAction,
} from "@/lib/partnerships/training-completion-constants";
import { serializeTrainingCompletionRecord } from "@/lib/partnerships/training-completion-serialize";
import { getPartnershipProgramSettings } from "@/lib/partnerships/partnerships-settings-service";
import {
  canAutomationCompleteApplication,
  canTransitionCompletionStatus,
  getAllowedCompletionTransitions,
} from "@/lib/partnerships/partnerships-state-machine";
import { validateTrainingReportSubmitPayload } from "@/lib/partnerships/training-completion-validation";
import { extractInstitutionFinalReportFromUpload } from "@/lib/partnerships/institution-final-report-ai";
import { applyInstitutionExtractionToRecord } from "@/lib/partnerships/institution-final-report-auto-populate";
import { inferInstitutionReportSourceFromMime } from "@/lib/partnerships/institution-final-report-constants";
import { buildInstitutionReportValidationDiagnostics } from "@/lib/partnerships/institution-final-report-validation-diagnostics";
import {
  resolveInstitutionReportVisualEvidence,
  type InstitutionReportDetectionFeedback,
} from "@/lib/partnerships/institution-final-report-visual-evidence";

const appendRevisionAudit = (
  record: InstanceType<typeof TrainingCompletionRecord>,
  entry: {
    action: string;
    actorId?: string;
    actorName?: string;
    reason?: string;
    fromStatus?: string;
    toStatus?: string;
  }
) => {
  const audit = Array.isArray(record.revisionAudit) ? [...record.revisionAudit] : [];
  audit.push({
    at: new Date(),
    action: entry.action,
    actorId: entry.actorId,
    actorName: entry.actorName,
    reason: entry.reason,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
  });
  record.revisionAudit = audit;
};

const pickInstitutionReviewStatus = (record: InstanceType<typeof TrainingCompletionRecord>) => {
  const extraction =
    record.institutionReportExtraction && typeof record.institutionReportExtraction === "object"
      ? (record.institutionReportExtraction as Record<string, unknown>)
      : null;
  const validationResult =
    extraction?.validationResult && typeof extraction.validationResult === "object"
      ? (extraction.validationResult as Record<string, unknown>)
      : null;
  const reviewStatus = String(validationResult?.reviewStatus || extraction?.reviewStatus || "");
  return reviewStatus === "APPROVED" || reviewStatus === "REQUIRES_REVIEW" ? reviewStatus : null;
};

export const enrichTrainingCompletionRecordForRead = <
  T extends Record<string, unknown> & {
    institutionReportExtraction?: Record<string, unknown> | null;
    institutionReportFileKey?: string;
    institutionReportFileName?: string;
  },
>(
  item: T
) => {
  const extraction =
    item.institutionReportExtraction && typeof item.institutionReportExtraction === "object"
      ? { ...item.institutionReportExtraction }
      : null;

  if (extraction && !extraction.visualEvidence) {
    const resolved = resolveInstitutionReportVisualEvidence(
      extraction,
      String(item.institutionReportFileKey || "")
    );
    if (resolved) {
      extraction.visualEvidence = resolved;
    }
  }

  const validationDiagnostics = buildInstitutionReportValidationDiagnostics(extraction, {
    fileName: String(item.institutionReportFileName || ""),
  });

  return {
    ...item,
    institutionReportExtraction: extraction,
    validationDiagnostics,
  };
};

export { getAllowedCompletionTransitions };

export { validateTrainingReportSubmitPayload };

const ELIGIBLE_APPLICATION_STATUSES = new Set(["accepted", "completed"]);

export type TrainingAttachmentInput = {
  type?: TrainingAttachmentType;
  fileName: string;
  storageKey: string;
  mimeType?: string;
};

export type SaveTrainingReportInput = {
  applicationId: string;
  studentId: mongoose.Types.ObjectId;
  submit?: boolean;
  supervisorName?: string;
  supervisorPhone?: string;
  trainingStartDate?: string;
  trainingEndDate?: string;
  volunteerHours?: number;
  hasAllowance?: boolean;
  studentBenefitRating?: number;
  numberOfTrainees?: number;
  positionTitle?: string;
  assignedTasks?: string;
  studentReflection?: string;
  supervisorCooperationRating?: number;
  practicalBenefitRating?: number;
  workEnvironmentRating?: number;
  recommendInstitutionToPeers?: boolean;
  biggestChallenge?: string;
  challengeResponse?: string;
  wishedToLearn?: string;
  futureImpact?: string;
  videoUrl?: string;
  attachments?: TrainingAttachmentInput[];
  institutionReport?: {
    fileName: string;
    storageKey: string;
    mimeType?: string;
  };
};

const parseDate = (value?: string) => {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const resolveOrganizationName = (organization?: { name?: string } | null, fallback = "") =>
  String(organization?.name || fallback || "").trim();

const buildSubmitValidationInput = (
  input: SaveTrainingReportInput,
  organizationName: string
) => ({
  organizationNameFromApplication: organizationName,
  supervisorName: input.supervisorName,
  trainingStartDate: input.trainingStartDate,
  trainingEndDate: input.trainingEndDate,
  volunteerHours: input.volunteerHours,
  studentBenefitRating: input.studentBenefitRating,
  positionTitle: input.positionTitle,
  assignedTasks: input.assignedTasks,
  studentReflection: input.studentReflection,
  supervisorCooperationRating: input.supervisorCooperationRating,
  practicalBenefitRating: input.practicalBenefitRating,
  workEnvironmentRating: input.workEnvironmentRating,
  recommendInstitutionToPeers: input.recommendInstitutionToPeers,
  biggestChallenge: input.biggestChallenge,
  challengeResponse: input.challengeResponse,
  wishedToLearn: input.wishedToLearn,
  futureImpact: input.futureImpact,
  videoUrl: input.videoUrl,
});

const validateVideoAndAttachments = async (input: SaveTrainingReportInput) => {
  const settings = await getPartnershipProgramSettings();
  if (input.videoUrl?.trim() && !settings.allowVideoUpload) {
    throw new Error("Video upload is disabled by program settings");
  }
  const maxBytes = settings.maxAttachmentSizeMb * 1024 * 1024;
  for (const attachment of input.attachments || []) {
    if (attachment.mimeType && attachment.fileName) {
      const estimated = attachment.storageKey?.length || 0;
      if (estimated > maxBytes * 4) {
        throw new Error(`Attachment exceeds max size of ${settings.maxAttachmentSizeMb}MB`);
      }
    }
  }
};

const loadApplicationContext = async (applicationId: string, studentId?: mongoose.Types.ObjectId) => {
  const application = await StudentTrainingApplication.findById(applicationId);
  if (!application) throw new Error("Application not found");
  if (studentId && String(application.studentId) !== String(studentId)) {
    throw new Error("Forbidden");
  }
  if (!ELIGIBLE_APPLICATION_STATUSES.has(String(application.status))) {
    throw new Error("Application is not eligible for final report");
  }
  const opportunity = await TrainingOpportunity.findById(application.opportunityId).lean();
  if (!opportunity) throw new Error("Opportunity not found");
  const organization = await PartnerOrganization.findById(opportunity.organizationId).lean();
  return { application, opportunity, organization };
};

const appendApplicationTimeline = async (
  applicationId: mongoose.Types.ObjectId,
  action: string,
  actorName?: string,
  note?: string
) => {
  const application = await StudentTrainingApplication.findById(applicationId);
  if (!application) return;
  application.timeline = appendTimelineEvent(application.timeline, {
    at: new Date(),
    action,
    actorName,
    note,
  });
  await application.save();
};

const loadRecordBundle = async (recordId: string) => {
  const record = await TrainingCompletionRecord.findById(recordId).lean();
  if (!record) return null;
  const [application, attachments] = await Promise.all([
    StudentTrainingApplication.findById(record.applicationId).lean(),
    TrainingAttachment.find({ recordId: record._id }).sort({ createdAt: 1 }).lean(),
  ]);
  const opportunity = application
    ? await TrainingOpportunity.findById(application.opportunityId).lean()
    : null;
  const organization = opportunity
    ? await PartnerOrganization.findById(opportunity.organizationId).lean()
    : null;
  return serializeTrainingCompletionRecord(record, {
    studentName: application?.studentSnapshot?.fullName || "",
    opportunityTitle: opportunity?.title || "",
    organizationLabel: organization?.name || record.organizationName || "",
    attachments,
  });
};

const loadEnrichedRecordBundle = async (recordId: string) => {
  const bundle = await loadRecordBundle(recordId);
  return bundle ? enrichTrainingCompletionRecordForRead(bundle) : null;
};

export const ensureTrainingCompletionRecord = async (input: {
  applicationId: string;
  studentId: mongoose.Types.ObjectId;
}) => {
  await connectDB();
  const { application, opportunity, organization } = await loadApplicationContext(
    input.applicationId,
    input.studentId
  );

  let record = await TrainingCompletionRecord.findOne({ applicationId: application._id });
  if (!record) {
    record = await TrainingCompletionRecord.create({
      applicationId: application._id,
      studentId: application.studentId,
      organizationId: opportunity.organizationId,
      academicYear: application.academicYear,
      status: "pending",
      organizationName: resolveOrganizationName(organization),
      studentBenefitRating: 5,
    });
  }
  return record;
};

export const saveTrainingCompletionReport = async (input: SaveTrainingReportInput) => {
  await connectDB();
  const { application, opportunity, organization } = await loadApplicationContext(
    input.applicationId,
    input.studentId
  );

  if (input.submit) {
    let recordForValidation = await TrainingCompletionRecord.findOne({ applicationId: application._id });
    const organizationName = resolveOrganizationName(
      organization,
      recordForValidation?.organizationName
    );
    const errors = validateTrainingReportSubmitPayload(
      buildSubmitValidationInput(input, organizationName)
    );
    if (errors.length > 0) throw new Error(errors[0]);
  }
  await validateVideoAndAttachments(input);

  let record = await TrainingCompletionRecord.findOne({ applicationId: application._id });
  if (!record) {
    record = new TrainingCompletionRecord({
      applicationId: application._id,
      studentId: application.studentId,
      organizationId: opportunity.organizationId,
      academicYear: application.academicYear,
      status: "pending",
    });
  }

  if (!["pending", "rejected", "needs_revision"].includes(String(record.status))) {
    throw new Error("Report cannot be edited in current status");
  }

  record.organizationName = resolveOrganizationName(organization, record.organizationName);
  record.supervisorName = String(input.supervisorName || "").trim() || undefined;
  record.supervisorPhone = String(input.supervisorPhone || "").trim() || undefined;
  record.trainingStartDate = parseDate(input.trainingStartDate);
  record.trainingEndDate = parseDate(input.trainingEndDate);
  record.volunteerHours =
    input.volunteerHours != null && Number.isFinite(Number(input.volunteerHours))
      ? Number(input.volunteerHours)
      : undefined;
  record.hasAllowance = typeof input.hasAllowance === "boolean" ? input.hasAllowance : undefined;
  record.studentBenefitRating = isValidRating(input.studentBenefitRating)
    ? input.studentBenefitRating
    : record.studentBenefitRating ?? 5;
  record.numberOfTrainees =
    input.numberOfTrainees != null && Number.isFinite(Number(input.numberOfTrainees))
      ? Number(input.numberOfTrainees)
      : undefined;
  record.positionTitle = String(input.positionTitle || "").trim() || undefined;
  record.assignedTasks = String(input.assignedTasks || "").trim() || undefined;
  record.studentReflection = String(input.studentReflection || "").trim() || undefined;
  record.supervisorCooperationRating = isValidRating(input.supervisorCooperationRating)
    ? input.supervisorCooperationRating
    : undefined;
  record.practicalBenefitRating = isValidRating(input.practicalBenefitRating)
    ? input.practicalBenefitRating
    : undefined;
  record.workEnvironmentRating = isValidRating(input.workEnvironmentRating)
    ? input.workEnvironmentRating
    : undefined;
  record.recommendInstitutionToPeers =
    typeof input.recommendInstitutionToPeers === "boolean"
      ? input.recommendInstitutionToPeers
      : undefined;
  record.biggestChallenge = String(input.biggestChallenge || "").trim() || undefined;
  record.challengeResponse = String(input.challengeResponse || "").trim() || undefined;
  record.wishedToLearn = String(input.wishedToLearn || "").trim() || undefined;
  record.futureImpact = String(input.futureImpact || "").trim() || undefined;
  record.videoUrl = String(input.videoUrl || "").trim() || undefined;

  if (input.videoUrl && !isAllowedTrainingVideoUrl(input.videoUrl)) {
    throw new Error("videoUrl must be YouTube, Vimeo, Google Drive, or OneDrive");
  }

  if (input.institutionReport?.storageKey) {
    const fileName = String(input.institutionReport.fileName || "").trim();
    const storageKey = String(input.institutionReport.storageKey || "").trim();
    const mimeType = String(input.institutionReport.mimeType || "").trim() || undefined;
    if (fileName && storageKey) {
      record.institutionReportFileKey = storageKey;
      record.institutionReportFileName = fileName;
      const source = inferInstitutionReportSourceFromMime(fileName, mimeType);
      if (record.institutionReportSource !== "portal") {
        record.institutionReportSource = source;
      }
      const extraction = await extractInstitutionFinalReportFromUpload({
        storageKey,
        fileName,
        mimeType,
      });
      applyInstitutionExtractionToRecord(record, extraction, source, storageKey);
      await appendApplicationTimeline(
        application._id,
        "institution_final_report_uploaded",
        undefined,
        fileName
      );
    }
  }

  await record.save();

  if (Array.isArray(input.attachments) && input.attachments.length > 0) {
    for (const row of input.attachments) {
      const fileName = String(row.fileName || "").trim();
      const storageKey = String(row.storageKey || "").trim();
      if (!fileName || !storageKey) continue;
      const type = row.type || inferTrainingAttachmentType(fileName, row.mimeType);
      await TrainingAttachment.create({
        recordId: record._id,
        type,
        fileName,
        storageKey,
        uploadedBy: input.studentId,
      });
      await appendApplicationTimeline(application._id, "training_attachment_uploaded", undefined, fileName);
    }
  }

  if (input.submit) {
    const previousStatus = String(record.status);
    record.status = previousStatus === "needs_revision" ? "resubmitted" : "submitted";
    record.submittedAt = new Date();
    if (previousStatus === "needs_revision") {
      record.resubmittedAt = new Date();
      appendRevisionAudit(record, {
        action: "resubmitted",
        actorId: String(input.studentId),
        fromStatus: previousStatus,
        toStatus: "resubmitted",
      });
      await appendApplicationTimeline(application._id, "training_report_resubmitted");
    } else {
      record.reviewNotes = "";
      await appendApplicationTimeline(application._id, "training_report_submitted");
    }
    await record.save();
  }

  return loadRecordBundle(String(record._id));
};

export const getStudentTrainingReport = async (studentId: mongoose.Types.ObjectId) => {
  await connectDB();
  const application = await StudentTrainingApplication.findOne({
    studentId,
    status: { $in: ["accepted", "completed"] },
  })
    .sort({ submittedAt: -1, createdAt: -1 })
    .lean();

  if (!application) return { eligible: false, application: null, item: null };

  let record = await TrainingCompletionRecord.findOne({ applicationId: application._id }).lean();
  if (!record) {
    const opportunity = await TrainingOpportunity.findById(application.opportunityId).lean();
    const organization = opportunity
      ? await PartnerOrganization.findById(opportunity.organizationId).lean()
      : null;
    if (!opportunity?.organizationId) throw new Error("Opportunity organization not found");
    const created = await TrainingCompletionRecord.create({
      applicationId: application._id,
      studentId: application.studentId,
      organizationId: opportunity.organizationId,
      academicYear: application.academicYear,
      status: "pending",
      organizationName: resolveOrganizationName(organization),
      studentBenefitRating: 5,
    });
    record = created.toObject();
  }

  const attachments = await TrainingAttachment.find({ recordId: record._id }).sort({ createdAt: 1 }).lean();
  const opportunity = await TrainingOpportunity.findById(application.opportunityId).lean();
  const organization = opportunity
    ? await PartnerOrganization.findById(opportunity.organizationId).lean()
    : null;

  return {
    eligible: true,
    application: {
      id: String(application._id),
      status: application.status,
      opportunityTitle: opportunity?.title || "",
    },
    item: serializeTrainingCompletionRecord(record, {
      studentName: application.studentSnapshot?.fullName || "",
      opportunityTitle: opportunity?.title || "",
      organizationLabel: resolveOrganizationName(organization, record.organizationName),
      attachments,
    }),
  };
};

export const listTrainingCompletionReports = async (filters?: {
  status?: string;
  organizationId?: string;
  academicYear?: string;
}) => {
  await connectDB();
  const query: Record<string, unknown> = {};
  if (filters?.status && filters.status !== "all") query.status = filters.status;
  if (filters?.organizationId && mongoose.Types.ObjectId.isValid(filters.organizationId)) {
    query.organizationId = filters.organizationId;
  }
  if (filters?.academicYear) query.academicYear = filters.academicYear;

  const records = await TrainingCompletionRecord.find(query)
    .sort({ submittedAt: -1, updatedAt: -1 })
    .limit(200)
    .lean();

  const applicationIds = records.map((row) => row.applicationId);
  const applications = await StudentTrainingApplication.find({ _id: { $in: applicationIds } }).lean();
  const appMap = new Map(applications.map((row) => [String(row._id), row]));

  const opportunityIds = [...new Set(applications.map((row) => String(row.opportunityId)))];
  const opportunities = await TrainingOpportunity.find({ _id: { $in: opportunityIds } }).lean();
  const oppMap = new Map(opportunities.map((row) => [String(row._id), row]));

  const items = records.map((record) => {
    const app = appMap.get(String(record.applicationId));
    const opp = app ? oppMap.get(String(app.opportunityId)) : undefined;
    return serializeTrainingCompletionRecord(record, {
      studentName: app?.studentSnapshot?.fullName || "",
      opportunityTitle: opp?.title || "",
      organizationLabel: record.organizationName || "",
    });
  });

  const [submitted, pendingReview, approved, rejected] = await Promise.all([
    TrainingCompletionRecord.countDocuments({
      status: { $in: ["submitted", "under_review", "resubmitted", "needs_revision", "approved", "rejected"] },
    }),
    TrainingCompletionRecord.countDocuments({
      status: { $in: ["submitted", "under_review", "resubmitted"] },
    }),
    TrainingCompletionRecord.countDocuments({ status: "approved" }),
    TrainingCompletionRecord.countDocuments({ status: "rejected" }),
  ]);

  return {
    items,
    dashboard: {
      submitted,
      pendingReview,
      approved,
      rejected,
    },
  };
};

export const reviewTrainingCompletionReport = async (input: {
  recordId: string;
  action: TrainingReportSupervisorAction;
  reviewerId: mongoose.Types.ObjectId;
  actorName?: string;
  note?: string;
  approveOverride?: boolean;
}) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(input.recordId)) throw new Error("Invalid record id");

  const record = await TrainingCompletionRecord.findById(input.recordId);
  if (!record) throw new Error("Record not found");

  const currentStatus = String(record.status);
  const targetStatus =
    input.action === "approve"
      ? "approved"
      : input.action === "reject"
        ? "rejected"
        : "needs_revision";
  if (!canTransitionCompletionStatus(currentStatus, targetStatus)) {
    throw new Error(`Invalid completion status transition: ${currentStatus} → ${targetStatus}`);
  }

  const now = new Date();
  const note = String(input.note || "").trim();
  record.reviewedAt = now;
  record.reviewedBy = input.reviewerId;

  if (input.action === "approve") {
    const institutionReviewStatus = pickInstitutionReviewStatus(record);
    if (institutionReviewStatus === "REQUIRES_REVIEW" && !input.approveOverride) {
      throw new Error("Institution report requires review before approval");
    }
    record.status = "approved";
    record.reviewNotes = note || undefined;
    appendRevisionAudit(record, {
      action: "approved",
      actorId: String(input.reviewerId),
      actorName: input.actorName,
      reason: note || undefined,
      fromStatus: currentStatus,
      toStatus: "approved",
    });
    await record.save();
    const application = await StudentTrainingApplication.findById(record.applicationId);
    if (application) {
      const fromStatus = String(application.status || "");
      if (!canAutomationCompleteApplication(fromStatus)) {
        throw new Error(`Cannot complete application from status: ${fromStatus}`);
      }
      application.status = "completed";
      application.timeline = appendTimelineEvent(application.timeline, {
        at: now,
        action: "training_report_approved",
        fromStatus,
        toStatus: "completed",
        actorName: input.actorName,
        note,
      });
      await application.save();
    } else {
      await appendApplicationTimeline(record.applicationId, "training_report_approved", input.actorName, note);
    }
    const { processTrainingCompletionAutomation } = await import(
      "@/lib/partnerships/training-achievement-automation"
    );
    const automation = await processTrainingCompletionAutomation({
      recordId: String(record._id),
      reviewerId: input.reviewerId,
    });
    const bundle = await loadEnrichedRecordBundle(String(record._id));
    return { ...bundle, automation };
  }

  if (input.action === "reject") {
    if (!note) throw new Error("Rejection note is required");
    record.status = "rejected";
    record.reviewNotes = note;
    appendRevisionAudit(record, {
      action: "rejected",
      actorId: String(input.reviewerId),
      actorName: input.actorName,
      reason: note,
      fromStatus: currentStatus,
      toStatus: "rejected",
    });
    await record.save();
    await appendApplicationTimeline(record.applicationId, "training_report_rejected", input.actorName, note);
    return loadEnrichedRecordBundle(String(record._id));
  }

  if (!note) throw new Error("Revision note is required");
  record.status = "needs_revision";
  record.revisionRequestedAt = now;
  record.revisionRequestedBy = input.reviewerId;
  record.revisionReason = note;
  record.reviewNotes = note;
  appendRevisionAudit(record, {
    action: "needs_revision",
    actorId: String(input.reviewerId),
    actorName: input.actorName,
    reason: note,
    fromStatus: currentStatus,
    toStatus: "needs_revision",
  });
  await record.save();
  await appendApplicationTimeline(
    record.applicationId,
    "training_report_revision_requested",
    input.actorName,
    note
  );
  return loadEnrichedRecordBundle(String(record._id));
};

export const getTrainingCompletionReportById = async (recordId: string) => {
  await connectDB();
  return loadEnrichedRecordBundle(recordId);
};

export const markInstitutionReportManualVerification = async (input: {
  recordId: string;
  reviewerId: mongoose.Types.ObjectId;
}) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(input.recordId)) throw new Error("Invalid record id");

  const record = await TrainingCompletionRecord.findById(input.recordId);
  if (!record) throw new Error("Record not found");
  if (!record.institutionReportExtraction || typeof record.institutionReportExtraction !== "object") {
    throw new Error("Institution report extraction not found");
  }

  const now = new Date();
  const existing = record.institutionReportExtraction as InstitutionReportExtractionMeta;
  record.institutionReportExtraction = {
    ...existing,
    manualVerification: true,
    manualVerifiedAt: now,
    manualVerifiedBy: String(input.reviewerId),
  };
  record.markModified("institutionReportExtraction");
  await record.save();

  return loadEnrichedRecordBundle(String(record._id));
};

export type InstitutionDetectionFeedbackTarget = "stamp" | "signature" | "rating";

export const markInstitutionReportDetectionFeedback = async (input: {
  recordId: string;
  reviewerId: mongoose.Types.ObjectId;
  target: InstitutionDetectionFeedbackTarget;
  ratingKey?: string;
}) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(input.recordId)) throw new Error("Invalid record id");
  if (input.target === "rating" && !String(input.ratingKey || "").trim()) {
    throw new Error("ratingKey is required for rating feedback");
  }

  const record = await TrainingCompletionRecord.findById(input.recordId);
  if (!record) throw new Error("Record not found");
  if (!record.institutionReportExtraction || typeof record.institutionReportExtraction !== "object") {
    throw new Error("Institution report extraction not found");
  }

  const now = new Date();
  const existing = record.institutionReportExtraction as InstitutionReportExtractionMeta;
  const validationResult = existing.validationResult as Record<string, unknown> | undefined;
  const priorFeedback = (existing.detectionFeedback as InstitutionReportDetectionFeedback | undefined) || {};
  const priorModelFeedback = (existing.modelFeedback as { entries?: unknown[] } | undefined) || {
    entries: [],
  };

  const detectionFeedback: InstitutionReportDetectionFeedback = {
    ...priorFeedback,
    feedbackAt: now.toISOString(),
    feedbackBy: String(input.reviewerId),
  };

  const aiDetected =
    input.target === "stamp"
      ? validationResult?.stampDetected === true
      : input.target === "signature"
        ? validationResult?.signatureDetected === true
        : Boolean(
            (validationResult?.ratingRowDetails as Array<{ key: string; rowStatus: string }> | undefined)?.find(
              (row) => row.key === input.ratingKey
            )?.rowStatus === "VALID"
          );

  if (input.target === "stamp") detectionFeedback.falsePositiveStamp = true;
  if (input.target === "signature") detectionFeedback.falsePositiveSignature = true;
  if (input.target === "rating" && input.ratingKey) {
    detectionFeedback.falsePositiveRatings = [
      ...new Set([...(priorFeedback.falsePositiveRatings || []), input.ratingKey]),
    ];
  }

  const modelFeedback = {
    entries: [
      ...(Array.isArray(priorModelFeedback.entries) ? priorModelFeedback.entries : []),
      {
        target: input.target,
        ratingKey: input.ratingKey,
        aiDetected,
        aiConfidence:
          input.target === "stamp"
            ? validationResult?.stampConfidence
            : input.target === "signature"
              ? validationResult?.signatureConfidence
              : undefined,
        reviewStatus: validationResult?.reviewStatus,
        overallConfidence: validationResult?.overallConfidence ?? validationResult?.confidence,
        markedAt: now.toISOString(),
        markedBy: String(input.reviewerId),
      },
    ],
  };

  record.institutionReportExtraction = {
    ...existing,
    detectionFeedback,
    modelFeedback,
  };
  record.markModified("institutionReportExtraction");
  await record.save();

  return loadEnrichedRecordBundle(String(record._id));
};
