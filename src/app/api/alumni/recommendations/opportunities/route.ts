import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import { requireSessionUser } from "@/lib/alumni/require-alumni";
import { buildViewerMatchProfile } from "@/lib/alumni/matching/viewer-profile";
import { rankOpportunities, type OpportunityCandidate } from "@/lib/alumni/matching/opportunity-matching";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireSessionUser();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const me = await User.findById(gate.user._id).select("alumniProfile").lean();
    const viewer = buildViewerMatchProfile(me as any, request.nextUrl.searchParams);

    const now = new Date();
    const rows = await AlumniOpportunity.find({
      published: true,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .select("title description type company location featured")
      .sort({ featured: -1, updatedAt: -1 })
      .limit(80)
      .lean();

    const opps: OpportunityCandidate[] = rows.map((row: any) => ({
      id: row._id.toString(),
      title: row.title || "",
      description: row.description ?? null,
      type: row.type || "",
      company: row.company ?? null,
      location: row.location ?? null,
      featured: row.featured === true,
    }));

    const ranked = rankOpportunities(viewer, opps, 12);

    return NextResponse.json({
      ok: true,
      items: ranked.map((o) => ({
        id: o.id,
        title: o.title,
        type: o.type,
        company: o.company,
        matchScore: o.matchScore,
        matchReasons: o.matchReasons,
      })),
    });
  } catch (error) {
    console.error("[GET /api/alumni/recommendations/opportunities]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
