import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { isAllowedAlumniMemoryImageUrl } from "@/lib/alumni/alumni-memory-url";
import { hasRecentDuplicateMemoryPost } from "@/lib/alumni/alumni-memory-dedupe";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

const editableStatuses = new Set(["pending", "rejected", "draft"]);

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;

  const { id: memoryPostId } = await ctx.params;
  if (!mongoose.isValidObjectId(memoryPostId)) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  try {
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const statusIntent = body.status !== undefined ? String(body.status || "").trim().toLowerCase() : "";
    const caption =
      body.caption !== undefined ? sanitizeUserText(String(body.caption || "")).slice(0, 500) : undefined;
    const memoryYearRaw = body.memoryYear;
    const memoryYear =
      memoryYearRaw === null || memoryYearRaw === ""
        ? null
        : typeof memoryYearRaw === "number" && Number.isFinite(memoryYearRaw)
          ? Math.round(memoryYearRaw)
          : Math.round(Number(String(memoryYearRaw)));
    const imageUrlRaw = body.imageUrl != null ? sanitizeUserText(String(body.imageUrl || "")).trim() : undefined;

    await connectDB();
    const uid = new mongoose.Types.ObjectId(gate.userId);
    const postOid = new mongoose.Types.ObjectId(memoryPostId);

    const owner = await User.findOne({
      _id: uid,
      alumniProfile: { $exists: true },
      "alumniProfile.memoryPosts": { $elemMatch: { _id: postOid } },
    })
      .select("alumniProfile.memoryPosts")
      .lean();

    const posts = ((owner as { alumniProfile?: { memoryPosts?: { _id: mongoose.Types.ObjectId; status?: string }[] } })
      ?.alumniProfile?.memoryPosts || []) as Array<{
      _id: mongoose.Types.ObjectId;
      status?: string;
      caption?: string;
      memoryYear?: number;
      imageUrl?: string;
      submittedAt?: Date;
    }>;
    const hit = posts.find((p) => String(p._id) === String(postOid));
    if (!hit) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (!editableStatuses.has(String(hit.status || "pending"))) {
      return NextResponse.json({ error: "NOT_EDITABLE" }, { status: 409 });
    }

    const updates: Record<string, unknown> = {};
    if (caption !== undefined) updates["alumniProfile.memoryPosts.$[p].caption"] = caption || "";
    if (memoryYearRaw !== undefined) {
      if (memoryYear === null || Number.isNaN(memoryYear as number)) {
        updates["alumniProfile.memoryPosts.$[p].memoryYear"] = null;
      } else if (typeof memoryYear === "number" && memoryYear >= 1970 && memoryYear <= 2100) {
        updates["alumniProfile.memoryPosts.$[p].memoryYear"] = memoryYear;
      }
    }
    if (imageUrlRaw !== undefined) {
      if (!imageUrlRaw || !isAllowedAlumniMemoryImageUrl(imageUrlRaw)) {
        return NextResponse.json({ error: "INVALID_IMAGE_URL" }, { status: 400 });
      }
      updates["alumniProfile.memoryPosts.$[p].imageUrl"] = imageUrlRaw;
    }

    if (statusIntent === "pending") {
      const mergedImage =
        imageUrlRaw !== undefined ? imageUrlRaw : String((hit as { imageUrl?: string }).imageUrl || "").trim();
      const mergedCaption = caption !== undefined ? caption : String(hit.caption || "");
      const mergedYear =
        memoryYearRaw !== undefined
          ? memoryYear === null || Number.isNaN(memoryYear as number)
            ? null
            : memoryYear
          : hit.memoryYear ?? null;
      if (!mergedImage || !isAllowedAlumniMemoryImageUrl(mergedImage)) {
        return NextResponse.json({ error: "IMAGE_REQUIRED_FOR_SUBMIT" }, { status: 400 });
      }
      if (
        hasRecentDuplicateMemoryPost(
          posts,
          {
            caption: mergedCaption,
            memoryYear: mergedYear,
            imageUrl: mergedImage,
          },
          { excludePostId: String(postOid) }
        )
      ) {
        return NextResponse.json({ error: "DUPLICATE_MEMORY" }, { status: 409 });
      }
      updates["alumniProfile.memoryPosts.$[p].status"] = "pending";
      updates["alumniProfile.memoryPosts.$[p].submittedAt"] = new Date();
      if (imageUrlRaw === undefined && mergedImage) {
        updates["alumniProfile.memoryPosts.$[p].imageUrl"] = mergedImage;
      }
    } else if (statusIntent && statusIntent !== "") {
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "NO_UPDATES" }, { status: 400 });
    }

    const res = await User.updateOne(
      { _id: uid },
      { $set: updates },
      { arrayFilters: [{ "p._id": postOid }] }
    );

    if (res.modifiedCount === 0 && res.matchedCount === 0) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/alumni/memories/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteCtx) {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;

  const { id: memoryPostId } = await ctx.params;
  if (!mongoose.isValidObjectId(memoryPostId)) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  try {
    await connectDB();
    const uid = new mongoose.Types.ObjectId(gate.userId);
    const postOid = new mongoose.Types.ObjectId(memoryPostId);

    const owner = await User.findOne({
      _id: uid,
      "alumniProfile.memoryPosts._id": postOid,
    })
      .select("alumniProfile.memoryPosts")
      .lean();

    const posts = ((owner as { alumniProfile?: { memoryPosts?: { _id: mongoose.Types.ObjectId; status?: string }[] } })
      ?.alumniProfile?.memoryPosts || []) as { _id: mongoose.Types.ObjectId; status?: string }[];
    const hit = posts.find((p) => String(p._id) === String(postOid));
    if (!hit) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (!editableStatuses.has(String(hit.status || "pending"))) {
      return NextResponse.json({ error: "NOT_DELETABLE" }, { status: 409 });
    }

    const res = await User.updateOne(
      { _id: uid },
      { $pull: { "alumniProfile.memoryPosts": { _id: postOid } } }
    );

    if (res.modifiedCount === 0) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/alumni/memories/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
