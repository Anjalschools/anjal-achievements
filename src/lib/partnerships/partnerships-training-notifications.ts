import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Notification from "@/models/Notification";
import User from "@/models/User";
import type { StudentTrainingApplicationStatus } from "@/lib/partnerships/partnerships-constants";

const preview = (text: string) => String(text || "").trim().slice(0, 280);

const createNotification = async (input: {
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

const statusCopy = (
  status: StudentTrainingApplicationStatus,
  opportunityTitle: string,
  locale: "ar" | "en"
): { title: string; message: string } => {
  const title = opportunityTitle.trim() || (locale === "ar" ? "التدريب الصيفي" : "Summer training");
  const map: Record<StudentTrainingApplicationStatus, { ar: { title: string; message: string }; en: { title: string; message: string } }> = {
    under_review: {
      ar: { title: "تحديث طلب التدريب", message: `طلبك على «${title}» قيد المراجعة لدى مشرف الشراكات.` },
      en: { title: "Training application update", message: `Your application for "${title}" is now under review.` },
    },
    interview_requested: {
      ar: { title: "طلب مقابلة — التدريب الصيفي", message: `تم طلب مقابلة لطلبك على «${title}». راجع الرسائل للتفاصيل.` },
      en: { title: "Interview requested — Summer training", message: `An interview was requested for "${title}". Check your messages.` },
    },
    institution_review: {
      ar: { title: "تحويل للمؤسسة — التدريب الصيفي", message: `تم إرسال طلبك على «${title}» للمؤسسة التدريبية للمراجعة.` },
      en: { title: "Sent to institution — Summer training", message: `Your application for "${title}" was sent to the training institution.` },
    },
    accepted: {
      ar: { title: "قبول في التدريب الصيفي", message: `تم قبولك في فرصة «${title}». مبروك!` },
      en: { title: "Summer training acceptance", message: `You were accepted for "${title}". Congratulations!` },
    },
    awaiting_school_approval: {
      ar: { title: "التقرير النهائي بانتظار اعتماد المدرسة", message: `أكملت المؤسسة تقييمك لفرصة «${title}» وبانتظار اعتماد المدرسة.` },
      en: { title: "Final report awaiting school approval", message: `The institution completed your evaluation for "${title}" and it awaits school approval.` },
    },
    rejected: {
      ar: { title: "تحديث طلب التدريب", message: `لم يُقبل طلبك على «${title}». راجع الرسائل أو تواصل مع المشرف.` },
      en: { title: "Training application update", message: `Your application for "${title}" was not accepted.` },
    },
    submitted: { ar: { title: "", message: "" }, en: { title: "", message: "" } },
    withdrawn: { ar: { title: "", message: "" }, en: { title: "", message: "" } },
    completed: { ar: { title: "", message: "" }, en: { title: "", message: "" } },
  };
  const row = map[status]?.[locale] || map.under_review[locale];
  return row;
};

export const notifyStudentTrainingStatusChange = async (input: {
  studentId: mongoose.Types.ObjectId;
  applicationId: string;
  opportunityTitle: string;
  status: StudentTrainingApplicationStatus;
  locale?: "ar" | "en";
}) => {
  await connectDB();
  const locale = input.locale || "ar";
  const copy = statusCopy(input.status, input.opportunityTitle, locale);
  if (!copy.title) return;

  await createNotification({
    userId: input.studentId,
    title: copy.title,
    message: copy.message,
    metadata: {
      applicationId: input.applicationId,
      status: input.status,
      kind: "training_status_change",
    },
  });
};

export const notifyStudentTrainingApplicationReopened = async (input: {
  studentId: mongoose.Types.ObjectId;
  applicationId: string;
  opportunityTitle?: string;
  locale?: "ar" | "en";
}) => {
  await connectDB();
  const locale = input.locale || "ar";
  const title = input.opportunityTitle?.trim() || (locale === "ar" ? "التدريب الصيفي" : "Summer training");
  const message =
    locale === "ar"
      ? `تمت إعادة فتح طلب التدريب الخاص بك على «${title}» وإعادته إلى مرحلة المراجعة.`
      : `Your training application for "${title}" was reopened and returned to the review stage.`;

  await createNotification({
    userId: input.studentId,
    title: locale === "ar" ? "إعادة فتح طلب التدريب" : "Training application reopened",
    message,
    metadata: {
      applicationId: input.applicationId,
      status: "under_review",
      kind: "training_application_reopened",
    },
  });
};

export const notifySupervisorTrainingMessage = async (input: {
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) => {
  await connectDB();
  const supervisors = await User.find({
    role: { $in: ["partnershipSupervisor", "admin"] },
    status: "active",
  })
    .select("_id")
    .lean();

  await Promise.all(
    supervisors.map((row) =>
      createNotification({
        userId: row._id as mongoose.Types.ObjectId,
        title: input.title,
        message: preview(input.message),
        metadata: input.metadata,
      })
    )
  );
};

export const notifyStudentSupervisorReply = async (input: {
  studentId: mongoose.Types.ObjectId;
  body: string;
  threadId: string;
  applicationId?: string;
  locale?: "ar" | "en";
}) => {
  const locale = input.locale || "ar";
  await createNotification({
    userId: input.studentId,
    title: locale === "ar" ? "رد مشرف — التدريب الصيفي" : "Supervisor reply — Summer training",
    message: preview(input.body),
    metadata: {
      threadId: input.threadId,
      applicationId: input.applicationId || null,
      kind: "training_supervisor_reply",
    },
  });
};
