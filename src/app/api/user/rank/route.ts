import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { getStudentRankSummary } from "@/lib/leaderboard-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (String(user.role) !== "student") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const summary = await getStudentRankSummary(String(user._id));
    return NextResponse.json({
      ok: true,
      totalPoints: summary.totalPoints,
      achievementsCount: summary.achievementsCount,
      rank: summary.rank,
      totalRankedStudents: summary.totalRankedStudents,
    });
  } catch (error) {
    console.error("[GET /api/user/rank]", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

