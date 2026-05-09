import { NextRequest, NextResponse } from "next/server";
import type { PipelineStage } from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { blockIneligibleStudentOnPublicCommunityApi } from "@/lib/alumni/public-community-session-guard";

export const dynamic = "force-dynamic";
export const revalidate = 120;

const ALUMNI_MATCH = {
  $or: [{ accountType: "alumni" }, { "alumniProfile.industry": { $exists: true, $nin: [null, ""] } }],
};

export async function GET(request: NextRequest) {
  try {
    const blocked = await blockIneligibleStudentOnPublicCommunityApi();
    if (blocked) return blocked;
    const axis = String(request.nextUrl.searchParams.get("axis") || "industry").trim();
    await connectDB();

    const path =
      axis === "company"
        ? "$alumniProfile.currentCompany"
        : axis === "role"
          ? "$alumniProfile.currentPosition"
          : "$alumniProfile.industry";

    const presence =
      axis === "company"
        ? { "alumniProfile.currentCompany": { $nin: [null, ""] } }
        : axis === "role"
          ? { "alumniProfile.currentPosition": { $nin: [null, ""] } }
          : { "alumniProfile.industry": { $nin: [null, ""] } };

    const pipeline: PipelineStage[] = [
      { $match: ALUMNI_MATCH },
      { $match: presence },
      {
        $group: {
          _id: { $trim: { input: path } },
          count: { $sum: 1 },
        },
      },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { count: -1 } },
      { $limit: 80 },
    ];

    const out = await User.aggregate<{ _id: string; count: number }>(pipeline);

    return NextResponse.json({
      ok: true,
      axis,
      items: out.map((r) => ({ label: r._id, count: r.count })),
    });
  } catch (error) {
    console.error("[GET /api/public/alumni-network/careers]", error);
    return NextResponse.json({ ok: true, axis: "industry", items: [] });
  }
}
