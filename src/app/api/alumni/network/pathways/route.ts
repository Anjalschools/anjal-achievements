import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { findAlumniPathways } from "@/lib/alumni/career-graph/pathways";
import { leanUserToMentorCandidate, loadCareerGraphPeers } from "@/lib/alumni/career-graph/peers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAlumniUser(request);
  if (!gate.ok) return gate.response;

  if (!(await checkRouteRateLimit(request, "/api/alumni/network/pathways"))) {
    return rateLimitExceededResponse();
  }

  const targetId = request.nextUrl.searchParams.get("targetId")?.trim();
  if (!targetId || !mongoose.isValidObjectId(targetId)) {
    return NextResponse.json({ error: "targetId_required" }, { status: 400 });
  }
  if (targetId === gate.userId) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }

  try {
    await connectDB();

    const [meLean, targetLean] = await Promise.all([
      User.findById(gate.userId).select("fullName alumniProfile updatedAt lastLoginAt").lean(),
      User.findOne({ _id: targetId, accountType: "alumni" }).select("fullName alumniProfile updatedAt lastLoginAt").lean(),
    ]);

    if (!meLean || !targetLean) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const self = leanUserToMentorCandidate(meLean);
    const target = leanUserToMentorCandidate(targetLean);

    const sp = request.nextUrl.searchParams;
    const { peers } = await loadCareerGraphPeers({
      selfUserId: gate.userId,
      selfLean: meLean,
      focusSearchParams: sp,
      poolLimit: 200,
      topK: 48,
    });

    const intermediates = peers.map((p) => p.peer).filter((c) => c.id !== targetId);

    const pathways = findAlumniPathways({
      self,
      target,
      intermediates,
      maxPaths: 5,
    });

    return NextResponse.json({
      ok: true,
      target: { id: target.id, fullName: target.fullName, industry: target.industry },
      pathways,
    });
  } catch (e) {
    console.error("[GET /api/alumni/network/pathways]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
