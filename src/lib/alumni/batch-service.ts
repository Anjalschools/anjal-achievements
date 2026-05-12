import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import AlumniCohort from "@/models/AlumniCohort";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";
import { normalizeGraduationYearToNumber } from "@/lib/alumni/graduation-year-normalize";

const alumniActiveWithGradYearMatch = (): Record<string, unknown> => ({
  $and: [
    { accountType: "alumni" },
    alumniCommunityActiveUserClause(),
    { "alumniProfile.graduationYear": { $exists: true, $nin: [null, ""] } },
  ],
});

const mergeCountMap = (rows: { _id: unknown; c?: number }[]): Map<number, number> => {
  const m = new Map<number, number>();
  for (const r of rows) {
    const y = normalizeGraduationYearToNumber(r._id);
    if (y == null) continue;
    m.set(y, (m.get(y) || 0) + Number(r.c || 0));
  }
  return m;
};

export type AdminAlumniCohortIntel = {
  id: string;
  graduationYear: number;
  label: string;
  track: string;
  stage: string;
  featured: boolean;
  alumniCount: number;
  verifiedCount: number;
  verificationRatePercent: number;
  avgReputation: number | null;
  mentorCount: number;
  mentorCases: number;
  opportunityCount: number;
  active30Count: number;
  activityRatePercent: number;
  topUniversityName: string;
  topUniversityCount: number;
};

const emptyIntel = (year: number, doc?: { _id?: { toString(): string }; label?: string; track?: string; stage?: string; featured?: boolean }): AdminAlumniCohortIntel => ({
  id: doc?._id ? doc._id.toString() : `year-${year}`,
  graduationYear: year,
  label: String(doc?.label || ""),
  track: String(doc?.track || ""),
  stage: String(doc?.stage || ""),
  featured: doc?.featured === true,
  alumniCount: 0,
  verifiedCount: 0,
  verificationRatePercent: 0,
  avgReputation: null,
  mentorCount: 0,
  mentorCases: 0,
  opportunityCount: 0,
  active30Count: 0,
  activityRatePercent: 0,
  topUniversityName: "",
  topUniversityCount: 0,
});

/**
 * Upsert one cohort row per distinct normalized graduation year on active alumni users.
 */
export const syncAlumniCohortsFromAlumniUsers = async (): Promise<number> => {
  await connectDB();
  const raw = await User.distinct("alumniProfile.graduationYear", alumniActiveWithGradYearMatch());
  let n = 0;
  for (const v of raw as unknown[]) {
    const y = normalizeGraduationYearToNumber(v);
    if (y == null) continue;
    await AlumniCohort.updateOne(
      { graduationYear: y },
      { $setOnInsert: { graduationYear: y, featured: false } },
      { upsert: true }
    );
    n += 1;
  }
  return n;
};

export const touchAlumniCohortForUser = async (userId: string): Promise<void> => {
  await connectDB();
  const u = await User.findById(userId).select("alumniProfile.graduationYear").lean();
  const y = normalizeGraduationYearToNumber((u as { alumniProfile?: { graduationYear?: unknown } } | null)?.alumniProfile?.graduationYear);
  if (y == null) return;
  await AlumniCohort.updateOne(
    { graduationYear: y },
    { $setOnInsert: { graduationYear: y, featured: false } },
    { upsert: true }
  );
};

