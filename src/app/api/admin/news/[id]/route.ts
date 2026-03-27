import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import connectDB from "@/lib/mongodb";
import NewsPost from "@/models/NewsPost";
import { serializeNewsPost } from "@/lib/news-serialize";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import type { IUser } from "@/models/User";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";

const editableStatuses = new Set([
  "draft",
  "pending_review",
  "approved",
  "scheduled",
  "failed",
  "published",
]);

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await NewsPost.findById(id).lean();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, item: serializeNewsPost(doc as unknown as Record<string, unknown>) });
  } catch (e) {
    console.error("[GET /api/admin/news/[id]]", e);
    return jsonInternalServerError(e);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    await connectDB();
    const doc = await NewsPost.findById(id);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (doc.status === "published" && body.status !== undefined && body.status !== "published") {
      return NextResponse.json({ error: "لا يمكن تغيير حالة الخبر من منشور إلى غير منشور من هنا" }, { status: 400 });
    }
    if (!editableStatuses.has(String(doc.status))) {
      return NextResponse.json({ error: "حالة غير قابلة للتعديل" }, { status: 400 });
    }

    const before = { status: doc.status, title: doc.title };
    const set: Record<string, unknown> = {};

    const str = (k: string) => (body[k] !== undefined ? String(body[k]) : undefined);
    if (body.title !== undefined) set.title = String(body.title).trim() || doc.title;
    if (body.subtitle !== undefined) set.subtitle = str("subtitle");
    if (body.locale !== undefined) set.locale = body.locale;
    if (body.tone !== undefined) set.tone = str("tone");
    if (body.audience !== undefined) set.audience = str("audience");
    if (body.category !== undefined) set.category = str("category");
    if (body.schoolSection !== undefined) set.schoolSection = str("schoolSection");
    if (body.namesOrEntities !== undefined) set.namesOrEntities = str("namesOrEntities");
    if (body.summary !== undefined) set.summary = str("summary");
    if (body.rawNotes !== undefined) set.rawNotes = str("rawNotes");
    if (body.eventDate !== undefined) set.eventDate = body.eventDate ? new Date(String(body.eventDate)) : null;
    if (body.location !== undefined) set.location = str("location");
    if (body.websiteBody !== undefined) set.websiteBody = str("websiteBody");
    if (body.instagramCaption !== undefined) set.instagramCaption = str("instagramCaption");
    if (body.xPostText !== undefined) set.xPostText = str("xPostText");
    if (body.snapchatText !== undefined) set.snapchatText = str("snapchatText");
    if (body.tiktokCaption !== undefined) set.tiktokCaption = str("tiktokCaption");
    if (body.bilingualBody !== undefined) set.bilingualBody = str("bilingualBody");
    if (body.hashtags !== undefined) set.hashtags = Array.isArray(body.hashtags) ? body.hashtags.map(String) : [];
    if (body.coverImage !== undefined) set.coverImage = str("coverImage");
    if (body.attachments !== undefined) set.attachments = Array.isArray(body.attachments) ? body.attachments.map(String) : [];
    if (body.publishTargets !== undefined)
      set.publishTargets = Array.isArray(body.publishTargets) ? body.publishTargets.map(String) : [];
    if (body.sourceType !== undefined) set.sourceType = str("sourceType");
    if (body.sourceIds !== undefined && Array.isArray(body.sourceIds)) {
      set.sourceIds = body.sourceIds
        .map((x) => {
          const s = String(x);
          return mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : null;
        })
        .filter((x): x is mongoose.Types.ObjectId => x !== null);
    }

    Object.assign(doc, set);
    await doc.save();

    await logAuditEvent({
      actionType: "news_post_updated",
      entityType: "news_post",
      entityId: id,
      entityTitle: doc.title,
      descriptionAr: "تم تحديث الخبر",
      before,
      after: { status: doc.status, title: doc.title },
      outcome: "success",
      actor: actorFromUser(gate.user as IUser),
      request,
    });

    return NextResponse.json({ ok: true, item: serializeNewsPost(doc.toObject()) });
  } catch (e) {
    console.error("[PATCH /api/admin/news/[id]]", e);
    return jsonInternalServerError(e);
  }
}
