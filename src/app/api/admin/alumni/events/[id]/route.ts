import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniReunionEvent from "@/models/AlumniReunionEvent";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { slugifyLatin } from "@/lib/alumni/slugify";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const { id } = await ctx.params;
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
    if (body.eventType !== undefined) update.eventType = String(body.eventType || "");
    if (body.location !== undefined) update.location = sanitizeUserText(String(body.location || ""));
    if (body.meetingLink !== undefined) update.meetingLink = sanitizeUserText(String(body.meetingLink || ""));
    if (body.coverImage !== undefined) update.coverImage = sanitizeUserText(String(body.coverImage || ""));
    if (body.featured !== undefined) update.featured = body.featured === true;
    if (body.published !== undefined) update.published = body.published === true;
    if (body.startsAt !== undefined) update.startsAt = body.startsAt ? new Date(String(body.startsAt)) : null;
    if (body.endsAt !== undefined) update.endsAt = body.endsAt ? new Date(String(body.endsAt)) : null;
    if (body.publishAt !== undefined) update.publishAt = body.publishAt ? new Date(String(body.publishAt)) : null;
    if (body.expiresAt !== undefined) update.expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;

    const row = await AlumniReunionEvent.findByIdAndUpdate(id, { $set: update }, { new: true }).select("_id");
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/admin/alumni/events/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
