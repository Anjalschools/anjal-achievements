import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  generateInstitutionAnnualReview,
  getInstitutionAnnualReview,
} from "@/lib/partnerships/institution-performance-intelligence-service";
import { requirePartnershipsManage } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsManage();
  if (!gate.ok) return gate.response;

  const organizationId = String(params.id || "").trim();
  const academicYearLabel = request.nextUrl.searchParams.get("academicYearLabel") || undefined;

  try {
    const review = await getInstitutionAnnualReview(organizationId, academicYearLabel);
    return NextResponse.json({ ok: true, review });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/organizations/[id]/annual-review]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsManage();
  if (!gate.ok) return gate.response;

  const organizationId = String(params.id || "").trim();

  try {
    const review = await generateInstitutionAnnualReview(organizationId, {
      generatedBy: String(gate.user._id),
    });
    return NextResponse.json({ ok: true, review });
  } catch (error) {
    console.error("[POST /api/admin/partnerships/organizations/[id]/annual-review]", error);
    return jsonInternalServerError(error);
  }
}
