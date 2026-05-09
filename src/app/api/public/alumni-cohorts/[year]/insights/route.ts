import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import { buildViewerMatchProfile } from "@/lib/alumni/matching/viewer-profile";
import { rankCohortPeers, type CohortPeer } from "@/lib/alumni/matching/cohort-matching";
import { getCurrentDbUser } from "@/lib/auth";
import { rankOpportunities, type OpportunityCandidate } from "@/lib/alumni/matching/opportunity-matching";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ year: string }> }) {
  try {
    const { year } = await ctx.params;
    const y = Number(year);
    if (!Number.isFinite(y)) return NextResponse.json({ error: "INVALID_YEAR" }, { status: 400 });

    await connectDB();
    const current = await getCurrentDbUser();
    const me = current?._id
      ? await User.findById(current._id).select("alumniProfile").lean()
      : null;
    const viewer = buildViewerMatchProfile(me as any, new URL(request.url).searchParams);

    const peersRaw = await User.find({
      accountType: "alumni",
      "alumniProfile.graduationYear": y,
    })
      .select("fullName alumniProfile updatedAt")
      .limit(80)
      .lean();

    const peers: CohortPeer[] = peersRaw.map((row: any) => {
      const p = row.alumniProfile || {};
      return {
        id: row._id.toString(),
        fullName: row.fullName || "",
        universityName: p.universityName ?? null,
        major: p.major ?? null,
        industry: p.industry ?? null,
        currentCompany: p.currentCompany ?? null,
        reputationScore: p.reputationScore ?? null,
        updatedAt: row.updatedAt ?? null,
      };
    });

    const selfId = current?._id ? String(current._id) : undefined;
    const similar = rankCohortPeers(viewer, peers, selfId, 16).filter((s) => s.similarityScore > 0).slice(0, 8);

    const active = [...peers]
      .sort((a, b) => {
        const ra = Number(a.reputationScore || 0);
        const rb = Number(b.reputationScore || 0);
        if (rb !== ra) return rb - ra;
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        fullName: p.fullName,
        universityName: p.universityName,
        reputationScore: p.reputationScore,
      }));

    const now = new Date();
    const opRows = await AlumniOpportunity.find({
      published: true,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .select("title description type company location featured")
      .limit(40)
      .lean();

    const opps: OpportunityCandidate[] = opRows.map((row: any) => ({
      id: row._id.toString(),
      title: row.title || "",
      description: row.description ?? null,
      type: row.type || "",
      company: row.company ?? null,
      location: row.location ?? null,
      featured: row.featured === true,
    }));

    const cohortViewer = { ...viewer, graduationYear: y };
    const cohortOpps = rankOpportunities(cohortViewer, opps, 6);

    return NextResponse.json({
      ok: true,
      year: y,
      similarAlumni: similar.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        universityName: s.universityName,
        similarityScore: s.similarityScore,
        similarityReasons: s.similarityReasons,
      })),
      mostActive: active,
      relatedOpportunities: cohortOpps.map((o) => ({
        id: o.id,
        title: o.title,
        type: o.type,
        matchScore: o.matchScore,
      })),
    });
  } catch (error) {
    console.error("[GET /api/public/alumni-cohorts/[year]/insights]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
