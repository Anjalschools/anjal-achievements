import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LetterRequest from "@/models/LetterRequest";
import { requireLetterRequestStaff } from "@/lib/letter-request-auth";
import { letterRequestVisibleToStaff } from "@/lib/letter-request-scope";
import { appendLetterStatusHistory } from "@/lib/letter-request-service";
import { serializeLetterRequest } from "@/lib/letter-request-api-serialize";
import { ALLOWED_INFERRED_FIELD_VALUES } from "@/lib/achievement-inferred-field-allowlist";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { isAiAssistEnabled } from "@/lib/openai-env";
import mongoose from "mongoose";
import User from "@/models/User";
import type { LetterRequestStatus } from "@/lib/letter-request-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  const gate = await requireLetterRequestStaff();
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const allowed = await letterRequestVisibleToStaff(id, gate.user as import("@/models/User").IUser);
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await connectDB();
    const doc = await LetterRequest.findById(id).exec();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (doc.status === "pending") {
      const prev = doc.status;
      doc.status = "in_review";
      doc.reviewedAt = new Date();
      doc.reviewedBy = gate.user._id as mongoose.Types.ObjectId;
      await appendLetterStatusHistory(
        doc,
        gate.user as import("@/models/User").IUser,
        "open_review",
        prev,
        "in_review"
      );
      await doc.save();
    }

    const u = await User.findById(doc.userId).select("fullName fullNameAr fullNameEn email studentId").lean();
    const studentUser = u
      ? {
          fullName: (u as { fullNameAr?: string }).fullNameAr || (u as { fullNameEn?: string }).fullNameEn || u.fullName,
          email: u.email,
          studentId: u.studentId,
        }
      : null;

    return NextResponse.json({
      ok: true,
      item: serializeLetterRequest(doc.toObject(), "admin"),
      studentUser,
      /** Same gate as certificate / attachment AI (`openai-env`). */
      aiAssistEnabled: isAiAssistEnabled(),
    });
  } catch (e) {
    console.error("[GET /api/admin/letter-requests/[id]]", e);
    return jsonInternalServerError(e);
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const gate = await requireLetterRequestStaff();
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const allowed = await letterRequestVisibleToStaff(id, gate.user as import("@/models/User").IUser);
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  try {
    await connectDB();
    const doc = await LetterRequest.findById(id).exec();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const prevStatus = doc.status;

    if (typeof o.targetOrganization === "string") {
      const t = o.targetOrganization.trim();
      if (t.length > 0 && t.length <= 200) doc.targetOrganization = t;
    }
    if (typeof o.requestBody === "string") {
      const t = o.requestBody.trim();
      if (t.length >= 10 && t.length <= 20000) doc.requestBody = t;
    }
    if (o.requestType === "testimonial" || o.requestType === "recommendation") {
      doc.requestType = o.requestType;
    }
    if (o.language === "ar" || o.language === "en") {
      doc.language = o.language;
    }
    if (o.requestedAuthorRole === "teacher" || o.requestedAuthorRole === "supervisor" || o.requestedAuthorRole === "school_administration") {
      doc.requestedAuthorRole = o.requestedAuthorRole;
    }
    if (typeof o.requestedSpecialization === "string") {
      const s = o.requestedSpecialization.trim();
      doc.requestedSpecialization = s || undefined;
    }
    if (typeof o.aiDraftText === "string") {
      doc.aiDraftText = o.aiDraftText;
    }
    if (typeof o.finalApprovedText === "string") {
      doc.finalApprovedText = o.finalApprovedText;
    }

    if (doc.requestedAuthorRole === "school_administration") {
      doc.requestedSpecialization = undefined;
    } else if (doc.requestedAuthorRole === "teacher" || doc.requestedAuthorRole === "supervisor") {
      const spec = doc.requestedSpecialization;
      if (!spec || !ALLOWED_INFERRED_FIELD_VALUES.has(spec)) {
        return NextResponse.json({ error: "Invalid requestedSpecialization for role" }, { status: 400 });
      }
    }

    let statusChanged = false;
    if (typeof o.status === "string") {
      const next = o.status as LetterRequestStatus;
      const allowedNext = new Set<LetterRequestStatus>(["pending", "in_review", "approved", "rejected", "needs_revision"]);
      if (allowedNext.has(next) && next !== prevStatus) {
        doc.status = next;
        statusChanged = true;
        await appendLetterStatusHistory(
          doc,
          gate.user as import("@/models/User").IUser,
          "staff_status_change",
          prevStatus,
          next,
          typeof o.statusNote === "string" ? o.statusNote : undefined
        );
      }
    }

    if (statusChanged && doc.status === "rejected") {
      doc.verificationToken = undefined;
    }

    await doc.save();
    return NextResponse.json({ ok: true, item: serializeLetterRequest(doc.toObject(), "admin") });
  } catch (e) {
    console.error("[PATCH /api/admin/letter-requests/[id]]", e);
    return jsonInternalServerError(e);
    }
}
