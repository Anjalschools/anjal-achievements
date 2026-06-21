import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireSession } from "@/lib/auth-guard";
import {
  editPartnershipMessage,
  restorePartnershipMessage,
  softDeletePartnershipMessage,
} from "@/lib/partnerships/partnership-message-mutation-service";
import { requirePartnershipsView, requireStudentApplicant } from "@/lib/partnerships/partnerships-auth";

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

const authorizeMutation = async (role: string) => {
  if (role === "student") {
    const studentGate = await requireStudentApplicant();
    if (!studentGate.ok) return studentGate;
  } else if (role === "trainingInstitution") {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  } else {
    const viewGate = await requirePartnershipsView();
    if (!viewGate.ok) return viewGate;
  }
  return { ok: true as const };
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const messageId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return NextResponse.json({ error: "Invalid message id" }, { status: 400 });
  }

  const auth = await authorizeMutation(String(gate.user.role || ""));
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const message = await editPartnershipMessage({
      messageId,
      userId: gate.user._id,
      role: String(gate.user.role || ""),
      body: String(body.body || ""),
    });
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const mapped = mapMutationError(error);
    if (mapped.status === 500) console.error("[PATCH /api/partnerships/messages/[id]]", error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const messageId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return NextResponse.json({ error: "Invalid message id" }, { status: 400 });
  }

  const auth = await authorizeMutation(String(gate.user.role || ""));
  if (!auth.ok) return auth.response;

  try {
    const message = await softDeletePartnershipMessage({
      messageId,
      userId: gate.user._id,
      role: String(gate.user.role || ""),
    });
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const mapped = mapMutationError(error);
    if (mapped.status === 500) console.error("[DELETE /api/partnerships/messages/[id]]", error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  return NextResponse.json({ error: "Use /restore endpoint" }, { status: 405 });
}
