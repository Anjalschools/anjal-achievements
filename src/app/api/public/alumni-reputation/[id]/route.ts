import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { blockIneligibleStudentOnPublicCommunityApi } from "@/lib/alumni/public-community-session-guard";
import AlumniReputation from "@/models/AlumniReputation";
import { getAccountType } from "@/lib/account-type";
import { effectivePrivacy } from "@/lib/alumni/privacy";
import { recomputeAlumniReputationGraph } from "@/lib/alumni/reputation-graph/recompute";

type RouteParams = { params: { id: string } };

export const dynamic = "force-dynamic";
export const revalidate = 120;

export async function GET(_request: Request, { params }: RouteParams) {
  const id = String(params.id || "");
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }
  const oid = new mongoose.Types.ObjectId(id);

  try {
    const blocked = await blockIneligibleStudentOnPublicCommunityApi();
    if (blocked) return blocked;
    await connectDB();
    const row = await User.findById(oid).select("accountType alumniProfile").lean();
    if (!row || getAccountType(row as any) !== "alumni") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const ap = (row as any).alumniProfile;
    const priv = effectivePrivacy(ap);
    if (!priv.searchable || !priv.publicProfile) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const trust = typeof ap?.trustScore === "number" ? ap.trustScore : null;

    let doc = await AlumniReputation.findOne({ userId: oid }).lean();
    if (!doc) {
      const snap = await recomputeAlumniReputationGraph(oid);
      return NextResponse.json({
        ok: true,
        data: {
          reputationScore: snap.reputationScore,
          badges: snap.badges,
          tiers: snap.tiers,
          currentTier: snap.currentTier,
          lastCalculatedAt: snap.lastCalculatedAt,
          trustScore: trust,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        reputationScore: doc.reputationScore,
        badges: doc.badges,
        tiers: doc.tiers,
        currentTier: doc.tiers.length ? doc.tiers[doc.tiers.length - 1] : "Bronze",
        lastCalculatedAt: doc.lastCalculatedAt.toISOString(),
        trustScore: trust,
      },
    });
  } catch (e) {
    console.error("[GET /api/public/alumni-reputation/[id]]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
