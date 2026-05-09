import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import AlumniCohort from "@/models/AlumniCohort";
import { blockIneligibleStudentOnPublicCommunityApi } from "@/lib/alumni/public-community-session-guard";

export const dynamic = "force-dynamic";
export const revalidate = 120;

const ALUMNI_MATCH = {
  $or: [{ accountType: "alumni" }, { "alumniProfile.graduationYear": { $exists: true } }],
};

export async function GET() {
  try {
    const blocked = await blockIneligibleStudentOnPublicCommunityApi();
    if (blocked) return blocked;
    await connectDB();
    const [fromUsers, cohortDocs] = await Promise.all([
      User.aggregate<{ _id: number; count: number }>([
        { $match: ALUMNI_MATCH },
        { $match: { "alumniProfile.graduationYear": { $type: "number" } } },
        {
          $group: {
            _id: "$alumniProfile.graduationYear",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 as const } },
        { $limit: 80 },
      ]),
      AlumniCohort.find({}).select("graduationYear track stage label featured").sort({ graduationYear: -1 }).limit(200).lean(),
    ]);

    return NextResponse.json({
      ok: true,
      years: fromUsers.map((y) => ({ year: y._id, count: y.count })),
      cohorts: cohortDocs.map((c: any) => ({
        graduationYear: c.graduationYear,
        track: c.track || "",
        stage: c.stage || "",
        label: c.label || "",
        featured: c.featured === true,
      })),
    });
  } catch (error) {
    console.error("[GET /api/public/alumni-cohorts]", error);
    return NextResponse.json({ ok: true, years: [], cohorts: [] });
  }
}
