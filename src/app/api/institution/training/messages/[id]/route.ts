import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  editPartnershipMessage,
  restorePartnershipMessage,
  softDeletePartnershipMessage,
} from "@/lib/partnerships/partnership-message-mutation-service";
import { requireTrainingInstitution } from "@/lib/partnerships/partnerships-institution-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

const mapMutationError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Error";
  if (message === "Forbidden") return { status: 403, message };
  if (message === "Message not found" || message === "Thread not found") {
    return { status: 404, message };
  }
  if (
    message.includes("required") ||
    message.includes("Invalid") ||
    message.includes("Cannot edit") ||
    message.includes("not deleted") ||
    message.includes("expired")
  ) {
    return { status: 400, message };
  }
  return { status: 500, message };
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const messageId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return NextResponse.json({ error: "Invalid message id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const message = await editPartnershipMessage({
      messageId,
      userId: gate.user._id,
      role: "trainingInstitution",
      body: String(body.body || ""),
    });
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const mapped = mapMutationError(error);
    if (mapped.status === 500) console.error("[PATCH /api/institution/training/messages/[id]]", error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const messageId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return NextResponse.json({ error: "Invalid message id" }, { status: 400 });
  }

  try {
    const message = await softDeletePartnershipMessage({
      messageId,
      userId: gate.user._id,
      role: "trainingInstitution",
    });
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const mapped = mapMutationError(error);
    if (mapped.status === 500) console.error("[DELETE /api/institution/training/messages/[id]]", error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
