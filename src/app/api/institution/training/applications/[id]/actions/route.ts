import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  createApplicationRequirement,
  createTrainingAssessment,
  scheduleTrainingInterview,
  submitInstitutionCompletionEvaluation,
  updateTrainingInterview,
} from "@/lib/partnerships/institution-experience-service";
import { requireTrainingInstitution } from "@/lib/partnerships/partnerships-institution-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const organizationId = gate.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ error: "Institution organization not linked" }, { status: 403 });
  }

  const applicationId = String(params.id || "").trim();
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action || "").trim();
  const actorName = String(
    gate.user.fullNameAr || gate.user.fullName || gate.organization?.name || gate.user.email || ""
  ).trim();
  const actor = { id: String(gate.user._id), name: actorName };

  try {
    if (action === "create_requirement") {
      const result = await createApplicationRequirement({
        applicationId,
        organizationId,
        title: String(body.title || ""),
        description: String(body.description || ""),
        required: body.required !== false,
        fileTypes: Array.isArray(body.fileTypes) ? body.fileTypes.map(String) : [],
        dueDate: body.dueDate ? String(body.dueDate) : undefined,
        actor,
        request,
      });
      if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
      return NextResponse.json({ ok: true, id: result.id });
    }

    if (action === "schedule_interview") {
      const result = await scheduleTrainingInterview({
        applicationId,
        organizationId,
        scheduledAt: String(body.scheduledAt || ""),
        location: String(body.location || ""),
        meetingUrl: String(body.meetingUrl || ""),
        notes: String(body.notes || ""),
        actor,
        request,
      });
      if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
      return NextResponse.json({ ok: true, id: result.id });
    }

    if (action === "update_interview") {
      const result = await updateTrainingInterview({
        interviewId: String(body.interviewId || ""),
        organizationId,
        scheduledAt: body.scheduledAt ? String(body.scheduledAt) : undefined,
        location: body.location !== undefined ? String(body.location) : undefined,
        meetingUrl: body.meetingUrl !== undefined ? String(body.meetingUrl) : undefined,
        notes: body.notes !== undefined ? String(body.notes) : undefined,
        status: body.status as "scheduled" | "completed" | "cancelled" | "rescheduled" | undefined,
        actor,
        request,
      });
      if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === "create_assessment") {
      const result = await createTrainingAssessment({
        applicationId,
        organizationId,
        type: String(body.type || "upload_task") as "external_link" | "upload_task" | "questionnaire",
        title: String(body.title || ""),
        description: String(body.description || ""),
        externalUrl: String(body.externalUrl || ""),
        dueDate: body.dueDate ? String(body.dueDate) : undefined,
        actor,
        request,
      });
      if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
      return NextResponse.json({ ok: true, id: result.id });
    }

    if (action === "submit_evaluation") {
      const result = await submitInstitutionCompletionEvaluation({
        applicationId,
        organizationId,
        commitment: Number(body.commitment),
        attendance: Number(body.attendance),
        discipline: Number(body.discipline),
        communication: Number(body.communication),
        teamwork: Number(body.teamwork),
        technicalSkills: Number(body.technicalSkills),
        professionalSkills: Number(body.professionalSkills),
        strengths: String(body.strengths || ""),
        improvementAreas: String(body.improvementAreas || ""),
        finalRecommendation: String(body.finalRecommendation || "good") as
          | "excellent"
          | "very_good"
          | "good"
          | "acceptable"
          | "not_recommended",
        institutionNotes: String(body.institutionNotes || ""),
        actor,
        request,
      });
      if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
      return NextResponse.json({ ok: true, id: result.id });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[POST /api/institution/training/applications/[id]/actions]", error);
    return jsonInternalServerError(error);
  }
}
