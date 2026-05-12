import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
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

const buildSlug = (title: string) => {
  const base = title
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  const suf = crypto.randomBytes(3).toString("hex");
  return `${base || "campaign"}-${suf}`;
};

export async function GET() {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;
  try {
    await connectDB();
    const rows = await AlumniCampaign.find({})
      .select("title slug kind status subject scheduledAt sentAt statsDelivered statsOpened statsClicked statsFailed createdAt")
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean();
    return NextResponse.json({
      ok: true,
      items: rows.map((r: any) => ({
        id: r._id.toString(),
        title: r.title,
        slug: r.slug,
        kind: r.kind,
        status: r.status,
        subject: r.subject,
        scheduledAt: r.scheduledAt ? new Date(r.scheduledAt).toISOString() : null,
        sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : null,
        stats: {
          delivered: r.statsDelivered ?? 0,
          opened: r.statsOpened ?? 0,
          clicked: r.statsClicked ?? 0,
          failed: r.statsFailed ?? 0,
        },
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/campaigns]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as {
      title?: string;
      kind?: AlumniCampaignKind;
      subject?: string;
      bodyHtml?: string;
      bodyText?: string;
      audienceFilter?: Record<string, unknown>;
      scheduledAt?: string | null;
    };
    const title = sanitizeUserText(body.title);
    if (!title) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
    if (!body.kind || !KINDS.has(body.kind)) return NextResponse.json({ error: "INVALID_KIND" }, { status: 400 });
    const subject = sanitizeUserText(body.subject);
    if (!subject) return NextResponse.json({ error: "SUBJECT_REQUIRED" }, { status: 400 });
    const bodyHtml = sanitizeCampaignHtml(body.bodyHtml || "");
    const bodyText = sanitizeUserText(body.bodyText || body.bodyHtml || "");
    if (!bodyHtml && !bodyText) return NextResponse.json({ error: "BODY_REQUIRED" }, { status: 400 });

    await connectDB();
    const doc = await AlumniCampaign.create({
      title,
      slug: buildSlug(title),
      kind: body.kind,
      status: "draft",
      subject,
      bodyHtml: bodyHtml || `<p>${bodyText}</p>`,
      bodyText,
      audienceFilter: body.audienceFilter && typeof body.audienceFilter === "object" ? body.audienceFilter : {},
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      createdById: gate.user._id,
    });

    return NextResponse.json({ ok: true, id: doc._id.toString(), slug: doc.slug });
  } catch (error) {
    console.error("[POST /api/admin/alumni/campaigns]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
