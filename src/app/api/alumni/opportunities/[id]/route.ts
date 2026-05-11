import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { requireAlumniCommunityForAuthedUser } from "@/lib/alumni/require-alumni-community-access";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { normalizeOpportunityStatus } from "@/lib/alumni/normalize-opportunity-status";
import type { AlumniOpportunityType } from "@/models/AlumniOpportunity";

export const dynamic = "force-dynamic";

const TYPES = new Set<AlumniOpportunityType>([
  "mentorship",
  "internship",
  "job",
  "workshop",
  "speaking",
  "partnership",
]);

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;
  const blocked = requireAlumniCommunityForAuthedUser(gate.user);
  if (blocked) return blocked;

  const { id } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  try {
    await connectDB();
    const oid = new mongoose.Types.ObjectId(id);
    const uid = new mongoose.Types.ObjectId(gate.userId);

    const existing = await AlumniOpportunity.findOne({ _id: oid, createdByUserId: uid }).lean();
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const canon = normalizeOpportunityStatus(existing as any);
    if (canon === "approved" || canon === "archived") {
      return NextResponse.json({ error: "NOT_EDITABLE" }, { status: 409 });
    }

    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = sanitizeUserText(String(body.title || "")).slice(0, 220);
    if (body.description !== undefined) updates.description = sanitizeUserText(String(body.description || "")).slice(0, 10_000);
    if (body.company !== undefined) updates.company = sanitizeUserText(String(body.company || "")).slice(0, 200) || undefined;
    if (body.location !== undefined) updates.location = sanitizeUserText(String(body.location || "")).slice(0, 200) || undefined;
    if (body.remote !== undefined) updates.remote = body.remote === true;
    if (body.contactEmail !== undefined) updates.contactEmail = sanitizeUserText(String(body.contactEmail || "")).slice(0, 320) || undefined;
    if (body.applicationUrl !== undefined) updates.applicationUrl = sanitizeUserText(String(body.applicationUrl || "")).slice(0, 1000) || undefined;
    if (body.type !== undefined) {
      const t = String(body.type) as AlumniOpportunityType;
      if (!TYPES.has(t)) return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });
      updates.type = t;
    }
    if (body.expiresAt !== undefined) updates.expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "NO_UPDATES" }, { status: 400 });
    }

    const row = await AlumniOpportunity.findOneAndUpdate({ _id: oid, createdByUserId: uid }, { $set: updates }, { new: true })
      .select("_id")
      .lean();
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/alumni/opportunities/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteCtx) {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;
  const blocked = requireAlumniCommunityForAuthedUser(gate.user);
  if (blocked) return blocked;

  const { id } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  try {
    await connectDB();
    const oid = new mongoose.Types.ObjectId(id);
    const uid = new mongoose.Types.ObjectId(gate.userId);

    const existing = await AlumniOpportunity.findOne({ _id: oid, createdByUserId: uid }).lean();
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const canon = normalizeOpportunityStatus(existing as any);
    if (canon === "approved" || canon === "archived") {
      return NextResponse.json({ error: "NOT_DELETABLE" }, { status: 409 });
    }

    await AlumniOpportunity.deleteOne({ _id: oid, createdByUserId: uid });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/alumni/opportunities/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
