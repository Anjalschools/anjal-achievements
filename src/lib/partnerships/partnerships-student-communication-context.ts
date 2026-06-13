import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnershipThread from "@/models/PartnershipThread";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import { trainingApplicationStatusLabel } from "@/lib/partnerships/partnerships-application-status-ui";
import { timelineActionLabel } from "@/lib/partnerships/partnerships-application-workflow";

export const loadStudentOpportunityCommunication = async (input: {
  studentId: mongoose.Types.ObjectId;
  opportunityId: string;
  locale: "ar" | "en";
}) => {
  await connectDB();
  const isAr = input.locale === "ar";

  const application = await StudentTrainingApplication.findOne({
    studentId: input.studentId,
    opportunityId: new mongoose.Types.ObjectId(input.opportunityId),
    archived: { $ne: true },
  })
    .sort({ submittedAt: -1, createdAt: -1 })
    .lean();

  const threadQuery = application
    ? { applicationId: application._id }
    : { studentId: input.studentId, opportunityId: input.opportunityId, threadKind: "opportunity" };

  const thread = await PartnershipThread.findOne(threadQuery).lean();

  const timeline = (application?.timeline || []).slice(-4).map((event) => ({
    at: event.at ? new Date(event.at).toISOString() : null,
    label: timelineActionLabel(String(event.action || ""), isAr),
    note: event.note || "",
  }));

  return {
    applicationStatus: application?.status ? String(application.status) : null,
    applicationStatusLabel: application?.status
      ? trainingApplicationStatusLabel(String(application.status), isAr)
      : null,
    applicationId: application?._id ? String(application._id) : null,
    reviewStatusLabel: application?.status
      ? trainingApplicationStatusLabel(String(application.status), isAr)
      : null,
    lastMessagePreview: thread?.lastMessagePreview || "",
    lastMessageAt: thread?.lastMessageAt ? new Date(thread.lastMessageAt).toISOString() : null,
    unreadCount: thread?.studentUnreadCount || 0,
    threadId: thread?._id ? String(thread._id) : null,
    timeline,
  };
};
