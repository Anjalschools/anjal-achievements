import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniOpportunity, { type AlumniOpportunityType } from "@/models/AlumniOpportunity";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";

const TYPES = new Set<AlumniOpportunityType>([
  "mentorship",
  "internship",
  "job",
  "workshop",
  "speaking",
  "partnership",
]);

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    await connectDB();
    const rows = await AlumniOpportunity.find({})
      .select("title type company remote published featured expiresAt createdAt")
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(120)
      .lean();
    return NextResponse.json({
      ok: true,
      items: rows.map((row: any) => ({
        id: row._id.toString(),
        title: row.title || "",
        type: row.type,
        company: row.company || null,
        remote: row.remote === true,
        published: row.published === true,
        featured: row.featured === true,
        expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/opportunities]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const title = sanitizeUserText(String(body.title || ""));
    const type = String(body.type || "") as AlumniOpportunityType;
    if (!title || !TYPES.has(type)) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }
    await connectDB();
    const row = await AlumniOpportunity.create({
      title,
      description: sanitizeUserText(String(body.description || "")) || undefined,
      type,
      company: sanitizeUserText(String(body.company || "")) || undefined,
      location: sanitizeUserText(String(body.location || "")) || undefined,
      remote: body.remote === true,
      contactEmail: sanitizeUserText(String(body.contactEmail || "")) || undefined,
      applicationUrl: sanitizeUserText(String(body.applicationUrl || "")) || undefined,
      createdByUserId: gate.user._id,
      published: body.published === true,
      featured: body.featured === true,
      expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : undefined,
    });
    return NextResponse.json({ ok: true, id: row._id.toString() }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/alumni/opportunities]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const id = String(body.id || "");
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = sanitizeUserText(String(body.title || ""));
    if (body.description !== undefined) updates.description = sanitizeUserText(String(body.description || "")) || undefined;
    if (body.company !== undefined) updates.company = sanitizeUserText(String(body.company || "")) || undefined;
    if (body.location !== undefined) updates.location = sanitizeUserText(String(body.location || "")) || undefined;
    if (body.remote !== undefined) updates.remote = body.remote === true;
    if (body.contactEmail !== undefined) updates.contactEmail = sanitizeUserText(String(body.contactEmail || "")) || undefined;
    if (body.applicationUrl !== undefined) updates.applicationUrl = sanitizeUserText(String(body.applicationUrl || "")) || undefined;
    if (body.featured !== undefined) updates.featured = body.featured === true;
    if (body.published !== undefined) updates.published = body.published === true;
    if (body.expiresAt !== undefined) updates.expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;
    if (body.type !== undefined && TYPES.has(String(body.type) as AlumniOpportunityType)) {
      updates.type = String(body.type);
    }

    await connectDB();
    const row = await AlumniOpportunity.findByIdAndUpdate(id, { $set: updates }, { new: true })
      .select("_id")
      .lean();
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/admin/alumni/opportunities]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
