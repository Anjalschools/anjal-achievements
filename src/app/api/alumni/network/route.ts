import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { loadCareerGraphPeers, peersToGraph } from "@/lib/alumni/career-graph/peers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAlumniUser(request);
  if (!gate.ok) return gate.response;

  if (!(await checkRouteRateLimit(request, "/api/alumni/network"))) {
    return rateLimitExceededResponse();
  }

  try {
    await connectDB();
    const me = await User.findById(gate.userId).select("fullName alumniProfile updatedAt lastLoginAt").lean();

    const sp = request.nextUrl.searchParams;
    const { self, peers } = await loadCareerGraphPeers({
      selfUserId: gate.userId,
      selfLean: me,
      focusSearchParams: sp,
      poolLimit: Math.min(220, Math.max(40, parseInt(sp.get("pool") || "160", 10) || 160)),
      topK: Math.min(48, Math.max(8, parseInt(sp.get("top") || "32", 10) || 32)),
    });

    const maxEdges = Math.min(40, Math.max(8, parseInt(sp.get("edges") || "28", 10) || 28));
    const { nodes, edges } = peersToGraph(self, peers, maxEdges);

    const uniCounts = new Map<string, number>();
    const industryCounts = new Map<string, number>();
    for (const p of peers.slice(0, 20)) {
      const u = (p.peer.universityName || "").trim();
      const ind = (p.peer.industry || "").trim();
      if (u) uniCounts.set(u, (uniCounts.get(u) || 0) + 1);
      if (ind) industryCounts.set(ind, (industryCounts.get(ind) || 0) + 1);
    }
    const topUniversity = [...uniCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const topIndustry = [...industryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return NextResponse.json({
      ok: true,
      viewer: {
        id: self.id,
        fullName: self.fullName,
        universityName: self.universityName,
        major: self.major,
        industry: self.industry,
      },
      nodes,
      edges,
      clusters: { topUniversity, topIndustry, mentorshipNeighborCount: peers.filter((p) => p.reasons.includes("mentorship_link")).length },
    });
  } catch (e) {
    console.error("[GET /api/alumni/network]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
