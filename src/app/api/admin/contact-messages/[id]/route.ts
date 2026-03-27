import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import mongoose from "mongoose";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import connectDB from "@/lib/mongodb";
import ContactMessage from "@/models/ContactMessage";
import { buildContactMessagesScopeFilter } from "@/lib/contact-messages-access";
import type { IUser } from "@/models/User";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  const user = gate.user as IUser;
  if (!roleHasCapability(user.role, "contactMessages")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ ok: false, error: "Invalid message id" }, { status: 400 });
  }

  try {
    await connectDB();
    const baseScope = buildContactMessagesScopeFilter(user);
    const scopedQuery =
      Object.keys(baseScope).length > 0
        ? ({ $and: [{ _id: id }, baseScope] } as Record<string, unknown>)
        : ({ _id: id } as Record<string, unknown>);
    const existing = await ContactMessage.findOne(scopedQuery).lean();
    if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;
    const update: Record<string, unknown> = {};

    // Backward compatible + new contract:
    // UI may send: { reply, status: replied|processing|archived, assignedTo }
    // Legacy UI may send: { replyText, status: in_progress|replied|archived, assignedRole }
    const statusRaw = String(body.status || "").trim();
    const mappedStatus =
      statusRaw === "processing"
        ? "in_progress"
        : ["new", "in_progress", "replied", "archived"].includes(statusRaw)
          ? statusRaw
          : "";
    if (mappedStatus) update.status = mappedStatus;

    const assignedTo = String(body.assignedTo || body.assignedRole || "").trim();
    if (assignedTo) update.assignedRole = assignedTo;

    const reply = String(body.reply || body.replyText || "").trim();
    if (Object.prototype.hasOwnProperty.call(body, "reply") || Object.prototype.hasOwnProperty.call(body, "replyText")) {
      if (!reply) {
        return NextResponse.json({ ok: false, error: "Reply is required" }, { status: 400 });
      }
      update.replyText = reply;
      update.repliedAt = new Date();
      if (!update.status) update.status = "replied";
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: false, error: "No updates supplied" }, { status: 400 });
    }

    const updated = await ContactMessage.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (reply) {
      await logAuditEvent({
        actionType: "contact_message_replied",
        entityType: "contact_message",
        entityId: String(id),
        entityTitle: String((existing as any).subject || "").trim().slice(0, 200) || undefined,
        descriptionAr: "تم إرسال رد على رسالة تواصل وتحديث حالتها.",
        actor: actorFromUser(user as any),
        before: { status: (existing as any).status, assignedRole: (existing as any).assignedRole },
        after: { status: (updated as any)?.status, assignedRole: (updated as any)?.assignedRole, repliedAt: (updated as any)?.repliedAt },
        outcome: "success",
        platform: "website",
        request,
      });
    }
    return NextResponse.json({ ok: true, item: updated });
  } catch (error) {
    console.error("[PATCH /api/admin/contact-messages/[id]]", error);
    return jsonInternalServerError(error, { merge: { ok: false } });
  }
}
