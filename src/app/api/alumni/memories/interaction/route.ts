import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_LIKED_IDS = 400;

type MemoryPostDoc = {
  _id: mongoose.Types.ObjectId;
  status?: string;
  likeCount?: number;
  likedUserIds?: mongoose.Types.ObjectId[];
  viewCount?: number;
};

export async function POST(request: NextRequest) {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;

  if (!(await checkRouteRateLimit(request, "/api/alumni/memories/interaction"))) {
    return rateLimitExceededResponse();
  }

  try {
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const action = String(body.action || "").trim();
    const ownerUserId = String(body.ownerUserId || "").trim();
    const memoryPostId = String(body.memoryPostId || "").trim();

    if (!mongoose.isValidObjectId(ownerUserId) || !mongoose.isValidObjectId(memoryPostId)) {
      return NextResponse.json({ error: "INVALID_IDS" }, { status: 400 });
    }
    if (action !== "like" && action !== "view") {
      return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
    }

    await connectDB();
    const viewerId = new mongoose.Types.ObjectId(gate.userId);
    const ownerOid = new mongoose.Types.ObjectId(ownerUserId);
    const postOid = new mongoose.Types.ObjectId(memoryPostId);

    const doc = await User.findById(ownerOid).select("alumniProfile.memoryPosts accountType").lean();
    if (!doc || (doc as { accountType?: string }).accountType !== "alumni") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const posts = ((doc as { alumniProfile?: { memoryPosts?: MemoryPostDoc[] } }).alumniProfile?.memoryPosts ||
      []) as MemoryPostDoc[];
    const post = posts.find((p) => p._id && String(p._id) === String(postOid));
    if (!post || post.status !== "approved") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    if (action === "view") {
      await User.updateOne(
        { _id: ownerOid, "alumniProfile.memoryPosts._id": postOid },
        { $inc: { "alumniProfile.memoryPosts.$.viewCount": 1 } }
      );
      const next = (post.viewCount ?? 0) + 1;
      return NextResponse.json({ ok: true, viewCount: next });
    }

    const live = await User.findById(ownerOid);
    if (!live) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const ap = (live as unknown as { alumniProfile?: { memoryPosts?: MemoryPostDoc[] } }).alumniProfile || {};
    const mem = [...(ap.memoryPosts || [])];
    const idx = mem.findIndex((p) => p._id && String(p._id) === String(postOid));
    if (idx < 0 || mem[idx].status !== "approved") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const cur = mem[idx];
    const ids = [...(cur.likedUserIds || [])];
    const has = ids.some((id) => id.equals(viewerId));
    if (has) {
      const nextIds = ids.filter((id) => !id.equals(viewerId));
      mem[idx] = {
        ...cur,
        likedUserIds: nextIds,
        likeCount: Math.max(0, nextIds.length),
      };
    } else {
      if (String(ownerOid) === String(viewerId)) {
        return NextResponse.json({ error: "SELF_LIKE" }, { status: 400 });
      }
      const nextIds = [...ids, viewerId].slice(0, MAX_LIKED_IDS);
      mem[idx] = {
        ...cur,
        likedUserIds: nextIds,
        likeCount: nextIds.length,
      };
    }

    (live as unknown as { alumniProfile: Record<string, unknown> }).alumniProfile = {
      ...(live as unknown as { alumniProfile?: Record<string, unknown> }).alumniProfile,
      memoryPosts: mem,
    };
    live.markModified("alumniProfile");
    await live.save();

    return NextResponse.json({
      ok: true,
      likeCount: mem[idx].likeCount ?? 0,
      liked: !has,
    });
  } catch (error) {
    console.error("[POST /api/alumni/memories/interaction]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
