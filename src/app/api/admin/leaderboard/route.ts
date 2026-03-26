import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { getAdminLeaderboard, type LeaderboardSortKey } from "@/lib/leaderboard-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SORT_KEYS = new Set<LeaderboardSortKey>([
  "totalPoints",
  "achievementsCount",
  "latestAchievementDate",
]);

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  try {
    const sp = request.nextUrl.searchParams;
    const q = sp.get("q") || undefined;
    const gender = sp.get("gender");
    const grade = sp.get("grade") || undefined;
    const section = sp.get("section");
    const academicYear = sp.get("academicYear") || undefined;
    const page = Number(sp.get("page") || "1");
    const limit = Number(sp.get("limit") || "25");
    const sortByRaw = sp.get("sortBy") || "totalPoints";
    const sortOrderRaw = sp.get("sortOrder") || "desc";

    const sortBy = SORT_KEYS.has(sortByRaw as LeaderboardSortKey)
      ? (sortByRaw as LeaderboardSortKey)
      : "totalPoints";
    const sortOrder = sortOrderRaw === "asc" ? "asc" : "desc";

    const result = await getAdminLeaderboard({
      q,
      gender: gender === "male" || gender === "female" ? gender : undefined,
      grade,
      section: section === "arabic" || section === "international" ? section : undefined,
      academicYear,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      ok: true,
      items: result.items,
      summary: result.summary ?? null,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (e) {
    console.error("[GET /api/admin/leaderboard]", e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
