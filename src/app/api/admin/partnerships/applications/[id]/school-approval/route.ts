import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  approveInstitutionEvaluationForSchool,
  rejectInstitutionEvaluationForSchool,
} from "@/lib/partnerships/institution-school-approval-service";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  const role = String(gate.user.role || "");
  if (role !== "partnershipSupervisor" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const applicationId = String(params.id || "").trim();
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action || "").trim();
  const actorName = String(gate.user.fullNameAr || gate.user.fullName || gate.user.email || "");

  try {
    if (action === "approve") {
      const result = await approveInstitutionEvaluationForSchool({
        applicationId,
        reviewerId: gate.user._id as mongoose.Types.ObjectId,
        actorName,
        note: String(body.note || "").trim() || undefined,
        request,
      });
      return NextResponse.json({ ok: true, result });
    }

    if (action === "reject") {
      const note = String(body.note || "").trim();
      if (!note) return NextResponse.json({ error: "Rejection note is required" }, { status: 400 });
      await rejectInstitutionEvaluationForSchool({
        applicationId,
        reviewerId: gate.user._id as mongoose.Types.ObjectId,
        actorName,
        note,
        request,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[POST school-approval]", error);
    const msg = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
