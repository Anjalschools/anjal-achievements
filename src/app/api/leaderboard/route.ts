import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard, parseLeaderboardAchievementTiersParam } from "@/lib/leaderboard-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const gender = sp.get("gender");
    const section = sp.get("section");
    const grade = sp.get("grade");
    const stageRaw = sp.get("stage");
    const stage =
      stageRaw === "primary" || stageRaw === "middle" || stageRaw === "secondary" ? stageRaw : undefined;
    const academicYear = sp.get("academicYear");
    const q = sp.get("q") || undefined;
    const page = Number(sp.get("page") || "1");
    const limit = Number(sp.get("limit") || "24");
    const achievementTiers =
      parseLeaderboardAchievementTiersParam(sp.get("achievementTiers")) ??
      parseLeaderboardAchievementTiersParam(sp.get("levels"));

    const result = await getLeaderboard({
      q,
      gender: gender === "male" || gender === "female" ? gender : undefined,
      section: section === "arabic" || section === "international" ? section : undefined,
      grade: grade || undefined,
      stage,
      achievementTiers,
      academicYear: academicYear || undefined,
      page,
      limit,
    });

    return NextResponse.json({
      ok: true,
      items: result.items.map((item) => ({
        userId: item.userId,
        rank: item.rank,
        totalPoints: item.totalPoints,
        achievementsCount: item.achievementsCount,
        fullName: item.fullName,
        fullNameAr: item.fullNameAr,
        fullNameEn: item.fullNameEn,
        profilePhoto: item.profilePhoto,
        grade: item.grade,
        gender: item.gender,
        section: item.section,
      })),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error("[GET /api/leaderboard]", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

