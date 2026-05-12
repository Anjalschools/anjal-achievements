import User from "@/models/User";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";

const activeAlumniMatch = (): Record<string, unknown> => ({
  $and: [{ accountType: "alumni" }, alumniCommunityActiveUserClause()],
});

export type ReputationPeerStats = {
  percentile: number | null;
  peerMeanReputation: number;
  vsPeerMean: number;
  trend: { direction: "above_peer_mean" | "below_peer_mean" | "near_peer_mean" };
};

export const getReputationPeerStats = async (score: number): Promise<ReputationPeerStats> => {
  const [below, withScore, meanAgg] = await Promise.all([
    User.countDocuments({
      $and: [activeAlumniMatch(), { "alumniProfile.reputationScore": { $lt: score } }],
    }),
    User.countDocuments({
      $and: [
        activeAlumniMatch(),
        { "alumniProfile.reputationScore": { $exists: true, $type: "number" } },
      ],
    }),
    User.aggregate<{ v: number | null }>([
      { $match: activeAlumniMatch() },
      { $group: { _id: null as unknown as string, v: { $avg: "$alumniProfile.reputationScore" } } },
    ]),
  ]);

  const peerMeanReputation = Math.round((meanAgg[0]?.v || 0) * 10) / 10;
  const vsPeerMean = Math.round((score - peerMeanReputation) * 10) / 10;
  const percentile =
    withScore === 0 ? null : Math.min(99.9, Math.round((below / withScore) * 1000) / 10);
  const direction =
    vsPeerMean > 8 ? "above_peer_mean" : vsPeerMean < -8 ? "below_peer_mean" : "near_peer_mean";

  return { percentile, peerMeanReputation, vsPeerMean, trend: { direction } };
};
