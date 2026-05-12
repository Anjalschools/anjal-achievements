import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireSessionUser } from "@/lib/alumni/require-alumni";
import { requireAlumniCommunityForAuthedUser } from "@/lib/alumni/require-alumni-community-access";
import { buildViewerMatchProfile } from "@/lib/alumni/matching/viewer-profile";
import { runRecommendationEngineV1 } from "@/lib/alumni/recommendations/recommendation-engine-v1";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireSessionUser();
  if (!gate.ok) return gate.response;
  const denied = requireAlumniCommunityForAuthedUser(gate.user);
  if (denied) return denied;

  try {
    await connectDB();
    const uid = String(gate.user._id);
    const me = await User.findById(uid).select("alumniProfile lastLoginAt").lean();
    const viewer = buildViewerMatchProfile(me as never, request.nextUrl.searchParams);
    const bundle = await runRecommendationEngineV1(uid, viewer);
    return NextResponse.json({ ok: true, ...bundle });
  } catch (error) {
    console.error("[GET /api/alumni/recommendations/v1]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
