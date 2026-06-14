import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  addInstitutionPrivateNote,
  listInstitutionPrivateNotes,
} from "@/lib/partnerships/institution-candidate-pipeline-service";
import { INSTITUTION_PRIVATE_NOTE_CATEGORIES } from "@/lib/partnerships/institution-candidate-pipeline-constants";
import { requireTrainingInstitution } from "@/lib/partnerships/partnerships-institution-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const organizationId = gate.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ error: "Institution organization not linked" }, { status: 403 });
  }

  try {
    const result = await listInstitutionPrivateNotes(String(params.id), organizationId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, items: result.items });
  } catch (error) {
    console.error("[GET /api/institution/training/applications/[id]/notes]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const organizationId = gate.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ error: "Institution organization not linked" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const categoryRaw = String(body.category || "general").trim();
    const category = INSTITUTION_PRIVATE_NOTE_CATEGORIES.includes(
      categoryRaw as (typeof INSTITUTION_PRIVATE_NOTE_CATEGORIES)[number]
    )
      ? (categoryRaw as (typeof INSTITUTION_PRIVATE_NOTE_CATEGORIES)[number])
      : "general";

    const actorName = String(
      gate.user.fullNameAr || gate.user.fullName || gate.organization?.name || gate.user.email || ""
    ).trim();

    const result = await addInstitutionPrivateNote({
      applicationId: String(params.id),
      organizationId,
      authorId: String(gate.user._id),
      authorName: actorName,
      category,
      body: String(body.body || ""),
      request,
    });

    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    console.error("[POST /api/institution/training/applications/[id]/notes]", error);
    return jsonInternalServerError(error);
  }
}
