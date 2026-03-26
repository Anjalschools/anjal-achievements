import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import connectDB from "@/lib/mongodb";
import NewsPost from "@/models/NewsPost";
import { draftSlugForId } from "@/lib/news-service";
import { serializeNewsPost } from "@/lib/news-serialize";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import type { IUser } from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10) || 20));
    const skip = (page - 1) * limit;
    const status = String(sp.get("status") || "").trim();

    const q: Record<string, unknown> = {};
    if (status) q.status = status;

    const total = await NewsPost.countDocuments(q);
    const rows = await NewsPost.find(q).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean();

    return NextResponse.json({
      ok: true,
      items: rows.map((r) => serializeNewsPost(r as unknown as Record<string, unknown>)),
      total,
      page,
      limit,
    });
  } catch (e) {
    console.error("[GET /api/admin/news]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    await connectDB();

    const id = new mongoose.Types.ObjectId();
    const title = String(body.title || "").trim() || "مسودة خبر";
    const sourceType = String(body.sourceType || "manual");
    const sourceIdsRaw = body.sourceIds;
    const sourceIds = Array.isArray(sourceIdsRaw)
      ? sourceIdsRaw
          .map((x) => {
            const s = String(x);
            return mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : null;
          })
          .filter((x): x is mongoose.Types.ObjectId => x !== null)
      : [];

    const doc = await NewsPost.create({
      _id: id,
      title,
      subtitle: body.subtitle ? String(body.subtitle) : undefined,
      slug: draftSlugForId(id.toString()),
      sourceType,
      sourceIds,
      locale: (body.locale as "ar" | "en" | "bilingual") || "ar",
      tone: body.tone ? String(body.tone) : undefined,
      audience: body.audience ? String(body.audience) : undefined,
      category: body.category ? String(body.category) : undefined,
      schoolSection: body.schoolSection ? String(body.schoolSection) : undefined,
      namesOrEntities: body.namesOrEntities ? String(body.namesOrEntities) : undefined,
      summary: body.summary ? String(body.summary) : undefined,
      rawNotes: body.rawNotes ? String(body.rawNotes) : undefined,
      eventDate: body.eventDate ? new Date(String(body.eventDate)) : undefined,
      location: body.location ? String(body.location) : undefined,
      hashtags: Array.isArray(body.hashtags) ? body.hashtags.map(String) : [],
      coverImage: body.coverImage ? String(body.coverImage) : undefined,
      attachments: Array.isArray(body.attachments) ? body.attachments.map(String) : [],
      status: "draft",
      publishTargets: [],
      publishResults: [],
      createdBy: gate.user._id,
    });

    await logAuditEvent({
      actionType: "news_post_created",
      entityType: "news_post",
      entityId: doc._id.toString(),
      entityTitle: title,
      descriptionAr: "تم إنشاء مسودة خبر",
      outcome: "success",
      actor: actorFromUser(gate.user as IUser),
      request,
    });

    return NextResponse.json({ ok: true, item: serializeNewsPost(doc.toObject()) });
  } catch (e) {
    console.error("[POST /api/admin/news]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
