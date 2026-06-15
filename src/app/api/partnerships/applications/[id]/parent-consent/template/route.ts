import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireSession } from "@/lib/auth-guard";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import {
  ensureParentConsentGeneratedTemplate,
  recordParentConsentTemplateDownload,
} from "@/lib/partnerships/parent-consent-template-service";
import { getParentConsentRequirement } from "@/lib/partnerships/parent-consent-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  if (String(gate.user.role || "") !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const applicationId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const application = await StudentTrainingApplication.findById(applicationId).select("studentId").lean();
    if (!application || String(application.studentId) !== String(gate.user._id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requirement = await getParentConsentRequirement(applicationId);
    if (!requirement) {
      return NextResponse.json({ error: "Parent consent not required" }, { status: 404 });
    }

    const actorName = String(gate.user.fullNameAr || gate.user.fullName || gate.user.email || "").trim();
    const generated = await ensureParentConsentGeneratedTemplate({
      requirementId: String(requirement._id),
      applicationId,
      studentId: String(gate.user._id),
      actor: { id: String(gate.user._id), name: actorName, role: "student" },
      request,
    });
    if (!generated?.storageKey) {
      return NextResponse.json({ error: "Could not generate template" }, { status: 500 });
    }

    await recordParentConsentTemplateDownload({
      applicationId,
      requirementId: String(requirement._id),
      actor: { id: String(gate.user._id), name: actorName, role: "student" },
      request,
    });

    return NextResponse.json({
      ok: true,
      downloadUrl: generated.storageKey,
      fileName: generated.fileName,
    });
  } catch (error) {
    console.error("[GET /api/partnerships/applications/[id]/parent-consent/template]", error);
    return jsonInternalServerError(error);
  }
}
