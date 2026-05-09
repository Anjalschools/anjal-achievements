import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireSessionUser } from "@/lib/alumni/require-alumni";
import { requireAlumniCommunityForAuthedUser } from "@/lib/alumni/require-alumni-community-access";
import { buildViewerMatchProfile } from "@/lib/alumni/matching/viewer-profile";
import { rankMentors, type MentorCandidate } from "@/lib/alumni/matching/mentor-matching";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireSessionUser();
  if (!gate.ok) return gate.response;
  const denied = requireAlumniCommunityForAuthedUser(gate.user);
  if (denied) return denied;

  try {
    await connectDB();
    const uid = String(gate.user._id);
    const me = await User.findById(uid)
      .select("alumniProfile lastLoginAt")
      .lean();
    const viewer = buildViewerMatchProfile(me as any, request.nextUrl.searchParams);

    const rows = await User.find({
      accountType: "alumni",
      "alumniProfile.alumniServices.mentoring": true,
      _id: { $ne: gate.user._id },
    })
      .select("fullName alumniProfile updatedAt lastLoginAt")
      .limit(100)
      .lean();

    const mentors: MentorCandidate[] = rows.map((row: any) => {
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

    const ranked = rankMentors(viewer, mentors, uid, 12);

    return NextResponse.json({
      ok: true,
      items: ranked.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        universityName: m.universityName,
        company: null,
        expertise: m.major,
        matchScore: m.matchScore,
        matchReasons: m.matchReasons,
      })),
    });
  } catch (error) {
    console.error("[GET /api/alumni/recommendations/mentors]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
