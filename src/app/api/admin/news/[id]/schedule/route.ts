import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import connectDB from "@/lib/mongodb";
import NewsPost from "@/models/NewsPost";
import { serializeNewsPost } from "@/lib/news-serialize";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import type { IUser } from "@/models/User";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { scheduledFor?: string };
    const when = body.scheduledFor ? new Date(String(body.scheduledFor)) : null;
    if (!when || Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: "تاريخ الجدولة غير صالح" }, { status: 400 });
    }
    if (when.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: "يجب أن يكون وقت الجدولة في المستقبل" }, { status: 400 });
    }

    await connectDB();
    const doc = await NewsPost.findById(id);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (String(doc.status) !== "approved") {
      return NextResponse.json({ error: "يجب اعتماد الخبر قبل الجدولة" }, { status: 400 });
    }

    doc.status = "scheduled";
    doc.scheduledFor = when;
    await doc.save();

    await logAuditEvent({
      actionType: "news_scheduled",
      entityType: "news_post",
      entityId: id,
      entityTitle: doc.title,
      descriptionAr: `جدولة النشر: ${when.toISOString()}`,
      outcome: "success",
      actor: actorFromUser(gate.user as IUser),
      request,
      metadata: { scheduledFor: when.toISOString() },
    });

    return NextResponse.json({ ok: true, item: serializeNewsPost(doc.toObject()) });
  } catch (e) {
    console.error("[POST schedule]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
