import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  getSupervisorInstitutionFeedback,
  submitSupervisorInstitutionFeedback,
} from "@/lib/partnerships/institution-performance-intelligence-service";
import { requirePartnershipsManage } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsManage();
  if (!gate.ok) return gate.response;

  const organizationId = String(params.id || "").trim();
  try {
    const feedback = await getSupervisorInstitutionFeedback(organizationId, String(gate.user._id));
    return NextResponse.json({ ok: true, feedback });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/organizations/[id]/supervisor-feedback]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsManage();
  if (!gate.ok) return gate.response;

  const organizationId = String(params.id || "").trim();
  const body = (await request.json()) as Record<string, unknown>;

  try {
    const feedback = await submitSupervisorInstitutionFeedback({
      organizationId,
      supervisorId: String(gate.user._id),
      cooperation: Number(body.cooperation),
      commitment: Number(body.commitment),
      responseSpeed: Number(body.responseSpeed),
      reportQuality: Number(body.reportQuality),
      communication: Number(body.communication),
      notes: body.notes ? String(body.notes) : undefined,
      academicYearId: body.academicYearId ? String(body.academicYearId) : undefined,
      academicYearLabel: body.academicYearLabel ? String(body.academicYearLabel) : undefined,
    });
    return NextResponse.json({ ok: true, feedback });
  } catch (error) {
    console.error("[POST /api/admin/partnerships/organizations/[id]/supervisor-feedback]", error);
    return jsonInternalServerError(error);
  }
}
