import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import User from "@/models/User";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  requirePartnershipsManageOrganizations,
  requirePartnershipsView,
} from "@/lib/partnerships/partnerships-auth";
import { serializePartnerOrganization } from "@/lib/partnerships/partnerships-serialize";
import { isValidPartnerOrganizationCategory } from "@/lib/partnerships/institution-analytics-constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const parseInstitutionUserIds = async (body: Record<string, unknown>): Promise<mongoose.Types.ObjectId[]> => {
  const rawIds = Array.isArray(body.institutionUserIds)
    ? body.institutionUserIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  const rawEmails = String(body.institutionUserEmails || "")
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const ids = rawIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (rawEmails.length) {
    await connectDB();
    const users = await User.find({ email: { $in: rawEmails } }).select("_id").lean();
    for (const user of users) {
      ids.push(user._id as mongoose.Types.ObjectId);
    }
  }

  return [...new Map(ids.map((id) => [String(id), id])).values()];
};

const normalizeOrganizationBody = async (body: Record<string, unknown>) => {
  const data: Record<string, unknown> = {
    name: String(body.name || "").trim(),
    logo: body.logo ? String(body.logo).trim() : undefined,
    sector: body.sector ? String(body.sector).trim() : undefined,
    city: body.city ? String(body.city).trim() : undefined,
    contactName: body.contactName ? String(body.contactName).trim() : undefined,
    contactEmail: body.contactEmail ? String(body.contactEmail).trim().toLowerCase() : undefined,
    contactPhone: body.contactPhone ? String(body.contactPhone).trim() : undefined,
    notes: body.notes ? String(body.notes).trim() : undefined,
    active: body.active !== false,
  };

  if ("institutionUserIds" in body || "institutionUserEmails" in body) {
    const ids = await parseInstitutionUserIds(body);
    const primary = ids[0];
    data.institutionUserId = primary;
    data.institutionUserIds = primary ? [primary] : [];
  }

  if ("category" in body) {
    const category = String(body.category || "").trim();
    data.category = category && isValidPartnerOrganizationCategory(category) ? category : undefined;
  }
  if ("subCategory" in body) {
    const subCategory = String(body.subCategory || "").trim();
    data.subCategory = subCategory || undefined;
  }

  return data;
};

export async function GET() {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const rows = await PartnerOrganization.find().sort({ name: 1 }).lean();
    return NextResponse.json({
      ok: true,
      items: rows.map((row) => serializePartnerOrganization(row)),
    });
  } catch (error) {
    console.error("[GET /api/partnerships/organizations]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest) {
  const gate = await requirePartnershipsManageOrganizations();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data = await normalizeOrganizationBody(body);
    if (!data.name) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
    }

    await connectDB();
    const created = await PartnerOrganization.create(data);

    await logAuditEvent({
      actionType: "partnership_created",
      entityType: "PartnerOrganization",
      entityId: String(created._id),
      entityTitle: created.name,
      descriptionAr: `تم إنشاء مؤسسة شريكة: ${created.name}`,
      actor: actorFromUser(gate.user),
      request,
      outcome: "success",
    });

    return NextResponse.json({ ok: true, item: serializePartnerOrganization(created.toObject()) }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/partnerships/organizations]", error);
    return jsonInternalServerError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requirePartnershipsManageOrganizations();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Organization id is required" }, { status: 400 });
    }

    const data = await normalizeOrganizationBody(body);
    if (!data.name) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
    }

    await connectDB();
    const before = await PartnerOrganization.findById(id).lean();
    const updated = await PartnerOrganization.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after" }).lean();
    if (!updated) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const categoryChanged =
      before &&
      (String(before.category || "") !== String(updated.category || "") ||
        String(before.subCategory || "") !== String(updated.subCategory || ""));

    await logAuditEvent({
      actionType: categoryChanged ? "partnership_organization_classification_updated" : "partnership_organization_updated",
      entityType: "PartnerOrganization",
      entityId: id,
      entityTitle: updated.name,
      descriptionAr: categoryChanged
        ? `تم تحديث تصنيف المؤسسة: ${updated.name}`
        : `تم تحديث بيانات المؤسسة: ${updated.name}`,
      actor: actorFromUser(gate.user),
      request,
      outcome: "success",
      before: before
        ? {
            name: before.name,
            category: before.category,
            subCategory: before.subCategory,
            sector: before.sector,
            city: before.city,
            active: before.active,
          }
        : undefined,
      after: {
        name: updated.name,
        category: updated.category,
        subCategory: updated.subCategory,
        sector: updated.sector,
        city: updated.city,
        active: updated.active,
      },
    });

    return NextResponse.json({ ok: true, item: serializePartnerOrganization(updated) });
  } catch (error) {
    console.error("[PATCH /api/partnerships/organizations]", error);
    return jsonInternalServerError(error);
  }
}

export async function DELETE(request: NextRequest) {
  const gate = await requirePartnershipsManageOrganizations();
  if (!gate.ok) return gate.response;

  try {
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Organization id is required" }, { status: 400 });
    }

    await connectDB();
    const deleted = await PartnerOrganization.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/partnerships/organizations]", error);
    return jsonInternalServerError(error);
  }
}
