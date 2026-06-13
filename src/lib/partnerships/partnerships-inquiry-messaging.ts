import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnershipMessage from "@/models/PartnershipMessage";
import PartnershipThread from "@/models/PartnershipThread";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import {
  STUDENT_INQUIRY_TYPES,
  type StudentInquiryType,
} from "@/lib/partnerships/partnerships-student-application-constants";
import { notifySupervisorTrainingMessage } from "@/lib/partnerships/partnerships-training-notifications";

const preview = (text: string) => String(text || "").trim().slice(0, 280);

const INQUIRY_SUBJECT: Record<StudentInquiryType, { ar: string; en: string }> = {
  general_inquiry: { ar: "استفسار عام — التدريب الصيفي", en: "General inquiry — Summer training" },
  opportunity_inquiry: { ar: "استفسار عن فرصة تدريب", en: "Opportunity inquiry" },
  application_inquiry: { ar: "استفسار عن طلب تدريب", en: "Application inquiry" },
  interview_inquiry: { ar: "استفسار عن مقابلة", en: "Interview inquiry" },
  acceptance_inquiry: { ar: "استفسار عن قبول", en: "Acceptance inquiry" },
};

const MEANINGFUL_STATUSES = new Set([
  "submitted",
  "under_review",
  "interview_requested",
  "institution_review",
  "accepted",
  "completed",
]);

export const resolveAllowedInquiryTypes = (
  applications: Array<{ status: string }>
): StudentInquiryType[] => {
  const meaningful = applications.filter((row) => MEANINGFUL_STATUSES.has(String(row.status || "")));
  const hasApplication = meaningful.length > 0;
  const hasInterviewStage = meaningful.some((row) =>
    ["interview_requested", "institution_review", "accepted", "completed"].includes(String(row.status))
  );
  const hasInstitutionStage = meaningful.some((row) =>
    ["institution_review", "accepted", "completed"].includes(String(row.status))
  );

  const allowed: StudentInquiryType[] = [];
  if (!hasApplication) {
    allowed.push("general_inquiry", "opportunity_inquiry");
  } else {
    allowed.push("application_inquiry");
  }
  if (hasInterviewStage) allowed.push("interview_inquiry");
  if (hasInstitutionStage) allowed.push("acceptance_inquiry");
  return allowed;
};

export const loadStudentInquiryContext = async (studentId: mongoose.Types.ObjectId) => {
  await connectDB();
  const applications = await StudentTrainingApplication.find({
    studentId,
    archived: { $ne: true },
  })
    .select("status opportunityId submittedAt")
    .sort({ submittedAt: -1 })
    .lean();

  const opportunityIds = [...new Set(applications.map((row) => String(row.opportunityId)))];
  const opportunities = await TrainingOpportunity.find({
    _id: { $in: opportunityIds },
    visible: true,
    active: true,
  })
    .select("title")
    .lean();

  const visibleOpportunities = await TrainingOpportunity.find({ visible: true, active: true })
    .select("title")
    .sort({ registrationEnd: -1 })
    .limit(40)
    .lean();

  const oppTitleMap = new Map(
    [...opportunities, ...visibleOpportunities].map((row) => [String(row._id), row.title])
  );

  return {
    allowedInquiryTypes: resolveAllowedInquiryTypes(applications),
    applications: applications
      .filter((row) => MEANINGFUL_STATUSES.has(String(row.status)))
      .map((row) => ({
        id: String(row._id),
        status: String(row.status),
        opportunityId: String(row.opportunityId),
        opportunityTitle: oppTitleMap.get(String(row.opportunityId)) || "",
      })),
    opportunities: visibleOpportunities.map((row) => ({
      id: String(row._id),
      title: row.title,
    })),
  };
};

const validateInquiryPermission = (
  inquiryType: StudentInquiryType,
  allowed: StudentInquiryType[]
) => {
  if (!STUDENT_INQUIRY_TYPES.includes(inquiryType)) {
    throw new Error("Invalid inquiry type");
  }
  if (!allowed.includes(inquiryType)) {
    throw new Error("This inquiry type is not available for your current application status");
  }
};

