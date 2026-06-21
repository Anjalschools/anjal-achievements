import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { restorePartnershipMessage } from "@/lib/partnerships/partnership-message-mutation-service";
import { requireTrainingInstitution } from "@/lib/partnerships/partnerships-institution-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const messageId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return NextResponse.json({ error: "Invalid message id" }, { status: 400 });
  }

  try {
    const message = await restorePartnershipMessage({
      messageId,
      userId: gate.user._id,
      role: "trainingInstitution",
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
    if (status === 500) console.error("[POST /api/institution/training/messages/[id]/restore]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
