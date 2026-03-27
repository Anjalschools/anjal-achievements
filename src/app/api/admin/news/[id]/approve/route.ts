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

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await NewsPost.findById(id);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (String(doc.status) !== "pending_review") {
      return NextResponse.json({ error: "يمكن الاعتماد فقط للخبر قيد المراجعة" }, { status: 400 });
    }

    doc.status = "approved";
    doc.approvedBy = gate.user._id;
    await doc.save();

    await logAuditEvent({
      actionType: "news_approved",
      entityType: "news_post",
      entityId: id,
      entityTitle: doc.title,
      descriptionAr: "تم اعتماد الخبر",
      outcome: "success",
      actor: actorFromUser(gate.user as IUser),
      request,
    });

    return NextResponse.json({ ok: true, item: serializeNewsPost(doc.toObject()) });
  } catch (e) {
    console.error("[POST approve]", e);
    return jsonInternalServerError(e);
  }
}
