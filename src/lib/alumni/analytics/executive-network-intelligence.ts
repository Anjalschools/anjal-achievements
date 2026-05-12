import mongoose from "mongoose";
import User from "@/models/User";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import AlumniFeedEngagement from "@/models/AlumniFeedEngagement";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";
import { normalizeGraduationYearToNumber } from "@/lib/alumni/graduation-year-normalize";

export type ExecutiveNetworkIntelligence = {
  computedAt: string;
  windowDays: number;
  activeAlumniApprox: number;
  mentorshipsCompletedInWindow: number;
  feedEngagementsInWindow: number;
  topInfluentialAlumni: Array<{
    userId: string;
    fullName: string;
    reputationScore: number;
    completedMentorships: number;
    influenceScore: number;
  }>;
  topMentorsByCompletions: Array<{ userId: string; fullName: string; completedMentorships: number }>;
  topLinkedUniversityPairs: Array<{ universityA: string; universityB: string; mentorshipEdges: number }>;
  highImpactGradYears: Array<{ graduationYear: number; alumniCount: number; avgReputation: number }>;
};

const activeAlumni = (): Record<string, unknown> => ({
  $and: [{ accountType: "alumni" }, alumniCommunityActiveUserClause()],
});

export const getExecutiveNetworkIntelligence = async (): Promise<ExecutiveNetworkIntelligence> => {
  const windowDays = 30;
  const since = new Date(Date.now() - windowDays * 86400000);
  const userColl = User.collection.collectionName;

  const [
    activeAlumniApprox,
    mentorshipsCompletedInWindow,
    feedEngagementsInWindow,
    topMentors,
    topInfl,
    uniPairs,
  ] = await Promise.all([
    User.countDocuments(activeAlumni()),
    AlumniMentorshipRequest.countDocuments({ status: "completed", updatedAt: { $gte: since } }),
    AlumniFeedEngagement.countDocuments({ createdAt: { $gte: since } }),
    AlumniMentorshipRequest.aggregate<{ _id: mongoose.Types.ObjectId; c: number }>([
      { $match: { status: "completed", updatedAt: { $gte: since } } },
      { $group: { _id: "$mentorId", c: { $sum: 1 } } },
      { $sort: { c: -1 } },
      { $limit: 10 },
    ]),
    User.aggregate<{
      _id: mongoose.Types.ObjectId;
      fullName: string;
      reputationScore: number;
      mc: number;
      influenceScore: number;
    }>([
      {
        $match: {
          ...activeAlumni(),
          "alumniProfile.reputationScore": { $gte: 200, $type: "number" },
        },
      },
      {
        $lookup: {
          from: AlumniMentorshipRequest.collection.collectionName,
          let: { uid: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ["$mentorId", "$$uid"] }, { $eq: ["$status", "completed"] }],
                },
              },
            },
            { $count: "c" },
          ],
          as: "mentorHits",
        },
      },
      {
        $project: {
          fullName: 1,
          reputationScore: "$alumniProfile.reputationScore",
          mc: { $ifNull: [{ $arrayElemAt: ["$mentorHits.c", 0] }, 0] },
        },
      },
      {
        $addFields: {
          influenceScore: {
            $add: [
              { $multiply: ["$reputationScore", 0.6] },
              { $multiply: [{ $ln: { $add: ["$mc", 1] } }, 120] },
            ],
          },
        },
      },
      { $sort: { influenceScore: -1 } },
      { $limit: 10 },
    ]),
    AlumniMentorshipRequest.aggregate<{ _id: { a: string; b: string }; c: number }>([
      { $match: { status: { $in: ["accepted", "completed"] }, updatedAt: { $gte: since } } },
      {
        $lookup: {
          from: userColl,
          localField: "mentorId",
          foreignField: "_id",
          as: "md",
        },
      },
      {
        $lookup: {
          from: userColl,
          localField: "requesterId",
          foreignField: "_id",
          as: "rd",
        },
      },
      {
        $project: {
          mu: { $arrayElemAt: ["$md.alumniProfile.universityName", 0] },
          ru: { $arrayElemAt: ["$rd.alumniProfile.universityName", 0] },
        },
      },
      {
        $match: {
          mu: { $type: "string", $nin: [null, ""] },
          ru: { $type: "string", $nin: [null, ""] },
        },
      },
      {
        $project: {
          a: { $min: ["$mu", "$ru"] },
          b: { $max: ["$mu", "$ru"] },
        },
      },
      { $group: { _id: { a: "$a", b: "$b" }, c: { $sum: 1 } } },
      { $sort: { c: -1 } },
      { $limit: 8 },
    ]),
  ]);

  const cohortRowsRaw = await User.aggregate<{ _id: unknown; c: number; avgRep: number | null }>([
    { $match: { ...activeAlumni(), "alumniProfile.graduationYear": { $exists: true, $nin: [null, ""] } } },
    {
      $group: {
        _id: "$alumniProfile.graduationYear",
        c: { $sum: 1 },
        avgRep: { $avg: "$alumniProfile.reputationScore" },
      },
    },
  ]);

  const mergedCohorts = new Map<number, { c: number; sumRep: number }>();
  for (const row of cohortRowsRaw) {
    const y = normalizeGraduationYearToNumber(row._id);
    if (y == null || y < 1990) continue;
    const cur = mergedCohorts.get(y) || { c: 0, sumRep: 0 };
    const ar = row.avgRep != null && Number.isFinite(Number(row.avgRep)) ? Number(row.avgRep) : 0;
    cur.sumRep += ar * row.c;
    cur.c += row.c;
    mergedCohorts.set(y, cur);
  }

  const cohorts = [...mergedCohorts.entries()]
    .map(([y, v]) => ({ _id: y, c: v.c, avgRep: v.c > 0 ? v.sumRep / v.c : 0 }))
    .filter((z) => z.c >= 3)
    .sort((a, b) => (b.avgRep - a.avgRep) || (b.c - a.c))
    .slice(0, 8);

  const mentorIds = topMentors.map((m) => m._id);
  const mentorUsers = mentorIds.length
    ? await User.find({ _id: { $in: mentorIds } })
        .select("fullName")
        .lean()
    : [];
  const nameById = new Map(mentorUsers.map((u) => [String((u as { _id: mongoose.Types.ObjectId })._id), String((u as { fullName?: string }).fullName || "")]));

  return {
    computedAt: new Date().toISOString(),
    windowDays,
    activeAlumniApprox,
    mentorshipsCompletedInWindow,
    feedEngagementsInWindow,
    topInfluentialAlumni: topInfl.map((r) => ({
      userId: String(r._id),
      fullName: String(r.fullName || ""),
      reputationScore: Math.round(Number(r.reputationScore || 0)),
      completedMentorships: Number(r.mc || 0),
      influenceScore: Math.round(Number(r.influenceScore || 0)),
    })),
    topMentorsByCompletions: topMentors.map((m) => ({
      userId: String(m._id),
      fullName: nameById.get(String(m._id)) || "",
      completedMentorships: m.c,
    })),
    topLinkedUniversityPairs: uniPairs.map((p) => ({
      universityA: p._id.a,
      universityB: p._id.b,
      mentorshipEdges: p.c,
    })),
    highImpactGradYears: cohorts.map((c) => ({
      graduationYear: c._id,
      alumniCount: c.c,
      avgReputation: Math.round((c.avgRep || 0) * 10) / 10,
    })),
  };
};
