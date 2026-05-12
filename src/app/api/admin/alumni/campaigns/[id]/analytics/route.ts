import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniCampaign from "@/models/AlumniCampaign";
import AlumniCampaignRecipient from "@/models/AlumniCampaignRecipient";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  try {
    await connectDB();
    const campaign = await AlumniCampaign.findById(id).lean();
    if (!campaign) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const cid = new mongoose.Types.ObjectId(id);
    const byStatus = await AlumniCampaignRecipient.aggregate<{ _id: string; c: number }>([
      { $match: { campaignId: cid } },
      { $group: { _id: "$status", c: { $sum: 1 } } },
    ]);

    const map: Record<string, number> = {};
    for (const row of byStatus) map[row._id] = row.c;

    const c = campaign as any;
    const delivered = c.statsDelivered ?? 0;
    const opened = c.statsOpened ?? 0;
    const clicked = c.statsClicked ?? 0;
    const failed = c.statsFailed ?? 0;
    const denom = delivered + failed || 1;
    const engagementRate = Math.round(((opened + clicked) / denom) * 1000) / 10;

    return NextResponse.json({
      ok: true,
      campaignId: id,
      funnel: map,
      aggregates: {
        delivered,
        opened,
        clicked,
        failed,
        engagementRatePercent: engagementRate,
      },
    });
  } catch (error) {
    console.error("[GET .../campaigns/[id]/analytics]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
