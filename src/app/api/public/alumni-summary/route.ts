import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import {
  getAlumniSummaryCached,
  setAlumniSummaryCached,
} from "@/lib/alumni/alumni-public-cache";
import type { AlumniSummaryResponse } from "@/lib/alumni/alumni-public-types";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const CACHE_TTL_MS = 45_000;

const JSON_HEADERS = {
  headers: {
    "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=60",
  },
};

/** Alumni users: explicit account type or a non-empty alumni profile worth counting. */
const ALUMNI_SCOPE_FILTER = {
  $or: [
    { accountType: "alumni" },
    { "alumniProfile.graduationYear": { $exists: true } },
    { "alumniProfile.universityName": { $exists: true, $nin: [null, ""] } },
    { "alumniProfile.major": { $exists: true, $nin: [null, ""] } },
    { "alumniProfile.currentCompany": { $exists: true, $nin: [null, ""] } },
    { "alumniProfile.industry": { $exists: true, $nin: [null, ""] } },
    { "alumniProfile.bio": { $exists: true, $nin: [null, ""] } },
    { "alumniProfile.linkedinUrl": { $exists: true, $nin: [null, ""] } },
    { "alumniProfile.isFeaturedAlumni": true },
    { "alumniProfile.isVerifiedAlumni": true },
    { "alumniProfile.country": { $exists: true, $nin: [null, ""] } },
    { "alumniProfile.studyCountry": { $exists: true, $nin: [null, ""] } },
    { "alumniProfile.city": { $exists: true, $nin: [null, ""] } },
  ],
};

const EMPTY_STATS: AlumniSummaryResponse = {
  ok: true,
  stats: {
    totalAlumni: 0,
    universities: 0,
    countries: 0,
    companies: 0,
    globalParticipation: 0,
    mentorshipAvailable: 0,
    featuredAlumni: 0,
  },
};

export async function GET() {
  try {
    const hit = getAlumniSummaryCached();
    if (hit) {
      return NextResponse.json(hit, JSON_HEADERS);
    }

    await connectDB();

    const [counts] = await User.aggregate<AlumniSummaryResponse["stats"]>([
      { $match: ALUMNI_SCOPE_FILTER },
      {
        $facet: {
          totalAlumni: [{ $count: "count" }],
          universities: [
            { $match: { "alumniProfile.universityName": { $exists: true, $ne: "" } } },
            { $group: { _id: "$alumniProfile.universityName" } },
            { $count: "count" },
          ],
          countries: [
            {
              $addFields: {
                countryValue: {
                  $ifNull: ["$alumniProfile.country", "$alumniProfile.studyCountry"],
                },
              },
            },
            { $match: { countryValue: { $exists: true, $ne: "" } } },
            { $group: { _id: "$countryValue" } },
            { $count: "count" },
          ],
          featuredAlumni: [
            { $match: { "alumniProfile.isFeaturedAlumni": true } },
            { $count: "count" },
          ],
          companies: [
            { $match: { "alumniProfile.currentCompany": { $exists: true, $ne: "" } } },
            { $group: { _id: "$alumniProfile.currentCompany" } },
            { $count: "count" },
          ],
          mentorshipAvailable: [
            { $match: { "alumniProfile.alumniServices.mentoring": true } },
            { $count: "count" },
          ],
        },
      },
      {
        $project: {
          totalAlumni: { $ifNull: [{ $first: "$totalAlumni.count" }, 0] },
          universities: { $ifNull: [{ $first: "$universities.count" }, 0] },
          countries: { $ifNull: [{ $first: "$countries.count" }, 0] },
          featuredAlumni: { $ifNull: [{ $first: "$featuredAlumni.count" }, 0] },
          companies: { $ifNull: [{ $first: "$companies.count" }, 0] },
          globalParticipation: { $ifNull: [{ $first: "$globalParticipation.count" }, 0] },
          mentorshipAvailable: { $ifNull: [{ $first: "$mentorshipAvailable.count" }, 0] },
        },
      },
    ]);

    const body: AlumniSummaryResponse = {
      ok: true,
      stats: {
        totalAlumni: Number(counts?.totalAlumni ?? 0),
        universities: Number(counts?.universities ?? 0),
        countries: Number(counts?.countries ?? 0),
        companies: Number(counts?.companies ?? 0),
        globalParticipation: Number(counts?.globalParticipation ?? 0),
        mentorshipAvailable: Number(counts?.mentorshipAvailable ?? 0),
        featuredAlumni: Number(counts?.featuredAlumni ?? 0),
      },
    };

    setAlumniSummaryCached(body, CACHE_TTL_MS);
    return NextResponse.json(body, JSON_HEADERS);
  } catch (error) {
    console.error("[GET /api/public/alumni-summary]", error);
    return NextResponse.json(EMPTY_STATS, JSON_HEADERS);
  }
}
