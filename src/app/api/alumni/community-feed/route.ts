import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import AlumniStory from "@/models/AlumniStory";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { requireAlumniCommunityForAuthedUser } from "@/lib/alumni/require-alumni-community-access";
import { publicAlumniOpportunityListingFilter } from "@/lib/alumni/normalize-opportunity-status";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Lightweight mixed activity stream (v1) — foundation for a richer community feed.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;
  const blocked = requireAlumniCommunityForAuthedUser(gate.user);
  if (blocked) return blocked;

  if (!(await checkRouteRateLimit(request, "/api/alumni/community-feed"))) {
    return rateLimitExceededResponse();
  }

  try {
    await connectDB();
    const now = new Date();

    const [memories, opportunities, stories, mentors] = await Promise.all([
      User.aggregate<{ id: string; type: string; title: string; subtitle?: string; href?: string; at: Date }>([
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

    const items: Array<{
      kind: string;
      id: string;
      title: string;
      subtitle?: string;
      at: string | null;
      href?: string;
    }> = [];

    for (const m of memories) {
      items.push({
        kind: "memory",
        id: m.id,
        title: m.title,
        subtitle: m.subtitle ? String(m.subtitle).slice(0, 160) : undefined,
        at: m.at ? new Date(m.at).toISOString() : null,
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
        href: "/alumni/opportunities",
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
      });
    }
    for (const u of mentors) {
      items.push({
        kind: "mentor",
        id: (u as { _id: mongoose.Types.ObjectId })._id.toString(),
        title: String((u as { fullName?: string }).fullName || ""),
        subtitle: "Mentoring available",
        at: (u as { updatedAt?: Date }).updatedAt ? new Date((u as { updatedAt: Date }).updatedAt).toISOString() : null,
        href: `/alumni/${(u as { _id: mongoose.Types.ObjectId })._id.toString()}`,
      });
    }

    items.sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : 0;
      const tb = b.at ? new Date(b.at).getTime() : 0;
      return tb - ta;
    });

    return NextResponse.json({ ok: true, items: items.slice(0, 24) });
  } catch (e) {
    console.error("[GET /api/alumni/community-feed]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
