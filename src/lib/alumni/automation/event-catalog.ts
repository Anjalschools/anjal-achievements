/**
 * Stable automation event names for payloads and external queue adapters (BullMQ, Trigger.dev, Cloud Tasks).
 */
export const AlumniAutomationEvents = {
  APPROVED: "alumni.approved",
  MENTORSHIP_PENDING: "mentorship.pending",
  EVENT_UPCOMING: "event.upcoming",
  PROFILE_INCOMPLETE: "profile.incomplete",
  ALUMNI_INACTIVE: "alumni.inactive",
  CAMPAIGN_LAUNCH: "campaign.launch",
} as const;
