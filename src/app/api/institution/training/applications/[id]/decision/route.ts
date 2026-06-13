import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { executeInstitutionReviewDecision } from "@/lib/partnerships/institution-portal-service";
import { requireTrainingInstitution } from "@/lib/partnerships/partnerships-institution-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

const VALID_ACTIONS = new Set(["accept", "reject", "interview"]);

export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const applicationId = String(params.id || "").trim();
  if (!applicationId) {
    return NextResponse.json({ error: "Application id is required" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "").trim();
    const notes = String(body.notes || "").trim();
    const rejectionReason = String(body.rejectionReason || "").trim();

    if (!VALID_ACTIONS.has(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const organizationId = gate.organization?.id;
    if (!organizationId) {
      return NextResponse.json({ error: "Institution organization not linked" }, { status: 403 });
    }

    const actorName = String(
      gate.user.fullNameAr || gate.user.fullName || gate.organization?.name || gate.user.email || ""
    ).trim();

    const result = await executeInstitutionReviewDecision({
      applicationId,
      organizationId,
      action: action as "accept" | "reject" | "interview",
      notes: notes || undefined,
      rejectionReason: rejectionReason || undefined,
      actorName,
      actorId: String(gate.user._id),
      request: request,
    });

    if (!result.ok) {
      const status =
        result.code === "forbidden"
          ? 403
          : result.code === "seats_full"
            ? 409
            : result.code === "rejection_reason_required"
              ? 400
              : 400;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/institution/training/applications/[id]/decision]", error);
    return jsonInternalServerError(error);
  }
}
