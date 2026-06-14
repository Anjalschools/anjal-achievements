import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit-log-service";
import PartnershipMessage from "@/models/PartnershipMessage";
import PartnershipThread from "@/models/PartnershipThread";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import User from "@/models/User";
import { getInstitutionUserIdsForNotifications } from "@/lib/partnerships/institution-organization-resolver";
import { INSTITUTION_SUPERVISOR_INQUIRY_TYPE } from "@/lib/partnerships/institution-portal-constants";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";
import { assertInstitutionApplicationAccess } from "@/lib/partnerships/institution-scope";
import {
  notifyStudentSupervisorReply,
  notifySupervisorTrainingMessage,
} from "@/lib/partnerships/partnerships-training-notifications";
import Notification from "@/models/Notification";

const preview = (text: string) => String(text || "").trim().slice(0, 280);

export type InstitutionThreadRow = {
  id: string;
  kind: "student" | "supervisor";
  applicationId: string;
  opportunityTitle: string;
  studentName: string;
  subject: string;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unreadCount: number;
  status: string;
};

const mapStudentThread = (
  thread: {
    _id: mongoose.Types.ObjectId;
    applicationId?: mongoose.Types.ObjectId;
    subject: string;
    lastMessagePreview?: string;
    lastMessageAt?: Date;
    institutionUnreadCount?: number;
  },
  appMap: Map<string, { studentSnapshot?: { fullName?: string }; opportunityId: mongoose.Types.ObjectId; status: string }>,
  oppMap: Map<string, { title?: string }>
): InstitutionThreadRow | null => {
  if (!thread.applicationId) return null;
  const app = appMap.get(String(thread.applicationId));
  if (!app) return null;
  const opp = oppMap.get(String(app.opportunityId));
  return {
    id: String(thread._id),
    kind: "student",
    applicationId: String(thread.applicationId),
    opportunityTitle: opp?.title || "",
    studentName: app.studentSnapshot?.fullName || "",
    subject: thread.subject,
    lastMessagePreview: thread.lastMessagePreview || "",
    lastMessageAt: thread.lastMessageAt ? new Date(thread.lastMessageAt).toISOString() : null,
    unreadCount: thread.institutionUnreadCount || 0,
    status: app.status || "",
  };
};

const loadSupervisorIds = async () => {
  const supervisors = await User.find({
    role: { $in: ["partnershipSupervisor", "admin"] },
  })
    .select("_id")
    .lean();
  return supervisors.map((row) => row._id);
};

export const ensureInstitutionSupervisorThread = async (
  institutionUserId: string,
  organizationName?: string
) => {
  await connectDB();
  const supervisorIds = await loadSupervisorIds();

  let thread = await PartnershipThread.findOne({
    studentId: new mongoose.Types.ObjectId(institutionUserId),
    threadKind: "general",
    inquiryType: INSTITUTION_SUPERVISOR_INQUIRY_TYPE,
  }).exec();

  if (!thread) {
    thread = await PartnershipThread.create({
      studentId: new mongoose.Types.ObjectId(institutionUserId),
      threadKind: "general",
      inquiryType: INSTITUTION_SUPERVISOR_INQUIRY_TYPE,
      subject: organizationName
        ? `محادثة مشرف الشراكات — ${organizationName}`
        : "محادثة مشرف الشراكات",
      participantSupervisorIds: supervisorIds,
      participantInstitutionUserIds: [new mongoose.Types.ObjectId(institutionUserId)],
    });

    await logAuditEvent({
      actionType: "institution_supervisor_thread_created",
      entityType: "partnership_thread",
      entityId: String(thread._id),
      descriptionAr: "إنشاء محادثة دائمة بين المؤسسة ومشرف الشراكات",
      actor: { name: organizationName || "Institution", role: "trainingInstitution" },
      outcome: "success",
      metadata: { institutionUserId, inquiryType: INSTITUTION_SUPERVISOR_INQUIRY_TYPE },
    });
  } else {
    const institutionIds = new Set(
      (thread.participantInstitutionUserIds || []).map((id) => String(id))
    );
    institutionIds.add(institutionUserId);
    thread.participantInstitutionUserIds = [...institutionIds].map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const existingSupervisors = new Set((thread.participantSupervisorIds || []).map((id) => String(id)));
    for (const id of supervisorIds) existingSupervisors.add(String(id));
    thread.participantSupervisorIds = [...existingSupervisors].map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    await thread.save();
  }

  return thread;
};

const ensureInstitutionThread = async (applicationId: string, institutionUserId: string) => {
  const application = await StudentTrainingApplication.findById(applicationId).lean();
  if (!application) throw new Error("Application not found");

  let thread = await PartnershipThread.findOne({ applicationId }).exec();
  if (!thread) {
    thread = await PartnershipThread.create({
      studentId: application.studentId,
      applicationId: application._id,
      opportunityId: application.opportunityId,
      subject: "رسالة المؤسسة التدريبية",
      participantSupervisorIds: [],
      participantInstitutionUserIds: [new mongoose.Types.ObjectId(institutionUserId)],
    });
  } else {
    const ids = new Set((thread.participantInstitutionUserIds || []).map((id) => String(id)));
    ids.add(institutionUserId);
    thread.participantInstitutionUserIds = [...ids].map((id) => new mongoose.Types.ObjectId(id));
    await thread.save();
  }

  return { thread, application };
};

