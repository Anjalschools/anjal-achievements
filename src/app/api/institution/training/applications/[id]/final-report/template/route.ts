import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { resolveInstitutionOrganizationForUser } from "@/lib/partnerships/institution-portal-service";
import { generateInstitutionFinalReportTemplate } from "@/lib/partnerships/training-final-institution-evaluation-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { requireSession } = await import("@/lib/auth-guard");
    const gate = await requireSession();
    if (!gate.ok) return gate.response;

    const applicationId = String(params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const org = await resolveInstitutionOrganizationForUser(String(gate.user._id));
    if (!org?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await generateInstitutionFinalReportTemplate(
      applicationId,
      org.id,
      body
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
    }

    return NextResponse.json({ ok: true, storageKey: result.storageKey, downloadUrl: result.storageKey });
  } catch (error) {
    console.error("[POST final-report/template]", error);
    return jsonInternalServerError(error);
  }
}
