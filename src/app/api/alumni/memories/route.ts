import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { isAllowedAlumniMemoryImageUrl } from "@/lib/alumni/alumni-memory-url";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";
import { hasRecentDuplicateMemoryPost } from "@/lib/alumni/alumni-memory-dedupe";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_POSTS = 36;
const MAX_PENDING = 8;

const privacySearchable = (): Record<string, unknown> => ({
  $nor: [{ "alumniProfile.privacySettings.searchable": false }],
});

export async function GET() {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const uid = new mongoose.Types.ObjectId(gate.userId);
    const me = await User.findById(uid).select("alumniProfile.memoryPosts fullName").lean();
    const posts = ((me as any)?.alumniProfile?.memoryPosts || []) as Array<{
      _id: mongoose.Types.ObjectId;
      imageUrl: string;
      caption?: string;
      memoryYear?: number;
      status?: string;
      submittedAt?: Date;
    }>;
    const mine = [...posts]
      .sort((a, b) => {
        const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 24)
      .map((p) => {
        const ext = p as typeof p & { likeCount?: number; viewCount?: number };
        return {
          id: p._id.toString(),
          imageUrl: p.imageUrl || "",
          caption: p.caption || "",
          memoryYear: p.memoryYear ?? null,
          status: p.status || "pending",
          submittedAt: p.submittedAt ? new Date(p.submittedAt).toISOString() : null,
          likeCount: typeof ext.likeCount === "number" ? ext.likeCount : 0,
          viewCount: typeof ext.viewCount === "number" ? ext.viewCount : 0,
        };
      });

    const showcaseAgg = await User.aggregate<{
      uid: mongoose.Types.ObjectId;
      fullName: string;
      profilePhoto?: string;
      postId: mongoose.Types.ObjectId;
      imageUrl: string;
      caption?: string;
      submittedAt: Date;
      likeCount: number;
      viewCount: number;
    }>([
      {
        $match: {
          accountType: "alumni",
          ...alumniCommunityActiveUserClause(),
          ...privacySearchable(),
          "alumniProfile.memoryPosts": { $exists: true, $ne: [] },
        },
      },
      { $unwind: "$alumniProfile.memoryPosts" },
      { $match: { "alumniProfile.memoryPosts.status": "approved" } },
      {
        $project: {
          uid: "$_id",
          fullName: 1,
          profilePhoto: 1,
          postId: "$alumniProfile.memoryPosts._id",
          imageUrl: "$alumniProfile.memoryPosts.imageUrl",
          caption: "$alumniProfile.memoryPosts.caption",
          submittedAt: "$alumniProfile.memoryPosts.submittedAt",
          likeCount: { $ifNull: ["$alumniProfile.memoryPosts.likeCount", 0] },
          viewCount: { $ifNull: ["$alumniProfile.memoryPosts.viewCount", 0] },
        },
      },
      { $limit: 120 },
    ]);

    const scored = showcaseAgg.map((r) => {
      const t = r.submittedAt ? new Date(r.submittedAt).getTime() : 0;
      const recency = Math.min(48, Math.max(0, (Date.now() - t) / 86_400_000));
      const engagement = (r.likeCount || 0) * 3 + (r.viewCount || 0) + Math.max(0, 20 - recency);
      return { ...r, _score: engagement };
    });
    scored.sort((a, b) => b._score - a._score);

    const approvedStrip = scored.slice(0, 12).map((r) => ({
      uid: r.uid,
      fullName: r.fullName,
      profilePhoto: r.profilePhoto,
      imageUrl: r.imageUrl,
      submittedAt: r.submittedAt,
    }));

    const showcase = scored.slice(0, 36).map((r) => ({
      ownerUserId: r.uid.toString(),
      memoryPostId: r.postId.toString(),
      fullName: r.fullName || "",
      profilePhoto: r.profilePhoto ? String(r.profilePhoto) : null,
      imageUrl: r.imageUrl,
      caption: r.caption ? String(r.caption) : "",
      submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
      likeCount: r.likeCount || 0,
      viewCount: r.viewCount || 0,
      engagementScore: Math.round(r._score),
    }));

    const pendingCount = posts.filter((p) => p.status === "pending").length;
    const draftCount = posts.filter((p) => p.status === "draft").length;
    const approvedCount = posts.filter((p) => p.status === "approved").length;
    const rejectedCount = posts.filter((p) => p.status === "rejected").length;

    return NextResponse.json({
      ok: true,
      mine,
      showcase,
      communityPreview: approvedStrip.map((r) => ({
        userId: r.uid.toString(),
        fullName: r.fullName || "",
        profilePhoto: r.profilePhoto ? String(r.profilePhoto) : null,
        imageUrl: r.imageUrl,
        submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
      })),
      counts: {
        pending: pendingCount,
        draft: draftCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: posts.length,
      },
    });
  } catch (error) {
    console.error("[GET /api/alumni/memories]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;

  if (!(await checkRouteRateLimit(request, "/api/alumni/memories"))) {
    return rateLimitExceededResponse();
  }

  try {
    await connectDB();
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const intentRaw = String(body.intent || body.status || "submit").trim().toLowerCase();
    const asDraft = intentRaw === "draft" || intentRaw === "save_draft";
    const imageUrl = sanitizeUserText(String(body.imageUrl || "")).trim();
    const caption = sanitizeUserText(String(body.caption || "")).trim().slice(0, 500);
    const memoryYearRaw = body.memoryYear;
    const memoryYear =
      typeof memoryYearRaw === "number" && Number.isFinite(memoryYearRaw)
        ? Math.round(memoryYearRaw)
        : memoryYearRaw != null && String(memoryYearRaw).trim() !== ""
          ? Math.round(Number(String(memoryYearRaw)))
          : undefined;

    if (!asDraft) {
      if (!imageUrl || !isAllowedAlumniMemoryImageUrl(imageUrl)) {
        return NextResponse.json({ error: "INVALID_IMAGE_URL" }, { status: 400 });
      }
    } else if (imageUrl && !isAllowedAlumniMemoryImageUrl(imageUrl)) {
      return NextResponse.json({ error: "INVALID_IMAGE_URL" }, { status: 400 });
    }

    if (memoryYear !== undefined && (memoryYear < 1970 || memoryYear > 2100)) {
      return NextResponse.json({ error: "INVALID_YEAR" }, { status: 400 });
    }

    const uid = new mongoose.Types.ObjectId(gate.userId);
    const me = await User.findById(uid).select("alumniProfile.memoryPosts").lean();
    const existing = ((me as any)?.alumniProfile?.memoryPosts || []) as Array<{
      status?: string;
      caption?: string;
      memoryYear?: number;
      imageUrl?: string;
      submittedAt?: Date;
      _id?: mongoose.Types.ObjectId;
    }>;
    if (existing.length >= MAX_POSTS) {
      return NextResponse.json({ error: "MEMORY_LIMIT" }, { status: 400 });
    }
    const pending = existing.filter((p) => p.status === "pending").length;
    if (!asDraft && pending >= MAX_PENDING) {
      return NextResponse.json({ error: "PENDING_LIMIT" }, { status: 400 });
    }

    const doc = await User.findById(uid);
    if (!doc) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const ap = (doc as unknown as { alumniProfile?: Record<string, unknown> }).alumniProfile || {};
    const mem = [...((ap as { memoryPosts?: Record<string, unknown>[] }).memoryPosts || [])] as Record<
      string,
      unknown
    >[];

    const status = asDraft ? "draft" : "pending";
    if (
      !asDraft &&
      hasRecentDuplicateMemoryPost(existing, {
        caption,
        memoryYear: memoryYear ?? null,
        imageUrl,
      })
    ) {
      return NextResponse.json({ error: "DUPLICATE_MEMORY" }, { status: 409 });
    }

    const post: Record<string, unknown> = {
      ...(imageUrl ? { imageUrl } : {}),
      caption: caption || undefined,
      memoryYear: memoryYear !== undefined && Number.isFinite(memoryYear) ? memoryYear : undefined,
      status,
      submittedAt: new Date(),
      likeCount: 0,
      viewCount: 0,
      likedUserIds: [],
    };

    mem.unshift(post);
    const trimmed = mem.slice(0, MAX_POSTS);
    (doc as unknown as { alumniProfile: Record<string, unknown> }).alumniProfile = {
      ...ap,
      memoryPosts: trimmed,
    };
    doc.markModified("alumniProfile");
    await doc.save();

    const first = trimmed[0] as { _id?: mongoose.Types.ObjectId };
    const newId = first?._id?.toString?.() || "";

    return NextResponse.json({ ok: true, id: newId, status });
  } catch (error) {
    console.error("[POST /api/alumni/memories]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