export const listInstitutionMessagingCenter = async (
  institutionUserId: string,
  organizationId: string,
  organizationName?: string
) => {
  await connectDB();
  const supervisorThread = await ensureInstitutionSupervisorThread(institutionUserId, organizationName);

  const opportunities = await TrainingOpportunity.find({ organizationId }).select("_id title").lean();
  const opportunityIds = opportunities.map((row) => row._id);
  const oppMap = new Map(opportunities.map((row) => [String(row._id), row]));

  const applications = await StudentTrainingApplication.find({
    opportunityId: { $in: opportunityIds },
  })
    .select("_id studentId opportunityId studentSnapshot status")
    .lean();

  const appMap = new Map(applications.map((row) => [String(row._id), row]));
  const applicationIds = applications.map((row) => row._id);

  const threads = await PartnershipThread.find({
    applicationId: { $in: applicationIds },
  })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .lean();

  const studentThreads = threads
    .map((thread) => mapStudentThread(thread, appMap, oppMap))
    .filter((row): row is InstitutionThreadRow => Boolean(row));

  const supervisorRow: InstitutionThreadRow = {
    id: String(supervisorThread._id),
    kind: "supervisor",
    applicationId: "",
    opportunityTitle: "",
    studentName: "",
    subject: supervisorThread.subject,
    lastMessagePreview: supervisorThread.lastMessagePreview || "",
    lastMessageAt: supervisorThread.lastMessageAt
      ? new Date(supervisorThread.lastMessageAt).toISOString()
      : null,
    unreadCount: supervisorThread.institutionUnreadCount || 0,
    status: "active",
  };

  return {
    studentThreads,
    supervisorThread: supervisorRow,
    items: [supervisorRow, ...studentThreads],
  };
};

/** @deprecated Use listInstitutionMessagingCenter */
export const listInstitutionThreads = async (institutionUserId: string, organizationId: string) => {
  const center = await listInstitutionMessagingCenter(institutionUserId, organizationId);
  return center.studentThreads;
};

export const listInstitutionThreadMessages = async (
  threadId: string,
  institutionUserId: string,
  organizationId: string
) => {
  await connectDB();
  const thread = await PartnershipThread.findById(threadId);
  if (!thread) return { ok: false as const, error: "Thread not found", code: "not_found" };

  if (thread.threadKind === "general" && thread.inquiryType === INSTITUTION_SUPERVISOR_INQUIRY_TYPE) {
    if (String(thread.studentId) !== institutionUserId) {
      return { ok: false as const, error: "Thread not in scope", code: "forbidden" };
    }

    const participantIds = (thread.participantInstitutionUserIds || []).map((id) => String(id));
    if (!participantIds.includes(institutionUserId)) {
      thread.participantInstitutionUserIds = [
        ...(thread.participantInstitutionUserIds || []),
        new mongoose.Types.ObjectId(institutionUserId),
      ];
      await thread.save();
    }

    thread.institutionUnreadCount = 0;
    await thread.save();

    const messages = await PartnershipMessage.find({ threadId: thread._id })
      .sort({ createdAt: 1 })
      .lean();

    return {
      ok: true as const,
      threadKind: "supervisor" as const,
      applicationId: "",
      items: messages.map((row) => ({
        id: String(row._id),
        senderRole: row.senderRole,
        body: row.body,
        templateKey: row.templateKey || null,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
        isMine: row.senderRole === "institution" && String(row.senderId) === institutionUserId,
      })),
    };
  }

  if (!thread.applicationId) return { ok: false as const, error: "Thread not found", code: "not_found" };

  const access = await assertInstitutionApplicationAccess(String(thread.applicationId), organizationId);
  if (!access.ok) return { ok: false as const, error: access.error, code: access.code };

  const participantIds = (thread.participantInstitutionUserIds || []).map((id) => String(id));
  if (!participantIds.includes(institutionUserId)) {
    thread.participantInstitutionUserIds = [
      ...(thread.participantInstitutionUserIds || []),
      new mongoose.Types.ObjectId(institutionUserId),
    ];
    await thread.save();
  }

  thread.institutionUnreadCount = 0;
  await thread.save();

  const messages = await PartnershipMessage.find({ threadId: thread._id })
    .sort({ createdAt: 1 })
    .lean();

  return {
    ok: true as const,
    threadKind: "student" as const,
    applicationId: String(thread.applicationId),
    items: messages.map((row) => ({
      id: String(row._id),
      senderRole: row.senderRole,
      body: row.body,
      templateKey: row.templateKey || null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      isMine: row.senderRole === "institution" && String(row.senderId) === institutionUserId,
    })),
  };
};

