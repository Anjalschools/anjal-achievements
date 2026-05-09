import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { loadCareerGraphPeers } from "@/lib/alumni/career-graph/peers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAlumniUser(request);
  if (!gate.ok) return gate.response;

  if (!(await checkRouteRateLimit(request, "/api/alumni/network/suggestions"))) {
    return rateLimitExceededResponse();
  }

  try {
    await connectDB();
    const me = await User.findById(gate.userId).select("fullName alumniProfile updatedAt lastLoginAt").lean();
    const sp = request.nextUrl.searchParams;

    const { peers } = await loadCareerGraphPeers({
      selfUserId: gate.userId,
      selfLean: me,
      focusSearchParams: sp,
      topK: 12,
    });

    return NextResponse.json({
      ok: true,
      items: peers.map((p) => ({
        id: p.peer.id,
        fullName: p.peer.fullName,
        universityName: p.peer.universityName,
        industry: p.peer.industry,
        major: p.peer.major,
        weight: p.weight,
        reasons: p.reasons,
      })),
    });
  } catch (e) {
    console.error("[GET /api/alumni/network/suggestions]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
