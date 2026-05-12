import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import crypto from "crypto";
import connectDB from "@/lib/mongodb";
import AlumniCampaign from "@/models/AlumniCampaign";
import AlumniCampaignRecipient from "@/models/AlumniCampaignRecipient";
import User from "@/models/User";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { resolveAlumniAudience } from "@/lib/alumni/campaign-audience";
import { queueCampaignEmailJobs, emitCampaignLaunchSignal } from "@/lib/alumni/automation/campaign-trigger-engine";
import { sendSmtpMail } from "@/lib/mailer";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  try {
    const body = (await request.json()) as { testEmail?: string };
    await connectDB();

    const campaign = await AlumniCampaign.findById(id).lean();
    if (!campaign) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const c = campaign as any;

    if (typeof body.testEmail === "string" && body.testEmail.includes("@")) {
      const mail = await sendSmtpMail({
        to: body.testEmail.trim().toLowerCase(),
        subject: `[اختبار] ${c.subject}`,
        text: c.bodyText,
        html: c.bodyHtml,
      });
      return NextResponse.json({ ok: mail.ok, mode: "test", smtp: mail.ok });
    }

    const cid = new mongoose.Types.ObjectId(id);
    const existingRecipients = await AlumniCampaignRecipient.countDocuments({ campaignId: cid });
    if (existingRecipients > 0) {
      await emitCampaignLaunchSignal(id);
      const q = await queueCampaignEmailJobs(id);
      await logAuditEvent({
        actionType: "alumni.campaign_send",
        entityType: "AlumniCampaign",
        entityId: id,
        entityTitle: typeof c.subject === "string" ? c.subject : undefined,
        descriptionAr: "إعادة طابور إرسال حملة (مستلمون موجودون مسبقًا)",
        metadata: { mode: "requeue", queuedJobs: q.jobs, existingRecipients },
        actor: actorFromUser(gate.user),
        outcome: "success",
      });
      return NextResponse.json({
        ok: true,
        mode: "requeue",
        queuedJobs: q.jobs,
        existingRecipients,
      });
    }

    const resolved = await resolveAlumniAudience(c.audienceFilter || {}, 800);
    const docs: Array<{
      campaignId: mongoose.Types.ObjectId;
      userId: mongoose.Types.ObjectId;
      emailSnapshot: string;
      trackingToken: string;
      status: "pending";
    }> = [];

    const users = await User.find({ _id: { $in: resolved.userIds } })
      .select("email")
      .lean();

    for (const u of users) {
      const email = String((u as any).email || "").trim().toLowerCase();
      if (!email.includes("@")) continue;
      docs.push({
        campaignId: cid,
        userId: u._id as mongoose.Types.ObjectId,
        emailSnapshot: email,
        trackingToken: crypto.randomBytes(28).toString("hex"),
        status: "pending",
      });
    }

    if (docs.length) {
      await AlumniCampaignRecipient.insertMany(docs, { ordered: false });
    }

    await emitCampaignLaunchSignal(id);
    const q = await queueCampaignEmailJobs(id);

    await AlumniCampaign.updateOne(
      { _id: id },
      {
        $set: {
          status: docs.length ? "sending" : "draft",
          sentAt: docs.length ? new Date() : undefined,
        },
      }
    );

    await logAuditEvent({
      actionType: "alumni.campaign_send",
      entityType: "AlumniCampaign",
      entityId: id,
      entityTitle: typeof c.subject === "string" ? c.subject : undefined,
      descriptionAr: "إطلاق/إعادة طابور إرسال حملة بريد للخريجين",
      metadata: {
        recipientsResolved: docs.length,
        totalMatched: resolved.totalMatched,
        queuedJobs: q.jobs,
      },
      actor: actorFromUser(gate.user),
      outcome: "success",
    });

    return NextResponse.json({
      ok: true,
      recipientsResolved: docs.length,
      totalMatched: resolved.totalMatched,
      queuedJobs: q.jobs,
    });
  } catch (error) {
    console.error("[POST .../campaigns/[id]/send]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
