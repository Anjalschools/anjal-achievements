import User from "@/models/User";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";

const activeAlumniMatch = (): Record<string, unknown> => ({
  $and: [{ accountType: "alumni" }, alumniCommunityActiveUserClause()],
});

export type ReputationHistogramBucket = { label: string; min: number; max: number; count: number };

/** Coarse reputation distribution for snapshot payloads (strategic reporting). */
export const getAlumniReputationHistogram = async (): Promise<ReputationHistogramBucket[]> => {
  const [row] = await User.aggregate<{
    b0: number;
    b1: number;
    b2: number;
    b3: number;
    b4: number;
  }>([
    {
      $match: {
        $and: [
          activeAlumniMatch(),
          { "alumniProfile.reputationScore": { $exists: true, $type: "number" } },
        ],
      },
    },
    {
      $group: {
        _id: null as unknown as string,
        b0: { $sum: { $cond: [{ $lte: ["$alumniProfile.reputationScore", 199] }, 1, 0] } },
        b1: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$alumniProfile.reputationScore", 200] },
                  { $lte: ["$alumniProfile.reputationScore", 399] },
                ],
              },
              1,
              0,
            ],
          },
        },
        b2: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$alumniProfile.reputationScore", 400] },
                  { $lte: ["$alumniProfile.reputationScore", 599] },
                ],
              },
              1,
              0,
            ],
          },
        },
        b3: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$alumniProfile.reputationScore", 600] },
                  { $lte: ["$alumniProfile.reputationScore", 799] },
                ],
              },
              1,
              0,
            ],
          },
        },
        b4: { $sum: { $cond: [{ $gte: ["$alumniProfile.reputationScore", 800] }, 1, 0] } },
      },
    },
  ]);

  const r = row || { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0 };
  return [
    { label: "0–199", min: 0, max: 199, count: r.b0 },
    { label: "200–399", min: 200, max: 399, count: r.b1 },
    { label: "400–599", min: 400, max: 599, count: r.b2 },
    { label: "600–799", min: 600, max: 799, count: r.b3 },
    { label: "800+", min: 800, max: 1000, count: r.b4 },
  ];
};

export type NetworkSnapshotMetrics = {
  alumniWithLinkedInUrl: number;
  alumniWithBio: number;
};

export const getAlumniNetworkSnapshotMetrics = async (): Promise<NetworkSnapshotMetrics> => {
  const base = activeAlumniMatch();
  const [alumniWithLinkedInUrl, alumniWithBio] = await Promise.all([
    User.countDocuments({
      $and: [base, { "alumniProfile.linkedinUrl": { $exists: true, $nin: [null, ""] } }],
    }),
    User.countDocuments({
      $and: [base, { "alumniProfile.bio": { $exists: true, $nin: [null, ""] } }],
    }),
  ]);
  return { alumniWithLinkedInUrl, alumniWithBio };
};
