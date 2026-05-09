import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const limit = Math.min(48, Math.max(1, Number(sp.get("limit")) || 16));

    await connectDB();

    const rows = await User.find({
      accountType: "alumni",
      $or: [
        { "alumniProfile.isDistinguishedAlumni": true },
        { "alumniProfile.isFeaturedAlumni": true },
        { "alumniProfile.isAmbassadorAlumni": true },
        { "alumniProfile.reputationScore": { $gte: 180 } },
      ],
    })
      .select(
        "fullName profilePhoto alumniProfile.currentCompany alumniProfile.currentPosition alumniProfile.universityName alumniProfile.isVerifiedAlumni alumniProfile.verificationTier alumniProfile.trustScore alumniProfile.reputationScore alumniProfile.isDistinguishedAlumni alumniProfile.isAmbassadorAlumni alumniProfile.isFeaturedAlumni alumniProfile.alumniServices"
      )
      .sort({ "alumniProfile.reputationScore": -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    const items = rows.map((row: any) => {
      const p = row.alumniProfile || {};
      return {
        id: row._id.toString(),
        fullName: row.fullName || "",
        profilePhoto: row.profilePhoto ?? null,
        universityName: p.universityName ?? null,
        company: p.currentCompany ?? null,
        position: p.currentPosition ?? null,
        reputationScore: p.reputationScore ?? 0,
        isVerifiedAlumni: p.isVerifiedAlumni === true,
        verificationTier:
          p.verificationTier === "basic" ||
          p.verificationTier === "academic" ||
          p.verificationTier === "career" ||
          p.verificationTier === "institution" ||
          p.verificationTier === "global"
            ? p.verificationTier
            : undefined,
        trustScore: typeof p.trustScore === "number" ? p.trustScore : null,
        isFeaturedAlumni: p.isFeaturedAlumni === true,
        isAmbassadorAlumni: p.isAmbassadorAlumni === true,
        isDistinguishedAlumni: p.isDistinguishedAlumni === true,
        mentoringAvailable: p.alumniServices?.mentoring === true,
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[GET /api/public/alumni/elite]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
