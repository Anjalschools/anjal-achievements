import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { effectivePrivacy, isMentorDiscoverable } from "@/lib/alumni/privacy";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET() {
  try {
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
        "fullName alumniProfile.universityName alumniProfile.currentCompany alumniProfile.major alumniProfile.city alumniProfile.country alumniProfile.bio alumniProfile.graduationYear alumniProfile.linkedinUrl alumniProfile.privacySettings alumniProfile.alumniServices alumniProfile.isVerifiedAlumni alumniProfile.verificationTier alumniProfile.trustScore"
      )
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(80)
      .lean();

    const items = rows
      .filter((row: any) => isMentorDiscoverable(row.alumniProfile))
      .slice(0, 60)
      .map((row: any) => {
        const ap = row.alumniProfile || {};
        const e = effectivePrivacy(ap);
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
