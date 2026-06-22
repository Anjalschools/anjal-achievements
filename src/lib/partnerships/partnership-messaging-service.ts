import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Notification from "@/models/Notification";
import PartnershipMessage from "@/models/PartnershipMessage";
import PartnershipThread from "@/models/PartnershipThread";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";
import {
  notifyStudentSupervisorReply,
  notifySupervisorTrainingMessage,
} from "@/lib/partnerships/partnerships-training-notifications";
import {
  enrichMessagePermissions,
  normalizePartnershipSenderId,
  recordPartnershipMessageSent,
  resolvePartnershipActorId,
  serializePartnershipMessageRow,
} from "@/lib/partnerships/partnership-message-mutation-service";
import {
  buildPartnershipMessagePermissionTraceRow,
} from "@/lib/partnerships/partnership-message-permission-trace";
import {
  PARTNERSHIP_MESSAGE_TEMPLATE_LABELS,
  type PartnershipBulkTarget,
  type PartnershipMessageTemplateKey,
  templateTimelineAction,
} from "@/lib/partnerships/partnerships-messaging-constants";

const preview = (text: string) => String(text || "").trim().slice(0, 280);

const resolveTemplateBody = (templateKey: PartnershipMessageTemplateKey, locale: "ar" | "en") => {
  const row = PARTNERSHIP_MESSAGE_TEMPLATE_LABELS[templateKey];
  return locale === "ar" ? row.defaultBodyAr : row.defaultBodyEn;
};

const createPartnershipNotification = async (input: {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) => {
  await Notification.create({
    userId: input.userId,
    type: "partnership_message",
    title: input.title.trim().slice(0, 300),
    message: input.message.trim().slice(0, 4000),
    read: false,
    metadata: input.metadata,
  });
};

const ensureThread = async (applicationId: string, subject: string) => {
  const application = await StudentTrainingApplication.findById(applicationId).lean();
  if (!application) throw new Error("Application not found");

  let thread = await PartnershipThread.findOne({ applicationId }).exec();
  if (!thread) {
    thread = await PartnershipThread.create({
      studentId: application.studentId,
      applicationId: application._id,
      opportunityId: application.opportunityId,
      subject: subject.slice(0, 220),
      participantSupervisorIds: [],
    });
  }
  return { thread, application };
};

const appendApplicationTimelineForMessage = async (
  applicationId: mongoose.Types.ObjectId,
  templateKey?: PartnershipMessageTemplateKey,
  note?: string,
  actorName?: string
) => {
  if (!templateKey) return;
  const application = await StudentTrainingApplication.findById(applicationId);
  if (!application) return;
  application.timeline = appendTimelineEvent(application.timeline, {
    at: new Date(),
    action: templateTimelineAction(templateKey),
    actorName,
    note: note || resolveTemplateBody(templateKey, "ar"),
  });
  await application.save();
};

export const sendPartnershipMessage = async (input: {
  senderId: mongoose.Types.ObjectId;
  senderRole: "student" | "supervisor";
  applicationId: string;
  body?: string;
  templateKey?: PartnershipMessageTemplateKey;
  locale?: "ar" | "en";
  actorName?: string;
}) => {
  await connectDB();
  const locale = input.locale || "ar";
  const templateKey = input.templateKey;
  const body =
    String(input.body || "").trim() ||
    (templateKey ? resolveTemplateBody(templateKey, locale) : "");
  if (!body) throw new Error("Message body is required");

  const subject =
    templateKey != null
      ? PARTNERSHIP_MESSAGE_TEMPLATE_LABELS[templateKey][locale === "ar" ? "ar" : "en"]
      : locale === "ar"
        ? "رسالة برنامج التدريب"
        : "Training program message";

  const { thread, application } = await ensureThread(input.applicationId, subject);

  if (input.senderRole === "supervisor") {
    const ids = new Set((thread.participantSupervisorIds || []).map((id) => String(id)));
    ids.add(String(input.senderId));
    thread.participantSupervisorIds = [...ids].map((id) => new mongoose.Types.ObjectId(id));
    thread.supervisorUnreadCount = 0;
    thread.studentUnreadCount = (thread.studentUnreadCount || 0) + 1;
  } else {
    thread.studentUnreadCount = 0;
    thread.supervisorUnreadCount = (thread.supervisorUnreadCount || 0) + 1;
  }

  thread.lastMessagePreview = preview(body);
  thread.lastMessageAt = new Date();
  await thread.save();

  const message = await PartnershipMessage.create({
    threadId: thread._id,
    senderId: input.senderId,
    senderRole: input.senderRole,
    body,
    messageType: "user",
    templateKey,
    metadata: templateKey ? { templateKey, source: "manual_template" } : undefined,
  });

  await recordPartnershipMessageSent({
    messageId: message._id,
    threadId: thread._id,
    actorId: input.senderId,
    actorRole: input.senderRole === "student" ? "student" : String(input.senderRole),
    metadata: { applicationId: String(application._id), templateKey: templateKey || null },
  });

  const notifyUserId =
    input.senderRole === "supervisor" ? application.studentId : input.senderId;
  if (input.senderRole === "supervisor") {
    await notifyStudentSupervisorReply({
      studentId: application.studentId,
      body,
      threadId: String(thread._id),
      applicationId: String(application._id),
      locale,
    });
    await appendApplicationTimelineForMessage(
      application._id,
      templateKey,
      body,
      input.actorName
    );
  } else {
    const supervisorIds = thread.participantSupervisorIds || [];
    if (supervisorIds.length > 0) {
      await Promise.all(
        supervisorIds.map((userId) =>
          createPartnershipNotification({
            userId,
            title: locale === "ar" ? "رد طالب — التدريب الصيفي" : "Student reply — Summer training",
            message: preview(body),
            metadata: {
              threadId: String(thread._id),
              applicationId: String(application._id),
            },
          })
        )
      );
    } else {
      await notifySupervisorTrainingMessage({
        title: locale === "ar" ? "رد طالب — التدريب الصيفي" : "Student reply — Summer training",
        message: body,
        metadata: {
          threadId: String(thread._id),
          applicationId: String(application._id),
        },
      });
    }
  }

  return {
    threadId: String(thread._id),
    messageId: String(message._id),
    notifiedUserId: String(notifyUserId),
  };
};

export const sendPartnershipBulkMessages = async (input: {
  senderId: mongoose.Types.ObjectId;
  opportunityId: string;
  bulkTarget: PartnershipBulkTarget;
  templateKey: PartnershipMessageTemplateKey;
  body?: string;
  locale?: "ar" | "en";
  actorName?: string;
}) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(input.opportunityId)) {
    throw new Error("Invalid opportunity id");
  }

  const opportunity = await TrainingOpportunity.findById(input.opportunityId).lean();
  if (!opportunity) throw new Error("Opportunity not found");

  const statusFilter: Record<string, unknown> = { opportunityId: input.opportunityId };
  if (input.bulkTarget === "accepted") statusFilter.status = "accepted";
  if (input.bulkTarget === "rejected") statusFilter.status = "rejected";
  if (input.bulkTarget === "awaiting_interview") {
    statusFilter.$or = [
      { status: "interview_requested" },
      { institutionStatus: "institution_interview" },
    ];
  }

  const applications = await StudentTrainingApplication.find(statusFilter).select("_id").lean();
  const results: Array<{ applicationId: string; threadId: string }> = [];

  for (const app of applications) {
    const sent = await sendPartnershipMessage({
      senderId: input.senderId,
      senderRole: "supervisor",
      applicationId: String(app._id),
      templateKey: input.templateKey,
      body: input.body,
      locale: input.locale,
      actorName: input.actorName,
    });
    results.push({ applicationId: String(app._id), threadId: sent.threadId });
  }

  return { count: results.length, results, bulkTarget: input.bulkTarget };
};

