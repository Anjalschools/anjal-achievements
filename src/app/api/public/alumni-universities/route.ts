import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import {
  getAlumniUniversitiesCached,
  setAlumniUniversitiesCached,
} from "@/lib/alumni/alumni-public-cache";
import type { AlumniUniversitiesResponse } from "@/lib/alumni/alumni-public-types";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const CACHE_TTL_MS = 45_000;

const JSON_HEADERS = {
  headers: {
    "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=60",
  },
};

const EMPTY_RESPONSE: AlumniUniversitiesResponse = {
  ok: true,
  items: [],
};

const ALUMNI_SCOPE_FILTER = {
  $or: [{ accountType: "alumni" }, { "alumniProfile.isFeaturedAlumni": { $exists: true } }],
};

export async function GET() {
  try {
    const hit = getAlumniUniversitiesCached();
    if (hit) {
      return NextResponse.json(hit, JSON_HEADERS);
    }

    await connectDB();

    const rows = await User.aggregate<{ name: string; count: number }>([
      { $match: ALUMNI_SCOPE_FILTER },
      { $match: { "alumniProfile.universityName": { $exists: true, $ne: "" } } },
      {
        $group: {
          _id: { $trim: { input: "$alumniProfile.universityName" } },
          count: { $sum: 1 },
        },
      },
      { $match: { _id: { $ne: "" } } },
      { $project: { _id: 0, name: "$_id", count: 1 } },
      { $sort: { count: -1, name: 1 } },
      { $limit: 20 },
    ]);

    const body: AlumniUniversitiesResponse = {
      ok: true,
      items: rows.map((row) => ({
        name: row.name,
        count: Number(row.count ?? 0),
      })),
    };

    setAlumniUniversitiesCached(body, CACHE_TTL_MS);
    return NextResponse.json(body, JSON_HEADERS);
  } catch (error) {
    console.error("[GET /api/public/alumni-universities]", error);
    return NextResponse.json(EMPTY_RESPONSE, JSON_HEADERS);
  }
}
