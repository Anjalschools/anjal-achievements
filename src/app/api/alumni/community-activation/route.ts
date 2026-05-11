import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { buildCommunityFeed, buildCommunityInsights } from "@/lib/alumni/build-community-activation";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const [feed, insights] = await Promise.all([buildCommunityFeed(), buildCommunityInsights()]);
    return NextResponse.json({ ok: true, feed, insights });
  } catch (error) {
    console.error("[GET /api/alumni/community-activation]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
