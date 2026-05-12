import mongoose from "mongoose";
import User from "@/models/User";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import AlumniStory from "@/models/AlumniStory";
import AlumniFeedEngagement from "@/models/AlumniFeedEngagement";
import { publicAlumniOpportunityListingFilter } from "@/lib/alumni/normalize-opportunity-status";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";
import type { MatchProfileInput } from "@/lib/alumni/matching/mentor-matching";
import { MENTOR_SCORE_MAX, scoreMentor, type MentorCandidate } from "@/lib/alumni/matching/mentor-matching";
import { OPPORTUNITY_SCORE_MAX, scoreOpportunity } from "@/lib/alumni/matching/opportunity-matching";

export type CommunityFeedItem = {
  kind: "memory" | "opportunity" | "story" | "mentor" | string;
  id: string;
  title: string;
  subtitle?: string;
  at: string | null;
  href?: string;
  /** Author / profile subject for personalization (memory + mentor). */
  authorId?: string;
  /** Rough engagement rank after optional personalization (bounded, explainable signals). */
  rank: number;
  /** Up to 3 stable keys describing ranking boosts (for debugging / future UI). */
  rankSignals?: string[];
  likes?: number;
  saves?: number;
  shares?: number;
};

const memoryHref = (mode: "alumni" | "admin") =>
  mode === "admin" ? "/admin/alumni/memories" : "/alumni/dashboard#alumni-memories";

const opportunityHref = (mode: "alumni" | "admin") =>
  mode === "admin" ? "/admin/alumni/opportunities" : "/alumni/opportunities";

const leanUserToCandidate = (raw: Record<string, unknown>): MentorCandidate => {
  const p = (raw.alumniProfile as Record<string, unknown> | undefined) || {};
  return {
    id: String((raw._id as mongoose.Types.ObjectId).toString()),
    fullName: String(raw.fullName || ""),
    universityName: (p.universityName as string | null | undefined) ?? null,
    major: (p.major as string | null | undefined) ?? null,
    industry: (p.industry as string | null | undefined) ?? null,
    country: (p.country as string | null | undefined) ?? null,
    studyCountry: (p.studyCountry as string | null | undefined) ?? null,
    graduationYear: (p.graduationYear as number | null | undefined) ?? null,
    interests: Array.isArray(p.interests) ? (p.interests as string[]) : null,
    bio: (p.bio as string | null | undefined) ?? null,
    updatedAt: (raw.updatedAt as Date | null | undefined) ?? null,
    lastLoginAt: (raw.lastLoginAt as Date | null | undefined) ?? null,
    isVerifiedAlumni: p.isVerifiedAlumni === true,
    reputationScore: (p.reputationScore as number | null | undefined) ?? null,
  };
};

const applyFeedPersonalization = async (
  rows: CommunityFeedItem[],
  ctx: { userId: string; profile: MatchProfileInput }
): Promise<CommunityFeedItem[]> => {
  const authorIds = new Set<string>();
  for (const r of rows) {
    if (r.kind === "mentor") authorIds.add(r.id);
    else if (r.authorId) authorIds.add(r.authorId);
  }
  authorIds.delete(ctx.userId);

  const validIds = [...authorIds].filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
  const since = new Date(Date.now() - 180 * 86400000);

  const engBoost =
    validIds.length > 0
      ? await AlumniFeedEngagement.aggregate<{ _id: mongoose.Types.ObjectId; boost: number }>([
          {
            $match: {
              actorId: new mongoose.Types.ObjectId(ctx.userId),
              targetOwnerId: { $in: validIds },
              createdAt: { $gte: since },
            },
          },
          {
            $group: {
              _id: "$targetOwnerId",
              boost: {
                $sum: {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$action", "like"] }, then: 2 },
                      { case: { $eq: ["$action", "save"] }, then: 5 },
                    ],
                    default: 1,
                  },
                },
              },
            },
          },
        ])
      : [];
  const boostMap = new Map(engBoost.map((e) => [String(e._id), e.boost]));

  const authorRows =
    validIds.length > 0
      ? await User.find({ _id: { $in: validIds } })
          .select("fullName alumniProfile updatedAt lastLoginAt")
          .lean()
      : [];
  const candidates = new Map<string, MentorCandidate>();
  for (const raw of authorRows as unknown as Array<Record<string, unknown>>) {
    const c = leanUserToCandidate(raw);
    candidates.set(c.id, c);
  }

  const nowMs = Date.now();
  const scored = rows.map((row, i) => {
    const ageMs = row.at ? Math.max(0, nowMs - new Date(row.at).getTime()) : 86400000 * 365;
    const decay = Math.min(1, (86400000 * 14) / Math.max(86400000, ageMs));
    const base = (100 - i * 2.4) * decay;
    let bonus = 0;
    const signals: string[] = [];

    const authorKey = row.kind === "mentor" ? row.id : row.authorId;
    if (authorKey && authorKey !== ctx.userId) {
      const eb = boostMap.get(authorKey) || 0;
      if (eb > 0) {
        bonus += Math.min(16, eb);
        signals.push("prior_engagement_same_author");
      }
      const cand = candidates.get(authorKey);
      if (cand) {
        const m = scoreMentor(ctx.profile, cand, ctx.userId);
        if (m.score > 0) {
          bonus += Math.min(22, (m.score / MENTOR_SCORE_MAX) * 22);
          signals.push(...m.reasons.slice(0, 2));
        }
      }
    }

    if (row.kind === "opportunity") {
      const o = scoreOpportunity(ctx.profile, {
        id: row.id,
        title: row.title,
        description: row.subtitle || "",
        type: "",
        company: "",
        location: "",
      });
      if (o.score > 0) {
        bonus += Math.min(14, (o.score / OPPORTUNITY_SCORE_MAX) * 14);
        signals.push(...o.reasons.slice(0, 1));
      }
    }

    if (row.kind === "story") {
      const hay = (row.title || "").toLowerCase();
      for (const t of ctx.profile.interests || []) {
        const x = t.trim().toLowerCase();
        if (x.length > 2 && hay.includes(x)) {
          bonus += 8;
          signals.push("story_interest_overlap");
          break;
        }
      }
    }

    const engWeight = Math.min(
      10,
      (row.likes || 0) * 0.55 + (row.saves || 0) * 1.35 + (row.shares || 0) * 0.85
    );
    bonus += engWeight;
    if (engWeight >= 3) signals.push("high_community_engagement");

    const uniqSignals = [...new Set(signals)].slice(0, 3);
    return { row, total: base + Math.min(30, bonus), signals: uniqSignals };
  });

  scored.sort((a, b) => b.total - a.total);
  return scored.map((x, idx) => {
    x.row.rank = Math.round((100 - idx * 2.8) * 10) / 10;
    x.row.rankSignals = x.signals;
    return x.row;
  });
};

