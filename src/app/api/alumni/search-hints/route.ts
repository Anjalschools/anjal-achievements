import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { buildCommunityInsights } from "@/lib/alumni/build-community-activation";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const insights = await buildCommunityInsights();
    return NextResponse.json({
      ok: true,
      trendingMajors: insights.topMajors.slice(0, 10),
      trendingUniversities: insights.topUniversities.slice(0, 10),
      trendingIndustries: insights.topIndustries.slice(0, 8),
    });
  } catch (error) {
    console.error("[GET /api/alumni/search-hints]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
