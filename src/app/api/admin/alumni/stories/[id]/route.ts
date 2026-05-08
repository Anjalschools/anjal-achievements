import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniStory from "@/models/AlumniStory";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";

type RouteParams = { params: { id: string } };

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const id = String(params.id || "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = sanitizeUserText(String(body.title || ""));
    if (body.excerpt !== undefined) updates.excerpt = sanitizeUserText(String(body.excerpt || "")) || undefined;
    if (body.content !== undefined) updates.content = sanitizeUserText(String(body.content || "")) || undefined;
    if (body.coverImage !== undefined) updates.coverImage = sanitizeUserText(String(body.coverImage || "")) || undefined;
    if (body.graduationYear !== undefined) updates.graduationYear = Number(body.graduationYear) || undefined;
    if (body.universityName !== undefined) updates.universityName = sanitizeUserText(String(body.universityName || "")) || undefined;
    if (body.currentCompany !== undefined) updates.currentCompany = sanitizeUserText(String(body.currentCompany || "")) || undefined;
    if (body.currentPosition !== undefined) updates.currentPosition = sanitizeUserText(String(body.currentPosition || "")) || undefined;
    if (body.seoTitle !== undefined) updates.seoTitle = sanitizeUserText(String(body.seoTitle || "")) || undefined;
    if (body.seoDescription !== undefined) updates.seoDescription = sanitizeUserText(String(body.seoDescription || "")) || undefined;
    if (body.featured !== undefined) updates.featured = body.featured === true;
    if (body.published !== undefined) {
      updates.published = body.published === true;
      updates.publishedAt = body.published === true ? new Date() : null;
    }

    await connectDB();
    const row = await AlumniStory.findByIdAndUpdate(id, { $set: updates }, { new: true })
      .select("_id")
      .lean();
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/admin/alumni/stories/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