const findOrCreateInquiryThread = async (input: {
  studentId: mongoose.Types.ObjectId;
  inquiryType: StudentInquiryType;
  locale: "ar" | "en";
  opportunityId?: string;
  applicationId?: string;
}) => {
  const subject = INQUIRY_SUBJECT[input.inquiryType][input.locale];

  if (input.inquiryType === "general_inquiry") {
    let thread = await PartnershipThread.findOne({ studentId: input.studentId, threadKind: "general" });
    if (!thread) {
      thread = await PartnershipThread.create({
        studentId: input.studentId,
        threadKind: "general",
        inquiryType: input.inquiryType,
        subject,
        participantSupervisorIds: [],
      });
    }
    return thread;
  }

  if (input.inquiryType === "opportunity_inquiry") {
    if (!input.opportunityId || !mongoose.Types.ObjectId.isValid(input.opportunityId)) {
      throw new Error("opportunityId is required for opportunity inquiry");
    }
    let thread = await PartnershipThread.findOne({
      studentId: input.studentId,
      opportunityId: input.opportunityId,
      threadKind: "opportunity",
    });
    if (!thread) {
      thread = await PartnershipThread.create({
        studentId: input.studentId,
        opportunityId: new mongoose.Types.ObjectId(input.opportunityId),
        threadKind: "opportunity",
        inquiryType: input.inquiryType,
        subject,
        participantSupervisorIds: [],
      });
    }
    return thread;
  }

  if (!input.applicationId || !mongoose.Types.ObjectId.isValid(input.applicationId)) {
    throw new Error("applicationId is required for this inquiry type");
  }

  const application = await StudentTrainingApplication.findById(input.applicationId).lean();
  if (!application || String(application.studentId) !== String(input.studentId)) {
    throw new Error("Application not found");
  }

  let thread = await PartnershipThread.findOne({ applicationId: application._id });
  if (!thread) {
    thread = await PartnershipThread.create({
      studentId: input.studentId,
      applicationId: application._id,
      opportunityId: application.opportunityId,
      threadKind: "application",
      inquiryType: input.inquiryType,
      subject,
      participantSupervisorIds: [],
    });
  }
  return thread;
};

export const sendStudentInquiryMessage = async (input: {
  studentId: mongoose.Types.ObjectId;
  inquiryType: StudentInquiryType;
  body: string;
  locale?: "ar" | "en";
  opportunityId?: string;
  applicationId?: string;
}) => {
  await connectDB();
  const locale = input.locale || "ar";
  const body = String(input.body || "").trim();
  if (!body) throw new Error("Message body is required");

  const context = await loadStudentInquiryContext(input.studentId);
  validateInquiryPermission(input.inquiryType, context.allowedInquiryTypes);

  const thread = await findOrCreateInquiryThread({
    studentId: input.studentId,
    inquiryType: input.inquiryType,
    locale,
    opportunityId: input.opportunityId,
    applicationId: input.applicationId,
  });

  thread.studentUnreadCount = 0;
  thread.supervisorUnreadCount = (thread.supervisorUnreadCount || 0) + 1;
  thread.lastMessagePreview = preview(body);
  thread.lastMessageAt = new Date();
  thread.inquiryType = input.inquiryType;
  await thread.save();

  const message = await PartnershipMessage.create({
    threadId: thread._id,
    senderId: input.studentId,
    senderRole: "student",
    body,
    metadata: { inquiryType: input.inquiryType },
  });

  await notifySupervisorTrainingMessage({
    title: locale === "ar" ? "رسالة طالب — التدريب الصيفي" : "Student message — Summer training",
    message: body,
    metadata: {
      threadId: String(thread._id),
      inquiryType: input.inquiryType,
      applicationId: thread.applicationId ? String(thread.applicationId) : null,
      opportunityId: thread.opportunityId ? String(thread.opportunityId) : null,
    },
  });

  return {
    threadId: String(thread._id),
    messageId: String(message._id),
  };
};
