import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { logAuditEvent, type AuditActor } from "@/lib/audit-log-service";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";
import {
  STUDENT_EDITABLE_APPLICATION_STATUSES,
  STUDENT_WITHDRAWABLE_STATUSES,
} from "@/lib/partnerships/partnerships-student-application-constants";
import type { StudentTrainingApplicationStatus } from "@/lib/partnerships/partnerships-constants";
import { resolveApplicationLastUpdatedAt } from "@/lib/partnerships/partnerships-application-workflow";
import { validateApplicationTransition } from "@/lib/partnerships/partnerships-state-machine";

const isEditableStatus = (status: string) =>
  (STUDENT_EDITABLE_APPLICATION_STATUSES as readonly string[]).includes(status);

const isWithdrawableStatus = (status: string) =>
  (STUDENT_WITHDRAWABLE_STATUSES as readonly string[]).includes(status);

export const withdrawStudentTrainingApplication = async (input: {
  applicationId: string;
  studentId: mongoose.Types.ObjectId;
  actorName: string;
  actor: AuditActor;
  request: NextRequest;
}) => {
  await connectDB();
  const application = await StudentTrainingApplication.findById(input.applicationId);
  if (!application || String(application.studentId) !== String(input.studentId)) {
    throw new Error("Application not found");
  }
  if (application.archived) throw new Error("Application is archived");

  const fromStatus = String(application.status || "");
  if (!isWithdrawableStatus(fromStatus)) {
    throw new Error("Application cannot be withdrawn in its current status");
  }

  const transition = validateApplicationTransition(fromStatus, "withdrawn");
  if (!transition.ok) throw new Error(transition.reason);

  const now = new Date();
  application.status = "withdrawn";
  application.timeline = appendTimelineEvent(application.timeline, {
    at: now,
    action: "withdrawn",
    fromStatus,
    toStatus: "withdrawn",
    actorId: String(input.studentId),
    actorName: input.actorName,
    note: input.actorName ? `انسحاب الطالب` : undefined,
  });
  await application.save();

  const opportunity = await TrainingOpportunity.findById(application.opportunityId).select("title").lean();

  await logAuditEvent({
    actionType: "training_application_withdrawn",
    entityType: "StudentTrainingApplication",
    entityId: String(application._id),
    entityTitle: opportunity?.title,
    descriptionAr: "انسحاب طالب من طلب تدريب صيفي",
    actor: input.actor,
    request: input.request,
    outcome: "success",
    metadata: { fromStatus, toStatus: "withdrawn" },
  });

  return application;
};

export const updateStudentTrainingApplicationContent = async (input: {
  applicationId: string;
  studentId: mongoose.Types.ObjectId;
  studentNotes?: string;
  applicationMessage?: string;
  actorName: string;
  actor: AuditActor;
  request: NextRequest;
}) => {
  await connectDB();
  const application = await StudentTrainingApplication.findById(input.applicationId);
  if (!application || String(application.studentId) !== String(input.studentId)) {
    throw new Error("Application not found");
  }
  if (application.archived) throw new Error("Application is archived");
  if (!isEditableStatus(String(application.status || ""))) {
    throw new Error("Application cannot be edited in its current status");
  }

  const updates: string[] = [];
  if (input.studentNotes !== undefined) {
    application.studentNotes = String(input.studentNotes || "").trim().slice(0, 4000) || undefined;
    updates.push("studentNotes");
  }
  if (input.applicationMessage !== undefined) {
    application.applicationMessage = String(input.applicationMessage || "").trim().slice(0, 6000) || undefined;
    updates.push("applicationMessage");
  }
  if (updates.length === 0) throw new Error("No editable fields provided");

  application.timeline = appendTimelineEvent(application.timeline, {
    at: new Date(),
    action: "training_student_request_update",
    actorId: String(input.studentId),
    actorName: input.actorName,
    note: updates.join(", "),
  });
  await application.save();

  const opportunity = await TrainingOpportunity.findById(application.opportunityId).select("title").lean();

  await logAuditEvent({
    actionType: "training_student_request_update",
    entityType: "StudentTrainingApplication",
    entityId: String(application._id),
    entityTitle: opportunity?.title,
    descriptionAr: "تحديث طالب لبيانات طلب التدريب",
    actor: input.actor,
    request: input.request,
    outcome: "success",
    metadata: { fields: updates, status: application.status },
  });

  return application;
};

export const loadStudentApplicationForOpportunity = async (
  studentId: mongoose.Types.ObjectId,
  opportunityId: string
) => {
  await connectDB();
  const application = await StudentTrainingApplication.findOne({
    studentId,
    opportunityId: new mongoose.Types.ObjectId(opportunityId),
    archived: { $ne: true },
  })
    .sort({ submittedAt: -1, createdAt: -1 })
    .lean();

  if (!application) return null;

  return {
    id: String(application._id),
    status: application.status as StudentTrainingApplicationStatus,
    studentNotes: application.studentNotes || "",
    applicationMessage: application.applicationMessage || "",
    submittedAt: application.submittedAt ? new Date(application.submittedAt).toISOString() : null,
    lastUpdatedAt: resolveApplicationLastUpdatedAt(application),
    timeline: (application.timeline || []).map((event) => ({
      at: event.at ? new Date(event.at).toISOString() : null,
      action: event.action,
      note: event.note || "",
    })),
    canEdit: isEditableStatus(String(application.status || "")),
    canWithdraw: isWithdrawableStatus(String(application.status || "")),
  };
};
