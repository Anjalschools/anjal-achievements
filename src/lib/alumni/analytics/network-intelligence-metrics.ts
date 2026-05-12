import User from "@/models/User";
import AlumniFeedEngagement from "@/models/AlumniFeedEngagement";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";

export type NetworkIntelligenceV1 = {
  windowDays: number;
  activeAlumniApprox: number;
  feedEngagementActionsLast90d: number;
  distinctActorOwnerPairsLast90d: number;
  mentorshipsCompletedLast90d: number;
  crossBatchMentorshipsCompletedLast90d: number;
  /** Heuristic 0–1: edges per active alumni (bounded). */
  connectionDensityProxy: number;
  /** Mean completed sessions per mentor (mentors with ≥1 completion in window). */
  mentorReachAvgCompletedPerMentorLast90d: number;
};

const crossBatchCompletedSince = async (since: Date): Promise<number> => {
  const userColl = User.collection.collectionName;
  const [row] = await AlumniMentorshipRequest.aggregate<{ c: number }>([
    { $match: { status: "completed", updatedAt: { $gte: since } } },
    {
      $lookup: {
        from: userColl,
        localField: "mentorId",
        foreignField: "_id",
        as: "mentorDoc",
      },
    },
    {
      $lookup: {
        from: userColl,
        localField: "requesterId",
        foreignField: "_id",
        as: "reqDoc",
      },
    },
    {
      $project: {
        my: { $arrayElemAt: ["$mentorDoc.alumniProfile.graduationYear", 0] },
        ry: { $arrayElemAt: ["$reqDoc.alumniProfile.graduationYear", 0] },
      },
    },
    {
      $match: {
        my: { $type: "number", $gte: 1950 },
        ry: { $type: "number", $gte: 1950 },
      },
    },
    { $match: { $expr: { $ne: ["$my", "$ry"] } } },
    { $count: "c" },
  ]);
  return row?.c ?? 0;
};

/**
 * Extended network metrics for snapshots / admin intelligence (rule-derived aggregates).
 */
export const getAlumniNetworkIntelligenceV1 = async (): Promise<NetworkIntelligenceV1> => {
  const windowDays = 90;
  const since = new Date(Date.now() - windowDays * 86400000);
  const activeMatch = { $and: [{ accountType: "alumni" }, alumniCommunityActiveUserClause()] };

  const [
    activeAlumniApprox,
    feedActions,
    pairsRow,
    completedMent,
    mentorReachRows,
    crossBatch,
  ] = await Promise.all([
    User.countDocuments(activeMatch),
    AlumniFeedEngagement.countDocuments({ createdAt: { $gte: since } }),
    AlumniFeedEngagement.aggregate<{ n: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { a: "$actorId", o: "$targetOwnerId" } } },
      { $count: "n" },
    ]),
    AlumniMentorshipRequest.countDocuments({ status: "completed", updatedAt: { $gte: since } }),
    AlumniMentorshipRequest.aggregate<{ avg: number }>([
      { $match: { status: "completed", updatedAt: { $gte: since } } },
      { $group: { _id: "$mentorId", c: { $sum: 1 } } },
      { $group: { _id: null as unknown as string, avg: { $avg: "$c" } } },
    ]),
    crossBatchCompletedSince(since),
  ]);

  const pairCount = pairsRow[0]?.n ?? 0;
  const mentorReachAvg = mentorReachRows[0]?.avg ?? 0;
  const edgeApprox = pairCount + completedMent;
  const density =
    activeAlumniApprox > 0 ? Math.min(1, edgeApprox / Math.max(80, activeAlumniApprox * 6)) : 0;

  return {
    windowDays,
    activeAlumniApprox,
    feedEngagementActionsLast90d: feedActions,
    distinctActorOwnerPairsLast90d: pairCount,
    mentorshipsCompletedLast90d: completedMent,
    crossBatchMentorshipsCompletedLast90d: crossBatch,
    connectionDensityProxy: Math.round(density * 1000) / 1000,
    mentorReachAvgCompletedPerMentorLast90d: Math.round(mentorReachAvg * 100) / 100,
  };
};
