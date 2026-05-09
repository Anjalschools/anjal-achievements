import { NextRequest, NextResponse } from "next/server";
import type { PipelineStage } from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";
export const revalidate = 120;

const ALUMNI_MATCH = {
  $or: [
    { accountType: "alumni" },
    { "alumniProfile.universityName": { $exists: true, $nin: [null, ""] } },
  ],
};

export async function GET(request: NextRequest) {
  try {
    const q = String(request.nextUrl.searchParams.get("q") || "").trim();
    await connectDB();

    const pipeline: PipelineStage[] = [
      { $match: ALUMNI_MATCH },
      { $match: { "alumniProfile.universityName": { $nin: [null, ""] } } },
    ];

    if (q) {
      pipeline.push({
        $match: {
          "alumniProfile.universityName": new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        },
      });
    }

    pipeline.push(
      {
        $group: {
          _id: { $trim: { input: "$alumniProfile.universityName" } },
          count: { $sum: 1 },
        },
      },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { count: -1 } },
      { $limit: 80 }
    );

    const rows = await User.aggregate<{ _id: string; count: number }>(pipeline);
    return NextResponse.json({
      ok: true,
      items: rows.map((r) => ({ name: r._id, count: r.count })),
    });
  } catch (error) {
    console.error("[GET /api/public/alumni-network/universities]", error);
    return NextResponse.json({ ok: true, items: [] });
  }
}
