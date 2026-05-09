/**
 * Lightweight engagement signals shared by CRM + automation weighting.
 * Deterministic; extend without coupling to UI.
 */

export type EngagementSignals = {
  mentorshipCompleted: number;
  mentorshipAccepted: number;
  eventsGoing: number;
  inboxThreads: number;
  opportunitiesAuthored: number;
  campaignOpens: number;
  profileCompleteness: number; // 0–100
};

export const weightSignals = (s: EngagementSignals): number => {
  let score = 0;
  score += Math.min(240, s.mentorshipCompleted * 14);
  score += Math.min(120, s.mentorshipAccepted * 9);
  score += Math.min(100, s.eventsGoing * 12);
  score += Math.min(80, s.inboxThreads * 6);
  score += Math.min(120, s.opportunitiesAuthored * 25);
  score += Math.min(80, s.campaignOpens * 4);
  score += Math.min(160, Math.round(s.profileCompleteness * 1.6));
  return Math.min(1000, Math.round(score));
};
