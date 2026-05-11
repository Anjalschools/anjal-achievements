import mongoose from "mongoose";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";

export type MentorTrustStats = {
  mentorshipSessionCount: number;
  responseRateApprox: number | null;
  lastMentorshipActivityIso: string | null;
};

/**
 * Aggregate mentorship request stats per mentor (additive, heuristic — no schema changes).
 */
export const fetchMentorTrustStatsMap = async (
  mentorIds: mongoose.Types.ObjectId[]
): Promise<Map<string, MentorTrustStats>> => {
  const map = new Map<string, MentorTrustStats>();
  if (!mentorIds.length) return map;

  type AggRow = {
    _id: mongoose.Types.ObjectId;
    total: number;
    sessionCount: number;
    addressed: number;
    nonCancelled: number;
    lastAt: Date | null;
  };

  const agg = await AlumniMentorshipRequest.aggregate<AggRow>([
    { $match: { mentorId: { $in: mentorIds } } },
    {
      $group: {
        _id: "$mentorId",
        total: { $sum: 1 },
        sessionCount: {
          $sum: { $cond: [{ $in: ["$status", ["accepted", "completed"]] }, 1, 0] },
        },
        addressed: {
          $sum: { $cond: [{ $in: ["$status", ["accepted", "completed", "rejected"]] }, 1, 0] },
        },
        nonCancelled: {
          $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, 1, 0] },
        },
        lastAt: { $max: "$updatedAt" },
      },
    },
  ]);

  for (const r of agg) {
    const id = r._id.toString();
    const denom = Math.max(1, r.nonCancelled || 0);
    const rate = r.total > 0 ? Math.min(100, Math.round(((r.addressed || 0) / denom) * 100)) : null;
    map.set(id, {
      mentorshipSessionCount: r.sessionCount || 0,
      responseRateApprox: rate,
      lastMentorshipActivityIso: r.lastAt ? new Date(r.lastAt).toISOString() : null,
    });
  }

  return map;
};

export const mergeLastActivityIso = (
  mentorIso: string | null | undefined,
  userLastLogin: Date | null | undefined,
  userUpdated: Date | null | undefined
): string | null => {
  const dates: number[] = [];
  if (mentorIso) {
    const t = new Date(mentorIso).getTime();
    if (!Number.isNaN(t)) dates.push(t);
  }
  if (userLastLogin) dates.push(new Date(userLastLogin).getTime());
  if (userUpdated) dates.push(new Date(userUpdated).getTime());
  if (!dates.length) return null;
  return new Date(Math.max(...dates)).toISOString();
};
