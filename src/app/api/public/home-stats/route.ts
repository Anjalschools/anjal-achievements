import { NextResponse } from "next/server";
import { getPublicCache, setPublicCache } from "@/lib/home-stats-response-cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_TTL_MS = 45_000;

const JSON_HEADERS = {
  headers: {
    "Cache-Control": "no-store, max-age=0",
  },
};

export async function GET() {
  try {
    // Bootstrap: if SystemStats home doc is missing, updateHomeStats() creates it (was previously in instrumentation.ts).
    const cached = getPublicCache("home-stats");
    if (cached) {
      console.log("CACHE_FAST_PATH");
      return NextResponse.json(cached, JSON_HEADERS);
    }

    const connectDB = (await import("@/lib/mongodb")).default;
    const { default: SystemStats, SYSTEM_STATS_HOME_ID } = await import("@/models/SystemStats");
    const { updateHomeStats } = await import("@/lib/home-stats-service");

    await connectDB();

    let row = await SystemStats.findOne({ _id: SYSTEM_STATS_HOME_ID }).lean();

    if (!row) {
      console.log("HOME_STATS_SEED_FALLBACK");
      await updateHomeStats();
      row = await SystemStats.findOne({ _id: SYSTEM_STATS_HOME_ID }).lean();
    }

    if (!row) {
      return NextResponse.json(
        {
          ok: true,
          data: {
            studentsCount: 0,
            achievementsCount: 0,
            fieldsCount: 0,
            awardsCount: 50,
          },
        },
        JSON_HEADERS
      );
    }

    console.log("USING_SYSTEM_STATS");

    const body = {
      ok: true as const,
      data: {
        studentsCount: Number(row.studentsCount ?? 0),
        achievementsCount: Number(row.achievementsCount ?? 0),
        fieldsCount: Number(row.fieldsCount ?? 0),
        awardsCount: 50,
      },
    };
    setPublicCache("home-stats", body, CACHE_TTL_MS);
    return NextResponse.json(body, JSON_HEADERS);
  } catch (error) {
    console.error("[GET /api/public/home-stats]", error);
    return NextResponse.json(
      {
        ok: true,
        data: {
          studentsCount: 0,
          achievementsCount: 0,
          fieldsCount: 0,
          awardsCount: 50,
        },
      },
      { status: 200 }
    );
  }
}
