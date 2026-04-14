import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LetterRequest from "@/models/LetterRequest";
import { requireLetterRequestStaff } from "@/lib/letter-request-auth";
import { letterRequestVisibleToStaff } from "@/lib/letter-request-scope";
import { appendLetterStatusHistory } from "@/lib/letter-request-service";
import { serializeLetterRequest } from "@/lib/letter-request-api-serialize";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string }> };

/** Revoke approval: approved → in_review, clears verify token and approval metadata; keeps letter text. */
export async function POST(_request: NextRequest, context: Ctx) {
  const gate = await requireLetterRequestStaff();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(gate.user.role, "approveRejectWorkflow")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    if (doc.status !== "approved") {
      return NextResponse.json({ error: "Not approved" }, { status: 409 });
    }

    const prev = doc.status;
    doc.status = "in_review";
    doc.approvedAt = undefined;
    doc.approvedBy = undefined;
    doc.verificationToken = undefined;
    await appendLetterStatusHistory(
      doc,
      gate.user as import("@/models/User").IUser,
      "unapprove",
      prev,
      "in_review",
      "Approval revoked to allow edits"
    );
    await doc.save();

    return NextResponse.json({ ok: true, item: serializeLetterRequest(doc.toObject(), "admin") });
  } catch (e) {
    console.error("[POST /api/admin/letter-requests/[id]/unapprove]", e);
    return jsonInternalServerError(e);
  }
}
