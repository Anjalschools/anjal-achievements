/**
 * Single entry point for cron / external worker — scans lifecycle conditions and processes queued jobs.
 * Swap implementation body with BullMQ consumer later without changing routes.
 */
import { processAutomationJobsBatch } from "./job-processor";
import { enqueueMentorshipStaleReminders, enqueueUpcomingEventReminders } from "./reminders-engine";
import { enqueueInactiveAlumniJobs, enqueueIncompleteProfileJobs } from "./scanners";

export type AlumniAutomationCronResult = {
  scan: {
    mentorshipReminders: number;
    eventInvitations: number;
    inactive: number;
    incompleteProfiles: number;
  };
  batch: Awaited<ReturnType<typeof processAutomationJobsBatch>>;
};

export const runAlumniAutomationCycle = async (jobBatchLimit = 25): Promise<AlumniAutomationCronResult> => {
  const [mentorshipReminders, eventInvitations, inactive, incompleteProfiles] = await Promise.all([
    enqueueMentorshipStaleReminders(72),
    enqueueUpcomingEventReminders(14),
    enqueueInactiveAlumniJobs(120),
    enqueueIncompleteProfileJobs(45),
  ]);

  const batch = await processAutomationJobsBatch(jobBatchLimit);

  return {
    scan: { mentorshipReminders, eventInvitations, inactive, incompleteProfiles },
    batch,
  };
};
