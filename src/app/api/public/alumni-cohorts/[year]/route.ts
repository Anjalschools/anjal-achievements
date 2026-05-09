import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ year: string }> }) {
  try {
    const { year } = await params;
    const y = Number(year);
    if (!Number.isFinite(y)) return NextResponse.json({ error: "INVALID_YEAR" }, { status: 400 });

    await connectDB();
    const rows = await User.find({
      accountType: "alumni",
      "alumniProfile.graduationYear": y,
    })
      .select("fullName alumniProfile.universityName alumniProfile.currentCompany alumniProfile.major profilePhoto")
      .limit(48)
      .lean();

    return NextResponse.json({
      ok: true,
      year: y,
      items: rows.map((row: any) => ({
        id: row._id.toString(),
        fullName: row.fullName || "",
        universityName: row.alumniProfile?.universityName || "",
        company: row.alumniProfile?.currentCompany || "",
        major: row.alumniProfile?.major || "",
        profilePhoto: row.profilePhoto || null,
      })),
    });
  } catch (error) {
    console.error("[GET /api/public/alumni-cohorts/[year]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
