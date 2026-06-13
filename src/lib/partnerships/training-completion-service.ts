import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingAttachment from "@/models/TrainingAttachment";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
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
} from "@/lib/partnerships/partnerships-state-machine";

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
  organizationName?: string;
  supervisorName?: string;
  supervisorPhone?: string;
  trainingStartDate?: string;
  trainingEndDate?: string;
  volunteerHours?: number;
  hasAllowance?: boolean;
  studentBenefitRating?: number;
  numberOfTrainees?: number;
  assignedTasks?: string;
  studentReflection?: string;
  attendanceCommitment?: number;
  professionalEthics?: number;
  safetyCompliance?: number;
  overallRecommendation?: number;
  institutionNotes?: string;
  videoUrl?: string;
  attachments?: TrainingAttachmentInput[];
};

const parseDate = (value?: string) => {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const validateSubmitPayload = (input: SaveTrainingReportInput) => {
  const errors: string[] = [];
  if (!String(input.organizationName || "").trim()) errors.push("organizationName is required");
  if (!String(input.supervisorName || "").trim()) errors.push("supervisorName is required");
  if (!parseDate(input.trainingStartDate)) errors.push("trainingStartDate is required");
  if (!parseDate(input.trainingEndDate)) errors.push("trainingEndDate is required");
  if (input.volunteerHours == null || Number(input.volunteerHours) < 0) errors.push("volunteerHours is required");
  if (!isValidRating(input.studentBenefitRating)) errors.push("studentBenefitRating must be 1-5");
  if (!String(input.assignedTasks || "").trim()) errors.push("assignedTasks is required");
  if (!String(input.studentReflection || "").trim()) errors.push("studentReflection is required");
  if (input.videoUrl && !isAllowedTrainingVideoUrl(input.videoUrl)) {
    errors.push("videoUrl must be YouTube, Vimeo, Google Drive, or OneDrive");
  }
  return errors;
};

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
      organizationName: organization?.name || "",
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
    const errors = validateSubmitPayload(input);
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

  if (!["pending", "rejected"].includes(String(record.status))) {
    throw new Error("Report cannot be edited in current status");
  }

  record.organizationName = String(input.organizationName || organization?.name || record.organizationName || "").trim();
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
    : undefined;
  record.numberOfTrainees =
    input.numberOfTrainees != null && Number.isFinite(Number(input.numberOfTrainees))
      ? Number(input.numberOfTrainees)
      : undefined;
  record.assignedTasks = String(input.assignedTasks || "").trim() || undefined;
  record.studentReflection = String(input.studentReflection || "").trim() || undefined;
  record.attendanceCommitment = isValidRating(input.attendanceCommitment)
    ? input.attendanceCommitment
    : undefined;
  record.professionalEthics = isValidRating(input.professionalEthics)
    ? input.professionalEthics
    : undefined;
  record.safetyCompliance = isValidRating(input.safetyCompliance) ? input.safetyCompliance : undefined;
  record.overallRecommendation = isValidRating(input.overallRecommendation)
    ? input.overallRecommendation
    : undefined;
  record.institutionNotes = String(input.institutionNotes || "").trim() || undefined;
  record.videoUrl = String(input.videoUrl || "").trim() || undefined;

  if (input.videoUrl && !isAllowedTrainingVideoUrl(input.videoUrl)) {
    throw new Error("videoUrl must be YouTube, Vimeo, Google Drive, or OneDrive");
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
    record.status = "submitted";
    record.submittedAt = new Date();
    record.reviewNotes = "";
    await record.save();
    await appendApplicationTimeline(application._id, "training_report_submitted");
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
      organizationName: organization?.name || "",
    });
    record = created.toObject();
  }

  const attachments = await TrainingAttachment.find({ recordId: record._id }).sort({ createdAt: 1 }).lean();
  const opportunity = await TrainingOpportunity.findById(application.opportunityId).lean();

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
    TrainingCompletionRecord.countDocuments({ status: { $in: ["submitted", "under_review", "approved", "rejected"] } }),
    TrainingCompletionRecord.countDocuments({ status: { $in: ["submitted", "under_review"] } }),
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
}) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(input.recordId)) throw new Error("Invalid record id");

  const record = await TrainingCompletionRecord.findById(input.recordId);
  if (!record) throw new Error("Record not found");

  const currentStatus = String(record.status);
  const targetStatus =
    input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "pending";
  if (!canTransitionCompletionStatus(currentStatus, targetStatus)) {
    throw new Error(`Invalid completion status transition: ${currentStatus} → ${targetStatus}`);
  }

  const now = new Date();
  const note = String(input.note || "").trim();
  record.reviewedAt = now;
  record.reviewedBy = input.reviewerId;

  if (input.action === "approve") {
    record.status = "approved";
    record.reviewNotes = note || undefined;
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
    const bundle = await loadRecordBundle(String(record._id));
    return { ...bundle, automation };
  }

  if (input.action === "reject") {
    if (!note) throw new Error("Rejection note is required");
    record.status = "rejected";
    record.reviewNotes = note;
    await record.save();
    await appendApplicationTimeline(record.applicationId, "training_report_rejected", input.actorName, note);
    return loadRecordBundle(String(record._id));
  }

  record.status = "pending";
  record.reviewNotes = note || undefined;
  await record.save();
  await appendApplicationTimeline(
    record.applicationId,
    "training_report_changes_requested",
    input.actorName,
    note
  );
  return loadRecordBundle(String(record._id));
};

export const getTrainingCompletionReportById = async (recordId: string) => {
  await connectDB();
  return loadRecordBundle(recordId);
};
