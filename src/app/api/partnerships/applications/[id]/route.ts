import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import PartnerOrganization from "@/models/PartnerOrganization";
import { actorFromUser } from "@/lib/audit-log-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { serializeTrainingApplication } from "@/lib/partnerships/partnerships-application-serialize";
import { requireStudentApplicant } from "@/lib/partnerships/partnerships-auth";
import {
  loadStudentApplicationForOpportunity,
  updateStudentTrainingApplicationContent,
  withdrawStudentTrainingApplication,
} from "@/lib/partnerships/partnerships-student-application-service";
import { resolveStudentInstitutionContactView } from "@/lib/partnerships/institution-contact-access-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

const loadOwnedApplication = async (applicationId: string, studentId: mongoose.Types.ObjectId) => {
  await connectDB();
  const application = await StudentTrainingApplication.findOne({
    _id: applicationId,
    studentId,
    archived: { $ne: true },
  }).lean();
  if (!application) return null;

  const opportunity = await TrainingOpportunity.findById(application.opportunityId).lean();
  const organization = opportunity
    ? await PartnerOrganization.findById(opportunity.organizationId).lean()
    : null;

  return await serializeTrainingApplication(application, {
    opportunityTitle: opportunity?.title,
    organizationName: organization?.name,
  });
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireStudentApplicant();
  if (!gate.ok) return gate.response;

  const id = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const item = await loadOwnedApplication(id, gate.user._id);
    if (!item) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    const institutionContact = await resolveStudentInstitutionContactView(id, String(gate.user._id));
    return NextResponse.json({ ok: true, item, institutionContact });
  } catch (error) {
    console.error("[GET /api/partnerships/applications/[id]]", error);
    return jsonInternalServerError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requireStudentApplicant();
  if (!gate.ok) return gate.response;

  const id = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "").trim();
    const actorName = String(gate.user.fullNameAr || gate.user.fullName || gate.user.email || "").trim();
    const actor = actorFromUser(gate.user);

    if (action === "withdraw") {
      await withdrawStudentTrainingApplication({
        applicationId: id,
        studentId: gate.user._id,
        actorName,
        actor,
        request,
      });
    } else {
      await updateStudentTrainingApplicationContent({
        applicationId: id,
        studentId: gate.user._id,
        studentNotes: body.studentNotes !== undefined ? String(body.studentNotes) : undefined,
        applicationMessage:
          body.applicationMessage !== undefined ? String(body.applicationMessage) : undefined,
        actorName,
        actor,
        request,
      });
    }

    const item = await loadOwnedApplication(id, gate.user._id);
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    if (
      message.includes("not found") ||
      message.includes("cannot") ||
      message.includes("No editable") ||
      message.includes("Invalid transition")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[PATCH /api/partnerships/applications/[id]]", error);
    return jsonInternalServerError(error);
  }
}
