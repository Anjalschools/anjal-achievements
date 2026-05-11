import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { isAllowedAlumniMemoryImageUrl } from "@/lib/alumni/alumni-memory-url";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";

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
      .map((p) => ({
        id: p._id.toString(),
        imageUrl: p.imageUrl,
        caption: p.caption || "",
        memoryYear: p.memoryYear ?? null,
        status: p.status || "pending",
        submittedAt: p.submittedAt ? new Date(p.submittedAt).toISOString() : null,
      }));

    const approvedStrip = await User.aggregate<{
      uid: mongoose.Types.ObjectId;
      fullName: string;
      profilePhoto?: string;
      imageUrl: string;
      submittedAt: Date;
    }>([
      {
        $match: {
          accountType: "alumni",
          ...alumniCommunityActiveUserClause(),
          ...privacySearchable(),
          _id: { $ne: uid },
          "alumniProfile.memoryPosts": { $exists: true, $ne: [] },
        },
      },
      { $unwind: "$alumniProfile.memoryPosts" },
      { $match: { "alumniProfile.memoryPosts.status": "approved" } },
      { $sort: { "alumniProfile.memoryPosts.submittedAt": -1 } },
      { $limit: 12 },
      {
        $project: {
          uid: "$_id",
          fullName: 1,
          profilePhoto: 1,
          imageUrl: "$alumniProfile.memoryPosts.imageUrl",
          submittedAt: "$alumniProfile.memoryPosts.submittedAt",
        },
      },
    ]);

    const pendingCount = posts.filter((p) => p.status === "pending").length;
    const approvedCount = posts.filter((p) => p.status === "approved").length;

    return NextResponse.json({
      ok: true,
      mine,
      communityPreview: approvedStrip.map((r) => ({
        userId: r.uid.toString(),
        fullName: r.fullName || "",
        profilePhoto: r.profilePhoto ? String(r.profilePhoto) : null,
        imageUrl: r.imageUrl,
        submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
      })),
      counts: { pending: pendingCount, approved: approvedCount, total: posts.length },
    });
  } catch (error) {
    console.error("[GET /api/alumni/memories]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const imageUrl = sanitizeUserText(String(body.imageUrl || "")).trim();
    const caption = sanitizeUserText(String(body.caption || "")).trim().slice(0, 500);
    const memoryYearRaw = body.memoryYear;
    const memoryYear =
      typeof memoryYearRaw === "number" && Number.isFinite(memoryYearRaw)
        ? Math.round(memoryYearRaw)
        : memoryYearRaw != null && String(memoryYearRaw).trim() !== ""
          ? Math.round(Number(String(memoryYearRaw)))
          : undefined;

    if (!imageUrl || !isAllowedAlumniMemoryImageUrl(imageUrl)) {
      return NextResponse.json({ error: "INVALID_IMAGE_URL" }, { status: 400 });
    }

    if (memoryYear !== undefined && (memoryYear < 1970 || memoryYear > 2100)) {
      return NextResponse.json({ error: "INVALID_YEAR" }, { status: 400 });
    }

    const uid = new mongoose.Types.ObjectId(gate.userId);
    const me = await User.findById(uid).select("alumniProfile.memoryPosts").lean();
    const existing = ((me as any)?.alumniProfile?.memoryPosts || []) as { status?: string }[];
    if (existing.length >= MAX_POSTS) {
      return NextResponse.json({ error: "MEMORY_LIMIT" }, { status: 400 });
    }
    const pending = existing.filter((p) => p.status === "pending").length;
    if (pending >= MAX_PENDING) {
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

    const post: Record<string, unknown> = {
      imageUrl,
      caption: caption || undefined,
      memoryYear: memoryYear !== undefined && Number.isFinite(memoryYear) ? memoryYear : undefined,
      status: "pending",
      submittedAt: new Date(),
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

    return NextResponse.json({ ok: true, id: newId, status: "pending" });
  } catch (error) {
    console.error("[POST /api/alumni/memories]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
