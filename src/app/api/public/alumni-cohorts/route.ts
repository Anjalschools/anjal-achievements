import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import AlumniCohort from "@/models/AlumniCohort";
import { blockIneligibleStudentOnPublicCommunityApi } from "@/lib/alumni/public-community-session-guard";
import { normalizeGraduationYearToNumber } from "@/lib/alumni/graduation-year-normalize";

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
    const [rawYears, cohortDocs] = await Promise.all([
      User.aggregate<{ _id: unknown; count: number }>([
        { $match: ALUMNI_MATCH },
        { $match: { "alumniProfile.graduationYear": { $exists: true, $nin: [null, ""] } } },
        {
          $group: {
            _id: "$alumniProfile.graduationYear",
            count: { $sum: 1 },
          },
        },
        { $limit: 200 },
      ]),
      AlumniCohort.find({}).select("graduationYear track stage label featured").sort({ graduationYear: -1 }).limit(200).lean(),
    ]);

    const merged = new Map<number, number>();
    for (const row of rawYears) {
      const y = normalizeGraduationYearToNumber(row._id);
      if (y == null) continue;
      merged.set(y, (merged.get(y) || 0) + row.count);
    }
    const years = [...merged.entries()]
      .sort((a, b) => b[1] - a[1] || b[0] - a[0])
      .slice(0, 80)
      .map(([year, count]) => ({ year, count }));

    return NextResponse.json({
      ok: true,
      years,
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
