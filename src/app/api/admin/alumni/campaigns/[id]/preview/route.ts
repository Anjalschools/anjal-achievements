import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniCampaign from "@/models/AlumniCampaign";
import User from "@/models/User";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { resolveAlumniAudience } from "@/lib/alumni/campaign-audience";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  try {
    await connectDB();
    const campaign = await AlumniCampaign.findById(id).select("audienceFilter title").lean();
    if (!campaign) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const filter = (campaign as any).audienceFilter || {};
    const resolved = await resolveAlumniAudience(filter, 500);
    const sample = await User.find({ _id: { $in: resolved.userIds.slice(0, 8) } })
      .select("fullName email alumniProfile.universityName")
      .lean();

    return NextResponse.json({
      ok: true,
      title: (campaign as any).title,
      totalMatched: resolved.totalMatched,
      cappedSample: resolved.userIds.length,
      sample: sample.map((u: any) => ({
        id: u._id.toString(),
        fullName: u.fullName,
        email: u.email,
        universityName: u.alumniProfile?.universityName ?? null,
      })),
    });
  } catch (error) {
    console.error("[GET .../campaigns/[id]/preview]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
