import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import Achievement from "@/models/Achievement";
import { achievementOwnerUserIdFilter } from "@/lib/achievement-student-scope";
import { countsTowardApprovedScore, resolveWorkflowDisplayStatus } from "@/lib/achievementWorkflow";
import { canStudentViewCertificate } from "@/lib/certificate-eligibility";
import { formatAchievementForDashboard } from "@/lib/dashboard-achievement-format";
import { getScoringConfig } from "@/lib/getScoringConfig";
import type { AchievementLabelLocale } from "@/lib/achievement-labels";
import { perfElapsed, perfLog, perfNow } from "@/lib/perf-debug";

export const dynamic = "force-dynamic";

const parseLocale = (request: NextRequest): AchievementLabelLocale => {
  const q = request.nextUrl.searchParams.get("locale");
  if (q === "ar" || q === "en") return q;
  return "en";
};

// GET unified dashboard payload (single round-trip for dashboard page)
export async function GET(request: NextRequest) {
  try {
    perfLog("page:dashboard:start");
    await connectDB();
    const tu = perfNow();
    const user = await getCurrentDbUser();
    perfElapsed("page:dashboard:getCurrentDbUser", tu);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized - Please login" }, { status: 401 });
    }

    const loc = parseLocale(request);
    const scoringConfig = await getScoringConfig();

    const tAch = perfNow();
    const achievements = await Achievement.find(achievementOwnerUserIdFilter(user._id))
      .select(
        [
          "featured",
          "score",
          "scoreBreakdown",
          "resultType",
          "medalType",
          "rank",
          "participationType",
          "requiresCommitteeReview",
          "createdAt",
          "date",
          "achievementYear",
          "achievementLevel",
          "level",
          "achievementType",
          "status",
          "approved",
          "isFeatured",
          "achievementCategory",
          "nameAr",
          "nameEn",
          "title",
          "titleAr",
          "achievementName",
          "customAchievementName",
          "inferredField",
          "domain",
          "olympiadMeeting",
          "programName",
          "competitionName",
          "resultValue",
          "verificationStatus",
          "approvalStatus",
          "pendingReReview",
          "certificateIssued",
          "certificateRevokedAt",
          "certificateVerificationToken",
        ].join(" ")
      )
      .sort({ createdAt: -1 })
      .lean();
    perfElapsed("page:dashboard:achievementsQuery", tAch);

    const list = achievements as unknown as Record<string, unknown>[];

    const totalAchievements = list.length;

    const approvedOnly = list.filter((a) => countsTowardApprovedScore(a));
    const points = approvedOnly.reduce(
      (s, a) => s + (Number(a.score) || 0),
      0
    );

    const certificatesIssued = list.filter((a) =>
      canStudentViewCertificate(a as Parameters<typeof canStudentViewCertificate>[0])
    ).length;

    const pendingReviewCount = list.filter((a) => {
      const w = resolveWorkflowDisplayStatus(a);
      return w === "pending" || w === "needs_revision" || w === "pending_re_review";
    }).length;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentPeriodCount = list.filter((a) => {
      if (!countsTowardApprovedScore(a)) return false;
      const safeDate =
        a.createdAt instanceof Date
          ? a.createdAt
          : a.date instanceof Date
            ? a.date
            : typeof a.achievementYear === "number"
              ? new Date(`${a.achievementYear}-01-01`)
              : null;
      return safeDate ? safeDate >= thirtyDaysAgo : false;
    }).length;

    const sortedForRecent = [...list].sort((a, b) => {
      const da =
        a.createdAt instanceof Date
          ? a.createdAt.getTime()
          : a.date instanceof Date
            ? a.date.getTime()
            : 0;
      const db =
        b.createdAt instanceof Date
          ? b.createdAt.getTime()
          : b.date instanceof Date
            ? b.date.getTime()
            : 0;
      return db - da;
    });

    const recentAchievements = sortedForRecent
      .slice(0, 3)
      .map((a) => formatAchievementForDashboard(a, loc, scoringConfig))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    const last = sortedForRecent[0];
    const lastFormatted = last ? formatAchievementForDashboard(last, loc, scoringConfig) : null;

    perfLog("page:dashboard:data=ok", { totalAchievements, points });

    return NextResponse.json({
      totalAchievements,
      points,
      certificatesIssued,
      pendingReviewCount,
      recentPeriodCount,
      participationCount: totalAchievements,
      lastAchievement: lastFormatted
        ? {
            id: lastFormatted.id,
            title: lastFormatted.title,
            date: lastFormatted.date,
          }
        : null,
      recentAchievements,
    });
  } catch (error) {
    console.error("[GET /api/user/dashboard]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
