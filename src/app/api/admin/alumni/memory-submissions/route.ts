import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const rows = await User.aggregate<{
      _id: mongoose.Types.ObjectId;
      fullName: string;
      email?: string;
      post: {
        _id: mongoose.Types.ObjectId;
        imageUrl: string;
        caption?: string;
        memoryYear?: number;
        submittedAt?: Date;
      };
    }>([
      { $match: { "alumniProfile.memoryPosts": { $exists: true, $ne: [] } } },
      { $unwind: "$alumniProfile.memoryPosts" },
      { $match: { "alumniProfile.memoryPosts.status": "pending" } },
      { $sort: { "alumniProfile.memoryPosts.submittedAt": 1 } },
      { $limit: 80 },
      {
        $project: {
          fullName: 1,
          email: 1,
          post: "$alumniProfile.memoryPosts",
        },
      },
    ]);

    return NextResponse.json({
      ok: true,
      items: rows.map((r) => ({
        userId: r._id.toString(),
        fullName: r.fullName || "",
        email: r.email || "",
        memoryPostId: r.post._id.toString(),
        imageUrl: r.post.imageUrl,
        caption: r.post.caption || "",
        memoryYear: r.post.memoryYear ?? null,
        submittedAt: r.post.submittedAt ? new Date(r.post.submittedAt).toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/memory-submissions]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  try {
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const userId = String(body.userId || "").trim();
    const memoryPostId = String(body.memoryPostId || "").trim();
    const action = String(body.action || "").trim();

    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(memoryPostId)) {
      return NextResponse.json({ error: "INVALID_IDS" }, { status: 400 });
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
    }

    await connectDB();
    const status = action === "approve" ? "approved" : "rejected";
    const reviewedAt = new Date();

    const res = await User.updateOne(
      {
        _id: new mongoose.Types.ObjectId(userId),
        "alumniProfile.memoryPosts._id": new mongoose.Types.ObjectId(memoryPostId),
      },
      {
        $set: {
          "alumniProfile.memoryPosts.$.status": status,
          "alumniProfile.memoryPosts.$.reviewedAt": reviewedAt,
        },
      }
    );

    if (res.matchedCount === 0) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error("[PATCH /api/admin/alumni/memory-submissions]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
