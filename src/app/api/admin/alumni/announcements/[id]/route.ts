import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniAnnouncement from "@/models/AlumniAnnouncement";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { slugifyLatin } from "@/lib/alumni/slugify";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    await connectDB();

    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = sanitizeUserText(String(body.title || ""));
    if (body.slug !== undefined) update.slug = slugifyLatin(sanitizeUserText(String(body.slug || "")));
    if (body.summary !== undefined) update.summary = sanitizeUserText(String(body.summary || ""));
    if (body.content !== undefined) update.content = sanitizeUserText(String(body.content || ""));
    if (body.category !== undefined) update.category = sanitizeUserText(String(body.category || ""));
    if (body.coverImage !== undefined) update.coverImage = sanitizeUserText(String(body.coverImage || ""));
    if (body.featured !== undefined) update.featured = body.featured === true;
    if (body.pinned !== undefined) update.pinned = body.pinned === true;
    if (body.published !== undefined) update.published = body.published === true;
    if (body.publishAt !== undefined) {
      update.publishAt = body.publishAt ? new Date(String(body.publishAt)) : null;
    }
    if (body.expiresAt !== undefined) {
      update.expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;
    }
    if (Array.isArray(body.targetCohorts)) {
      update.targetCohorts = (body.targetCohorts as unknown[])
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n));
    }

    const row = await AlumniAnnouncement.findByIdAndUpdate(id, { $set: update }, { new: true }).select("_id");
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/admin/alumni/announcements/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
