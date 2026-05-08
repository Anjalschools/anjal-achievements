import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import {
  getAlumniFieldsCached,
  setAlumniFieldsCached,
} from "@/lib/alumni/alumni-public-cache";
import type { AlumniFieldsResponse } from "@/lib/alumni/alumni-public-types";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const CACHE_TTL_MS = 45_000;

const JSON_HEADERS = {
  headers: {
    "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=60",
  },
};

const EMPTY_RESPONSE: AlumniFieldsResponse = {
  ok: true,
  items: [],
};

const ALUMNI_SCOPE_FILTER = {
  $or: [{ accountType: "alumni" }, { "alumniProfile.isFeaturedAlumni": { $exists: true } }],
};

export async function GET() {
  try {
    const hit = getAlumniFieldsCached();
    if (hit) {
      return NextResponse.json(hit, JSON_HEADERS);
    }

    await connectDB();

    const rows = await User.aggregate<{ field: string; count: number }>([
      { $match: ALUMNI_SCOPE_FILTER },
      { $match: { "alumniProfile.industry": { $exists: true, $ne: "" } } },
      {
        $group: {
          _id: { $trim: { input: "$alumniProfile.industry" } },
          count: { $sum: 1 },
        },
      },
      { $match: { _id: { $ne: "" } } },
      { $project: { _id: 0, field: "$_id", count: 1 } },
      { $sort: { count: -1, field: 1 } },
      { $limit: 20 },
    ]);

    const body: AlumniFieldsResponse = {
      ok: true,
      items: rows.map((row) => ({
        field: row.field,
        count: Number(row.count ?? 0),
      })),
    };

    setAlumniFieldsCached(body, CACHE_TTL_MS);
    return NextResponse.json(body, JSON_HEADERS);
  } catch (error) {
    console.error("[GET /api/public/alumni-fields]", error);
    return NextResponse.json(EMPTY_RESPONSE, JSON_HEADERS);
  }
}
