import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireSessionUser } from "@/lib/alumni/require-alumni";
import { requireAlumniCommunityForAuthedUser } from "@/lib/alumni/require-alumni-community-access";
import { buildViewerMatchProfile } from "@/lib/alumni/matching/viewer-profile";
import { scoreMentor, type MentorCandidate } from "@/lib/alumni/matching/mentor-matching";

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
    const viewer = buildViewerMatchProfile(me as any, request.nextUrl.searchParams);

    const rows = await User.find({
      accountType: "alumni",
      _id: { $ne: new mongoose.Types.ObjectId(uid) },
    })
      .select("fullName alumniProfile updatedAt lastLoginAt")
      .sort({ updatedAt: -1 })
      .limit(120)
      .lean();

    const candidates: MentorCandidate[] = rows.map((row: any) => {
      const p = row.alumniProfile || {};
      return {
        id: row._id.toString(),
        fullName: row.fullName || "",
        universityName: p.universityName ?? null,
        major: p.major ?? null,
        industry: p.industry ?? null,
        country: p.country ?? null,
        studyCountry: p.studyCountry ?? null,
        graduationYear: p.graduationYear ?? null,
        bio: p.bio ?? null,
        updatedAt: row.updatedAt ?? null,
        lastLoginAt: row.lastLoginAt ?? null,
        isVerifiedAlumni: p.isVerifiedAlumni === true,
        reputationScore: p.reputationScore ?? null,
      };
    });

    const scored = candidates
      .map((c) => {
        const { score, reasons } = scoreMentor(viewer, c, uid);
        return { ...c, matchScore: score, matchReasons: reasons };
      })
      .filter((x) => x.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 12);

    return NextResponse.json({
      ok: true,
      items: scored.map((x) => ({
        id: x.id,
        fullName: x.fullName,
        universityName: x.universityName,
        industry: x.industry,
        matchScore: x.matchScore,
        matchReasons: x.matchReasons,
      })),
    });
  } catch (error) {
    console.error("[GET /api/alumni/recommendations/network]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
