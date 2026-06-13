import { NextRequest, NextResponse } from "next/server";
import { submitInstitutionDecision } from "@/lib/partnerships/partner-access-service";
import { logAuditEvent } from "@/lib/audit-log-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { token: string } };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const token = String(params.token || "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const applicationId = String(body.applicationId || "").trim();
    const decision = String(body.decision || "").trim();
    const notes = String(body.notes || "").trim();

    if (!applicationId || !decision) {
      return NextResponse.json({ error: "applicationId and decision are required" }, { status: 400 });
    }

    const result = await submitInstitutionDecision({
      token,
      applicationId,
      decision,
      notes: notes || undefined,
    });

    await logAuditEvent({
      actionType: "institution_review_submitted",
      entityType: "StudentTrainingApplication",
      entityId: result.applicationId,
      descriptionAr: `قرار المؤسسة: ${decision}`,
      request,
      outcome: "success",
      metadata: { decision, notes: notes || null },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    if (
      message.includes("Invalid") ||
      message.includes("not found") ||
      message.includes("scope") ||
      message.includes("expired")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[POST /api/partner-access/[token]/decision]", error);
    return jsonInternalServerError(error);
  }
}
