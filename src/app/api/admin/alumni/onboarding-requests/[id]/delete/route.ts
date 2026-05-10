import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniOnboardingRequest from "@/models/AlumniOnboardingRequest";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import { clearAlumniIntelCache } from "@/lib/alumni/alumni-intelligence-cache";
import type { IUser } from "@/models/User";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  try {
    const { id } = await ctx.params;
    const rawId = String(id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(rawId)) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const body = sanitizeMongoShape((await request.json().catch(() => ({}))) as Record<string, unknown>);
    if (body.confirm !== true) {
      return NextResponse.json({ ok: false, error: "CONFIRM_REQUIRED" }, { status: 400 });
    }

    await connectDB();

    const row = await AlumniOnboardingRequest.findById(rawId).lean();
    if (!row) {
      return NextResponse.json({ ok: true, mode: "request_delete" as const });
    }

    const hasUser = Boolean(row.userId);
    if (row.status === "approved" && hasUser) {
      return NextResponse.json({ ok: false, error: "USE_PERMANENT_DELETE" }, { status: 400 });
    }

    const oid = new mongoose.Types.ObjectId(rawId);
    const del = await AlumniOnboardingRequest.deleteOne({ _id: oid });
    if (del.deletedCount === 0) {
      return NextResponse.json({ ok: true, mode: "request_delete" as const });
    }

    clearAlumniIntelCache();

    await logAuditEvent({
      actionType: "alumni_onboarding_request_deleted",
      entityType: "AlumniOnboardingRequest",
      entityId: rawId,
      entityTitle: String(row.fullName || ""),
      descriptionAr: "حذف طلب انضمام خريج (سجل الطلب فقط — بدون حذف مستخدم)",
      metadata: {
        email: String(row.email || ""),
        status: row.status,
        hadUserId: hasUser,
      },
      actor: actorFromUser(gate.user as IUser),
      request,
      outcome: "success",
    });

    return NextResponse.json({ ok: true, mode: "request_delete" as const });
  } catch (e) {
    console.error("[POST /api/admin/alumni/onboarding-requests/[id]/delete]", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