export const listPartnershipThreadsForUser = async (input: {
  userId: mongoose.Types.ObjectId;
  role: string;
}) => {
  await connectDB();
  const isSupervisor = [
    "admin",
    "partnershipSupervisor",
    "supervisor",
    "schoolAdmin",
    "teacher",
  ].includes(String(input.role || ""));

  const threads = await PartnershipThread.find(
    isSupervisor ? {} : { studentId: input.userId }
  )
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(80)
    .lean();

  const visibleThreads = threads;

  const applicationIds = visibleThreads
    .map((thread) => thread.applicationId)
    .filter((id): id is NonNullable<typeof id> => Boolean(id));
  const applications = await StudentTrainingApplication.find({ _id: { $in: applicationIds } })
    .select("studentSnapshot opportunityId")
    .lean();
  const appMap = new Map(applications.map((row) => [String(row._id), row]));

  const opportunityIds = [
    ...new Set([
      ...applications.map((row) => String(row.opportunityId)),
      ...visibleThreads
        .filter((thread) => thread.opportunityId)
        .map((thread) => String(thread.opportunityId)),
    ]),
  ];
  const opportunities = await TrainingOpportunity.find({ _id: { $in: opportunityIds } })
    .select("title")
    .lean();
  const oppMap = new Map(opportunities.map((row) => [String(row._id), row]));

  return visibleThreads.map((thread) => {
    const app = thread.applicationId ? appMap.get(String(thread.applicationId)) : undefined;
    const oppId = app ? String(app.opportunityId) : thread.opportunityId ? String(thread.opportunityId) : "";
    const opp = oppId ? oppMap.get(oppId) : undefined;
    return {
      id: String(thread._id),
      applicationId: thread.applicationId ? String(thread.applicationId) : "",
      threadKind: thread.threadKind || "application",
      inquiryType: thread.inquiryType || null,
      opportunityTitle: opp?.title || "",
      studentName: app?.studentSnapshot?.fullName || "",
      subject: thread.subject,
      lastMessagePreview: thread.lastMessagePreview || "",
      lastMessageAt: thread.lastMessageAt ? new Date(thread.lastMessageAt).toISOString() : null,
      unreadCount: isSupervisor ? thread.supervisorUnreadCount || 0 : thread.studentUnreadCount || 0,
    };
  });
};

