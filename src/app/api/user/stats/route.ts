import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import Achievement from "@/models/Achievement";
import { achievementOwnerUserIdFilter } from "@/lib/achievement-student-scope";
import { isFeaturedAchievement } from "@/lib/achievementFeatured";
import { countsTowardApprovedScore } from "@/lib/achievementWorkflow";

export const dynamic = "force-dynamic";

// GET user statistics
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    console.log("[GET /api/user/stats] Fetching current user stats from session");

    const user = await getCurrentDbUser();

    if (!user) {
      console.log("[GET /api/user/stats] No user found in session");
      return NextResponse.json(
        { error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    const userId = user._id.toString();
    console.log("[GET /api/user/stats] Found user:", userId);

    const achievements = await Achievement.find(achievementOwnerUserIdFilter(user._id))
      .select(
        "featured score resultType createdAt date achievementYear achievementLevel level achievementType status approved isFeatured achievementCategory"
      )
      .lean();

    const totalCount = achievements.length;

    const approvedOnly = achievements.filter((a) =>
      countsTowardApprovedScore(a as unknown as Record<string, unknown>)
    );
    const totalScore = approvedOnly.reduce(
      (s, a) => s + (Number((a as { score?: number }).score) || 0),
      0
    );

    const featuredCount = achievements.filter((a: any) => {
      if (!countsTowardApprovedScore(a as unknown as Record<string, unknown>)) return false;
      return isFeaturedAchievement(a as Record<string, unknown>);
    }).length;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentAchievementsCount = achievements.filter((a: any) => {
      if (!countsTowardApprovedScore(a as unknown as Record<string, unknown>)) return false;
      const safeDate =
        a.createdAt instanceof Date
          ? a.createdAt
          : a.date instanceof Date
            ? a.date
            : a.achievementYear
              ? new Date(`${a.achievementYear}-01-01`)
              : null;
      return safeDate ? safeDate >= thirtyDaysAgo : false;
    }).length;

    const participationCount = totalCount;

    // Calculate yearsActive from user.createdAt
    let yearsActive = 1;
    if (user.createdAt) {
      const yearsDiff = new Date().getFullYear() - new Date(user.createdAt).getFullYear();
      yearsActive = Math.max(1, yearsDiff);
    }

    const stats = {
      totalAchievements: totalCount,
      featuredAchievements: featuredCount,
      recentAchievementsCount,
      participationCount,
      yearsActive,
      totalScore,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
