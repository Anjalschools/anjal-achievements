import mongoose from "mongoose";
import User from "@/models/User";
import Achievement from "@/models/Achievement";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";
import { publicAlumniOpportunityListingFilter } from "@/lib/alumni/normalize-opportunity-status";
import type {
  CommunityFeedItem,
  CommunityInsights,
  PlatformMetricsStrip,
  WeeklyAlumniDigest,
} from "@/lib/alumni/community-activation-types";

const baseAlumni = (): Record<string, unknown> => ({
  accountType: "alumni",
  ...alumniCommunityActiveUserClause(),
});

const privacySearchable = (): Record<string, unknown> => ({
  $nor: [{ "alumniProfile.privacySettings.searchable": false }],
});

export const buildCommunityInsights = async (): Promise<CommunityInsights> => {
  const match = { ...baseAlumni(), ...privacySearchable() };

  const [uniRows, majorRows, indRows, opps] = await Promise.all([
    User.aggregate<{ _id: string; c: number }>([
      { $match: { ...match, "alumniProfile.universityName": { $nin: [null, ""] } } },
      { $group: { _id: { $trim: { input: "$alumniProfile.universityName" } }, c: { $sum: 1 } } },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { c: -1 } },
      { $limit: 6 },
    ]),
    User.aggregate<{ _id: string; c: number }>([
      { $match: { ...match, "alumniProfile.major": { $nin: [null, ""] } } },
      { $group: { _id: { $trim: { input: "$alumniProfile.major" } }, c: { $sum: 1 } } },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { c: -1 } },
      { $limit: 6 },
    ]),
    User.aggregate<{ _id: string; c: number }>([
      { $match: { ...match, "alumniProfile.industry": { $nin: [null, ""] } } },
      { $group: { _id: { $trim: { input: "$alumniProfile.industry" } }, c: { $sum: 1 } } },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { c: -1 } },
      { $limit: 6 },
    ]),
    AlumniOpportunity.find({
      ...publicAlumniOpportunityListingFilter(),
    })
      .sort({ featured: -1, updatedAt: -1 })
      .limit(5)
      .select("title type")
      .lean(),
  ]);

  return {
    topUniversities: uniRows.map((r) => ({ name: String(r._id || ""), count: r.c })),
    topMajors: majorRows.map((r) => ({ name: String(r._id || ""), count: r.c })),
    topIndustries: indRows.map((r) => ({ name: String(r._id || ""), count: r.c })),
    opportunities: (opps as { _id: mongoose.Types.ObjectId; title?: string; type?: string }[]).map((o) => ({
      id: o._id.toString(),
      title: String(o.title || ""),
      type: String(o.type || ""),
    })),
  };
};