export const sendPartnershipThreadMessage = async (input: {
  senderId: mongoose.Types.ObjectId;
  senderRole: "student" | "supervisor";
  threadId: string;
  body: string;
  locale?: "ar" | "en";
  actorName?: string;
}) => {
  await connectDB();
  const locale = input.locale || "ar";
  const body = String(input.body || "").trim();
  if (!body) throw new Error("Message body is required");

  const thread = await PartnershipThread.findById(input.threadId);
  if (!thread) throw new Error("Thread not found");

  if (input.senderRole === "student" && String(thread.studentId) !== String(input.senderId)) {
    throw new Error("Forbidden");
  }

  if (input.senderRole === "supervisor") {
    const ids = new Set((thread.participantSupervisorIds || []).map((id) => String(id)));
    ids.add(String(input.senderId));
    thread.participantSupervisorIds = [...ids].map((id) => new mongoose.Types.ObjectId(id));
    thread.supervisorUnreadCount = 0;
    thread.studentUnreadCount = (thread.studentUnreadCount || 0) + 1;
  } else {
    thread.studentUnreadCount = 0;
    thread.supervisorUnreadCount = (thread.supervisorUnreadCount || 0) + 1;
  }

  thread.lastMessagePreview = preview(body);
  thread.lastMessageAt = new Date();
  await thread.save();

  const message = await PartnershipMessage.create({
    threadId: thread._id,
    senderId: input.senderId,
    senderRole: input.senderRole,
    body,
  });

  await recordPartnershipMessageSent({
    messageId: message._id,
    threadId: thread._id,
    actorId: input.senderId,
    actorRole: input.senderRole === "student" ? "student" : String(input.senderRole),
    metadata: { threadId: String(thread._id) },
  });

  if (input.senderRole === "supervisor") {
    await notifyStudentSupervisorReply({
      studentId: thread.studentId,
      body,
      threadId: String(thread._id),
      applicationId: thread.applicationId ? String(thread.applicationId) : undefined,
      locale,
    });
    if (thread.applicationId) {
      await appendApplicationTimelineForMessage(
        thread.applicationId,
        undefined,
        body,
        input.actorName
      );
    }
  } else {
    await notifySupervisorTrainingMessage({
      title: locale === "ar" ? "رد طالب — التدريب الصيفي" : "Student reply — Summer training",
      message: body,
      metadata: {
        threadId: String(thread._id),
        applicationId: thread.applicationId ? String(thread.applicationId) : null,
      },
    });
  }

  return {
    threadId: String(thread._id),
    messageId: String(message._id),
  };
};

export const listPartnershipThreadMessages = async (input: {
  threadId: string;
  userId: mongoose.Types.ObjectId;
  role: string;
  includePermissionTrace?: boolean;
}) => {
  await connectDB();
  const thread = await PartnershipThread.findById(input.threadId);
  if (!thread) throw new Error("Thread not found");

  const isSupervisor = [
    "admin",
    "partnershipSupervisor",
    "supervisor",
    "schoolAdmin",
    "teacher",
  ].includes(String(input.role || ""));

  const allowed = isSupervisor || String(thread.studentId) === String(input.userId);
  if (!allowed) throw new Error("Forbidden");

  if (isSupervisor) {
    thread.supervisorUnreadCount = 0;
    const ids = new Set((thread.participantSupervisorIds || []).map((id) => String(id)));
    ids.add(String(input.userId));
    thread.participantSupervisorIds = [...ids].map((id) => new mongoose.Types.ObjectId(id));
  } else {
    thread.studentUnreadCount = 0;
  }
  await thread.save();

  const messages = await PartnershipMessage.find({ threadId: thread._id })
    .sort({ createdAt: 1 })
    .lean();

  const currentUserId = resolvePartnershipActorId({ _id: input.userId });

  const items = messages.map((row) => {
    const senderId = normalizePartnershipSenderId(row.senderId);
    const enriched = enrichMessagePermissions(serializePartnershipMessageRow(row, input.userId), {
      role: input.role,
      senderId,
      userId: input.userId,
      messageType: row.messageType,
      templateKey: row.templateKey,
      metadata: row.metadata,
    });
    return { ...enriched, currentUserId };
  });

  const includePermissionTrace =
    input.includePermissionTrace === true || process.env.PARTNERSHIP_MESSAGE_DEBUG === "1";

  if (includePermissionTrace) {
    for (const enriched of items) {
      console.info(
        "[partnership-message-permissions]",
        buildPartnershipMessagePermissionTraceRow(enriched, currentUserId)
      );
    }
  }

  return {
    thread: {
      id: String(thread._id),
      subject: thread.subject,
      applicationId: thread.applicationId ? String(thread.applicationId) : "",
      threadKind: thread.threadKind || "application",
    },
    currentUserId,
    viewerRole: String(input.role || ""),
    items,
    permissionTrace: includePermissionTrace
      ? items.map((enriched) => buildPartnershipMessagePermissionTraceRow(enriched, currentUserId))
      : undefined,
  };
};
