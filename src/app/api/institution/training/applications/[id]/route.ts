import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { getInstitutionApplicationDetail } from "@/lib/partnerships/institution-portal-service";
import { requireTrainingInstitution } from "@/lib/partnerships/partnerships-institution-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const organizationId = gate.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ error: "Institution organization not linked" }, { status: 403 });
  }

  const applicationId = String(params.id || "").trim();
  if (!applicationId) {
    return NextResponse.json({ error: "Application id is required" }, { status: 400 });
  }

  try {
    const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "ar";
    const detail = await getInstitutionApplicationDetail(applicationId, organizationId, locale);
    if (!detail) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, application: detail });
  } catch (error) {
    console.error("[GET /api/institution/training/applications/[id]]", error);
    return jsonInternalServerError(error);
  }
}