export const buildCommunityFeed = async (): Promise<CommunityFeedItem[]> => {
  const match = { ...baseAlumni(), ...privacySearchable() };
  const now = new Date();

  const [
    joined,
    jobs,
    mentors,
    portfolios,
    memories,
    achievements,
    alumniCount,
  ] = await Promise.all([
    User.find({
      ...match,
      completedAlumniOnboardingAt: { $exists: true, $ne: null },
    })
      .sort({ completedAlumniOnboardingAt: -1 })
      .limit(6)
      .select("fullName profilePhoto completedAlumniOnboardingAt")
      .lean(),
    User.find({
      ...match,
      "alumniProfile.currentCompany": { $exists: true, $nin: [null, ""] },
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select("fullName profilePhoto updatedAt alumniProfile.currentCompany")
      .lean(),
    User.find({
      ...match,
      "alumniProfile.alumniServices.mentoring": true,
    })
      .sort({ updatedAt: -1 })
      .limit(4)
      .select("fullName profilePhoto updatedAt")
      .lean(),
    User.find({
      ...match,
      publicPortfolioEnabled: true,
      publicPortfolioPublishedAt: { $exists: true, $ne: null },
    })
      .sort({ publicPortfolioPublishedAt: -1 })
      .limit(4)
      .select("fullName profilePhoto publicPortfolioPublishedAt")
      .lean(),
    User.aggregate<{
      uid: mongoose.Types.ObjectId;
      fullName: string;
      profilePhoto?: string;
      imageUrl: string;
      caption?: string;
      submittedAt: Date;
    }>([
      { $match: { ...match, "alumniProfile.memoryPosts": { $exists: true, $ne: [] } } },
      { $unwind: "$alumniProfile.memoryPosts" },
      { $match: { "alumniProfile.memoryPosts.status": "approved" } },
      { $sort: { "alumniProfile.memoryPosts.submittedAt": -1 } },
      { $limit: 6 },
      {
        $project: {
          uid: "$_id",
          fullName: 1,
          profilePhoto: 1,
          imageUrl: "$alumniProfile.memoryPosts.imageUrl",
          caption: "$alumniProfile.memoryPosts.caption",
          submittedAt: "$alumniProfile.memoryPosts.submittedAt",
        },
      },
    ]),
    Achievement.find({
      approved: true,
      certificateIssuedAt: { $exists: true, $ne: null },
    })
      .sort({ certificateIssuedAt: -1 })
      .limit(6)
      .select("userId certificateIssuedAt achievementName nameAr nameEn")
      .lean(),
    User.countDocuments(match),
  ]);

  const items: CommunityFeedItem[] = [];

  for (const row of joined as any[]) {
    const at = row.completedAlumniOnboardingAt ? new Date(row.completedAlumniOnboardingAt).toISOString() : now.toISOString();
    items.push({
      id: `join-${String(row._id)}-${at}`,
      kind: "member_joined",
      at,
      actorId: String(row._id),
      actorName: String(row.fullName || ""),
      actorPhoto: row.profilePhoto ? String(row.profilePhoto) : null,
      href: `/alumni/${String(row._id)}`,
    });
  }

  for (const row of jobs as any[]) {
    const at = row.updatedAt ? new Date(row.updatedAt).toISOString() : now.toISOString();
    const co = row.alumniProfile?.currentCompany ? String(row.alumniProfile.currentCompany) : "";
    items.push({
      id: `job-${String(row._id)}-${at}`,
      kind: "job_update",
      at,
      actorId: String(row._id),
      actorName: String(row.fullName || ""),
      actorPhoto: row.profilePhoto ? String(row.profilePhoto) : null,
      href: `/alumni/${String(row._id)}`,
      meta: co,
    });
  }

  for (const row of mentors as any[]) {
    const at = row.updatedAt ? new Date(row.updatedAt).toISOString() : now.toISOString();
    items.push({
      id: `mentor-${String(row._id)}-${at}`,
      kind: "mentor_live",
      at,
      actorId: String(row._id),
      actorName: String(row.fullName || ""),
      actorPhoto: row.profilePhoto ? String(row.profilePhoto) : null,
      href: `/alumni/mentorship?mentor=${encodeURIComponent(String(row._id))}`,
    });
  }

  for (const row of portfolios as any[]) {
    const at = row.publicPortfolioPublishedAt
      ? new Date(row.publicPortfolioPublishedAt).toISOString()
      : now.toISOString();
    items.push({
      id: `pf-${String(row._id)}-${at}`,
      kind: "portfolio_live",
      at,
      actorId: String(row._id),
      actorName: String(row.fullName || ""),
      actorPhoto: row.profilePhoto ? String(row.profilePhoto) : null,
      href: `/alumni/${String(row._id)}`,
    });
  }

  for (const row of memories) {
    const at = row.submittedAt ? new Date(row.submittedAt).toISOString() : now.toISOString();
    items.push({
      id: `mem-${row.uid.toString()}-${at}-${row.imageUrl.slice(-24)}`,
      kind: "memory_shared",
      at,
      actorId: row.uid.toString(),
      actorName: row.fullName || "",
      actorPhoto: row.profilePhoto ? String(row.profilePhoto) : null,
      href: `/alumni/${row.uid.toString()}`,
      meta: row.caption ? String(row.caption).slice(0, 80) : undefined,
    });
  }

  const achUserIds = [
    ...new Set(
      (achievements as { userId?: mongoose.Types.ObjectId }[])
        .map((a) => a.userId)
        .filter(Boolean) as mongoose.Types.ObjectId[]
    ),
  ];
  const alumniOwners = new Set<string>();
  const userMeta = new Map<string, { fullName: string; profilePhoto: string | null }>();
  if (achUserIds.length) {
    const owners = await User.find({
      _id: { $in: achUserIds },
      accountType: "alumni",
    })
      .select("_id fullName profilePhoto")
      .lean();
    for (const o of owners as { _id: mongoose.Types.ObjectId; fullName?: string; profilePhoto?: string }[]) {
      const id = o._id.toString();
      alumniOwners.add(id);
      userMeta.set(id, {
        fullName: String(o.fullName || ""),
        profilePhoto: o.profilePhoto ? String(o.profilePhoto) : null,
      });
    }
  }

  for (const a of achievements as any[]) {
    const uid = a.userId ? String(a.userId) : "";
    if (!uid || !alumniOwners.has(uid)) continue;
    const at = a.certificateIssuedAt ? new Date(a.certificateIssuedAt).toISOString() : now.toISOString();
    const title = String(a.achievementName || a.nameAr || a.nameEn || "").slice(0, 120);
    const um = userMeta.get(uid);
    items.push({
      id: `cert-${String(a._id)}-${at}`,
      kind: "certificate_added",
      at,
      actorId: uid,
      actorName: um?.fullName || "",
      actorPhoto: um?.profilePhoto ?? null,
      href: `/alumni/${uid}`,
      meta: title,
    });
  }

  if (typeof alumniCount === "number" && alumniCount > 0) {
    items.push({
      id: `pulse-count-${alumniCount}`,
      kind: "pulse",
      at: now.toISOString(),
      actorId: "community",
      actorName: "",
      actorPhoto: null,
      href: "/search",
      meta: String(alumniCount),
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const seenIds = new Set<string>();
  const deduped: CommunityFeedItem[] = [];
  for (const it of items) {
    if (seenIds.has(it.id)) continue;
    seenIds.add(it.id);
    deduped.push(it);
    if (deduped.length >= 18) break;
  }

  return deduped;
};

const weekAgo = (): Date => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
};

const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

export const buildWeeklyAlumniDigest = async (): Promise<WeeklyAlumniDigest> => {
  const since = weekAgo();
  const match = { ...baseAlumni(), ...privacySearchable() };
  const insights = await buildCommunityInsights();

  const [newAlumniCount, memAgg, newOpportunitiesCount, mentorsActiveCount] = await Promise.all([
    User.countDocuments({
      ...match,
      $or: [{ completedAlumniOnboardingAt: { $gte: since } }, { createdAt: { $gte: since } }],
    }),
    User.aggregate<{ c: number }>([
      { $match: { ...match, "alumniProfile.memoryPosts": { $exists: true, $ne: [] } } },
      { $unwind: "$alumniProfile.memoryPosts" },
      {
        $match: {
          "alumniProfile.memoryPosts.status": "approved",
          "alumniProfile.memoryPosts.submittedAt": { $gte: since },
        },
      },
      { $count: "c" },
    ]),
    AlumniOpportunity.countDocuments({
      ...publicAlumniOpportunityListingFilter(),
      createdAt: { $gte: since },
    }),
    User.countDocuments({
      ...match,
      "alumniProfile.alumniServices.mentoring": true,
      updatedAt: { $gte: since },
    }),
  ]);

  return {
    periodLabel: "7d",
    sinceIso: since.toISOString(),
    newAlumniCount,
    newApprovedMemoriesCount: memAgg[0]?.c ?? 0,
    newOpportunitiesCount,
    mentorsActiveCount,
    trendingMajors: insights.topMajors.slice(0, 5),
  };
};

export const buildPlatformMetricsStrip = async (): Promise<PlatformMetricsStrip> => {
  const match = { ...baseAlumni(), ...privacySearchable() };
  const since30 = daysAgo(30);

  const [
    activeAlumni30d,
    uniAgg,
    majAgg,
    jobOpportunitiesCount,
    mentorCount,
  ] = await Promise.all([
    User.countDocuments({ ...match, lastLoginAt: { $gte: since30 } }),
    User.aggregate<{ c: number }>([
      { $match: { ...match, "alumniProfile.universityName": { $nin: [null, ""] } } },
      { $group: { _id: { $trim: { input: "$alumniProfile.universityName" } } } },
      { $match: { _id: { $nin: [null, ""] } } },
      { $count: "c" },
    ]),
    User.aggregate<{ c: number }>([
      { $match: { ...match, "alumniProfile.major": { $nin: [null, ""] } } },
      { $group: { _id: { $trim: { input: "$alumniProfile.major" } } } },
      { $match: { _id: { $nin: [null, ""] } } },
      { $count: "c" },
    ]),
    AlumniOpportunity.countDocuments({
      ...publicAlumniOpportunityListingFilter(),
      type: "job",
    }),
    User.countDocuments({ ...match, "alumniProfile.alumniServices.mentoring": true }),
  ]);

  return {
    activeAlumni30d,
    universityCount: uniAgg[0]?.c ?? 0,
    majorCount: majAgg[0]?.c ?? 0,
    jobOpportunitiesCount,
    mentorCount,
  };
};
