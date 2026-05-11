/** Stored in `alumniProfile.badges` and/or computed at read time. */
export const ALUMNI_BADGE_IDS = [
  "verified_alumni",
  "mentor",
  "profile_complete",
  "active_alumni",
  "memory_contributor",
  "early_member",
  "professional_participant",
] as const;

export type AlumniBadgeId = (typeof ALUMNI_BADGE_IDS)[number];

export const isAlumniBadgeId = (v: string): v is AlumniBadgeId =>
  (ALUMNI_BADGE_IDS as readonly string[]).includes(v);
