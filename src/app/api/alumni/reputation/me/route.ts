import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import AlumniReputation from "@/models/AlumniReputation";
import { recomputeAlumniReputationGraph } from "@/lib/alumni/reputation-graph/recompute";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const oid = new mongoose.Types.ObjectId(gate.userId);
    let doc = await AlumniReputation.findOne({ userId: oid }).lean();
    if (!doc) {
      const snap = await recomputeAlumniReputationGraph(oid);
      return NextResponse.json({ ok: true, data: snap });
    }
    return NextResponse.json({
      ok: true,
      data: {
        userId: gate.userId,
        reputationScore: doc.reputationScore,
        mentorshipScore: doc.mentorshipScore,
        communityContributionScore: doc.communityContributionScore,
        eventParticipationScore: doc.eventParticipationScore,
        careerImpactScore: doc.careerImpactScore,
        verificationScore: doc.verificationScore,
        networkStrengthScore: doc.networkStrengthScore,
        contentContributionScore: doc.contentContributionScore,
        lastCalculatedAt: doc.lastCalculatedAt.toISOString(),
        badges: doc.badges,
        tiers: doc.tiers,
        currentTier: doc.tiers.length ? doc.tiers[doc.tiers.length - 1] : "Bronze",
      },
    });
  } catch (e) {
    console.error("[GET /api/alumni/reputation/me]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
