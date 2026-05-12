import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniCampaign, { type AlumniCampaignKind } from "@/models/AlumniCampaign";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { sanitizeCampaignHtml } from "@/lib/alumni/sanitize-campaign-html";

export const dynamic = "force-dynamic";

const KINDS = new Set<AlumniCampaignKind>([
  "email_campaign",
  "alumni_engagement",
  "reunion_invitation",
  "mentorship_invitation",
  "graduation_reminder",
  "event_promotion",
]);

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  try {
    await connectDB();
    const row = await AlumniCampaign.findById(id).lean();
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const r = row as any;
    return NextResponse.json({
      ok: true,
      item: {
        id: r._id.toString(),
        title: r.title,
        slug: r.slug,
        kind: r.kind,
        status: r.status,
        subject: r.subject,
        bodyHtml: r.bodyHtml,
        bodyText: r.bodyText,
        audienceFilter: r.audienceFilter || {},
        scheduledAt: r.scheduledAt ? new Date(r.scheduledAt).toISOString() : null,
        sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : null,
        stats: {
          delivered: r.statsDelivered ?? 0,
          opened: r.statsOpened ?? 0,
          clicked: r.statsClicked ?? 0,
          failed: r.statsFailed ?? 0,
        },
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/campaigns/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  try {
    const body = (await request.json()) as {
      title?: string;
      kind?: AlumniCampaignKind;
      subject?: string;
      bodyHtml?: string;
      bodyText?: string;
      audienceFilter?: Record<string, unknown>;
      scheduledAt?: string | null;
      status?: string;
    };

    await connectDB();
    const existing = await AlumniCampaign.findById(id).lean();
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if ((existing as any).status === "sent" || (existing as any).status === "sending") {
      return NextResponse.json({ error: "CAMPAIGN_LOCKED" }, { status: 400 });
    }

    const $set: Record<string, unknown> = {};
    if (typeof body.title === "string") $set.title = sanitizeUserText(body.title);
    if (body.kind && KINDS.has(body.kind)) $set.kind = body.kind;
    if (typeof body.subject === "string") $set.subject = sanitizeUserText(body.subject);
    if (typeof body.bodyHtml === "string") $set.bodyHtml = sanitizeCampaignHtml(body.bodyHtml);
    if (typeof body.bodyText === "string") $set.bodyText = sanitizeUserText(body.bodyText);
    if (body.audienceFilter && typeof body.audienceFilter === "object") $set.audienceFilter = body.audienceFilter;
    if (body.scheduledAt !== undefined) $set.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    if (body.status === "draft" || body.status === "scheduled" || body.status === "cancelled") $set.status = body.status;

    await AlumniCampaign.updateOne({ _id: id }, { $set });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/admin/alumni/campaigns/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  try {
    await connectDB();
    const existing = await AlumniCampaign.findById(id).lean();
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if ((existing as any).status !== "draft") {
      return NextResponse.json({ error: "CANNOT_DELETE_NON_DRAFT" }, { status: 400 });
    }
    await AlumniCampaign.deleteOne({ _id: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/admin/alumni/campaigns/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
