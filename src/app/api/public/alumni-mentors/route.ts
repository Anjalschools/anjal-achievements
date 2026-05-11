import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { computeAlumniBadgesLight } from "@/lib/alumni/compute-alumni-badges";
import { fetchMentorTrustStatsMap, mergeLastActivityIso } from "@/lib/alumni/mentor-trust-stats";
import { effectivePrivacy, isMentorDiscoverable } from "@/lib/alumni/privacy";
import { blockIneligibleStudentOnPublicCommunityApi } from "@/lib/alumni/public-community-session-guard";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET() {
  try {
    const blocked = await blockIneligibleStudentOnPublicCommunityApi();
    if (blocked) return blocked;
    await connectDB();
    const rows = await User.find({
      accountType: "alumni",
      "alumniProfile.alumniServices.mentoring": true,
      $nor: [
        { "alumniProfile.privacySettings.searchable": false },
        { "alumniProfile.privacySettings.publicProfile": false },
        { "alumniProfile.privacySettings.allowMentorshipRequests": false },
      ],
    })
      .select(
        "fullName lastLoginAt updatedAt alumniProfile.universityName alumniProfile.currentCompany alumniProfile.major alumniProfile.industry alumniProfile.interests alumniProfile.city alumniProfile.country alumniProfile.bio alumniProfile.graduationYear alumniProfile.linkedinUrl alumniProfile.privacySettings alumniProfile.alumniServices alumniProfile.isVerifiedAlumni alumniProfile.verificationTier alumniProfile.trustScore"
      )
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(80)
      .lean();

    const discoverable = rows.filter((row: any) => isMentorDiscoverable(row.alumniProfile)).slice(0, 60);
    const mentorIds = discoverable.map((row: any) => row._id as mongoose.Types.ObjectId);
    const statsMap = await fetchMentorTrustStatsMap(mentorIds);

    const items = discoverable.map((row: any) => {
      const ap = row.alumniProfile || {};
      const e = effectivePrivacy(ap);
      const interestList = Array.isArray(ap.interests) ? ap.interests : [];
      const expertiseAreas = [ap.major, ap.industry, ...interestList]
        .map((x: unknown) => (x != null ? String(x).trim() : ""))
        .filter(Boolean);
      const uniqueExpertise = [...new Set(expertiseAreas)].slice(0, 6);
      const st = statsMap.get(row._id.toString());
      return {
        id: row._id.toString(),
        fullName: row.fullName || "",
        universityName: ap.universityName || null,
        company: e.showCompany ? ap.currentCompany || null : null,
        expertise: ap.major || null,
        city: ap.city || null,
        country: ap.country || null,
        bio: ap.bio || null,
        graduationYear: ap.graduationYear ?? null,
        linkedinUrl: e.showLinkedIn ? ap.linkedinUrl || null : null,
        mentoringAvailable: true,
        isVerifiedAlumni: ap.isVerifiedAlumni === true,
        verificationTier:
          ap.verificationTier === "basic" ||
          ap.verificationTier === "academic" ||
          ap.verificationTier === "career" ||
          ap.verificationTier === "institution" ||
          ap.verificationTier === "global"
            ? ap.verificationTier
            : undefined,
        trustScore: typeof ap.trustScore === "number" ? ap.trustScore : null,
        trustBadges: computeAlumniBadgesLight({
          isVerifiedAlumni: ap.isVerifiedAlumni === true,
          mentoring: true,
          lastLoginAt: row.lastLoginAt ?? null,
          updatedAt: row.updatedAt ?? null,
        }),
        expertiseAreas: uniqueExpertise,
        mentorshipSessionCount: st?.mentorshipSessionCount ?? 0,
        responseRateApprox: st?.responseRateApprox ?? null,
        lastActivityAt: mergeLastActivityIso(st?.lastMentorshipActivityIso ?? null, row.lastLoginAt, row.updatedAt),
      };
    });

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (error) {
    console.error("[GET /api/public/alumni-mentors]", error);
    return NextResponse.json({ ok: true, items: [] });
  }
}
