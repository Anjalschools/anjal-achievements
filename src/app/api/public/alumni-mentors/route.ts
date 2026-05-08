import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET() {
  try {
    await connectDB();
    const rows = await User.find(
      {
        accountType: "alumni",
        "alumniProfile.alumniServices.mentoring": true,
        "alumniProfile.isVerifiedAlumni": true,
      },
      {
        fullName: 1,
        "alumniProfile.universityName": 1,
        "alumniProfile.currentCompany": 1,
        "alumniProfile.major": 1,
        "alumniProfile.city": 1,
        "alumniProfile.country": 1,
        "alumniProfile.bio": 1,
        "alumniProfile.graduationYear": 1,
        "alumniProfile.linkedinUrl": 1,
      }
    )
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(60)
      .lean();

    return NextResponse.json({
      ok: true,
      items: rows.map((row: any) => ({
        id: row._id.toString(),
        fullName: row.fullName || "",
        universityName: row.alumniProfile?.universityName || null,
        company: row.alumniProfile?.currentCompany || null,
        expertise: row.alumniProfile?.major || null,
        city: row.alumniProfile?.city || null,
        country: row.alumniProfile?.country || null,
        bio: row.alumniProfile?.bio || null,
        graduationYear: row.alumniProfile?.graduationYear ?? null,
        linkedinUrl: row.alumniProfile?.linkedinUrl || null,
        mentoringAvailable: true,
      })),
    });
  } catch (error) {
    console.error("[GET /api/public/alumni-mentors]", error);
    return NextResponse.json({ ok: true, items: [] });
  }
}
