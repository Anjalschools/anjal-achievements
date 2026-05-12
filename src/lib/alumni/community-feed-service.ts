import mongoose from "mongoose";
import User from "@/models/User";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import AlumniStory from "@/models/AlumniStory";
import { publicAlumniOpportunityListingFilter } from "@/lib/alumni/normalize-opportunity-status";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";

export type CommunityFeedItem = {
  kind: "memory" | "opportunity" | "story" | "mentor" | string;
  id: string;
  title: string;
  subtitle?: string;
  at: string | null;
  href?: string;
  /** Rough engagement rank: recency-weighted index (0 = newest in batch). */
  rank: number;
};

const memoryHref = (mode: "alumni" | "admin") =>
  mode === "admin" ? "/admin/alumni/memories" : "/alumni/dashboard#alumni-memories";

const opportunityHref = (mode: "alumni" | "admin") =>
  mode === "admin" ? "/admin/alumni/opportunities" : "/alumni/opportunities";

/**
 * Mixed alumni community stream (memories, opportunities, stories, mentors).
 * `mode` adjusts outbound links for alumni-facing vs alumni-admin surfaces.
 */
export const buildCommunityFeedItems = async (
  mode: "alumni" | "admin",
  limit = 24
): Promise<CommunityFeedItem[]> => {
  const now = new Date();

  const [memories, opportunities, stories, mentors] = await Promise.all([
    User.aggregate<{ id: string; type: string; title: string; subtitle?: string; at: Date }>([
      {
        $match: {
          accountType: "alumni",
          ...alumniCommunityActiveUserClause(),
          "alumniProfile.memoryPosts": { $exists: true, $ne: [] },
        },
      },
      { $unwind: "$alumniProfile.memoryPosts" },
      { $match: { "alumniProfile.memoryPosts.status": "approved" } },
      { $sort: { "alumniProfile.memoryPosts.submittedAt": -1 } },
      { $limit: 8 },
      {
        $project: {
          _id: 0,
          id: { $toString: "$alumniProfile.memoryPosts._id" },
          type: { $literal: "memory" },
          title: "$fullName",
          subtitle: "$alumniProfile.memoryPosts.caption",
          at: "$alumniProfile.memoryPosts.submittedAt",
        },
      },
    ]),
    AlumniOpportunity.find({ ...publicAlumniOpportunityListingFilter(now) })
      .sort({ createdAt: -1 })
      .limit(6)
      .select("title type company createdAt")
      .lean(),
    AlumniStory.find({ published: true })
      .sort({ publishedAt: -1, updatedAt: -1 })
      .limit(6)
      .select("title slug publishedAt updatedAt")
      .lean(),
    User.find({
      accountType: "alumni",
      ...alumniCommunityActiveUserClause(),
      "alumniProfile.alumniServices.mentoring": true,
      "alumniProfile.isVerifiedAlumni": true,
    })
      .sort({ updatedAt: -1 })
      .limit(6)
      .select("fullName updatedAt")
      .lean(),
  ]);

  const items: CommunityFeedItem[] = [];

  for (const m of memories) {
    items.push({
      kind: "memory",
      id: m.id,
      title: m.title,
      subtitle: m.subtitle ? String(m.subtitle).slice(0, 160) : undefined,
      at: m.at ? new Date(m.at).toISOString() : null,
      href: memoryHref(mode),
      rank: 0,
    });
  }
  for (const o of opportunities) {
    items.push({
      kind: "opportunity",
      id: (o as { _id: mongoose.Types.ObjectId })._id.toString(),
      title: String((o as { title?: string }).title || ""),
      subtitle: [String((o as { type?: string }).type || ""), String((o as { company?: string }).company || "")]
        .filter(Boolean)
        .join(" · "),
      at: (o as { createdAt?: Date }).createdAt ? new Date((o as { createdAt: Date }).createdAt).toISOString() : null,
      href: opportunityHref(mode),
      rank: 0,
    });
  }
  for (const s of stories) {
    const slug = String((s as { slug?: string }).slug || "");
    items.push({
      kind: "story",
      id: (s as { _id: mongoose.Types.ObjectId })._id.toString(),
      title: String((s as { title?: string }).title || ""),
      at: (s as { publishedAt?: Date; updatedAt?: Date }).publishedAt
        ? new Date((s as { publishedAt: Date }).publishedAt).toISOString()
        : (s as { updatedAt?: Date }).updatedAt
          ? new Date((s as { updatedAt: Date }).updatedAt).toISOString()
          : null,
      href: slug ? `/alumni/stories/${encodeURIComponent(slug)}` : "/alumni/stories",
      rank: 0,
    });
  }
  for (const u of mentors) {
    items.push({
      kind: "mentor",
      id: (u as { _id: mongoose.Types.ObjectId })._id.toString(),
      title: String((u as { fullName?: string }).fullName || ""),
      subtitle: mode === "admin" ? "Mentoring · verified" : "Mentoring available",
      at: (u as { updatedAt?: Date }).updatedAt ? new Date((u as { updatedAt: Date }).updatedAt).toISOString() : null,
      href: `/alumni/${(u as { _id: mongoose.Types.ObjectId })._id.toString()}`,
      rank: 0,
    });
  }

  items.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return tb - ta;
  });

  const sliced = items.slice(0, limit);
  const nowMs = Date.now();
  sliced.forEach((row, i) => {
    const ageMs = row.at ? Math.max(0, nowMs - new Date(row.at).getTime()) : 86400000 * 365;
    const decay = Math.min(1, 86400000 * 14 / Math.max(86400000, ageMs));
    row.rank = Math.round((100 - i * 3) * decay * 10) / 10;
  });

  return sliced;
};