/**
 * Mixed alumni community stream (memories, opportunities, stories, mentors).
 * `mode` adjusts outbound links for alumni-facing vs alumni-admin surfaces.
 * When `personalize` is set on alumni mode, re-ranks using profile + relationship signals (rule-based).
 */
export const buildCommunityFeedItems = async (
  mode: "alumni" | "admin",
  limit = 24,
  personalize?: { userId: string; profile: MatchProfileInput } | null
): Promise<CommunityFeedItem[]> => {
  const now = new Date();

  const [memories, opportunities, stories, mentors] = await Promise.all([
    User.aggregate<{
      id: string;
      type: string;
      title: string;
      subtitle?: string;
      at: Date;
      authorId: string;
    }>([
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
          authorId: { $toString: "$_id" },
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
      authorId: m.authorId,
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
    const uid = (u as { _id: mongoose.Types.ObjectId })._id.toString();
    items.push({
      kind: "mentor",
      id: uid,
      authorId: uid,
      title: String((u as { fullName?: string }).fullName || ""),
      subtitle: mode === "admin" ? "Mentoring · verified" : "Mentoring available",
      at: (u as { updatedAt?: Date }).updatedAt ? new Date((u as { updatedAt: Date }).updatedAt).toISOString() : null,
      href: `/alumni/${uid}`,
      rank: 0,
    });
  }

  items.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return tb - ta;
  });

  const sliced = items.slice(0, limit);

  const orClause = sliced.map((row) => ({ targetKind: row.kind, targetId: row.id }));
  const countMap = new Map<string, { likes: number; saves: number; shares: number }>();
  if (orClause.length) {
    const agg = await AlumniFeedEngagement.aggregate<{
      _id: { k: string; i: string; a: string };
      c: number;
    }>([{ $match: { $or: orClause } }, { $group: { _id: { k: "$targetKind", i: "$targetId", a: "$action" }, c: { $sum: 1 } } }]);
    for (const row of agg) {
      const key = `${row._id.k}:${row._id.i}`;
      if (!countMap.has(key)) countMap.set(key, { likes: 0, saves: 0, shares: 0 });
      const cur = countMap.get(key)!;
      if (row._id.a === "like") cur.likes += row.c;
      else if (row._id.a === "save") cur.saves += row.c;
      else if (row._id.a === "share") cur.shares += row.c;
    }
  }

  for (const row of sliced) {
    const c = countMap.get(`${row.kind}:${row.id}`) || { likes: 0, saves: 0, shares: 0 };
    row.likes = c.likes;
    row.saves = c.saves;
    row.shares = c.shares;
  }

  const nowMs = Date.now();
  sliced.forEach((row, i) => {
    const ageMs = row.at ? Math.max(0, nowMs - new Date(row.at).getTime()) : 86400000 * 365;
    const decay = Math.min(1, (86400000 * 14) / Math.max(86400000, ageMs));
    row.rank = Math.round((100 - i * 3) * decay * 10) / 10;
  });

  if (mode === "alumni" && personalize?.userId && personalize.profile) {
    return applyFeedPersonalization(sliced, personalize);
  }

  return sliced;
};
