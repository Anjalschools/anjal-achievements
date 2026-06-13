import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnershipMessage from "@/models/PartnershipMessage";
import PartnershipThread from "@/models/PartnershipThread";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { getInstitutionUserIdsForNotifications } from "@/lib/partnerships/institution-organization-resolver";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";
import { assertInstitutionApplicationAccess } from "@/lib/partnerships/institution-scope";
import {
  notifyStudentSupervisorReply,
  notifySupervisorTrainingMessage,
} from "@/lib/partnerships/partnerships-training-notifications";
import Notification from "@/models/Notification";

const preview = (text: string) => String(text || "").trim().slice(0, 280);

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

export const listInstitutionThreads = async (institutionUserId: string, organizationId: string) => {
  await connectDB();
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

  return threads.map((thread) => {
    const app = thread.applicationId ? appMap.get(String(thread.applicationId)) : null;
    const opp = app ? oppMap.get(String(app.opportunityId)) : null;
    return {
      id: String(thread._id),
      applicationId: thread.applicationId ? String(thread.applicationId) : "",
      opportunityTitle: opp?.title || "",
      studentName: app?.studentSnapshot?.fullName || "",
      subject: thread.subject,
      lastMessagePreview: thread.lastMessagePreview || "",
      lastMessageAt: thread.lastMessageAt ? new Date(thread.lastMessageAt).toISOString() : null,
      unreadCount: thread.institutionUnreadCount || 0,
      status: app?.status || "",
    };
  });
};

export const listInstitutionThreadMessages = async (
  threadId: string,
  institutionUserId: string,
  organizationId: string
) => {
  await connectDB();
  const thread = await PartnershipThread.findById(threadId);
  if (!thread?.applicationId) return { ok: false as const, error: "Thread not found", code: "not_found" };

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

export const sendInstitutionThreadMessage = async (input: {
  applicationId: string;
  organizationId: string;
  institutionUserId: string;
  body: string;
  actorName: string;
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