export const sendInstitutionSupervisorMessage = async (input: {
  organizationId: string;
  institutionUserId: string;
  body: string;
  actorName: string;
  organizationName?: string;
  request?: NextRequest;
}) => {
  await connectDB();
  const body = String(input.body || "").trim();
  if (!body) return { ok: false as const, error: "Message body is required", code: "empty_body" };

  const thread = await ensureInstitutionSupervisorThread(
    input.institutionUserId,
    input.organizationName
  );

  thread.institutionUnreadCount = 0;
  thread.supervisorUnreadCount = (thread.supervisorUnreadCount || 0) + 1;
  thread.lastMessagePreview = preview(body);
  thread.lastMessageAt = new Date();
  await thread.save();

  await PartnershipMessage.create({
    threadId: thread._id,
    senderId: input.institutionUserId,
    senderRole: "institution",
    body,
  });

  await notifySupervisorTrainingMessage({
    title: "رسالة من مؤسسة تدريبية",
    message: `${input.actorName}: ${preview(body)}`,
    metadata: {
      threadId: String(thread._id),
      senderRole: "institution",
      inquiryType: INSTITUTION_SUPERVISOR_INQUIRY_TYPE,
      organizationId: input.organizationId,
    },
  });

  await logAuditEvent({
    actionType: "institution_supervisor_message_sent",
    entityType: "partnership_thread",
    entityId: String(thread._id),
    descriptionAr: "رسالة من المؤسسة إلى مشرف الشراكات",
    actor: {
      id: new mongoose.Types.ObjectId(input.institutionUserId),
      name: input.actorName,
      role: "trainingInstitution",
    },
    request: input.request,
    outcome: "success",
    metadata: { organizationId: input.organizationId },
  });

  return { ok: true as const, threadId: String(thread._id) };
};

export const sendInstitutionThreadMessage = async (input: {
  applicationId: string;
  organizationId: string;
  institutionUserId: string;
  body: string;
  actorName: string;
  request?: NextRequest;
}) => {
  await connectDB();
  const access = await assertInstitutionApplicationAccess(input.applicationId, input.organizationId);
  if (!access.ok) return { ok: false as const, error: access.error, code: access.code };

  const body = String(input.body || "").trim();
  if (!body) return { ok: false as const, error: "Message body is required", code: "empty_body" };

  const { thread, application } = await ensureInstitutionThread(
    input.applicationId,
    input.institutionUserId
  );

  thread.institutionUnreadCount = 0;
  thread.studentUnreadCount = (thread.studentUnreadCount || 0) + 1;
  thread.supervisorUnreadCount = (thread.supervisorUnreadCount || 0) + 1;
  thread.lastMessagePreview = preview(body);
  thread.lastMessageAt = new Date();
  await thread.save();

  await PartnershipMessage.create({
    threadId: thread._id,
    senderId: input.institutionUserId,
    senderRole: "institution",
    body,
  });

  const applicationDoc = await StudentTrainingApplication.findById(application._id);
  if (applicationDoc) {
    applicationDoc.timeline = appendTimelineEvent(applicationDoc.timeline, {
      at: new Date(),
      action: "institution_message_sent",
      actorId: input.institutionUserId,
      actorName: input.actorName,
      note: preview(body),
    });
    await applicationDoc.save();
  }

  await notifyStudentSupervisorReply({
    studentId: application.studentId,
    body,
    threadId: String(thread._id),
    applicationId: String(application._id),
    locale: "ar",
  });

  await notifySupervisorTrainingMessage({
    title: "رسالة من المؤسسة — تدريب صيفي",
    message: `${input.actorName}: ${preview(body)}`,
    metadata: {
      applicationId: String(application._id),
      threadId: String(thread._id),
      senderRole: "institution",
    },
  });

  await logAuditEvent({
    actionType: "institution_student_message_sent",
    entityType: "student_training_application",
    entityId: input.applicationId,
    descriptionAr: "رسالة من المؤسسة إلى الطالب",
    actor: {
      id: new mongoose.Types.ObjectId(input.institutionUserId),
      name: input.actorName,
      role: "trainingInstitution",
    },
    request: input.request,
    outcome: "success",
    metadata: { threadId: String(thread._id) },
  });

  return { ok: true as const, threadId: String(thread._id) };
};

export const notifyInstitutionOnStudentMessage = async (input: {
  applicationId: string;
  organizationId: string;
  body: string;
}) => {
  const userIds = await getInstitutionUserIdsForNotifications(input.organizationId);
  if (userIds.length === 0) return;

  await Promise.all(
    userIds.map((userId) =>
      Notification.create({
        userId: new mongoose.Types.ObjectId(userId),
        type: "partnership_message",
        title: "رسالة من طالب",
        message: preview(input.body),
        read: false,
        metadata: {
          applicationId: input.applicationId,
          kind: "institution_student_message",
        },
      })
    )
  );
};
