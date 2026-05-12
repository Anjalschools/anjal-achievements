import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import AlumniReputation from "@/models/AlumniReputation";
import { recomputeAlumniReputationGraph } from "@/lib/alumni/reputation-graph/recompute";
import { buildReputationBreakdown } from "@/lib/alumni/reputation-breakdown";
import { getReputationPeerStats } from "@/lib/alumni/reputation-peer-stats";

export const dynamic = "force-dynamic";

const enrich = async (payload: {
  userId: string;
  reputationScore: number;
  mentorshipScore: number;
  communityContributionScore: number;
  eventParticipationScore: number;
  careerImpactScore: number;
  verificationScore: number;
  networkStrengthScore: number;
  contentContributionScore: number;
  lastCalculatedAt: string;
  badges: string[];
  tiers: string[];
  currentTier: string;
}) => {
  const { components } = buildReputationBreakdown(payload);
  const peer = await getReputationPeerStats(payload.reputationScore);
  return {
    ...payload,
    totalScore: payload.reputationScore,
    breakdown: components,
    networkStrength: payload.networkStrengthScore,
    percentile: peer.percentile,
    peerMeanReputation: peer.peerMeanReputation,
    vsPeerMean: peer.vsPeerMean,
    trend: peer.trend,
  };
};

export async function GET() {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const oid = new mongoose.Types.ObjectId(gate.userId);
    const doc = await AlumniReputation.findOne({ userId: oid }).lean();
    if (!doc) {
      const snap = await recomputeAlumniReputationGraph(oid);
      const data = await enrich({
        userId: gate.userId,
        reputationScore: snap.reputationScore,
        mentorshipScore: snap.mentorshipScore,
        communityContributionScore: snap.communityContributionScore,
        eventParticipationScore: snap.eventParticipationScore,
        careerImpactScore: snap.careerImpactScore,
        verificationScore: snap.verificationScore,
        networkStrengthScore: snap.networkStrengthScore,
        contentContributionScore: snap.contentContributionScore,
        lastCalculatedAt: snap.lastCalculatedAt,
        badges: snap.badges,
        tiers: snap.tiers,
        currentTier: snap.currentTier,
      });
      return NextResponse.json({ ok: true, data });
    }

    const currentTier = doc.tiers?.length ? doc.tiers[doc.tiers.length - 1] : "Bronze";
    const data = await enrich({
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
      badges: doc.badges || [],
      tiers: doc.tiers || [],
      currentTier: String(currentTier),
    });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("[GET /api/alumni/reputation/me]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
