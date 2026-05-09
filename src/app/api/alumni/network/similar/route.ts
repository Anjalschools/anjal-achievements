import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { loadCareerGraphPeers } from "@/lib/alumni/career-graph/peers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAlumniUser(request);
  if (!gate.ok) return gate.response;

  if (!(await checkRouteRateLimit(request, "/api/alumni/network/similar"))) {
    return rateLimitExceededResponse();
  }

  try {
    await connectDB();
    const me = await User.findById(gate.userId).select("fullName alumniProfile updatedAt lastLoginAt").lean();
    const sp = request.nextUrl.searchParams;

    const anchorId = sp.get("alumniId")?.trim();
    let selfLean: unknown = me;
    let selfUserId = gate.userId;

    if (anchorId && mongoose.isValidObjectId(anchorId) && anchorId !== gate.userId) {
      const other = await User.findOne({ _id: anchorId, accountType: "alumni" })
        .select("fullName alumniProfile updatedAt lastLoginAt")
        .lean();
      if (!other) {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }
      selfLean = other;
      selfUserId = anchorId;
    }

    const limit = Math.min(40, Math.max(6, parseInt(sp.get("limit") || "16", 10) || 16));

    const { peers } = await loadCareerGraphPeers({
      selfUserId,
      selfLean,
      focusSearchParams: sp,
      poolLimit: 200,
      topK: limit,
    });

    return NextResponse.json({
      ok: true,
      anchorUserId: selfUserId,
      items: peers.map((p) => ({
        id: p.peer.id,
        fullName: p.peer.fullName,
        universityName: p.peer.universityName,
        industry: p.peer.industry,
        major: p.peer.major,
        graduationYear: p.peer.graduationYear,
        country: p.peer.country,
        weight: p.weight,
        reasons: p.reasons,
        isVerifiedAlumni: p.peer.isVerifiedAlumni === true,
      })),
    });
  } catch (e) {
    console.error("[GET /api/alumni/network/similar]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
