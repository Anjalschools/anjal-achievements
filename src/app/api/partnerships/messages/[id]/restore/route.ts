import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireSession } from "@/lib/auth-guard";
import { restorePartnershipMessage } from "@/lib/partnerships/partnership-message-mutation-service";
import { requirePartnershipsView, requireStudentApplicant } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const messageId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return NextResponse.json({ error: "Invalid message id" }, { status: 400 });
  }

  const role = String(gate.user.role || "");
  if (role === "student") {
    const studentGate = await requireStudentApplicant();
    if (!studentGate.ok) return studentGate.response;
  } else if (role !== "trainingInstitution") {
    const viewGate = await requirePartnershipsView();
    if (!viewGate.ok) return viewGate.response;
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const message = await restorePartnershipMessage({
      messageId,
      userId: gate.user._id,
      role,
    });
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    const status =
      message === "Forbidden"
        ? 403
        : message === "Message not found"
          ? 404
          : message.includes("expired") || message.includes("not deleted")
            ? 400
            : 500;
    if (status === 500) console.error("[POST /api/partnerships/messages/[id]/restore]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
