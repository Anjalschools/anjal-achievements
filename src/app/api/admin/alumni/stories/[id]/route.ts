import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniStory from "@/models/AlumniStory";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { invalidateAlumniSummaryCache } from "@/lib/alumni/alumni-public-cache";
import {
  alumniStoryContentEmptyIssue,
  alumniStoryTitleRequiredIssue,
} from "@/lib/alumni/alumni-story-field-issues";
import {
  alumniStoryBodyHasVisibleText,
  normalizeAlumniStoryBody,
  stripHtmlNoiseForEmptyCheck,
} from "@/lib/alumni/alumni-story-input";

type RouteParams = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function DELETE(_request: NextRequest, ctx: RouteParams) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;
  try {
    const { id: rawId } = await ctx.params;
    const id = String(rawId || "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }
    await connectDB();
    const res = await AlumniStory.deleteOne({ _id: id });
    if (res.deletedCount === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    invalidateAlumniSummaryCache("admin:alumni-story:delete");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/admin/alumni/stories/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteParams) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;
  try {
    const { id: rawId } = await ctx.params;
    const id = String(rawId || "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) {
      const tNorm = normalizeAlumniStoryBody(stripHtmlNoiseForEmptyCheck(String(body.title || "")));
      const t2 = sanitizeUserText(tNorm).slice(0, 220);
      if (!t2 || t2.length < 2) {
        return NextResponse.json(
          {
            ok: false,
            success: false,
            error: "INVALID_INPUT",
            issues: alumniStoryTitleRequiredIssue,
          },
          { status: 400 }
        );
      }
      updates.title = t2;
    }
    if (body.excerpt !== undefined) {
      updates.excerpt = sanitizeUserText(normalizeAlumniStoryBody(String(body.excerpt || ""))) || undefined;
    }
    if (body.content !== undefined) {
      const cNorm = normalizeAlumniStoryBody(stripHtmlNoiseForEmptyCheck(String(body.content || "")));
      if (!alumniStoryBodyHasVisibleText(cNorm)) {
        return NextResponse.json(
          {
            ok: false,
            success: false,
            error: "INVALID_INPUT",
            issues: alumniStoryContentEmptyIssue,
          },
          { status: 400 }
        );
      }
      updates.content = sanitizeUserText(cNorm) || undefined;
    }
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
    invalidateAlumniSummaryCache("admin:alumni-story:patch");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/admin/alumni/stories/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
