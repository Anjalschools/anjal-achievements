import mongoose from "mongoose";
import AlumniAutomationJob from "@/models/AlumniAutomationJob";
import type { AlumniAutomationJobType } from "@/models/AlumniAutomationJob";
import { AlumniAutomationEvents } from "./event-catalog";

export type ScheduleJobInput = {
  type: AlumniAutomationJobType;
  payload: Record<string, unknown>;
  scheduledFor?: Date;
  correlationId?: string;
};

/** Idempotent enqueue — prefers stable correlationId (recommended for workers). */
export const enqueueAutomationJob = async (input: ScheduleJobInput): Promise<{ created: boolean; jobId?: string }> => {
  const scheduledFor = input.scheduledFor ?? new Date();

  if (input.correlationId) {
    const dupCorr = await AlumniAutomationJob.findOne({
      status: { $in: ["pending", "processing"] },
      correlationId: input.correlationId,
    })
      .select("_id")
      .lean();
    if (dupCorr) return { created: false };
  }

  const uid = input.payload.userId;
  if (!input.correlationId && typeof uid === "string" && mongoose.isValidObjectId(uid)) {
    const dup = await AlumniAutomationJob.findOne({
      type: input.type,
      status: "pending",
      scheduledFor: { $lte: new Date(scheduledFor.getTime() + 86_400_000) },
      "payload.userId": uid,
    })
      .select("_id")
      .lean();
    if (dup) return { created: false };
  }

  const doc = await AlumniAutomationJob.create({
    type: input.type,
    payload: input.payload,
    status: "pending",
    scheduledFor,
    retryCount: 0,
    correlationId: input.correlationId,
  });
  return { created: true, jobId: doc._id.toString() };
};

/** Maps institutional lifecycle events → concrete job types (extend without breaking callers). */
export const mapLifecycleEventToJobType = (
  event: string
): AlumniAutomationJobType | null => {
  switch (event) {
    case AlumniAutomationEvents.APPROVED:
      return "alumni.welcome";
    case AlumniAutomationEvents.MENTORSHIP_PENDING:
      return "mentorship.pending";
    case AlumniAutomationEvents.EVENT_UPCOMING:
      return "event.upcoming";
    case AlumniAutomationEvents.PROFILE_INCOMPLETE:
      return "profile.incomplete";
    case AlumniAutomationEvents.ALUMNI_INACTIVE:
      return "alumni.inactive";
    case AlumniAutomationEvents.CAMPAIGN_LAUNCH:
      return "campaign.launch";
    default:
      return null;
  }
};