const buildCohortStatsMaps = async (): Promise<{
  byYear: Map<
    number,
    {
      alumniCount: number;
      verifiedCount: number;
      repSum: number;
      repN: number;
      mentorCount: number;
      active30: number;
    }
  >;
  oppByYear: Map<number, number>;
  mentorCasesByYear: Map<number, number>;
  topUniByYear: Map<number, { name: string; count: number }>;
}> => {
  await connectDB();
  const cutoff30 = new Date(Date.now() - 30 * 86_400_000);
  const userColl = User.collection.collectionName;

  const [rawUsers, rawUni, oppAgg, menAgg] = await Promise.all([
    User.aggregate<{
      _id: unknown;
      alumniCount: number;
      verifiedCount: number;
      repSum: number;
      repN: number;
      mentorCount: number;
      active30: number;
    }>([
      { $match: alumniActiveWithGradYearMatch() },
      {
        $group: {
          _id: "$alumniProfile.graduationYear",
          alumniCount: { $sum: 1 },
          verifiedCount: { $sum: { $cond: [{ $eq: ["$alumniProfile.isVerifiedAlumni", true] }, 1, 0] } },
          repSum: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$alumniProfile.reputationScore", null] },
                    { $gte: ["$alumniProfile.reputationScore", 0] },
                  ],
                },
                "$alumniProfile.reputationScore",
                0,
              ],
            },
          },
          repN: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$alumniProfile.reputationScore", null] },
                    { $gte: ["$alumniProfile.reputationScore", 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          mentorCount: { $sum: { $cond: [{ $eq: ["$alumniProfile.alumniServices.mentoring", true] }, 1, 0] } },
          active30: { $sum: { $cond: [{ $gte: ["$lastLoginAt", cutoff30] }, 1, 0] } },
        },
      },
    ]),
    User.aggregate<{ _id: { gy: unknown; u: string }; c: number }>([
      {
        $match: {
          $and: [
            { accountType: "alumni" },
            alumniCommunityActiveUserClause(),
            { "alumniProfile.graduationYear": { $exists: true, $nin: [null, ""] } },
            { "alumniProfile.universityName": { $exists: true, $nin: [null, ""] } },
          ],
        },
      },
      {
        $group: {
          _id: { gy: "$alumniProfile.graduationYear", u: "$alumniProfile.universityName" },
          c: { $sum: 1 },
        },
      },
      { $sort: { c: -1 } },
      { $limit: 800 },
    ]),
    AlumniOpportunity.aggregate<{ _id: unknown; c: number }>([
      { $match: { createdByUserId: { $exists: true, $ne: null } } },
      {
        $lookup: {
          from: userColl,
          localField: "createdByUserId",
          foreignField: "_id",
          as: "cr",
          pipeline: [{ $project: { gy: "$alumniProfile.graduationYear" } }],
        },
      },
      { $unwind: "$cr" },
      { $group: { _id: "$cr.gy", c: { $sum: 1 } } },
    ]),
    AlumniMentorshipRequest.aggregate<{ _id: unknown; c: number }>([
      {
        $match: {
          mentorId: { $exists: true, $ne: null },
          status: { $in: ["pending", "accepted", "completed"] },
        },
      },
      {
        $lookup: {
          from: userColl,
          localField: "mentorId",
          foreignField: "_id",
          as: "mv",
          pipeline: [{ $project: { gy: "$alumniProfile.graduationYear" } }],
        },
      },
      { $unwind: "$mv" },
      { $group: { _id: "$mv.gy", c: { $sum: 1 } } },
    ]),
  ]);

  const byYear = new Map<
    number,
    {
      alumniCount: number;
      verifiedCount: number;
      repSum: number;
      repN: number;
      mentorCount: number;
      active30: number;
    }
  >();

  for (const r of rawUsers) {
    const y = normalizeGraduationYearToNumber(r._id);
    if (y == null) continue;
    const cur = byYear.get(y) || { alumniCount: 0, verifiedCount: 0, repSum: 0, repN: 0, mentorCount: 0, active30: 0 };
    cur.alumniCount += r.alumniCount;
    cur.verifiedCount += r.verifiedCount;
    cur.repSum += r.repSum;
    cur.repN += r.repN;
    cur.mentorCount += r.mentorCount;
    cur.active30 += r.active30;
    byYear.set(y, cur);
  }

  const topUniByYear = new Map<number, { name: string; count: number }>();
  for (const r of rawUni) {
    const y = normalizeGraduationYearToNumber(r._id?.gy);
    if (y == null) continue;
    const name = String(r._id?.u || "").trim();
    if (!name) continue;
    const prev = topUniByYear.get(y);
    if (!prev || r.c > prev.count) topUniByYear.set(y, { name, count: r.c });
  }

  return {
    byYear,
    oppByYear: mergeCountMap(oppAgg),
    mentorCasesByYear: mergeCountMap(menAgg),
    topUniByYear,
  };
};

export const getAdminAlumniCohortListWithIntel = async (): Promise<{ syncedYears: number; items: AdminAlumniCohortIntel[] }> => {
  await connectDB();
  const syncedYears = await syncAlumniCohortsFromAlumniUsers();
  const [{ byYear, oppByYear, mentorCasesByYear, topUniByYear }, cohortDocs] = await Promise.all([
    buildCohortStatsMaps(),
    AlumniCohort.find({}).sort({ graduationYear: -1 }).limit(220).lean(),
  ]);

  const years = new Set<number>();
  for (const y of byYear.keys()) years.add(y);
  for (const c of cohortDocs) years.add(Number(c.graduationYear));

  const sortedYears = [...years].sort((a, b) => b - a);

  const items: AdminAlumniCohortIntel[] = sortedYears.map((year) => {
    const doc = cohortDocs.find((c) => Number(c.graduationYear) === year);
    const st = byYear.get(year);
    const opp = oppByYear.get(year) || 0;
    const mc = mentorCasesByYear.get(year) || 0;
    const top = topUniByYear.get(year);
    const alumniCount = st?.alumniCount ?? 0;
    const verifiedCount = st?.verifiedCount ?? 0;
    const repAvg = st && st.repN > 0 ? st.repSum / st.repN : null;
    const active30 = st?.active30 ?? 0;
    const base = emptyIntel(year, doc as { _id?: { toString(): string }; label?: string; track?: string; stage?: string; featured?: boolean });
    return {
      ...base,
      id: doc?._id ? String(doc._id) : base.id,
      alumniCount,
      verifiedCount,
      verificationRatePercent: alumniCount > 0 ? Math.round((verifiedCount / alumniCount) * 1000) / 10 : 0,
      avgReputation: repAvg != null && Number.isFinite(repAvg) ? Math.round(repAvg * 10) / 10 : null,
      mentorCount: st?.mentorCount ?? 0,
      mentorCases: mc,
      opportunityCount: opp,
      active30Count: active30,
      activityRatePercent: alumniCount > 0 ? Math.round((active30 / alumniCount) * 1000) / 10 : 0,
      topUniversityName: top?.name || "",
      topUniversityCount: top?.count ?? 0,
    };
  });

  return { syncedYears, items };
};
