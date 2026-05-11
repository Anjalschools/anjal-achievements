import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import {
  buildCommunityFeed,
  buildCommunityInsights,
  buildPlatformMetricsStrip,
  buildWeeklyAlumniDigest,
} from "@/lib/alumni/build-community-activation";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const [feed, insights, weeklyDigest, platformMetrics] = await Promise.all([
      buildCommunityFeed(),
      buildCommunityInsights(),
      buildWeeklyAlumniDigest(),
      buildPlatformMetricsStrip(),
    ]);
    return NextResponse.json({ ok: true, feed, insights, weeklyDigest, platformMetrics });
  } catch (error) {
    console.error("[GET /api/alumni/community-activation]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
