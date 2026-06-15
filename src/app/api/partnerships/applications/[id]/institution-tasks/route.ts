import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireSession } from "@/lib/auth-guard";
import {
  listStudentApplicationRequirements,
  listStudentTrainingAssessments,
  submitApplicationRequirement,
  submitTrainingAssessment,
} from "@/lib/partnerships/institution-experience-service";
import { inferTrainingAttachmentType } from "@/lib/partnerships/training-completion-constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  if (String(gate.user.role || "") !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const applicationId = String(params.id || "").trim();
  try {
    const [requirements, assessments] = await Promise.all([
      listStudentApplicationRequirements(applicationId, String(gate.user._id)),
      listStudentTrainingAssessments(applicationId, String(gate.user._id)),
    ]);

    if (!requirements.ok) return NextResponse.json({ error: requirements.error }, { status: 403 });

    return NextResponse.json({
      ok: true,
      requirements: requirements.items,
      assessments: assessments.ok ? assessments.items : [],
    });
  } catch (error) {
    console.error("[GET /api/partnerships/applications/[id]/institution-tasks]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  if (String(gate.user.role || "") !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const applicationId = String(params.id || "").trim();
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action || "").trim();

  try {
    if (action === "submit_requirement") {
      const fileName = String(body.fileName || "").trim();
      const storageKey = String(body.storageKey || "").trim();
      const mimeType = String(body.mimeType || "").trim();
      if (!fileName || !storageKey) {
        return NextResponse.json({ error: "fileName and storageKey are required" }, { status: 400 });
      }
      const result = await submitApplicationRequirement({
        requirementId: String(body.requirementId || ""),
        studentId: String(gate.user._id),
        attachment: {
          type: inferTrainingAttachmentType(fileName, mimeType),
          fileName,
          storageKey,
          mimeType: mimeType || undefined,
          storageProvider: body.storageProvider === "r2" || body.storageProvider === "cloudinary"
            ? body.storageProvider
            : "r2",
        },
        request,
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === "submit_assessment") {
      const fileName = String(body.fileName || "").trim();
      const storageKey = String(body.storageKey || "").trim();
      const mimeType = String(body.mimeType || "").trim();
      const result = await submitTrainingAssessment({
        assessmentId: String(body.assessmentId || ""),
        studentId: String(gate.user._id),
        submissionNotes: String(body.submissionNotes || ""),
        attachment:
          fileName && storageKey
            ? {
                type: inferTrainingAttachmentType(fileName, mimeType),
                fileName,
                storageKey,
              }
            : undefined,
        request,
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[POST /api/partnerships/applications/[id]/institution-tasks]", error);
    return jsonInternalServerError(error);
  }
}
