import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { decodeAlumniMemoryAdminId } from "@/lib/alumni/memory-admin-id";
import { isAllowedAlumniMemoryImageUrl } from "@/lib/alumni/alumni-memory-url";
import { alumniDebugLog } from "@/lib/alumni/alumni-debug-log";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  const { id: rawId } = await ctx.params;
  const ids = decodeAlumniMemoryAdminId(rawId);
  if (!ids) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  try {
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const status = body.status != null ? String(body.status).trim() : undefined;
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

    const updates: Record<string, unknown> = {};
    if (status === "pending" || status === "approved" || status === "rejected" || status === "draft") {
      updates["alumniProfile.memoryPosts.$[p].status"] = status;
      updates["alumniProfile.memoryPosts.$[p].reviewedAt"] = new Date();
    } else if (status !== undefined && status !== "") {
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    }
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

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "NO_UPDATES" }, { status: 400 });
    }

    await connectDB();
    const userOid = new mongoose.Types.ObjectId(ids.userId);
    const postOid = new mongoose.Types.ObjectId(ids.memoryPostId);

    const res = await User.updateOne(
      { _id: userOid },
      { $set: updates },
      { arrayFilters: [{ "p._id": postOid }] }
    );

    if (res.matchedCount === 0) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    alumniDebugLog("admin-memory-patch", { userId: ids.userId, memoryPostId: ids.memoryPostId });
    return NextResponse.json({ ok: true, success: true });
  } catch (error) {
    console.error("[PATCH /api/admin/alumni/memories/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteCtx) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  const { id: rawId } = await ctx.params;
  const ids = decodeAlumniMemoryAdminId(rawId);
  if (!ids) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  try {
    await connectDB();
    const userOid = new mongoose.Types.ObjectId(ids.userId);
    const postOid = new mongoose.Types.ObjectId(ids.memoryPostId);

    const res = await User.updateOne(
      { _id: userOid },
      { $pull: { "alumniProfile.memoryPosts": { _id: postOid } } }
    );

    if (res.matchedCount === 0) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    alumniDebugLog("admin-memory-delete", { userId: ids.userId, memoryPostId: ids.memoryPostId });
    return NextResponse.json({ ok: true, success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/alumni/memories/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
