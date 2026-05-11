import type { AlumniBadgeId } from "@/lib/alumni/alumni-badge-ids";
import { isAlumniBadgeId } from "@/lib/alumni/alumni-badge-ids";
import {
  computeAlumniProfileCompletionPct,
  type ProfileCompletionUserShape,
} from "@/lib/alumni/compute-profile-completion";

export type AlumniBadgeUserShape = ProfileCompletionUserShape & {
  createdAt?: Date | string | null;
  lastLoginAt?: Date | string | null;
  updatedAt?: Date | string | null;
  completedAlumniOnboardingAt?: Date | string | null;
  accountType?: string | null;
  alumniProfile?: (ProfileCompletionUserShape["alumniProfile"] & {
    isVerifiedAlumni?: boolean;
    alumniServices?: { mentoring?: boolean };
    memoryPosts?: Array<{ status?: string }>;
    badges?: string[];
  }) | null;
};

const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86_400_000);

const asDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Computes trust/engagement badges from existing profile fields.
 * Merges with any valid entries in `alumniProfile.badges` (manual / legacy).
 */
export const computeAlumniBadges = (
  user: AlumniBadgeUserShape,
  opts?: { certificateCount?: number; mentorshipParticipationCount?: number }
): AlumniBadgeId[] => {
  const ap = user.alumniProfile || {};
  const stored = (Array.isArray(ap.badges) ? ap.badges : [])
    .filter((x): x is AlumniBadgeId => typeof x === "string" && isAlumniBadgeId(x));

  const out = new Set<AlumniBadgeId>(stored);
  const now = new Date();

  if (ap.isVerifiedAlumni === true) out.add("verified_alumni");
  if (ap.alumniServices?.mentoring === true) out.add("mentor");

  const completion = computeAlumniProfileCompletionPct(user, opts?.certificateCount ?? 0);
  if (completion.pct >= 85) out.add("profile_complete");

  const last = asDate(user.lastLoginAt) || asDate(user.updatedAt);
  if (last && daysBetween(last, now) <= 30) out.add("active_alumni");

  const memories = ap.memoryPosts || [];
  if (memories.some((m) => m.status === "approved")) out.add("memory_contributor");

  const created = asDate(user.createdAt);
  if (created && daysBetween(created, now) >= 400) out.add("early_member");

  const participation = opts?.mentorshipParticipationCount ?? 0;
  const hasLinkedIn = Boolean(ap.linkedinUrl && String(ap.linkedinUrl).trim());
  const hasJob = Boolean(ap.currentCompany?.trim() || ap.currentPosition?.trim());
  if (participation > 0 || (hasLinkedIn && hasJob)) out.add("professional_participant");

  return Array.from(out);
};

/** Lighter set for search cards when full user doc is unavailable. */
export const computeAlumniBadgesLight = (row: {
  isVerifiedAlumni?: boolean;
  mentoring?: boolean;
  lastLoginAt?: Date | null;
  updatedAt?: Date | null;
}): AlumniBadgeId[] => {
  const ids: AlumniBadgeId[] = [];
  if (row.isVerifiedAlumni) ids.push("verified_alumni");
  if (row.mentoring) ids.push("mentor");
  const last = row.lastLoginAt || row.updatedAt;
  if (last && daysBetween(last instanceof Date ? last : new Date(last), new Date()) <= 30) {
    ids.push("active_alumni");
  }
  return ids;
};
