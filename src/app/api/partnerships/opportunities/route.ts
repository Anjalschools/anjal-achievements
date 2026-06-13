import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  PARTNERSHIP_TARGET_GENDERS,
  PARTNERSHIP_TARGET_GRADE_VALUES,
  PARTNERSHIP_TARGET_STAGES,
} from "@/lib/partnerships/partnerships-constants";
import { requirePartnershipsManage, requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";
import { parseOptionalDate, serializeTrainingOpportunity } from "@/lib/partnerships/partnerships-serialize";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const asStringArray = (value: unknown, allowed: readonly string[]) => {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter((v) => allowed.includes(v));
};

const normalizeOpportunityBody = (body: Record<string, unknown>) => {
  const targetGender = String(body.targetGender || "both").trim() as (typeof PARTNERSHIP_TARGET_GENDERS)[number];
  return {
    title: String(body.title || "").trim(),
    description: body.description ? String(body.description).trim() : undefined,
    organizationId: String(body.organizationId || "").trim(),
    targetGender: PARTNERSHIP_TARGET_GENDERS.includes(targetGender) ? targetGender : "both",
    targetStages: asStringArray(body.targetStages, PARTNERSHIP_TARGET_STAGES),
    targetGrades: asStringArray(body.targetGrades, PARTNERSHIP_TARGET_GRADE_VALUES),
    seats: Math.max(0, Number(body.seats) || 0),
    reserveSeats: Math.max(0, Number(body.reserveSeats) || 0),
    academicYear: body.academicYear ? String(body.academicYear).trim() : undefined,
    registrationStart: parseOptionalDate(body.registrationStart),
    registrationEnd: parseOptionalDate(body.registrationEnd),
    trainingStart: parseOptionalDate(body.trainingStart),
    trainingEnd: parseOptionalDate(body.trainingEnd),
    visible: body.visible === true,
    active: body.active !== false,
  };
};

const loadOpportunitiesWithOrganizations = async () => {
  const rows = await TrainingOpportunity.find().sort({ createdAt: -1 }).lean();
  const orgIds = [...new Set(rows.map((row) => String(row.organizationId)))];
  const orgs = await PartnerOrganization.find({ _id: { $in: orgIds } }).lean();
  const orgMap = new Map(orgs.map((org) => [String(org._id), org]));
  return rows.map((row) => serializeTrainingOpportunity(row, orgMap.get(String(row.organizationId)) || null));
};

export async function GET() {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const items = await loadOpportunitiesWithOrganizations();
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[GET /api/partnerships/opportunities]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest) {
  const gate = await requirePartnershipsManage();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data = normalizeOpportunityBody(body);

    if (!data.title) {
      return NextResponse.json({ error: "Opportunity title is required" }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(data.organizationId)) {
      return NextResponse.json({ error: "Valid organizationId is required" }, { status: 400 });
    }

    await connectDB();
    const organization = await PartnerOrganization.findById(data.organizationId).lean();
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const created = await TrainingOpportunity.create({
      ...data,
      organizationId: new mongoose.Types.ObjectId(data.organizationId),
    });

    await logAuditEvent({
      actionType: "training_opportunity_created",
      entityType: "TrainingOpportunity",
      entityId: String(created._id),
      entityTitle: created.title,
      descriptionAr: `تم إنشاء فرصة تدريبية: ${created.title}`,
      actor: actorFromUser(gate.user),
      request,
      outcome: "success",
    });

    return NextResponse.json(
      {
        ok: true,
        item: serializeTrainingOpportunity(created.toObject(), organization),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/partnerships/opportunities]", error);
    return jsonInternalServerError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requirePartnershipsManage();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Opportunity id is required" }, { status: 400 });
    }

    const data = normalizeOpportunityBody(body);
    if (!data.title) {
      return NextResponse.json({ error: "Opportunity title is required" }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(data.organizationId)) {
      return NextResponse.json({ error: "Valid organizationId is required" }, { status: 400 });
    }

    await connectDB();
    const organization = await PartnerOrganization.findById(data.organizationId).lean();
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const updated = await TrainingOpportunity.findByIdAndUpdate(
      id,
      {
        $set: {
          ...data,
          organizationId: new mongoose.Types.ObjectId(data.organizationId),
        },
      },
      { returnDocument: "after" }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item: serializeTrainingOpportunity(updated, organization) });
  } catch (error) {
    console.error("[PATCH /api/partnerships/opportunities]", error);
    return jsonInternalServerError(error);
  }
}

export async function DELETE(request: NextRequest) {
  const gate = await requirePartnershipsManage();
  if (!gate.ok) return gate.response;

  try {
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Opportunity id is required" }, { status: 400 });
    }

    await connectDB();
    const deleted = await TrainingOpportunity.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/partnerships/opportunities]", error);
    return jsonInternalServerError(error);
  }
}
